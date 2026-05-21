/**
 * Mediview Bridge — Electron main process.
 *
 * Tray-only app (config window opens on demand). Auto-starts at Windows
 * login. Owns:
 *   - Logger (rotating file in %APPDATA%/MediviewBridge/logs)
 *   - ConfigStore (%APPDATA%/MediviewBridge/config.json)
 *   - SlotManager (one DICOM Storage SCP per enabled printer slot)
 *   - JobQueue (debounced by Study UID)
 *   - PrintWorker (renders DICOM to PNG and prints via Electron)
 */

const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, Notification, shell, dialog, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');

const { Logger } = require('./src/log/logger');
const { SlotHistory } = require('./src/log/slotHistory');
const { ConfigStore } = require('./src/config/store');
const { defaultSlot, validateSlot } = require('./src/config/schema');
const { SlotManager } = require('./src/scp/slotManager');
const { JobQueue } = require('./src/print/jobQueue');
const { PrintWorker } = require('./src/print/printWorker');
const { ensureFirewallRules } = require('./src/firewall/addFirewallRule');
const { registerStartup, getStartupStatus } = require('./src/autostart/registerStartup');
const { parseStudyUid } = require('./src/render/dicomRender');
const { DEFAULT_BRANDING } = require('./src/config/defaultBranding');

// --- Single instance lock ---
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}

// --- Paths ---
const userDataRoot = path.join(app.getPath('appData'), 'MediviewBridge');
const logDir = path.join(userDataRoot, 'logs');
const historyDir = path.join(userDataRoot, 'history');
const configPath = path.join(userDataRoot, 'config.json');
const incomingRoot = path.join(userDataRoot, 'incoming');
const printedRoot = path.join(userDataRoot, 'printed');
const failedRoot = path.join(userDataRoot, 'failed');
const licenseFile = path.join(userDataRoot, '.license');
const trialFile = path.join(userDataRoot, '.trial');
for (const d of [userDataRoot, logDir, historyDir, incomingRoot, printedRoot, failedRoot]) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

// ===== License & Trial System =====
const LICENSE_API_BASE = 'https://mehrgrewal.com/mediview/api';
const TRIAL_DAYS = 7;

function getFingerprint() {
  const crypto = require('crypto');
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
    if (fs.existsSync(licenseFile)) return JSON.parse(fs.readFileSync(licenseFile, 'utf8'));
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
  let installDate;
  try {
    if (fs.existsSync(trialFile)) {
      const data = JSON.parse(fs.readFileSync(trialFile, 'utf8'));
      installDate = new Date(data.installDate);
    }
  } catch {}
  if (!installDate || isNaN(installDate.getTime())) {
    installDate = new Date();
    try { fs.writeFileSync(trialFile, JSON.stringify({ installDate: installDate.toISOString() }), 'utf8'); } catch {}
  }
  const elapsed = Math.floor((Date.now() - installDate.getTime()) / (1000 * 60 * 60 * 24));
  const remaining = Math.max(0, TRIAL_DAYS - elapsed);
  return { remaining, expired: remaining <= 0, totalDays: TRIAL_DAYS };
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
    return { valid: false, reason: res.data?.reason || 'invalid' };
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
    let daysLeft = null;
    if (lic.expiresAt) {
      daysLeft = Math.max(0, Math.ceil((new Date(lic.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
    }
    return { type: 'licensed', licenseKey: lic.licenseKey, plan: lic.plan, expiresAt: lic.expiresAt, lastValidated: lic.lastValidated, daysLeft, expired: daysLeft !== null && daysLeft <= 0 };
  }
  const trial = getTrialInfo();
  return { type: 'trial', remaining: trial.remaining, expired: trial.expired, totalDays: TRIAL_DAYS };
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
    { label: 'Mediview Bridge', enabled: false },
    { type: 'separator' },
    ...(slotItems.length ? slotItems : [{ label: 'No slots configured', enabled: false }]),
    { type: 'separator' },
    { label: 'Open Config…', click: openConfigWindow },
    { label: 'Open Logs Folder', click: () => shell.openPath(logDir) },
    { label: 'Open Storage Folder', click: () => shell.openPath(userDataRoot) },
    { type: 'separator' },
    { label: 'Quit Mediview Bridge', click: () => quitApp() },
  ]);
}

function refreshTray() {
  if (!tray) return;
  const status = slotManager ? slotManager.getStatus() : [];
  tray.setContextMenu(buildTrayMenu(status));
  const enabled = status.filter((s) => s.listening).length;
  tray.setToolTip(`Mediview Bridge — ${enabled} slot${enabled === 1 ? '' : 's'} listening`);
}

function setupTray() {
  const iconPath = path.join(__dirname, 'icon.ico');
  const icon = fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : nativeImage.createEmpty();
  tray = new Tray(icon);
  tray.setToolTip('Mediview Bridge');
  tray.on('click', openConfigWindow);
  tray.on('double-click', openConfigWindow);
  refreshTray();
}

function openConfigWindow() {
  if (configWindow && !configWindow.isDestroyed()) {
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
    title: 'Mediview Bridge',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // In dev mode (vite dev server), load from localhost
  const isDev = process.argv.includes('--dev');
  if (isDev && process.env.BRIDGE_UI_URL) {
    configWindow.loadURL(process.env.BRIDGE_UI_URL);
  } else if (isDev) {
    configWindow.loadURL('http://localhost:5174/');
  } else {
    configWindow.loadFile(path.join(__dirname, 'ui', 'dist', 'index.html'));
  }

  configWindow.once('ready-to-show', () => configWindow.show());

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
  ipcMain.handle('bridge:save-branding', async (_e, branding) => {
    const merged = { ...DEFAULT_BRANDING, ...branding };
    config.update({ branding: merged });
    return config.get().branding;
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
    const dest   = path.join(tmpDir, `mediview-bridge-update-${Date.now()}.exe`);
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
  logger.info(`[Boot] Mediview Bridge starting (hidden=${isHiddenLaunch()})`);

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
          title: 'Mediview Bridge — quota exhausted',
          body: `${job.slot.name}: print quota is 0. Printing is now paused for this slot.`,
        }).show();
      } else if (Notification.isSupported() && before > 50 && after <= 50) {
        new Notification({
          title: 'Mediview Bridge — low quota',
          body: `${job.slot.name}: only ${after} prints remaining. Top up soon.`,
        }).show();
      }
      // Push the updated slot to renderer so the card UI refreshes.
      if (configWindow && !configWindow.isDestroyed()) {
        configWindow.webContents.send('bridge:config-changed', config.get());
      }
    }

    if (Notification.isSupported()) {
      new Notification({
        title: 'Mediview Bridge — sent to printer',
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
        title: 'Mediview Bridge — print failed',
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
    notifySlotEvent('file', { slotId: slot.id, callingAE: info.callingAE, sopInstanceUid: info.sopInstanceUid });
    if (Notification.isSupported()) {
      const key = (info.studyInstanceUid || info.sopInstanceUid || '') + '|' + slot.id;
      const last = recentStudyNotifs.get(key) || 0;
      if (Date.now() - last > 30_000) {
        recentStudyNotifs.set(key, Date.now());
        new Notification({
          title: 'Mediview Bridge — study received',
          body:  `${slot.name}: receiving from ${info.callingAE || 'unknown AE'}`,
        }).show();
        // Record one "received" history row per study (not per file).
        slotHistory.record(slot.id, {
          kind: 'received',
          slotName: slot.name,
          aeTitle: slot.aeTitle,
          port: slot.port,
          callingAE: info.callingAE || '',
          studyUid: info.studyInstanceUid || '',
        });
      }
    }
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
