/**
 * One Clickz Bridge — Electron main process.
 *
 * Tray-only app (config window opens on demand). Auto-starts at Windows
 * login. Owns:
 *   - Logger (rotating file in %APPDATA%/OneClickzBridge/logs)
 *   - ConfigStore (%APPDATA%/OneClickzBridge/config.json)
 *   - SlotManager (one DICOM Storage SCP per enabled printer slot)
 *   - JobQueue (debounced by Study UID)
 *   - PrintWorker (renders DICOM to PNG and prints via Electron)
 */

const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, Notification, shell, dialog, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const { Logger } = require('./src/log/logger');
const { SlotHistory } = require('./src/log/slotHistory');
const { ConfigStore } = require('./src/config/store');
const { defaultSlot, validateSlot, newBrandingId } = require('./src/config/schema');
const { SlotManager } = require('./src/scp/slotManager');
const { JobQueue } = require('./src/print/jobQueue');
const { PrintWorker } = require('./src/print/printWorker');
const { ensureFirewallRules } = require('./src/firewall/addFirewallRule');
const { registerStartup, getStartupStatus } = require('./src/autostart/registerStartup');
const { parseStudyUid } = require('./src/render/dicomRender');
const { DEFAULT_BRANDING } = require('./src/config/defaultBranding');
const { encodeRequest, verifyVoucher, validateRechargePayload } = require('./src/license/offlineRecharge');

// --- Single instance lock ---
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}

// --- Paths ---
const userDataRoot = path.join(app.getPath('appData'), 'OneClickzBridge');
const logDir = path.join(userDataRoot, 'logs');
const historyDir = path.join(userDataRoot, 'history');
const configPath = path.join(userDataRoot, 'config.json');
const incomingRoot = path.join(userDataRoot, 'incoming');
const printedRoot = path.join(userDataRoot, 'printed');
const failedRoot = path.join(userDataRoot, 'failed');
const licenseFile = path.join(userDataRoot, '.license');
const trialFile = path.join(userDataRoot, '.trial');
const offlineRechargeFile = path.join(userDataRoot, 'offline-recharge-redemptions.json');
for (const d of [userDataRoot, logDir, historyDir, incomingRoot, printedRoot, failedRoot]) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

// ===== License & Trial System =====
const LICENSE_API_BASE = 'https://mehrgrewal.com/mediview/api';
const TRIAL_DAYS = 7;
/** Local install-trial print budget. Mirrors the viewer's TRIAL_PRINTS so
 *  an unactivated bridge has something to print with — the header shows
 *  "X prints left" out of the box, decrementing as jobs are processed. */
const TRIAL_PRINTS = 100;

function getFingerprint() {
  const os = require('os');
  const raw = [
    os.hostname(), os.platform(), os.arch(),
    os.cpus()[0]?.model || '', os.totalmem().toString(),
    (os.networkInterfaces()['Ethernet'] || os.networkInterfaces()['Wi-Fi'] || Object.values(os.networkInterfaces())[0] || [])
      .find(i => !i.internal && i.family === 'IPv4')?.mac || ''
  ].join('|');
  return crypto.createHash('sha256').update(raw).digest('hex').substring(0, 32);
}

function getLicenseData() {
  try {
    // Strip a leading BOM defensively — a BOM would otherwise make JSON.parse
    // throw and silently drop the user to "trial expired".
    if (fs.existsSync(licenseFile)) return JSON.parse(fs.readFileSync(licenseFile, 'utf8').replace(/^\uFEFF/, ''));
  } catch {}
  return null;
}

function saveLicenseData(data) {
  try { fs.writeFileSync(licenseFile, JSON.stringify(data, null, 2), 'utf8'); } catch {}
}

function clearLicenseData() {
  try { if (fs.existsSync(licenseFile)) fs.unlinkSync(licenseFile); } catch {}
}

function getTrialInfo() {
  let installDate, printsRemaining = TRIAL_PRINTS, printsTotal = TRIAL_PRINTS;
  try {
    if (fs.existsSync(trialFile)) {
      const data = JSON.parse(fs.readFileSync(trialFile, 'utf8'));
      installDate = new Date(data.installDate);
      if (Number.isFinite(data.printsRemaining)) printsRemaining = Math.max(0, data.printsRemaining);
      if (Number.isFinite(data.printsTotal)) printsTotal = Math.max(TRIAL_PRINTS, data.printsTotal);
    }
  } catch {}
  if (!installDate || isNaN(installDate.getTime())) {
    installDate = new Date();
    printsRemaining = TRIAL_PRINTS;
    printsTotal = TRIAL_PRINTS;
    saveTrialInfo({ installDate, printsRemaining, printsTotal });
  }
  const elapsed = Math.floor((Date.now() - installDate.getTime()) / (1000 * 60 * 60 * 24));
  const remaining = Math.max(0, TRIAL_DAYS - elapsed);
  return {
    remaining, expired: remaining <= 0, totalDays: TRIAL_DAYS,
    printsRemaining, printsTotal, installDate,
  };
}

function saveTrialInfo({ installDate, printsRemaining, printsTotal = TRIAL_PRINTS }) {
  try {
    fs.writeFileSync(trialFile, JSON.stringify({
      installDate: installDate.toISOString(),
      printsRemaining,
      printsTotal,
    }), 'utf8');
  } catch {}
}

function decrementTrialPrints(pages) {
  const t = getTrialInfo();
  const next = Math.max(0, t.printsRemaining - Math.max(1, parseInt(pages, 10) || 1));
  saveTrialInfo({ installDate: t.installDate, printsRemaining: next, printsTotal: t.printsTotal });
  return next;
}

const offlineRechargeChallenges = new Map();

function readOfflineRechargeRedemptions() {
  try {
    if (fs.existsSync(offlineRechargeFile)) {
      const parsed = JSON.parse(fs.readFileSync(offlineRechargeFile, 'utf8'));
      return {
        usedVoucherIds: Array.isArray(parsed.usedVoucherIds) ? parsed.usedVoucherIds : [],
      };
    }
  } catch {}
  return { usedVoucherIds: [] };
}

function saveOfflineRechargeRedemptions(data) {
  try {
    fs.writeFileSync(offlineRechargeFile, JSON.stringify(data, null, 2), 'utf8');
  } catch {}
}

function currentRechargeIdentity() {
  const lic = getLicenseData();
  return {
    fingerprint: getFingerprint(),
    licenseKey: lic?.licenseKey || 'TRIAL',
  };
}

// The expiry the bridge actually honours: the later of the server-issued
// expiry and any locally applied offline-recharge extension. Stored separately
// (offlineExpiresAt) so an online /license/validate can't erase a local top-up.
function effectiveExpiresAt(lic = getLicenseData()) {
  if (!lic) return null;
  const a = lic.expiresAt ? new Date(lic.expiresAt).getTime() : 0;
  const b = lic.offlineExpiresAt ? new Date(lic.offlineExpiresAt).getTime() : 0;
  const t = Math.max(a, b);
  return t > 0 ? new Date(t).toISOString() : null;
}

function createOfflineRechargeChallenge({ requestedPrints = 100, requestedDays = 0 } = {}) {
  const prints = Math.max(0, Math.floor(parseInt(requestedPrints, 10) || 0));
  const days = Math.max(0, Math.floor(parseInt(requestedDays, 10) || 0));
  const now = Date.now();
  const requestId = crypto.randomBytes(12).toString('hex');
  const identity = currentRechargeIdentity();
  const payload = {
    type: 'bridge-recharge-request',
    requestId,
    fingerprint: identity.fingerprint,
    licenseKey: identity.licenseKey,
    requestedPrints: prints,
    requestedDays: days,
    // Lets the admin tool compute an absolute new expiry from the current one.
    currentExpiresAt: effectiveExpiresAt(),
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 30 * 60 * 1000).toISOString(),
  };
  offlineRechargeChallenges.set(requestId, payload);
  return { ok: true, request: payload, code: encodeRequest(payload) };
}

function addOfflineRechargeCredit(prints) {
  const amount = Math.max(1, Math.floor(parseInt(prints, 10) || 0));
  const lic = getLicenseData();
  if (lic) {
    lic.quotaEnabled = true;
    lic.offlineQuotaCredit = Math.max(0, parseInt(lic.offlineQuotaCredit || 0, 10)) + amount;
    lic.offlineQuotaTotal = Math.max(0, parseInt(lic.offlineQuotaTotal || 0, 10)) + amount;
    saveLicenseData(lic);
    return {
      enabled: true,
      remaining: Math.max(0, parseInt(lic.quotaRemaining || 0, 10)) + lic.offlineQuotaCredit,
      total: Math.max(0, parseInt(lic.quotaTotal || 0, 10)) + lic.offlineQuotaTotal,
    };
  }

  const trial = getTrialInfo();
  const nextRemaining = trial.printsRemaining + amount;
  const nextTotal = trial.printsTotal + amount;
  saveTrialInfo({ installDate: trial.installDate, printsRemaining: nextRemaining, printsTotal: nextTotal });
  return { enabled: true, remaining: nextRemaining, total: nextTotal };
}

// Extend the license expiry the bridge honours, offline. Stored as a separate
// offlineExpiresAt so an online /license/validate sync can't shorten it; it
// only ever moves forward (monotonic).
function applyOfflineExpiry(newExpiresAt) {
  const lic = getLicenseData();
  const target = new Date(newExpiresAt).getTime();
  if (lic) {
    const current = lic.offlineExpiresAt ? new Date(lic.offlineExpiresAt).getTime() : 0;
    if (target > current) {
      lic.offlineExpiresAt = new Date(target).toISOString();
      lic.status = 'active';
      saveLicenseData(lic);
    }
  }
  return effectiveExpiresAt();
}

async function applyOfflineRechargeVoucher(voucher) {
  const verified = verifyVoucher(voucher);
  if (!verified.ok) return { ok: false, reason: verified.reason };

  const identity = currentRechargeIdentity();
  const v = validateRechargePayload(verified.payload, identity);
  if (!v.ok) return { ok: false, reason: v.reason };

  const p = verified.payload;
  const challenge = offlineRechargeChallenges.get(p.requestId);
  if (!challenge) return { ok: false, reason: 'request_not_found' };
  if (new Date(challenge.expiresAt).getTime() < Date.now()) {
    offlineRechargeChallenges.delete(p.requestId);
    return { ok: false, reason: 'request_expired' };
  }

  const redemptions = readOfflineRechargeRedemptions();
  if (redemptions.usedVoucherIds.includes(p.voucherId)) return { ok: false, reason: 'already_used' };
  redemptions.usedVoucherIds.push(p.voucherId);
  redemptions.usedVoucherIds = redemptions.usedVoucherIds.slice(-5000);
  saveOfflineRechargeRedemptions(redemptions);
  offlineRechargeChallenges.delete(p.requestId);

  // Apply whatever the voucher grants — prints, extra days, or both.
  let quota = { enabled: !!getLicenseData()?.quotaEnabled };
  if (v.prints > 0) quota = addOfflineRechargeCredit(v.prints);
  const expiresAt = v.newExpiresAt ? applyOfflineExpiry(v.newExpiresAt) : effectiveExpiresAt();

  const daysLeft = expiresAt
    ? Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000))
    : null;

  return {
    ok: true,
    ...quota,
    added: v.prints,
    addedExpiry: !!v.newExpiresAt,
    expiresAt,
    daysLeft,
  };
}

function bridgeApiRequest(endpoint, body) {
  const https = require('https');
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const urlObj = new URL(LICENSE_API_BASE + endpoint);
    const options = {
      hostname: urlObj.hostname, port: 443, path: urlObj.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch { resolve({ status: res.statusCode, data: { error: body } }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(data);
    req.end();
  });
}

async function activateBridgeLicense(licenseKey) {
  const fingerprint = getFingerprint();
  const os = require('os');
  try {
    const res = await bridgeApiRequest('/license/activate', {
      license_key: licenseKey, fingerprint,
      machine_name: os.hostname() + ' (Bridge)',
      os: `${os.platform()} ${os.release()}`,
      app: 'bridge',
      app_version: '1.0.0',
    });
    if (res.status >= 200 && res.status < 300) {
      saveLicenseData({
        licenseKey, fingerprint, deviceId: res.data.device_id,
        plan: res.data.plan || 'unknown', expiresAt: res.data.expires_at,
        activatedAt: new Date().toISOString(), lastValidated: new Date().toISOString(),
      });
      return { success: true, data: res.data };
    }
    return { success: false, error: res.data?.error || res.data?.message || 'Activation failed' };
  } catch (e) {
    return { success: false, error: 'Network error: ' + e.message };
  }
}

async function validateBridgeLicense() {
  const lic = getLicenseData();
  if (!lic) return { valid: false, reason: 'no_license' };
  try {
    const res = await bridgeApiRequest('/license/validate', {
      license_key: lic.licenseKey, fingerprint: lic.fingerprint, app: 'bridge',
    });
    if (res.data?.valid) {
      lic.lastValidated = new Date().toISOString();
      lic.plan = res.data.plan || lic.plan;
      lic.expiresAt = res.data.expires_at || lic.expiresAt;
      saveLicenseData(lic);
      return { valid: true, plan: lic.plan, expiresAt: lic.expiresAt };
    }
    // Server says the key is dead — purge the local cache so the bridge
    // stops claiming "license active / N prints left" against a deleted
    // or revoked key. Same hard-reject list as getCentralQuota.
    const hardReasons = ['not_found', 'revoked', 'deactivated', 'wrong_product', 'expired'];
    const reason = res.data?.reason || 'invalid';
    if (hardReasons.includes(reason)) {
      clearLicenseData();
    }
    return { valid: false, reason };
  } catch {
    if (lic.lastValidated) {
      const daysSince = (Date.now() - new Date(lic.lastValidated).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < 7) return { valid: true, plan: lic.plan, expiresAt: lic.expiresAt, offline: true };
    }
    return { valid: false, reason: 'network_error' };
  }
}

async function sendBridgeHeartbeat() {
  const lic = getLicenseData();
  if (!lic) return;
  try {
    await bridgeApiRequest('/license/heartbeat', {
      license_key: lic.licenseKey, fingerprint: lic.fingerprint, app_version: '1.0.0',
    });
  } catch {}
}

function getLicenseStatus() {
  const lic = getLicenseData();
  if (lic) {
    // Honour the later of server expiry and any offline-recharge extension.
    const expiresAt = effectiveExpiresAt(lic);
    let daysLeft = null;
    if (expiresAt) {
      daysLeft = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
    }
    return {
      type: 'licensed',
      licenseKey: lic.licenseKey,
      plan: lic.plan,
      expiresAt,
      lastValidated: lic.lastValidated,
      daysLeft,
      expired: daysLeft !== null && daysLeft <= 0,
      // Cached sell-by-print quota (refreshed by getCentralQuota / the UI poll).
      quotaEnabled:   !!lic.quotaEnabled,
      quotaRemaining: parseInt(lic.quotaRemaining || 0, 10),
      quotaTotal:     parseInt(lic.quotaTotal     || 0, 10),
    };
  }
  const trial = getTrialInfo();
  return { type: 'trial', remaining: trial.remaining, expired: trial.expired, totalDays: TRIAL_DAYS };
}

// ===== Central sell-by-print quota (shared with viewer + website) =====
// The bridge polls the same /license/quota endpoint the viewer uses so the
// header "X prints left" stays in sync across all software.  On every
// successful print the bridge decrements the central counter — local per-slot
// quotas (if the user has set any) keep working in parallel for back-compat.

async function getCentralQuota() {
  const lic = getLicenseData();
  if (!lic) {
    // No server license yet — surface the local install-trial budget so
    // the header shows "X prints left" without needing activation.
    const t = getTrialInfo();
    return {
      enabled:   true,
      remaining: t.printsRemaining,
      total:     t.printsTotal,
      valid:     !t.expired,
      reason:    'local_trial',
    };
  }
  const offlineCredit = Math.max(0, parseInt(lic.offlineQuotaCredit || 0, 10));
  const offlineTotal = Math.max(0, parseInt(lic.offlineQuotaTotal || 0, 10));
  try {
    const r = await bridgeApiRequest('/license/quota', {
      license_key: lic.licenseKey, fingerprint: lic.fingerprint, app: 'bridge',
    });
    if (r.status >= 200 && r.status < 300 && r.data && (r.data.ok || r.data.enabled !== undefined)) {
      lic.quotaEnabled   = !!r.data.enabled;
      lic.quotaRemaining = parseInt(r.data.remaining || 0, 10);
      lic.quotaTotal     = parseInt(r.data.total     || 0, 10);
      saveLicenseData(lic);
      return {
        enabled: lic.quotaEnabled || offlineCredit > 0,
        remaining: lic.quotaRemaining + offlineCredit,
        total: lic.quotaTotal + offlineTotal,
        valid: true,
        offlineCredit,
      };
    }
    // Hard server reject (key deleted on the server, revoked, or wrong product)
    // — purge the local cache so we don't keep showing a phantom "X prints left".
    const hardReasons = ['not_found', 'revoked', 'deactivated', 'wrong_product', 'expired'];
    if (r.status >= 200 && r.status < 300 && r.data?.reason && hardReasons.includes(r.data.reason)) {
      clearLicenseData();
      return { enabled: false, remaining: 0, total: 0, valid: false, reason: r.data.reason, invalidated: true };
    }
    return {
      enabled: !!lic.quotaEnabled || offlineCredit > 0,
      remaining: (lic.quotaRemaining || 0) + offlineCredit,
      total: (lic.quotaTotal || 0) + offlineTotal,
      valid: false,
      reason: r.data?.reason,
      offlineCredit,
    };
  } catch (e) {
    return {
      enabled: !!lic.quotaEnabled || offlineCredit > 0,
      remaining: (lic.quotaRemaining || 0) + offlineCredit,
      total: (lic.quotaTotal || 0) + offlineTotal,
      valid: true,
      offline: true,
      offlineCredit,
    };
  }
}

async function decrementCentralQuota(pages) {
  const lic = getLicenseData();
  if (!lic) {
    // Local trial — decrement the on-disk counter so the header reflects
    // the new value within the next poll tick.
    const remaining = decrementTrialPrints(pages);
    return { ok: true, enabled: true, remaining, total: getTrialInfo().printsTotal, source: 'local_trial' };
  }
  let remainingPages = Math.max(1, parseInt(pages, 10) || 1);
  const offlineCredit = Math.max(0, parseInt(lic.offlineQuotaCredit || 0, 10));
  if (offlineCredit > 0) {
    const usedOffline = Math.min(offlineCredit, remainingPages);
    lic.offlineQuotaCredit = offlineCredit - usedOffline;
    remainingPages -= usedOffline;
    saveLicenseData(lic);
    if (remainingPages <= 0) {
      return {
        ok: true,
        enabled: true,
        remaining: Math.max(0, parseInt(lic.quotaRemaining || 0, 10)) + lic.offlineQuotaCredit,
        total: Math.max(0, parseInt(lic.quotaTotal || 0, 10)) + Math.max(0, parseInt(lic.offlineQuotaTotal || 0, 10)),
        source: 'offline_recharge',
      };
    }
  }
  try {
    const r = await bridgeApiRequest('/license/quota', {
      license_key: lic.licenseKey, fingerprint: lic.fingerprint, app: 'bridge',
      decrement: remainingPages,
    });
    if (r.status >= 200 && r.status < 300) {
      lic.quotaEnabled   = !!r.data.enabled;
      lic.quotaRemaining = parseInt(r.data.remaining || 0, 10);
      lic.quotaTotal     = parseInt(r.data.total     || 0, 10);
      saveLicenseData(lic);
      const localCredit = Math.max(0, parseInt(lic.offlineQuotaCredit || 0, 10));
      const localTotal = Math.max(0, parseInt(lic.offlineQuotaTotal || 0, 10));
      return {
        ok: true,
        enabled: lic.quotaEnabled || localCredit > 0,
        remaining: lic.quotaRemaining + localCredit,
        total: lic.quotaTotal + localTotal,
      };
    }
    return { ok: false, reason: r.data?.error || 'rejected', status: r.status };
  } catch (e) {
    return { ok: false, reason: 'network', message: e.message };
  }
}

// --- Singletons ---
const logger = new Logger({ logDir });
const slotHistory = new SlotHistory({ historyRoot: historyDir, logger });
const config = new ConfigStore({ configPath, logger });
let printWorker = null;
let jobQueue = null;
let slotManager = null;
let tray = null;
let configWindow = null;

// --- Startup helpers ---
function isHiddenLaunch() {
  return process.argv.includes('--hidden');
}

function buildTrayMenu(slotStatus) {
  const slotItems = (slotStatus || []).map((s) => ({
    label: `${s.aeTitle} :${s.port} ${s.listening ? '●' : '○'}`,
    enabled: false,
  }));
  return Menu.buildFromTemplate([
    { label: 'One Clickz Bridge', enabled: false },
    { type: 'separator' },
    ...(slotItems.length ? slotItems : [{ label: 'No slots configured', enabled: false }]),
    { type: 'separator' },
    { label: 'Open Config…', click: openConfigWindow },
    { label: 'Open Logs Folder', click: () => shell.openPath(logDir) },
    { label: 'Open Storage Folder', click: () => shell.openPath(userDataRoot) },
    { type: 'separator' },
    { label: 'Quit One Clickz Bridge', click: () => quitApp() },
  ]);
}

function refreshTray() {
  if (!tray) return;
  const status = slotManager ? slotManager.getStatus() : [];
  tray.setContextMenu(buildTrayMenu(status));
  const enabled = status.filter((s) => s.listening).length;
  tray.setToolTip(`One Clickz Bridge — ${enabled} slot${enabled === 1 ? '' : 's'} listening`);
}

function setupTray() {
  const iconPath = path.join(__dirname, 'icon.ico');
  const icon = fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : nativeImage.createEmpty();
  tray = new Tray(icon);
  tray.setToolTip('One Clickz Bridge');
  tray.on('click', openConfigWindow);
  tray.on('double-click', openConfigWindow);
  refreshTray();
}

// Loads the renderer content into the given window. Extracted so it can be
// reused for the initial load AND for recovery reloads (white-screen fix).
function loadConfigUI(win) {
  const isDev = process.argv.includes('--dev');
  if (isDev && process.env.BRIDGE_UI_URL) {
    win.loadURL(process.env.BRIDGE_UI_URL);
  } else if (isDev) {
    win.loadURL('http://localhost:5174/');
  } else {
    win.loadFile(path.join(__dirname, 'ui', 'dist', 'index.html'));
  }
}

function isDevMode() {
  return process.argv.includes('--dev');
}

function hardenWindow(win, { allowDevTools = isDevMode(), allowFileNavigation = false } = {}) {
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, url) => {
    if (allowFileNavigation && String(url).startsWith('file://')) return;
    if (isDevMode() && /^https?:\/\/(localhost|127\.0\.0\.1):5174\//i.test(url)) return;
    event.preventDefault();
  });
  if (!allowDevTools) {
    win.webContents.on('devtools-opened', () => {
      try { win.webContents.closeDevTools(); } catch {}
    });
    win.webContents.on('before-input-event', (event, input) => {
      const key = String(input.key || '').toUpperCase();
      const blocked =
        key === 'F12' ||
        ((input.control || input.meta) && input.shift && ['I', 'J', 'C'].includes(key));
      if (blocked) event.preventDefault();
    });
  }
}

function openConfigWindow() {
  if (configWindow && !configWindow.isDestroyed()) {
    // Recover from a white screen: if the renderer crashed or never mounted
    // React (#root empty), force a reload before showing. This is what made
    // a stale/hung instance show blank when a 2nd launch signalled it.
    configWindow.webContents.executeJavaScript(
      "(() => { const r = document.getElementById('root'); return r ? r.children.length : -1; })()"
    ).then((n) => {
      if (!Number.isFinite(n) || n <= 0) {
        logger.warn(`[UI] stale window had empty #root (n=${n}); reloading`);
        loadConfigUI(configWindow);
      }
    }).catch(() => {
      // executeJavaScript throwing means the renderer is gone — reload it.
      logger.warn('[UI] window probe failed; reloading renderer');
      try { loadConfigUI(configWindow); } catch {}
    });
    configWindow.show();
    configWindow.focus();
    return;
  }
  configWindow = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 900,
    minHeight: 600,
    show: false,
    icon: path.join(__dirname, 'icon.ico'),
    title: 'One Clickz Bridge',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: isDevMode(),
      sandbox: false,
    },
  });
  hardenWindow(configWindow, { allowDevTools: isDevMode(), allowFileNavigation: true });

  // Surface preload + console failures to the log so a blank window is
  // never a mystery.
  configWindow.webContents.on('preload-error', (_e, preloadPath, err) => {
    logger.error(`[UI] preload-error path=${preloadPath} err=${err?.message || err}`);
  });
  configWindow.webContents.on('console-message', (_e, level, message, line, sourceId) => {
    // level: 0=log 1=warn 2=error 3=info — only surface warn/error to the log.
    if (level >= 1) {
      logger.error(`[UI console] ${message} (${sourceId}:${line})`);
    }
  });

  // ── White-screen self-recovery ──────────────────────────────
  // If the renderer crashes or a load fails, reload once after a short
  // delay rather than leaving a blank window the user has to kill/restart.
  let reloadAttempts = 0;
  configWindow.webContents.on('render-process-gone', (_e, details) => {
    logger.error(`[UI] render-process-gone reason=${details.reason}; reloading`);
    if (reloadAttempts++ < 3 && configWindow && !configWindow.isDestroyed()) {
      setTimeout(() => { try { loadConfigUI(configWindow); } catch {} }, 400);
    }
  });
  configWindow.webContents.on('did-fail-load', (_e, code, desc, url, isMainFrame) => {
    logger.error(`[UI] did-fail-load code=${code} desc=${desc} url=${url}`);
    // -3 = ERR_ABORTED (benign, e.g. a redirect); don't retry those.
    if (isMainFrame && code !== -3 && reloadAttempts++ < 3 && configWindow && !configWindow.isDestroyed()) {
      setTimeout(() => { try { loadConfigUI(configWindow); } catch {} }, 600);
    }
  });

  loadConfigUI(configWindow);

  configWindow.once('ready-to-show', () => configWindow.show());
  // Fallback: some renderer states never emit ready-to-show. Force-show
  // after 4s so the window can't get stuck invisible.
  setTimeout(() => {
    if (configWindow && !configWindow.isDestroyed() && !configWindow.isVisible()) {
      configWindow.show();
    }
  }, 4000);

  // One-time mount probe (temporary diagnostic): log whether React actually
  // rendered into #root so a "white screen" can be distinguished from a
  // window that opened before the bundle finished.
  configWindow.webContents.once('did-finish-load', () => {
    configWindow.webContents.executeJavaScript(
      "(() => { const r = document.getElementById('root'); return r ? r.children.length : -1; })()"
    ).then((n) => {
      logger.info(`[UI] mount probe: #root child count = ${n}`);
    }).catch((e) => logger.error(`[UI] mount probe failed: ${e?.message || e}`));
  });

  configWindow.on('close', (e) => {
    // Hide instead of close, keep tray running
    if (!app.isQuitting) {
      e.preventDefault();
      configWindow.hide();
    }
  });
}

function quitApp() {
  app.isQuitting = true;
  if (slotManager) slotManager.stopAll();
  if (tray) tray.destroy();
  if (configWindow && !configWindow.isDestroyed()) configWindow.destroy();
  logger.close();
  app.quit();
}

// --- Apply config: sync SCPs and firewall rules to current slot list ---
async function applyConfig() {
  const cfg = config.get();
  const enabled = cfg.slots.filter((s) => s.enabled);
  ensureFirewallRules(enabled.map((s) => s.port), logger);
  await slotManager.syncFromConfig(cfg.slots);
  refreshTray();
}

// --- IPC handlers ---
function setupIpc() {
  ipcMain.handle('bridge:get-config', () => config.get());

  ipcMain.handle('bridge:set-startup-behavior', (_e, mode) => {
    config.update({ startupBehavior: mode });
    return config.get();
  });

  ipcMain.handle('bridge:upsert-slot', async (_e, slot) => {
    const errors = validateSlot(slot);
    if (errors.length) return { ok: false, errors };
    config.upsertSlot(slot);
    await applyConfig();
    return { ok: true, config: config.get() };
  });

  ipcMain.handle('bridge:remove-slot', async (_e, slotId) => {
    config.removeSlot(slotId);
    await applyConfig();
    return { ok: true, config: config.get() };
  });

  ipcMain.handle('bridge:new-slot', () => {
    const cfg = config.get();
    const idx = cfg.slots.length + 1;
    return defaultSlot(idx);
  });

  ipcMain.handle('bridge:apply-config', async () => {
    await applyConfig();
    return { ok: true };
  });

  ipcMain.handle('bridge:get-system-printers', async () => {
    try {
      const win = configWindow && !configWindow.isDestroyed() ? configWindow : new BrowserWindow({ show: false });
      const printers = await win.webContents.getPrintersAsync();
      const tempCreated = win !== configWindow;
      if (tempCreated) win.destroy();
      return {
        success: true,
        printers: printers.map((p) => ({
          name: p.name,
          displayName: p.displayName || p.name,
          description: p.description || '',
          status: p.status,
          isDefault: p.isDefault,
        })),
      };
    } catch (e) {
      return { success: false, error: e.message, printers: [] };
    }
  });

  ipcMain.handle('bridge:get-slot-status', () => slotManager ? slotManager.getStatus() : []);

  ipcMain.handle('bridge:get-startup-status', () => getStartupStatus(app));

  // Enumerate non-internal IPv4 addresses on the host so the UI can show
  // "send DICOM to <ip>:<port>". Typically returns one address (Ethernet or
  // Wi-Fi); multi-NIC machines get the full list.
  ipcMain.handle('bridge:get-local-ips', () => {
    const os = require('os');
    const ifs = os.networkInterfaces();
    const ips = [];
    for (const name of Object.keys(ifs)) {
      for (const ni of ifs[name] || []) {
        if (ni.family === 'IPv4' && !ni.internal) {
          ips.push({ iface: name, address: ni.address });
        }
      }
    }
    return ips;
  });

  ipcMain.handle('bridge:get-log-tail', (_e, n) => logger.tail(n || 500));

  // Per-slot print history (UI filters with daily / monthly / yearly buttons).
  ipcMain.handle('bridge:get-slot-history', (_e, { slotId, fromTs, toTs, limit } = {}) => {
    if (!slotId) return [];
    return slotHistory.read(slotId, { fromTs, toTs, limit });
  });

  // Quota mutation (password-gated in the UI).
  ipcMain.handle('bridge:set-slot-quota', (_e, { slotId, quotaEnabled, quotaRemaining, quotaTotal } = {}) => {
    if (!slotId) return { ok: false, error: 'slotId required' };
    const patch = {};
    if (typeof quotaEnabled   === 'boolean') patch.quotaEnabled   = quotaEnabled;
    if (Number.isFinite(quotaRemaining))    patch.quotaRemaining = Math.max(0, Math.floor(quotaRemaining));
    if (Number.isFinite(quotaTotal))        patch.quotaTotal     = Math.max(0, Math.floor(quotaTotal));
    const slot = config.patchSlot(slotId, patch);
    if (configWindow && !configWindow.isDestroyed()) {
      configWindow.webContents.send('bridge:config-changed', config.get());
    }
    return { ok: !!slot, slot };
  });

  // --- Branding IPC ---
  // Notify any open config window so other views refresh after a change.
  const broadcastConfig = () => {
    if (configWindow && !configWindow.isDestroyed()) {
      configWindow.webContents.send('bridge:config-changed', config.get());
    }
  };

  // Save (update or insert) a single branding, identified by `branding.id`.
  // With no id it falls back to the default branding.
  ipcMain.handle('bridge:save-branding', async (_e, branding) => {
    const cfg = config.get();
    const list = Array.isArray(cfg.brandings) ? [...cfg.brandings] : [];
    const id = (branding && branding.id) || cfg.defaultBrandingId;
    const idx = list.findIndex((b) => b.id === id);
    const name = (branding && branding.name) || (idx >= 0 ? list[idx].name : 'Default');
    const merged = { ...DEFAULT_BRANDING, ...branding, id, name };
    if (idx >= 0) list[idx] = merged; else list.push(merged);
    config.update({ brandings: list });
    broadcastConfig();
    return merged;
  });

  // Create a new branding, optionally duplicating an existing one.
  ipcMain.handle('bridge:create-branding', async (_e, { name, copyFromId } = {}) => {
    const cfg = config.get();
    const list = Array.isArray(cfg.brandings) ? [...cfg.brandings] : [];
    const src = copyFromId ? list.find((b) => b.id === copyFromId) : null;
    const base = src ? { ...src } : { ...DEFAULT_BRANDING };
    delete base.id; delete base.name;
    const id = newBrandingId();
    const entry = { ...DEFAULT_BRANDING, ...base, id, name: (name && String(name).trim()) || `Branding ${list.length + 1}` };
    list.push(entry);
    const patch = { brandings: list };
    if (!cfg.defaultBrandingId) patch.defaultBrandingId = id;
    config.update(patch);
    broadcastConfig();
    return entry;
  });

  // Delete a branding. The last remaining one can't be deleted. The default
  // pointer and any slots using it fall back to the first remaining branding.
  ipcMain.handle('bridge:delete-branding', async (_e, { id } = {}) => {
    const cfg = config.get();
    const list = Array.isArray(cfg.brandings) ? [...cfg.brandings] : [];
    if (list.length <= 1) return { ok: false, error: 'At least one branding is required', config: cfg };
    const idx = list.findIndex((b) => b.id === id);
    if (idx < 0) return { ok: false, error: 'Branding not found', config: cfg };
    list.splice(idx, 1);
    const patch = { brandings: list };
    if (cfg.defaultBrandingId === id) patch.defaultBrandingId = list[0].id;
    patch.slots = (cfg.slots || []).map((s) => (s.brandingId === id ? { ...s, brandingId: null } : s));
    config.update(patch);
    broadcastConfig();
    return { ok: true, config: config.get() };
  });

  ipcMain.handle('bridge:pick-and-encode-logo', async () => {
    const r = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'svg', 'webp'] }],
    });
    if (r.canceled || !r.filePaths[0]) return null;
    const buf = await fs.promises.readFile(r.filePaths[0]);
    if (buf.length > 1_000_000) throw new Error('Logo must be under 1 MB');
    const ext = path.extname(r.filePaths[0]).slice(1).toLowerCase();
    const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
    return `data:${mime};base64,${buf.toString('base64')}`;
  });

  ipcMain.handle('bridge:hide-to-tray', () => {
    if (configWindow && !configWindow.isDestroyed()) configWindow.hide();
  });

  ipcMain.handle('bridge:quit-app', () => quitApp());

  // --- License IPC ---
  ipcMain.handle('bridge:get-license-status', () => getLicenseStatus());

  // Central sell-by-print quota — same endpoint the viewer uses, so the
  // header count stays in sync across viewer, website, and bridge.
  ipcMain.handle('bridge:get-license-quota', async () => getCentralQuota());
  ipcMain.handle('bridge:get-offline-recharge-challenge', async (_e, args = {}) =>
    createOfflineRechargeChallenge(args)
  );
  ipcMain.handle('bridge:apply-offline-recharge-voucher', async (_e, { voucher } = {}) => {
    const result = await applyOfflineRechargeVoucher(voucher);
    if (result.ok && configWindow && !configWindow.isDestroyed()) {
      configWindow.webContents.send('bridge:quota-changed', {
        enabled: result.enabled,
        remaining: result.remaining,
        total: result.total,
      });
    }
    return result;
  });

  ipcMain.handle('bridge:activate-license', async (_e, licenseKey) => {
    return await activateBridgeLicense(licenseKey);
  });

  ipcMain.handle('bridge:validate-license', async () => {
    return await validateBridgeLicense();
  });

  ipcMain.handle('bridge:deactivate-license', async () => {
    const lic = getLicenseData();
    if (lic) {
      try {
        await bridgeApiRequest('/license/deactivate', {
          license_key: lic.licenseKey, fingerprint: lic.fingerprint,
        });
      } catch {}
      clearLicenseData();
    }
    return { success: true };
  });

  ipcMain.handle('bridge:get-fingerprint', () => getFingerprint());

  ipcMain.handle('bridge:get-trial-info', () => getTrialInfo());

  // ── Auto-update ────────────────────────────────────────────────────────
  // Poll the website for the newest Bridge release on launch + every 30 min.
  // If force_update is on, surface a system notification AND open the config
  // window with a non-dismissible update modal.
  ipcMain.handle('bridge:check-for-update', () => checkBridgeForUpdate());
  ipcMain.handle('bridge:get-update-info',  () => LAST_BRIDGE_RELEASE);
  ipcMain.handle('bridge:download-and-install-update', async (_e, { downloadUrl } = {}) => {
    if (!downloadUrl) return { ok: false, error: 'No download URL' };
    const https = require('https');
    const tmpDir = app.getPath('temp');
    const dest   = path.join(tmpDir, `oneclickz-bridge-update-${Date.now()}.exe`);
    return await new Promise((resolve) => {
      const file = fs.createWriteStream(dest);
      const get  = (link) => https.get(link, (res) => {
        if ([301,302,303,307,308].includes(res.statusCode) && res.headers.location) return get(res.headers.location);
        if (res.statusCode !== 200) { file.close(); fs.unlink(dest, () => {}); return resolve({ ok: false, error: 'HTTP ' + res.statusCode }); }
        res.pipe(file);
        file.on('finish', () => file.close(() => {
          shell.openPath(dest).then((err) => {
            if (err) resolve({ ok: false, error: err });
            else { resolve({ ok: true }); setTimeout(() => app.quit(), 1500); }
          });
        }));
      });
      get(downloadUrl);
    });
  });

  // Forward log lines to renderer for the live tail viewer
  logger.on('line', (line) => {
    if (configWindow && !configWindow.isDestroyed()) {
      configWindow.webContents.send('bridge:log-line', line);
    }
  });
}

// Bridge auto-update helper (defined at top-level so app.whenReady can call it too).
let LAST_BRIDGE_RELEASE = null;
async function checkBridgeForUpdate() {
  const https = require('https');
  const cur   = (app.getVersion && app.getVersion()) || '0.0.0';
  const url   = LICENSE_API_BASE + '/release/check?app=bridge&current=' + encodeURIComponent(cur);
  return await new Promise((resolve) => {
    try {
      const u   = new URL(url);
      const req = https.request({ hostname: u.hostname, port: 443, path: u.pathname + u.search, method: 'GET' }, (res) => {
        let body = '';
        res.on('data', (c) => body += c);
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            LAST_BRIDGE_RELEASE = data;
            if (data?.has_update) {
              try {
                if (Notification.isSupported()) {
                  new Notification({
                    title: data.force_update ? 'Required Bridge update' : 'Bridge update available',
                    body:  `v${data.latest_version} is out — click to install.`,
                  }).on('click', () => showConfigWindow()).show();
                }
              } catch {}
              // If forced and the config window is already open, push it the news.
              if (configWindow && !configWindow.isDestroyed()) {
                configWindow.webContents.send('bridge:update-info', data);
              } else if (data.force_update) {
                // Open the config window so the user CAN'T miss the prompt.
                try { showConfigWindow(); } catch {}
              }
            }
            resolve(data);
          } catch { resolve(null); }
        });
      });
      req.on('error', () => resolve(null));
      req.setTimeout(15000, () => { req.destroy(); resolve(null); });
      req.end();
    } catch { resolve(null); }
  });
}

function notifySlotEvent(type, payload) {
  if (configWindow && !configWindow.isDestroyed()) {
    configWindow.webContents.send('bridge:slot-event', { type, payload, ts: Date.now() });
  }
  refreshTray();
}

// --- Lifecycle ---
app.whenReady().then(async () => {
  logger.info(`[Boot] One Clickz Bridge starting (hidden=${isHiddenLaunch()})`);

  // --- License check ---
  const lic = getLicenseData();
  let licenseValid = false;
  if (lic) {
    const result = await validateBridgeLicense();
    licenseValid = result.valid;
    if (!licenseValid) {
      logger.warn(`[License] Validation failed: ${result.reason}`);
      clearLicenseData();
    } else {
      // Start heartbeat
      setInterval(sendBridgeHeartbeat, 30 * 60 * 1000);
    }
  }
  if (!licenseValid && !lic) {
    const trial = getTrialInfo();
    if (trial.expired) {
      logger.error('[License] Trial expired, no license key. UI will show activation page.');
    } else {
      licenseValid = true;
      logger.info(`[License] Trial mode: ${trial.remaining} days remaining`);
    }
  }

  // Always register auto-start unless user opts out
  registerStartup(app, true);

  // Auto-update poll: first check 5s after boot, then every 30 min.
  setTimeout(checkBridgeForUpdate, 5000);
  setInterval(checkBridgeForUpdate, 30 * 60 * 1000);

  printWorker = new PrintWorker({ logger, configStore: config });
  jobQueue = new JobQueue({
    logger,
    parseStudyUid,
    printWorker,
    printedRoot,
    failedRoot,
  });
  jobQueue.on('printed', (job) => {
    logger.info(`[Job] printed slot=${job.slot.name} pages=${job.result.pages}`);
    notifySlotEvent('printed', { slotId: job.slot.id, pages: job.result.pages, layoutId: job.result.layoutId });
    slotHistory.record(job.slot.id, {
      kind: 'printed',
      slotName: job.slot.name,
      printer: job.slot.windowsPrinterName || '',
      paperSize: job.slot.paperSize || '',
      aeTitle: job.slot.aeTitle,
      port: job.slot.port,
      pages: job.result.pages,
      layoutId: job.result.layoutId,
      patientName: job.result.patientName || job.patientName || '',
      patientId:   job.result.patientId   || job.patientId   || '',
      modality:    job.result.modality    || job.modality    || '',
      studyUid:    job.studyUid || (job.result && job.result.studyUid) || '',
    });

    // Decrement the slot's print quota when it's enabled. Each page counts.
    const cur = config.get().slots.find((s) => s.id === job.slot.id);
    if (cur && cur.quotaEnabled) {
      const pages = Math.max(1, parseInt(job.result.pages || 1, 10));
      const before = cur.quotaRemaining || 0;
      const after  = Math.max(0, before - pages);
      config.patchSlot(job.slot.id, { quotaRemaining: after });
      // Fire warning at <= 50, separate notice at 0.
      if (Notification.isSupported() && after === 0) {
        new Notification({
          title: 'One Clickz Bridge — quota exhausted',
          body: `${job.slot.name}: print quota is 0. Printing is now paused for this slot.`,
        }).show();
      } else if (Notification.isSupported() && before > 50 && after <= 50) {
        new Notification({
          title: 'One Clickz Bridge — low quota',
          body: `${job.slot.name}: only ${after} prints remaining. Top up soon.`,
        }).show();
      }
      // Push the updated slot to renderer so the card UI refreshes.
      if (configWindow && !configWindow.isDestroyed()) {
        configWindow.webContents.send('bridge:config-changed', config.get());
      }
    }

    // Central sell-by-print quota — only decrement when quota mode is ON.
    // When quota is off, printing is unlimited — no server call needed.
    const pagesPrinted = Math.max(1, parseInt(job.result.pages || 1, 10));
    const licData = getLicenseData();
    const centralQuotaOn = licData
      ? (!!licData.quotaEnabled || Math.max(0, parseInt(licData.offlineQuotaCredit || 0, 10)) > 0)
      : true; // trial = always on
    if (centralQuotaOn) {
      decrementCentralQuota(pagesPrinted).then((q) => {
      if (q && q.ok && configWindow && !configWindow.isDestroyed()) {
        // Tell the renderer to refetch quota immediately for live UI.
        configWindow.webContents.send('bridge:quota-changed', {
          enabled: q.enabled, remaining: q.remaining, total: q.total,
        });
      }
      if (q && q.ok && q.enabled && Notification.isSupported()) {
        if (q.remaining === 0) {
          new Notification({
            title: 'One Clickz Bridge — print quota exhausted',
            body: 'Central print balance is 0. Top up to resume printing.',
          }).show();
        } else if (q.remaining <= 50) {
          new Notification({
            title: 'One Clickz Bridge — low print quota',
            body: `${q.remaining} prints remaining across all software.`,
          }).show();
        }
      }
    }).catch(() => {});
    } // end centralQuotaOn

    if (Notification.isSupported()) {
      new Notification({
        title: 'One Clickz Bridge — sent to printer',
        body: `${job.slot.name}: ${job.result.pages} page(s) sent to printer (${job.result.layoutId})`,
      }).show();
    }
  });
  jobQueue.on('failed', (job) => {
    notifySlotEvent('failed', { slotId: job.slot.id, error: job.error });
    slotHistory.record(job.slot.id, {
      kind: 'failed',
      slotName: job.slot.name,
      printer: job.slot.windowsPrinterName || '',
      paperSize: job.slot.paperSize || '',
      aeTitle: job.slot.aeTitle,
      port: job.slot.port,
      error: job.error,
      studyUid: job.studyUid || '',
    });
    if (Notification.isSupported()) {
      new Notification({
        title: 'One Clickz Bridge — print failed',
        body: `${job.slot.name}: ${job.error}`,
      }).show();
    }
  });

  const archiveRoot = path.join(__dirname, 'received');
  slotManager = new SlotManager({ incomingRoot, archiveRoot, logger, jobQueue });
  // Throttle "study received" notifications to one per studyUid every 30s
  // — modalities send many files per study and we don't want a flood.
  const recentStudyNotifs = new Map();
  slotManager.on('file', ({ slot, info }) => {
    // Still fire the in-app event so the renderer can refresh its status
    // dot, but the history log and OS notifications are deliberately quiet
    // here — the user only wants entries when a job actually prints, fails,
    // or a verification ping arrives.
    notifySlotEvent('file', { slotId: slot.id, callingAE: info.callingAE, sopInstanceUid: info.sopInstanceUid });

    if (Notification.isSupported()) {
      // Throttle by slot + calling AE so a single modality blasting many
      // images in a row only generates one "study received" notification
      // per 30 seconds. (sopInstanceUid changes per file, so it couldn't
      // throttle effectively; studyInstanceUid isn't parsed here either.)
      const key  = `${slot.id}|${info.callingAE || 'unknown'}`;
      const last = recentStudyNotifs.get(key) || 0;
      if (Date.now() - last > 30_000) {
        recentStudyNotifs.set(key, Date.now());
        new Notification({
          title: 'One Clickz Bridge — study received',
          body:  `${slot.name}: receiving from ${info.callingAE || 'unknown AE'}`,
        }).show();
      }
    }
  });
  slotManager.on('direct-print', ({ slot, job }) => {
    notifySlotEvent('file', {
      slotId: slot.id,
      callingAE: job.callingAE || '',
      sopInstanceUid: job.filmBoxUid || '',
      mode: 'dicom-print',
    });
  });
  slotManager.on('slot-error', ({ slot, error }) => {
    notifySlotEvent('slot-error', { slotId: slot.id, error });
  });

  // C-ECHO / verification ping from a modality (e.g. `echoscu`). Record it
  // in the per-slot history so the user can confirm devices are reaching
  // Bridge before sending real studies.
  slotManager.on('echo', ({ slot, info }) => {
    notifySlotEvent('echo', { slotId: slot.id, callingAE: info.callingAE });
    slotHistory.record(slot.id, {
      kind: 'echo',
      slotName: slot.name,
      aeTitle: slot.aeTitle,
      port: slot.port,
      callingAE: info.callingAE || '',
      remoteAddress: info.remoteAddress || '',
      remotePort: info.remotePort,
    });
  });

  setupTray();
  setupIpc();

  await applyConfig();

  if (!isHiddenLaunch()) openConfigWindow();

  // Global keybinding: opens (or focuses) the config window and asks the
  // renderer to show the password-gated Quota Settings modal.
  try {
    const ok = globalShortcut.register('CommandOrControl+Shift+Q', () => {
      openConfigWindow();
      // Give the window a beat to be ready before sending the IPC nudge.
      setTimeout(() => {
        if (configWindow && !configWindow.isDestroyed()) {
          configWindow.webContents.send('bridge:open-quota-settings');
        }
      }, 300);
    });
    if (!ok) logger.warn('[Shortcut] Ctrl+Shift+Q could not be registered (already in use)');
  } catch (e) { logger.warn('[Shortcut] register failed: ' + e.message); }
});

app.on('will-quit', () => {
  try { globalShortcut.unregisterAll(); } catch {}
});

app.on('second-instance', () => openConfigWindow());

app.on('window-all-closed', (e) => {
  // Keep tray running when all windows close
  e.preventDefault?.();
});

app.on('before-quit', () => { app.isQuitting = true; });

process.on('uncaughtException', (err) => {
  logger.error(`[uncaughtException] ${err.stack || err.message}`);
});
process.on('unhandledRejection', (reason) => {
  logger.error(`[unhandledRejection] ${reason}`);
});
