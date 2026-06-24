/**
 * One Clickz - Modern Desktop Edition
 * Electron Main Process
 *
 * Manages:
 * - Portable MariaDB server (auto-start/stop)
 * - PHP built-in server (auto-start/stop)
 * - Orthanc DICOM server (auto-start/stop)
 * - Database initialization on first run
 * - React SPA served via PHP
 */

const { app, BrowserWindow, dialog, Menu, shell, ipcMain, globalShortcut, safeStorage, session } = require('electron');
const path = require('path');
const { spawn, execSync } = require('child_process');
const http = require('http');
const url = require('url');
const fs = require('fs');
const crypto = require('crypto');

// ---------------------------------------------------------------------------
// GPU / WebGL acceleration (MUST run before app 'ready').
//
// Electron's bundled Chromium is far more conservative than desktop Chrome and
// frequently BLOCKLISTS common integrated GPUs (e.g. Intel Iris Xe). When that
// happens it silently falls back to software GL (SwiftShader), which makes the
// 3D volume viewer slow and low-quality - even though the exact same page is
// smooth in Chrome on the same machine. These switches force Electron to use
// the hardware GPU like Chrome does.
// ---------------------------------------------------------------------------
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('enable-accelerated-2d-canvas');
// Match Chrome's Windows default backend (the browser reports "ANGLE ... D3D11"),
// which is what renders the volume smoothly.
app.commandLine.appendSwitch('use-angle', 'd3d11');
// On dual-GPU laptops, prefer the high-performance GPU for our windows.
app.commandLine.appendSwitch('force_high_performance_gpu');

// Configuration
const PHP_PORT = 8080;
const VITE_PORT = 5173;
const MYSQL_PORT = 3307;
const ORTHANC_PORT = 8042;
const DICOM_PORT = 3457; // Local DICOM file server
let APP_URL = `http://localhost:${PHP_PORT}`;

// Global references
let mainWindow = null;
let splashWindow = null;
let phpProcess = null;
let mysqlProcess = null;
let orthancProcess = null;

// Environment
const isDev = !app.isPackaged;
const appPath = isDev ? __dirname : process.resourcesPath;

// Paths
const phpPath = isDev ? 'C:\\xampp\\php\\php.exe' : path.join(appPath, 'php', 'php.exe');
const wwwPath = isDev ? path.join(__dirname, 'www') : path.join(appPath, 'www');
const mysqlDir = isDev ? path.join(__dirname, 'mysql') : path.join(appPath, 'mysql');
const mysqldPath = path.join(mysqlDir, 'bin', 'mysqld.exe');
const mysqlClientPath = path.join(mysqlDir, 'bin', 'mysql.exe');
const userDataPath = app.getPath('userData');
const DICOM_ACCESS_TOKEN = crypto.randomBytes(32).toString('hex');
const UPDATE_DOWNLOAD_HOSTS = new Set(['mehrgrewal.com', 'www.mehrgrewal.com']);

function readOrCreateSecret(fileName, bytes = 24) {
    const filePath = path.join(userDataPath, fileName);
    try {
        if (!fs.existsSync(userDataPath)) fs.mkdirSync(userDataPath, { recursive: true });
        if (fs.existsSync(filePath)) {
            const existing = fs.readFileSync(filePath, 'utf8').trim();
            if (existing) return existing;
        }
        const secret = crypto.randomBytes(bytes).toString('base64url');
        fs.writeFileSync(filePath, secret, { encoding: 'utf8', mode: 0o600 });
        return secret;
    } catch (e) {
        console.error('[Security] Failed to read/create secret:', e.message);
        return crypto.randomBytes(bytes).toString('base64url');
    }
}

const ORTHANC_USERNAME = 'oneclickz';
const ORTHANC_PASSWORD = readOrCreateSecret('.orthanc-password', 24);

function orthancAuthHeader() {
    return 'Basic ' + Buffer.from(`${ORTHANC_USERNAME}:${ORTHANC_PASSWORD}`).toString('base64');
}

// ===== License & Trial System =====
const LICENSE_API_BASE = 'https://mehrgrewal.com/mediview/api';
const TRIAL_DAYS = 7;
const OFFLINE_LEASE_DAYS = 90;
const LEASE_WARN_DAYS = 14;
// Ed25519 PUBLIC key for verifying server-signed offline license leases.
// Embedded (not env-only) so verification works on packaged customer machines
// where env vars aren't set. The matching PRIVATE key lives ONLY in the server
// env (LICENSE_LEASE_PRIVATE_KEY_B64) and never ships with the app.
const LICENSE_LEASE_PUBLIC_KEY_B64 = process.env.ONECLICKZ_LICENSE_PUBLIC_KEY || 'tQ7De6EVOD5XagDAyP1YJVhxLhcy8iKQL1sJQIM0TT4=';
/** Local install-trial print budget. Used when no server license is
 *  activated yet - gives the operator something to test with so the
 *  header isn't stuck at "Prints Left: 0". Persisted alongside
 *  installDate in the .trial file. */
const TRIAL_PRINTS = 10;
const trialFile = path.join(userDataPath, '.trial');
const licenseFile = path.join(userDataPath, '.license');
const clockMarkFile = path.join(userDataPath, '.license-clock');
const clockMarkRegValue = 'LicenseClockMark';

function getFingerprint() {
    const os = require('os');
    const raw = [
        os.hostname(),
        os.platform(),
        os.arch(),
        os.cpus()[0]?.model || '',
        os.totalmem().toString(),
        (os.networkInterfaces()['Ethernet'] || os.networkInterfaces()['Wi-Fi'] || Object.values(os.networkInterfaces())[0] || [])
            .find(i => !i.internal && i.family === 'IPv4')?.mac || ''
    ].join('|');
    return crypto.createHash('sha256').update(raw).digest('hex').substring(0, 32);
}

function getLicenseData() {
    try {
        if (!fs.existsSync(licenseFile)) return null;
        const parsed = JSON.parse(fs.readFileSync(licenseFile, 'utf8'));
        // Encrypted envelope written by saveLicenseData ({ encrypted, data }).
        if (parsed && typeof parsed === 'object' && typeof parsed.data === 'string' && 'encrypted' in parsed) {
            try { return decryptJsonFromDisk(parsed); } catch { return null; }
        }
        // Legacy plaintext license — returned as-is; migrated to encrypted on next save.
        return parsed;
    } catch { /* corrupt */ }
    return null;
}

function saveLicenseData(data) {
    try {
        // Encrypt at rest (DPAPI via safeStorage) so license fields — especially
        // leaseToken and lastValidated — can't be hand-edited to forge validity.
        fs.writeFileSync(licenseFile, JSON.stringify(encryptJsonForDisk(data)), 'utf8');
    } catch (e) { console.error('[License] Failed to save:', e.message); }
}

function clearLicenseData() {
    try { if (fs.existsSync(licenseFile)) fs.unlinkSync(licenseFile); } catch {}
    // Removing a license drops the operator back to a fresh TRIAL_PRINTS
    // budget — not the in-progress counter from before they activated.
    // The trial file is recreated on next read.
    try { if (fs.existsSync(trialFile)) fs.unlinkSync(trialFile); } catch {}
}

function getTrialInfo() {
    let installDate, printsRemaining = TRIAL_PRINTS;
    try {
        if (fs.existsSync(trialFile)) {
            const data = JSON.parse(fs.readFileSync(trialFile, 'utf8'));
            installDate = new Date(data.installDate);
            if (Number.isFinite(data.printsRemaining)) printsRemaining = Math.max(0, data.printsRemaining);
        }
    } catch { /* corrupt file - treat as new install */ }

    if (!installDate || isNaN(installDate.getTime())) {
        installDate = new Date();
        printsRemaining = TRIAL_PRINTS;
        saveTrialInfo({ installDate, printsRemaining });
    }

    const now = new Date();
    const elapsed = Math.floor((now - installDate) / (1000 * 60 * 60 * 24));
    const remaining = Math.max(0, TRIAL_DAYS - elapsed);
    return {
        installDate, elapsed, remaining, expired: remaining <= 0,
        printsRemaining, printsTotal: TRIAL_PRINTS,
    };
}

function saveTrialInfo({ installDate, printsRemaining }) {
    try {
        fs.writeFileSync(trialFile, JSON.stringify({
            installDate: installDate.toISOString(),
            printsRemaining,
        }), 'utf8');
    } catch { /* ignore */ }
}

/** Reset the free-trial print budget to TRIAL_PRINTS. Called whenever the
 *  license file is wiped (deactivate or hard server reject) so the operator
 *  always lands back on a fresh 10-print trial instead of inheriting the
 *  in-progress counter from before activation. */
function resetTrialInfo() {
    try { if (fs.existsSync(trialFile)) fs.unlinkSync(trialFile); } catch {}
}

/** Push the current effective quota to every open renderer so the header /
 *  Recharge tab / print management page update without waiting for the
 *  next 5-second poll. Used after voucher redeem, deactivation, etc. */
function broadcastQuotaChanged() {
    try {
        const q = computeEffectiveQuota();
        BrowserWindow.getAllWindows().forEach(w => {
            try { w.webContents.send('mv:quota-changed', q); } catch {}
        });
    } catch {}
}

/** Returns the quota the UI should display — server numbers PLUS the local
 *  offlineQuotaCredit so voucher recharges aren't wiped by the next poll. */
function computeEffectiveQuota() {
    const lic = getLicenseData();
    if (!lic) {
        const t = getTrialInfo();
        return { enabled: true, remaining: t.printsRemaining, total: t.printsTotal, source: 'trial' };
    }
    const offlineCredit = Math.max(0, parseInt(lic.offlineQuotaCredit || 0, 10));
    const offlineTotal  = Math.max(0, parseInt(lic.offlineQuotaTotal  || 0, 10));
    return {
        // Sell-by-print is "on" once ANY prints were ever granted (server quota
        // or an offline recharge). We key off offlineTotal — NOT live credit —
        // so a recharge that's been spent down to 0 reads as "blocked", not
        // "unlimited". Unlimited = never granted any prints at all.
        enabled:   !!lic.quotaEnabled || offlineTotal > 0,
        remaining: Math.max(0, parseInt(lic.quotaRemaining || 0, 10)) + offlineCredit,
        total:     Math.max(0, parseInt(lic.quotaTotal     || 0, 10)) + offlineTotal,
        source:    'license',
    };
}

/** Decrement the local trial print counter when no server license is
 *  activated. Returns the updated remaining count. */
function decrementTrialPrints(pages) {
    const t = getTrialInfo();
    const next = Math.max(0, t.printsRemaining - Math.max(1, parseInt(pages, 10) || 1));
    saveTrialInfo({ installDate: t.installDate, printsRemaining: next });
    return next;
}

function apiSleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/** One POST attempt. Resolves for ANY HTTP response (incl. 4xx/5xx) and
 *  rejects only on a transport-level failure (connect timeout, reset, DNS).
 *  That split lets the retry wrapper retry flaky links without re-sending
 *  on a legitimate "invalid key" rejection from the server. */
function apiRequestOnce(endpoint, body) {
    const https = require('https');
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(body);
        const urlObj = new URL(LICENSE_API_BASE + endpoint);
        const options = {
            hostname: urlObj.hostname,
            port: 443,
            path: urlObj.pathname,
            method: 'POST',
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
        req.setTimeout(12000, () => { req.destroy(); reject(new Error('Timeout')); });
        req.write(data);
        req.end();
    });
}

/** Retrying POST. The route to mehrgrewal.com drops a large share of TCP
 *  connections on some networks (lossy ISP path / busy shared host), so a
 *  single attempt fails often even though the server is up. Retrying a few
 *  times with backoff turns ~40% per-attempt success into ~95%+. Only
 *  transport failures are retried — HTTP error statuses pass straight back. */
async function apiRequest(endpoint, body, { attempts = 4 } = {}) {
    let lastErr;
    for (let i = 0; i < attempts; i++) {
        try { return await apiRequestOnce(endpoint, body); }
        catch (e) {
            lastErr = e;
            if (i < attempts - 1) await apiSleep(800 * (i + 1));
        }
    }
    throw lastErr;
}

async function activateLicense(licenseKey) {
    const fingerprint = getFingerprint();
    const os = require('os');
    try {
        const res = await apiRequest('/license/activate', {
            license_key: licenseKey,
            fingerprint,
            machine_name: os.hostname(),
            os: `${os.platform()} ${os.release()}`,
            app_version: app.getVersion ? app.getVersion() : '1.0.0',
        });
        if (res.status >= 200 && res.status < 300) {
            const leaseToken = res.data.license_token || res.data.lease_token || null;
            saveLicenseData({
                licenseKey,
                fingerprint,
                deviceId: res.data.device_id,
                plan: res.data.plan || 'unknown',
                expiresAt: res.data.expires_at,
                leaseToken,
                leaseWarn: leaseToken ? verifyLeaseToken(leaseToken).warn === true : false,
                activatedAt: new Date().toISOString(),
                lastValidated: new Date().toISOString(),
            });
            return { success: true, data: res.data };
        }
        return { success: false, error: res.data?.error || res.data?.message || 'Activation failed' };
    } catch (e) {
        return { success: false, error: 'Could not reach the licence server after several tries — your network looks unstable. Please try again, or switch to a mobile hotspot. (' + e.message + ')' };
    }
}

async function validateLicense() {
    const lic = getLicenseData();
    if (!lic) return { valid: false, reason: 'no_license' };

    // Offline-activated licences are server-less: authority is the baked-in term
    // (offlineExpiresAt) written at redeem time. Resolve locally and skip the
    // network — otherwise every poll would hang through the apiRequest retry
    // budget on a permanently-offline machine.
    if (lic.offlineActivated) {
        const expMs = lic.offlineExpiresAt ? new Date(lic.offlineExpiresAt).getTime() : 0;
        const valid = expMs > Date.now();
        return { valid, expired: !valid, plan: lic.plan || 'offline',
                 expiresAt: lic.offlineExpiresAt || null, offline: true,
                 reason: valid ? undefined : 'expired' };
    }

    try {
        const res = await apiRequest('/license/validate', {
            license_key: lic.licenseKey,
            fingerprint: lic.fingerprint,
            app: 'viewer',
        });
        if (res.data?.valid) {
            lic.lastValidated = new Date().toISOString();
            lic.plan = res.data.plan || lic.plan;
            lic.expiresAt = res.data.expires_at || lic.expiresAt;
            lic.leaseToken = res.data.license_token || res.data.lease_token || lic.leaseToken || null;
            const lease = lic.leaseToken ? verifyLeaseToken(lic.leaseToken) : null;
            if (lease && !lease.valid && lease.reason !== 'lease_public_key_missing') {
                return { valid: false, reason: lease.reason };
            }
            lic.leaseWarn = lease?.warn === true;
            // Mirror quota fields so the UI can show them without an extra round-trip.
            lic.quotaEnabled   = !!res.data.quota_enabled;
            lic.quotaRemaining = parseInt(res.data.quota_remaining || 0, 10);
            lic.quotaTotal     = parseInt(res.data.quota_total     || 0, 10);
            saveLicenseData(lic);
            return {
                valid: true, plan: lic.plan, expiresAt: lic.expiresAt,
                leaseWarn: lic.leaseWarn,
                daysUntilCheck: lease?.daysUntilCheck,
                quotaEnabled:   lic.quotaEnabled,
                quotaRemaining: lic.quotaRemaining,
                quotaTotal:     lic.quotaTotal,
            };
        }
        return { valid: false, reason: res.data?.reason || 'invalid' };
    } catch {
        // Offline path. If this license carries a server-signed lease, that
        // lease is the SOLE authority — we must NOT fall back to the editable
        // lastValidated grace, because stripping the token to force that
        // downgrade is exactly how the file-edit crack worked.
        if (lic.leaseToken) {
            const lease = verifyLeaseToken(lic.leaseToken);
            if (lease.valid) {
                return {
                    valid: true,
                    plan: lease.payload.plan || lic.plan,
                    expiresAt: lease.payload.licenseExpiresAt || lic.expiresAt,
                    offline: true,
                    leaseWarn: lease.warn,
                    daysUntilCheck: lease.daysUntilCheck,
                };
            }
            return { valid: false, reason: lease.reason || 'lease_invalid' };
        }
        // Legacy license issued before signed leases existed: fall back to the
        // time-based grace, anchored to the anti-rollback clock.
        if (lic.lastValidated) {
            const lastCheck = new Date(lic.lastValidated);
            const daysSince = (effectiveNowMs() - lastCheck.getTime()) / (1000 * 60 * 60 * 24);
            if (daysSince < OFFLINE_LEASE_DAYS) {
                return {
                    valid: true,
                    plan: lic.plan,
                    expiresAt: lic.expiresAt,
                    offline: true,
                    daysUntilCheck: Math.ceil(OFFLINE_LEASE_DAYS - daysSince),
                    leaseWarn: (OFFLINE_LEASE_DAYS - daysSince) <= LEASE_WARN_DAYS,
                };
            }
        }
        return { valid: false, reason: 'offline_lease_expired' };
    }
}

async function sendHeartbeat() {
    const lic = getLicenseData();
    if (!lic) return;
    try {
        await apiRequest('/license/heartbeat', {
            license_key: lic.licenseKey,
            fingerprint: lic.fingerprint,
            app_version: app.getVersion ? app.getVersion() : '1.0.0',
        });
    } catch { /* silent */ }
}

async function deactivateLicense() {
    const lic = getLicenseData();
    if (!lic) return;
    try {
        await apiRequest('/license/deactivate', {
            license_key: lic.licenseKey,
            fingerprint: lic.fingerprint,
        });
    } catch { /* silent */ }
    clearLicenseData();
    resetTrialInfo();
    broadcastQuotaChanged();
}

function getLicenseStatus() {
    const lic = getLicenseData();
    if (lic) {
        let daysLeft = null;
        if (lic.expiresAt) {
            daysLeft = Math.max(0, Math.ceil((new Date(lic.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
        }
        const os = require('os');
        return {
            type: 'licensed',
            licenseKey: lic.licenseKey,
            plan: lic.plan,
            expiresAt: lic.expiresAt,
            lastValidated: lic.lastValidated,
            activatedAt: lic.activatedAt,
            deviceId: lic.deviceId,
            fingerprint: lic.fingerprint,
            machineName: os.hostname(),
            daysLeft,
            leaseWarn: lic.leaseWarn === true,
            daysUntilCheck: Number.isFinite(lic.daysUntilCheck) ? lic.daysUntilCheck : undefined,
            expired: daysLeft !== null && daysLeft <= 0,
        };
    }
    const trial = getTrialInfo();
    return {
        type: 'trial',
        remaining: trial.remaining,
        expired: trial.expired,
        totalDays: TRIAL_DAYS,
    };
}
// ===== Offline voucher recharge (Recharge tab) =====
// Same short-code scheme + secret as the Bridge, so the one website generator
// (bridge-voucher.php) serves both. Codes are device-bound by fingerprint.
const { shortRequestCode: vShortRequestCode, verifyShortVoucher: vVerifyVoucher } = require('./voucherShort');
// Secret is reconstructed at runtime from XOR-masked chunks so it isn't a
// greppable literal in the packaged .asar. Env override stays first so a
// production deployment can inject a fresh value without rebuilding.
const VIEWER_VOUCHER_SECRET = process.env.ONECLICKZ_VOUCHER_SECRET || require('./secureSecret')();
const voucherCounterFile = path.join(userDataPath, '.voucher-counter');

function readVoucherCounterFile() { try { const n = parseInt(String(fs.readFileSync(voucherCounterFile, 'utf8')).trim(), 10); return Number.isFinite(n) ? n : 0; } catch { return 0; } }
function readVoucherCounterRegistry() {
    if (process.platform !== 'win32') return 0;
    try {
        const out = require('child_process').execSync('reg query HKCU\\Software\\OneClickz\\Viewer /v VoucherCounter', { stdio: 'pipe', windowsHide: true }).toString();
        const m = out.match(/VoucherCounter\s+REG_SZ\s+(\d+)/i);
        return m ? (parseInt(m[1], 10) || 0) : 0;
    } catch { return 0; }
}
// Counter persisted in file + registry; max() of the two so wiping one store
// can't roll it back and replay a spent voucher.
function getVoucherCounter() { return Math.max(readVoucherCounterFile(), readVoucherCounterRegistry()); }
function setVoucherCounter(n) {
    try { fs.writeFileSync(voucherCounterFile, String(n), 'utf8'); } catch {}
    if (process.platform === 'win32') { try { require('child_process').execSync(`reg add HKCU\\Software\\OneClickz\\Viewer /v VoucherCounter /t REG_SZ /d ${n} /f`, { stdio: 'ignore', windowsHide: true }); } catch {} }
}

function getViewerRequestCode() { return vShortRequestCode(VIEWER_VOUCHER_SECRET, getFingerprint(), getVoucherCounter()); }

function viewerEffectiveExpiry(lic) {
    if (!lic) return null;
    const a = lic.expiresAt ? new Date(lic.expiresAt).getTime() : 0;
    const b = lic.offlineExpiresAt ? new Date(lic.offlineExpiresAt).getTime() : 0;
    const t = Math.max(a, b);
    return t > 0 ? new Date(t).toISOString() : null;
}

function viewerVoucherStatus() {
    const lic = getLicenseData();
    let prints = null, daysLeft = null;
    if (lic) {
        const offlineCredit = Math.max(0, parseInt(lic.offlineQuotaCredit || 0, 10));
        const offlineTotal  = Math.max(0, parseInt(lic.offlineQuotaTotal  || 0, 10));
        const serverRemaining = Math.max(0, parseInt(lic.quotaRemaining || 0, 10));
        // Show prints whenever quota mode is on OR prints were ever granted via
        // an offline recharge (offlineTotal). Keyed off the granted total — not
        // live credit — so a spent-to-0 recharge still shows "0" (blocked),
        // not null (which the UI reads as unlimited). null = never limited.
        prints = (lic.quotaEnabled || offlineTotal > 0 || serverRemaining > 0)
            ? serverRemaining + offlineCredit
            : null;
        const exp = viewerEffectiveExpiry(lic);
        daysLeft = exp ? Math.max(0, Math.ceil((new Date(exp).getTime() - Date.now()) / 86400000)) : null;
    } else {
        const t = getTrialInfo();
        prints = t.printsRemaining;
        daysLeft = t.remaining;
    }
    return { requestCode: getViewerRequestCode(), prints, daysLeft };
}

function redeemViewerVoucher(code, licenseKey) {
    const counter = getVoucherCounter();
    const requestCode = vShortRequestCode(VIEWER_VOUCHER_SECRET, getFingerprint(), counter);
    const res = vVerifyVoucher(VIEWER_VOUCHER_SECRET, requestCode, code);
    if (!res.ok) return { ok: false, reason: res.reason };

    const lic = getLicenseData();
    // No server licence + the code carries a term => OFFLINE ACTIVATION. Create
    // a server-less licence; validateLicense() and get-license-quota resolve it
    // purely from offlineExpiresAt + offlineQuotaCredit (no network), so a
    // permanently-offline PC runs entirely on the baked-in term + quota.
    const activating = !lic && res.days > 0;

    if (lic) {
        if (res.prints > 0) {
            // Bank vouchered prints in a SEPARATE field so the next
            // /license/quota poll (which overwrites quotaRemaining with the
            // server's value) can't silently erase the recharge. Both fields
            // are summed when computing the displayed/decrementable balance.
            lic.quotaEnabled = true;
            lic.offlineQuotaCredit = Math.max(0, parseInt(lic.offlineQuotaCredit || 0, 10)) + res.prints;
            lic.offlineQuotaTotal  = Math.max(0, parseInt(lic.offlineQuotaTotal  || 0, 10)) + res.prints;
        }
        if (res.days > 0) {
            const base = Math.max(Date.now(), lic.offlineExpiresAt ? new Date(lic.offlineExpiresAt).getTime() : 0, lic.expiresAt ? new Date(lic.expiresAt).getTime() : 0);
            lic.offlineExpiresAt = new Date(base + res.days * 86400000).toISOString();
        }
        saveLicenseData(lic);
    } else if (activating) {
        saveLicenseData({
            licenseKey: (licenseKey && String(licenseKey).trim().toUpperCase()) || 'OFFLINE',
            fingerprint: getFingerprint(),
            plan: 'offline',
            offlineActivated: true,
            quotaEnabled: true,
            offlineQuotaCredit: res.prints,
            offlineQuotaTotal:  res.prints,
            offlineExpiresAt: new Date(Date.now() + res.days * 86400000).toISOString(),
            activatedAt:   new Date().toISOString(),
            lastValidated: new Date().toISOString(),
        });
    } else if (res.prints > 0) {
        const t = getTrialInfo();
        saveTrialInfo({ installDate: t.installDate, printsRemaining: t.printsRemaining + res.prints });
    }
    setVoucherCounter(counter + 1); // rotate request code → single-use

    broadcastQuotaChanged();
    const st = viewerVoucherStatus();
    return { ok: true, activated: activating, addedPrints: res.prints, addedDays: res.days, prints: st.prints, daysLeft: st.daysLeft };
}

const mysqlDataDir = path.join(userDataPath, 'mysql-data');
const mysqlDataSubDir = path.join(mysqlDataDir, 'data');
const orthancDir = isDev ? path.join(__dirname, 'orthanc') : path.join(appPath, 'orthanc');
const orthancExePath = path.join(orthancDir, 'Orthanc.exe');
const orthancStorageDir = path.join(userDataPath, 'orthanc-storage');
const orthancDbDir = path.join(userDataPath, 'orthanc-db');
const logsDir = path.join(userDataPath, 'logs');
const sessionAllowedDicomRoots = new Set();

function normalizeFsPath(inputPath) {
    if (!inputPath || typeof inputPath !== 'string') return null;
    try {
        const resolved = path.resolve(inputPath);
        return fs.existsSync(resolved) ? fs.realpathSync(resolved) : resolved;
    } catch {
        return null;
    }
}

function authorizeDicomPath(inputPath) {
    const resolved = normalizeFsPath(inputPath);
    if (!resolved) return;
    try {
        const stat = fs.existsSync(resolved) ? fs.statSync(resolved) : null;
        sessionAllowedDicomRoots.add((stat && stat.isFile()) ? path.dirname(resolved) : resolved);
    } catch {
        sessionAllowedDicomRoots.add(resolved);
    }
}

function isUnderRoot(candidate, root) {
    const rel = path.relative(root, candidate);
    return rel === '' || (!!rel && !rel.startsWith('..') && !path.isAbsolute(rel));
}

function allowedDicomRoots() {
    const envRoots = (process.env.DICOM_ALLOWED_ROOTS || '')
        .split(/[;|]/)
        .map(s => s.trim())
        .filter(Boolean);
    const roots = [
        userDataPath,
        wwwPath,
        path.join(appPath, 'uploads'),
        path.join(appPath, 'dicom-storage'),
        path.join(appPath, 'storage'),
        path.join(wwwPath, 'uploads'),
        path.join(appPath, 'data'),
        orthancStorageDir,
        typeof networkDicomStorage === 'string' ? networkDicomStorage : null,
        ...sessionAllowedDicomRoots,
        ...envRoots,
    ];
    return roots.map(normalizeFsPath).filter(Boolean);
}

function isAllowedDicomPath(inputPath, expectedType = 'any') {
    const resolved = normalizeFsPath(inputPath);
    if (!resolved || !fs.existsSync(resolved)) return false;
    const stat = fs.statSync(resolved);
    if (expectedType === 'file' && !stat.isFile()) return false;
    if (expectedType === 'directory' && !stat.isDirectory()) return false;
    return allowedDicomRoots().some(root => isUnderRoot(resolved, root));
}

function isPlausibleDicomPath(inputPath) {
    const base = path.basename(inputPath).toLowerCase();
    if (base === 'dicomdir' || base.endsWith('.dcm') || base.endsWith('.dicom') || !base.includes('.')) return true;
    return !/\.(php|exe|bat|cmd|sh|ps1|vbs|js|html?|json|xml|ini|env|sql|pem|key|txt|csv|xlsx?|docx?|pdf|zip|dll)$/i.test(base);
}

console.log('[Electron] Starting One Clickz...');
console.log('[Electron] isDev:', isDev);
console.log('[Electron] appPath:', appPath);
console.log('[Electron] wwwPath:', wwwPath);

// =====================================================
// Directory Setup
// =====================================================
function ensureDirectories() {
    [mysqlDataDir, orthancStorageDir, orthancDbDir, logsDir].forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`[Electron] Created: ${dir}`);
        }
    });
}

// =====================================================
// Frontend Build Check (auto-build on fresh clone)
// =====================================================
async function ensureFrontendBuild() {
    const distIndex = path.join(wwwPath, 'dist', 'index.html');
    if (fs.existsSync(distIndex)) return; // already built

    console.log('[Frontend] www/dist missing - building React app...');
    const wwwNodeModules = path.join(wwwPath, 'node_modules');
    if (!fs.existsSync(wwwNodeModules)) {
        console.log('[Frontend] Installing www dependencies...');
        execSync('npm install', { cwd: wwwPath, stdio: 'inherit', shell: true });
    }
    console.log('[Frontend] Running npm run build...');
    execSync('npm run build', { cwd: wwwPath, stdio: 'inherit', shell: true });
    console.log('[Frontend] Build complete.');
}

// =====================================================
// Splash Screen
// =====================================================
function createSplashWindow() {
    splashWindow = new BrowserWindow({
        width: 480,
        height: 380,
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        resizable: false,
        webPreferences: { nodeIntegration: false, contextIsolation: true }
    });
    splashWindow.loadFile(path.join(__dirname, 'splash.html'));
    splashWindow.center();
}

function updateSplashStatus(message) {
    if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.webContents.executeJavaScript(
            `document.getElementById('status').textContent = ${JSON.stringify(message)};`
        ).catch(() => {});
    }
    console.log(`[Startup] ${message}`);
}

function viewerWebPreferences(extra = {}) {
    return {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
        webSecurity: true,
        allowRunningInsecureContent: false,
        // Fully disable DevTools in the packaged build so F12 / Ctrl+Shift+I /
        // programmatic openDevTools() simply cannot open it (stronger than the
        // after-the-fact 'devtools-opened' auto-close). Kept on in dev.
        devTools: isDev,
        preload: path.join(__dirname, 'preload.js'),
        ...extra,
    };
}

function registerWindowSecurity(win) {
    if (!win || !win.webContents) return;
    win.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
        if (isAllowedAppUrl(targetUrl)) return { action: 'allow', overrideBrowserWindowOptions: { webPreferences: viewerWebPreferences() } };
        shell.openExternal(targetUrl).catch(() => {});
        return { action: 'deny' };
    });
    win.webContents.on('will-navigate', (event, targetUrl) => {
        if (!isAllowedAppUrl(targetUrl)) {
            event.preventDefault();
            shell.openExternal(targetUrl).catch(() => {});
        }
    });
    win.webContents.on('will-redirect', (event, targetUrl) => {
        if (!isAllowedAppUrl(targetUrl)) event.preventDefault();
    });
    if (!isDev) {
        win.webContents.on('devtools-opened', () => {
            try { win.webContents.closeDevTools(); } catch {}
        });
    }
}

function isAllowedAppUrl(targetUrl) {
    try {
        if (targetUrl.startsWith('about:') || targetUrl.startsWith('blob:')) return true;
        const target = new URL(targetUrl);
        const appOrigin = new URL(APP_URL).origin;
        return target.origin === appOrigin
            || target.origin === `http://localhost:${DICOM_PORT}`
            || target.origin === `http://127.0.0.1:${DICOM_PORT}`;
    } catch {
        return false;
    }
}

function buildViewMenu() {
    const submenu = [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
    ];
    if (isDev) {
        submenu.push({ type: 'separator' }, { role: 'toggleDevTools', label: 'Developer Tools', accelerator: 'F12' });
    }
    return { label: 'View', submenu };
}

function configureSessionSecurity() {
    const csp = [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: http://localhost:* http://127.0.0.1:*",
        "media-src 'self' data: blob: http://localhost:* http://127.0.0.1:*",
        "font-src 'self' data:",
        "connect-src 'self' https://mehrgrewal.com http://localhost:* http://127.0.0.1:* blob: data:",
        "worker-src 'self' blob:",
        "frame-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
    ].join('; ');
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': [csp],
                'X-Content-Type-Options': ['nosniff'],
            },
        });
    });
}

// =====================================================
// Main Window
// =====================================================
function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 768,
        show: false,
        title: (() => {
            const lic = getLicenseData();
            if (lic) return `One Clickz - ${lic.plan.charAt(0).toUpperCase() + lic.plan.slice(1)} License`;
            const trial = getTrialInfo();
            return `One Clickz - Trial (${trial.remaining} days remaining)`;
        })(),
        icon: path.join(__dirname, 'icon.ico'),
        webPreferences: viewerWebPreferences()
    });

    // Application menu
    const menu = Menu.buildFromTemplate([
        {
            label: 'File',
            submenu: [
                { label: 'Patients', click: () => mainWindow.loadURL(`${APP_URL}`) },
                { type: 'separator' },
                { role: 'quit', label: 'Exit' }
            ]
        },
        buildViewMenu(),
        {
            label: 'Tools',
            submenu: [
                { label: 'Open Orthanc', click: () => shell.openExternal(`http://localhost:${ORTHANC_PORT}`) },
                { label: 'View Logs', click: () => shell.openPath(logsDir) }
            ]
        },
        {
            label: 'Help',
            submenu: [
                {
                    label: 'About',
                    click: () => dialog.showMessageBox(mainWindow, {
                        type: 'info',
                        title: 'About One Clickz',
                        message: 'One Clickz',
                        detail: 'Version 1.0.0 - Modern Desktop Edition\n\nProfessional DICOM viewing and analysis for healthcare professionals.\n\nFeatures:\n* Multi-format DICOM viewing\n* Network file receiving from USG/medical devices\n* Advanced image analysis tools\n* Offline operation\n* Secure file management'
                    })
                }
            ]
        }
    ]);
    Menu.setApplicationMenu(menu);

    mainWindow.once('ready-to-show', () => {
        if (splashWindow) { splashWindow.destroy(); splashWindow = null; }
        mainWindow.show();
        mainWindow.focus();
    });

    mainWindow.on('closed', () => { mainWindow = null; });

    mainWindow.on('focus', () => {
        if (mainWindow && mainWindow.webContents) mainWindow.webContents.focus();
    });

    registerWindowSecurity(mainWindow);
}

// =====================================================
// MySQL/MariaDB Management
// =====================================================
async function initMySQLData() {
    if (fs.existsSync(mysqlDataSubDir) && fs.readdirSync(mysqlDataSubDir).length > 0) return false;
    console.log('[MySQL] First run - initializing data directory...');
    if (!fs.existsSync(mysqlDataDir)) fs.mkdirSync(mysqlDataDir, { recursive: true });
    
    // MariaDB uses mysql_install_db.exe (not mysqld --initialize-insecure which is MySQL 5.7+)
    const installDbPath = path.join(mysqlDir, 'bin', 'mysql_install_db.exe');
    if (fs.existsSync(installDbPath)) {
        console.log('[MySQL] Using mysql_install_db.exe...');
        execSync(`"${installDbPath}" --datadir="${mysqlDataSubDir}" --password="" --default-user --silent`, {
            timeout: 120000, stdio: 'pipe', cwd: mysqlDir
        });
    } else {
        // Fallback for older MySQL distributions
        console.log('[MySQL] Using mysqld --initialize-insecure...');
        execSync(`"${mysqldPath}" --initialize-insecure --datadir="${mysqlDataSubDir}" --basedir="${mysqlDir}"`, {
            timeout: 120000, stdio: 'pipe'
        });
    }
    console.log('[MySQL] Data directory initialized');
    return true;
}

function ensurePortFree(port) {
    try {
        const output = execSync(`netstat -ano | findstr :${port}`, { stdio: 'pipe' }).toString();
        const lines = output.split('\n').filter(l => l.includes('LISTENING'));
        for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            const pid = parts[parts.length - 1];
            if (pid && pid !== '0') {
                console.log(`[Startup] Killing process ${pid} on port ${port}...`);
                execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
            }
        }
    } catch (e) { /* ignore if port is already free */ }
}

function startMySQL() {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(mysqldPath)) {
            if (isDev) { console.log('[MySQL] Using system MySQL (dev mode)'); resolve(); return; }
            reject(new Error('MySQL not found: ' + mysqldPath)); return;
        }

        // Ensure port is free
        ensurePortFree(MYSQL_PORT);

        console.log('[MySQL] Starting MariaDB...');
        mysqlProcess = spawn(mysqldPath, [
            `--datadir=${mysqlDataSubDir}`, `--basedir=${mysqlDir}`,
            `--port=${MYSQL_PORT}`, '--skip-grant-tables', '--skip-networking=0',
            '--bind-address=127.0.0.1', '--socket=', '--console'
        ], { cwd: mysqlDir, stdio: ['ignore', 'pipe', 'pipe'] });

        mysqlProcess.stdout.on('data', d => console.log(`[MySQL] ${d.toString().trim()}`));
        mysqlProcess.stderr.on('data', d => console.log(`[MySQL] ${d.toString().trim()}`));
        mysqlProcess.on('error', reject);
        mysqlProcess.on('close', code => { console.log(`[MySQL] Exited: ${code}`); mysqlProcess = null; });
        // Reduced from 3000 to 500ms since waitForMySQL handles verification
        setTimeout(resolve, 500);
    });
}

function stopMySQL() {
    if (!mysqlProcess) return;
    console.log('[MySQL] Stopping...');
    try {
        if (fs.existsSync(mysqlClientPath)) {
            try { execSync(`"${mysqlClientPath}" -u root --port=${MYSQL_PORT} -e "SHUTDOWN"`, { timeout: 10000, stdio: 'pipe' }); }
            catch { mysqlProcess.kill('SIGTERM'); }
        } else { mysqlProcess.kill('SIGTERM'); }
    } catch { mysqlProcess.kill('SIGTERM'); }
    mysqlProcess = null;
}

async function waitForMySQL(maxAttempts = 30) {
    const net = require('net');
    const port = (isDev && !fs.existsSync(mysqldPath)) ? 3306 : MYSQL_PORT;
    for (let i = 0; i < maxAttempts; i++) {
        try {
            await new Promise((resolve, reject) => {
                const socket = net.createConnection({ host: '127.0.0.1', port });
                socket.on('connect', () => { socket.destroy(); resolve(); });
                socket.on('error', (err) => { socket.destroy(); reject(err); });
                setTimeout(() => { socket.destroy(); reject(new Error('timeout')); }, 2000);
            });
            console.log('[MySQL] Ready!');
            return true;
        } catch { console.log(`[MySQL] Waiting... (${i + 1}/${maxAttempts})`); await new Promise(r => setTimeout(r, 1000)); }
    }
    return false;
}

// Check for system MySQL (XAMPP on 3306, or any other MySQL)
async function waitForSystemMySQL(maxAttempts = 5) {
    const net = require('net');
    const systemPorts = [3306, 3307, 3308]; // Common MySQL ports
    
    for (const port of systemPorts) {
        for (let i = 0; i < maxAttempts; i++) {
            try {
                await new Promise((resolve, reject) => {
                    const socket = net.createConnection({ host: '127.0.0.1', port });
                    socket.on('connect', () => { socket.destroy(); resolve(); });
                    socket.on('error', (err) => { socket.destroy(); reject(err); });
                    setTimeout(() => { socket.destroy(); reject(new Error('timeout')); }, 1000);
                });
                console.log(`[MySQL] System MySQL found on port ${port}`);
                return true;
            } catch { /* try next */ }
        }
    }

    // Try to start XAMPP MySQL if available
    const xamppMysql = 'C:\\xampp\\mysql\\bin\\mysqld.exe';
    if (fs.existsSync(xamppMysql)) {
        console.log('[MySQL] Attempting to start XAMPP MySQL...');
        try {
            spawn(xamppMysql, ['--defaults-file=C:\\xampp\\mysql\\bin\\my.ini'], { 
                stdio: 'ignore', detached: true 
            }).unref();
            // Wait for it
            for (let i = 0; i < 15; i++) {
                try {
                    await new Promise((resolve, reject) => {
                        const socket = net.createConnection({ host: '127.0.0.1', port: 3306 });
                        socket.on('connect', () => { socket.destroy(); resolve(); });
                        socket.on('error', reject);
                        setTimeout(() => { socket.destroy(); reject(new Error('timeout')); }, 1000);
                    });
                    console.log('[MySQL] XAMPP MySQL started successfully');
                    return true;
                } catch { await new Promise(r => setTimeout(r, 1000)); }
            }
        } catch (e) { console.warn('[MySQL] Could not start XAMPP MySQL:', e.message); }
    }

    return false;
}

// Run all *.sql migrations from one directory against one database, tracked in
// that DB's app_migrations table (so each runs exactly once; CREATE TABLE IF
// NOT EXISTS + the per-file try/catch keep it safe to re-point at an existing DB).
// The DB the PHP API actually connects to — read from config/.env (DB_NAME),
// exactly like includes/config.php does, so Node migrations and PHP queries
// always hit the same database. Falls back to the historical default.
function phpConfiguredDbName() {
    try {
        const txt = fs.readFileSync(path.join(appPath, 'config', '.env'), 'utf8');
        const m = txt.match(/^\s*DB_NAME\s*=\s*(.+?)\s*$/m);
        if (m) return m[1].trim().replace(/^["']|["']$/g, '');
    } catch { /* no .env — use default */ }
    return 'dicom_viewer_pro';
}

async function runMigrations() {
    const dbName = phpConfiguredDbName();
    // Core set: the bundled www migrations (multi-clinic, licensing, …).
    await runMigrationSet(dbName, path.join(wwwPath, 'database', 'migrations'));
    // Feature set: the fetal module / catalogs live in the project-root
    // database/migrations. This is what creates the `examinations` table the
    // report flow needs. Exclude files that also ship in the www set so the
    // shared base files 001-004 (with plain seed INSERTs) don't run twice.
    const wwwDir = path.join(wwwPath, 'database', 'migrations');
    const wwwNames = fs.existsSync(wwwDir)
        ? new Set(fs.readdirSync(wwwDir).filter(f => f.endsWith('.sql')))
        : new Set();
    await runMigrationSet(dbName, path.join(appPath, 'database', 'migrations'), wwwNames);
}

async function runMigrationSet(dbName, migrationsDir, excludeFilenames = new Set()) {
    if (!migrationsDir || !fs.existsSync(migrationsDir)) return;
    const cmd = isDev && !fs.existsSync(mysqlClientPath)
        ? 'C:\\xampp\\mysql\\bin\\mysql.exe -u root -h 127.0.0.1 -P 3306'
        : `"${mysqlClientPath}" -u root --port=${MYSQL_PORT} --skip-ssl`;

    // Create database
    try {
        execSync(`${cmd} -e "CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"`, {
            timeout: 10000, stdio: 'pipe', shell: true
        });
    } catch (e) { /* ignore */ }

    // Ensure migrations table exists
    try {
        execSync(`${cmd} "${dbName}" -e "CREATE TABLE IF NOT EXISTS \`app_migrations\` (\`id\` int(11) NOT NULL AUTO_INCREMENT, \`filename\` varchar(255) NOT NULL, \`applied_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (\`id\`), UNIQUE KEY \`filename\` (\`filename\`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"`, {
            timeout: 10000, stdio: 'pipe', shell: true
        });
    } catch (e) { /* ignore */ }

    // Get applied migrations
    let appliedMigrations = [];
    try {
        const output = execSync(`${cmd} "${dbName}" -N -e "SELECT filename FROM app_migrations"`, {
            timeout: 10000, stdio: 'pipe', shell: true
        }).toString();
        appliedMigrations = output.split('\n').map(s => s.trim()).filter(Boolean);
    } catch (e) { console.warn('[MySQL] Failed to fetch applied migrations:', e.message); }

    const sqlFiles = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql') && !excludeFilenames.has(f)).sort();
    const pendingFiles = sqlFiles.filter(f => !appliedMigrations.includes(f));

    if (pendingFiles.length === 0) {
        console.log('[MySQL] All migrations are up to date');
        return;
    }

    console.log(`[MySQL] Running ${pendingFiles.length} new migrations...`);

    for (const sqlFile of pendingFiles) {
        try {
            console.log(`[MySQL] Running ${sqlFile}...`);
            const filePath = path.join(migrationsDir, sqlFile).replace(/\\/g, '/');
            // Use --execute="source ..." instead of < redirection for better shell compatibility
            execSync(`${cmd} "${dbName}" -e "source ${filePath}"`, {
                timeout: 30000, stdio: 'pipe', shell: true
            });

            // Mark as applied
            execSync(`${cmd} "${dbName}" -e "INSERT INTO app_migrations (filename) VALUES ('${sqlFile}')"`, {
                timeout: 10000, stdio: 'pipe', shell: true
            });
            console.log(`[MySQL] + ${sqlFile} (applied)`);
        } catch (e) {
            const msg = e.stderr ? e.stderr.toString() : e.message;
            // If it's just the SSL warning, we might have actually succeeded
            if (msg.includes('WARNING: option --ssl-verify-server-cert is disabled')) {
                // If the file is now in app_migrations, it actually worked
                try {
                    const check = execSync(`${cmd} "${dbName}" -N -e "SELECT id FROM app_migrations WHERE filename='${sqlFile}'"`, { stdio: 'pipe' }).toString().trim();
                    if (check) {
                        console.log(`[MySQL] + ${sqlFile} (applied despite warning)`);
                        continue;
                    }
                } catch (e2) { }
            }
            console.error(`[MySQL] ! ${sqlFile} failed: ${msg.substring(0, 150)}`);
        }
    }
}

// =====================================================
// Orthanc Management
// =====================================================
function generateOrthancConfig() {
    const configPath = path.join(userDataPath, 'orthanc.json');
    const orthancConfigDir = isDev ? path.join(__dirname, 'orthanc-config') : path.join(appPath, 'orthanc-config');
    const luaScript = path.join(orthancConfigDir, 'dicom-callbacks.lua');
    const pluginsDir = orthancDir.replace(/\\/g, '/');
    const config = {
        Name: 'Hospital_DICOM_Server',
        HttpPort: ORTHANC_PORT,
        RemoteAccessAllowed: true,
        Plugins: [pluginsDir],
        DicomPort: 3458,
        DicomServerEnabled: true,
        DicomAet: 'ONECLICKZ',
        DicomCheckCalledAet: false,
        AuthenticationEnabled: true,
        RegisteredUsers: { [ORTHANC_USERNAME]: ORTHANC_PASSWORD },
        StorageDirectory: orthancStorageDir.replace(/\\/g, '/'),
        IndexDirectory: orthancDbDir.replace(/\\/g, '/'),
        HttpHeaders: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
            'Access-Control-Allow-Credentials': 'true'
        },
        HttpCompressionEnabled: true,
        DicomWeb: { Enable: true, Root: '/dicom-web/', EnableWado: true, WadoRoot: '/wado/', Ssl: false },
        UnknownSopClassAccepted: true,
        KeepAlive: true,
        TcpNoDelay: true,
        LogLevel: 'warning'
    };
    if (fs.existsSync(luaScript)) config.LuaScripts = [luaScript.replace(/\\/g, '/')];
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    return configPath;
}

function startOrthanc() {
    return new Promise(resolve => {
        if (!fs.existsSync(orthancExePath)) {
            if (isDev) console.log('[Orthanc] Not found (dev mode)');
            resolve(); return;
        }

        // Ensure port is free
        ensurePortFree(ORTHANC_PORT);

        console.log('[Orthanc] Starting...');
        const configPath = generateOrthancConfig();
        orthancProcess = spawn(orthancExePath, [configPath], { cwd: orthancDir, stdio: ['ignore', 'pipe', 'pipe'] });
        orthancProcess.stdout.on('data', d => console.log(`[Orthanc] ${d.toString().trim()}`));
        orthancProcess.stderr.on('data', d => console.log(`[Orthanc] ${d.toString().trim()}`));
        orthancProcess.on('error', err => { console.warn('[Orthanc] Error:', err.message); resolve(); });
        orthancProcess.on('close', code => { console.log(`[Orthanc] Exited: ${code}`); orthancProcess = null; });
        // Reduced from 2000 to 500ms
        setTimeout(resolve, 500);
    });
}

function stopOrthanc() {
    if (orthancProcess) { console.log('[Orthanc] Stopping...'); orthancProcess.kill('SIGTERM'); orthancProcess = null; }
}

async function waitForOrthanc(maxAttempts = 15) {
    for (let i = 0; i < maxAttempts; i++) {
        try {
            await new Promise((resolve, reject) => {
                const req = http.request({
                    host: '127.0.0.1', port: ORTHANC_PORT, path: '/system', timeout: 2000,
                    headers: { Authorization: orthancAuthHeader() }
                }, res => { res.statusCode === 200 ? resolve(true) : reject(new Error(`Status ${res.statusCode}`)); });
                req.on('error', reject);
                req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
                req.end();
            });
            console.log('[Orthanc] Ready!');
            return true;
        } catch { await new Promise(r => setTimeout(r, 500)); }
    }
    return false;
}

// =====================================================
// Static File Server (replaces PHP - serves Vite dist)
// =====================================================
const mime = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.webp': 'image/webp',
};

let staticServer = null;
// Local PHP backend. Rather than depend on a manually-started XAMPP Apache,
// we spawn PHP's built-in server against the app root (which contains api/)
// and proxy /api + *.php to it. php.exe is bundled in production (phpPath).
const PHP_API_PORT = Number(process.env.ONECLICKZ_PHP_PORT || 8091);
const PHP_API_ROOT = appPath; // contains api/, www/, includes/ …
let phpApiProcess = null;

function startPhpApiServer() {
    return new Promise((resolve) => {
        if (!fs.existsSync(phpPath)) {
            console.warn('[PHP] php.exe not found at', phpPath, '- /api calls will fail until a PHP backend is reachable.');
            return resolve(false);
        }
        try {
            ensurePortFree(PHP_API_PORT);
            phpApiProcess = spawn(phpPath, ['-S', `127.0.0.1:${PHP_API_PORT}`, '-t', PHP_API_ROOT], {
                cwd: PHP_API_ROOT,
                windowsHide: true,
            });
            console.log(`[PHP] built-in server on 127.0.0.1:${PHP_API_PORT} (root: ${PHP_API_ROOT})`);
            phpApiProcess.stderr?.on('data', (d) => {
                const s = d.toString().trim();
                if (s) console.log('[PHP]', s);
            });
            phpApiProcess.on('exit', (code) => { if (code) console.warn('[PHP] server exited code', code); phpApiProcess = null; });
            phpApiProcess.on('error', (e) => { console.error('[PHP] failed to start:', e.message); phpApiProcess = null; });
            resolve(true);
        } catch (e) {
            console.error('[PHP] spawn error:', e.message);
            resolve(false);
        }
    });
}

function stopPhpApiServer() {
    if (phpApiProcess && !phpApiProcess.killed) { try { phpApiProcess.kill(); } catch {} }
    phpApiProcess = null;
}

function startStaticServer() {
    return new Promise((resolve) => {
        ensurePortFree(PHP_PORT);
        const distPath = path.join(wwwPath, 'dist');
        console.log('[StaticServer] Starting on port', PHP_PORT, '->', distPath);

        staticServer = http.createServer((req, res) => {
            const parsed = url.parse(req.url);
            let reqPath = parsed.pathname;

            // Proxy /api/ + *.php requests to the local PHP built-in server.
            // The PHP root IS the app dir (contains api/), so no path prefix is
            // needed — /api/pcpndt/prefill.php maps straight to api/pcpndt/...
            if (reqPath.startsWith('/api/') || reqPath.endsWith('.php')) {
                const proxyOpts = {
                    hostname: '127.0.0.1',
                    port: PHP_API_PORT,
                    path: parsed.path,
                    method: req.method,
                    // php -S is single-threaded and deadlocks on pooled keep-alive
                    // sockets — force a fresh connection that closes after each
                    // response so back-to-back /api calls don't hang.
                    agent: false,
                    headers: { ...req.headers, host: `127.0.0.1:${PHP_API_PORT}`, connection: 'close' },
                };
                const proxyReq = http.request(proxyOpts, (proxyRes) => {
                    res.writeHead(proxyRes.statusCode, proxyRes.headers);
                    proxyRes.pipe(res, { end: true });
                });
                // 5 min timeout - image conversion / multi-file uploads can be slow
                proxyReq.setTimeout(300000, () => {
                    proxyReq.destroy(new Error('PHP request timed out'));
                });
                proxyReq.on('error', (err) => {
                    const isDown = err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET';
                    console.error('[StaticServer] PHP proxy error:', err.code || err.message);
                    if (res.headersSent) { try { res.end(); } catch {} return; }
                    res.writeHead(502, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        ok: false,
                        code: isDown ? 'PHP_DOWN' : 'PROXY_ERROR',
                        error: isDown
                            ? 'Local PHP server is not running. Please restart the application.'
                            : 'API proxy error: ' + err.message,
                    }));
                });
                req.pipe(proxyReq, { end: true });
                return;
            }

            // Try exact file first
            let filePath = path.join(distPath, reqPath);
            const ext = path.extname(filePath).toLowerCase();

            // SPA fallback: any non-file request -> index.html
            const serveFile = (fp) => {
                fs.readFile(fp, (err, data) => {
                    if (err) {
                        res.writeHead(404); res.end('Not found');
                        return;
                    }
                    const fileExt = path.extname(fp).toLowerCase();
                    res.writeHead(200, { 'Content-Type': mime[fileExt] || 'application/octet-stream' });
                    res.end(data);
                });
            };

            if (ext && mime[ext]) {
                // Known asset - serve directly, fallback to 404
                fs.access(filePath, fs.constants.F_OK, (err) => {
                    if (err) { res.writeHead(404); res.end('Not found'); }
                    else serveFile(filePath);
                });
            } else {
                // SPA route - always serve index.html
                serveFile(path.join(distPath, 'index.html'));
            }
        });

        staticServer.listen(PHP_PORT, '127.0.0.1', () => {
            console.log('[StaticServer] Ready on port', PHP_PORT);
            resolve(true);
        });
        staticServer.on('error', (err) => {
            console.error('[StaticServer] Error:', err.message);
            resolve(false);
        });
    });
}

function stopStaticServer() {
    if (staticServer) { staticServer.close(); staticServer = null; }
}

// Keep these names for startup compatibility
const startPhpServer = startStaticServer;
function stopPhpServer() { stopStaticServer(); }

async function waitForServer(maxAttempts = 10) {
    // Static server resolves synchronously - just do a quick health check
    for (let i = 0; i < maxAttempts; i++) {
        try {
            await new Promise((resolve, reject) => {
                const req = http.request({ host: '127.0.0.1', port: PHP_PORT, timeout: 1000 }, () => resolve(true));
                req.on('error', reject);
                req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
                req.end();
            });
            return true;
        } catch { await new Promise(r => setTimeout(r, 200)); }
    }
    return true; // Static server is reliable - don't block startup
}

async function checkViteRunning() {
    return new Promise(resolve => {
        const req = http.request({ host: 'localhost', port: VITE_PORT, timeout: 1000 }, res => {
            resolve(res.statusCode === 200 || res.statusCode === 304 || (res.statusCode >= 200 && res.statusCode < 400));
        });
        req.on('error', () => resolve(false));
        req.on('timeout', () => { req.destroy(); resolve(false); });
        req.end();
    });
}

// =====================================================
// Firewall Configuration
// =====================================================
function configureFirewall() {
    const rules = [
        { name: 'One Clickz - Web Server', port: PHP_PORT },
        { name: 'One Clickz - DICOM Server', port: DICOM_PORT },
        { name: 'One Clickz - Orthanc HTTP', port: ORTHANC_PORT },
        { name: 'One Clickz - Orthanc DICOM', port: 3458 },
        { name: 'One Clickz - Network Receiver', port: 10104 },
        { name: 'One Clickz - MySQL', port: MYSQL_PORT },
    ];

    for (const rule of rules) {
        try {
            // Check if rule already exists
            const check = execSync(`netsh advfirewall firewall show rule name="${rule.name}"`, { stdio: 'pipe', shell: true }).toString();
            if (check.includes(rule.name)) continue;
        } catch { /* rule doesn't exist */ }

        try {
            execSync(`netsh advfirewall firewall add rule name="${rule.name}" dir=in action=allow protocol=TCP localport=${rule.port}`, {
                stdio: 'pipe', shell: true
            });
            console.log(`[Firewall] Added rule: ${rule.name} (port ${rule.port})`);
        } catch (e) {
            console.warn(`[Firewall] Could not add rule for port ${rule.port}: ${e.message}`);
        }
    }
}

// =====================================================
// Auto Install Dependencies
// =====================================================
async function ensureDependencies() {
    // Check root node_modules
    const rootNodeModules = path.join(__dirname, 'node_modules');
    if (!fs.existsSync(rootNodeModules) || !fs.existsSync(path.join(rootNodeModules, 'electron'))) {
        console.log('[Setup] Installing root dependencies...');
        updateSplashStatus('Installing dependencies...');
        try {
            execSync('npm install --production', { cwd: __dirname, stdio: 'pipe', shell: true, timeout: 120000 });
        } catch (e) {
            console.warn('[Setup] Root npm install warning:', e.message?.substring(0, 200));
        }
    }

    // Check www node_modules
    const wwwNodeModules = path.join(wwwPath, 'node_modules');
    if (!fs.existsSync(wwwNodeModules)) {
        console.log('[Setup] Installing www dependencies...');
        updateSplashStatus('Installing frontend dependencies...');
        try {
            execSync('npm install', { cwd: wwwPath, stdio: 'pipe', shell: true, timeout: 180000 });
        } catch (e) {
            console.warn('[Setup] www npm install warning:', e.message?.substring(0, 200));
        }
    }
}

// =====================================================
// Main Startup
// =====================================================
async function startApp() {
    try {
        ensureDirectories();
        createSplashWindow();

        // Auto-install dependencies if missing (fresh clone scenario)
        if (isDev) {
            await ensureDependencies();
        }

        updateSplashStatus('Building frontend...');
        await ensureFrontendBuild();

        // Configure firewall rules (non-blocking - warn on failure)
        updateSplashStatus('Configuring firewall...');
        try { configureFirewall(); } catch (e) {
            console.warn('[Startup] Firewall config skipped:', e.message);
        }

        const usePortableMySQL = fs.existsSync(mysqldPath);

        // 1. Kick off all services in parallel
        updateSplashStatus('Starting services...');
        console.log('[Startup] Initializing services in parallel...');

        const mysqlPromise = (async () => {
            updateSplashStatus('Starting MySQL...');
            if (usePortableMySQL) {
                const firstRun = !fs.existsSync(mysqlDataSubDir) || fs.readdirSync(mysqlDataSubDir).length === 0;
                if (firstRun) {
                    updateSplashStatus('Initializing database (first run)...');
                    await initMySQLData();
                }
                await startMySQL();
            }
            updateSplashStatus('Waiting for MySQL...');
            return await waitForMySQL(30);
        })();

        const orthancPromise = (async () => {
            updateSplashStatus('Starting Orthanc PACS...');
            await startOrthanc();
            return await waitForOrthanc(15);
        })();

        const phpPromise = (async () => {
            updateSplashStatus('Starting web server...');
            // In dev the renderer loads from Vite (5173), whose own plugin spawns
            // PHP on 8091 rooted at the htdocs parent (so its /dcm-prefixed proxy
            // resolves). Starting a second PHP here — rooted at the app dir — would
            // fight for the same port and serve the wrong root. So the bundled PHP
            // backend is prod-only; dev relies on Vite's PHP.
            if (!isDev) await startPhpApiServer();
            await startPhpServer();      // static SPA server (proxies /api → PHP)
            return await waitForServer();
        })();

        // Start independent services
        startDicomServer();
        startNetworkReceiverOnAppReady();

        // 2. Wait for MySQL to finish so we can run migrations
        const mysqlReady = await mysqlPromise;
        if (!mysqlReady) {
            // Try to detect system MySQL (XAMPP, etc.)
            updateSplashStatus('Portable MySQL failed, checking system...');
            console.warn('[MySQL] Portable MySQL failed, checking system MySQL...');
            const systemMysqlReady = await waitForSystemMySQL();
            if (!systemMysqlReady) {
                dialog.showErrorBox('Database Error',
                    'Could not start MySQL database.\n\n' +
                    'Please ensure one of the following:\n' +
                    '* The mysql/ folder exists in the application directory\n' +
                    '* XAMPP MySQL is running on port 3306\n' +
                    '* MySQL/MariaDB is installed and running on the system\n\n' +
                    'The application will continue without database features.'
                );
            }
        }

        // Run migrations (blocks until done, but only runs new ones)
        updateSplashStatus('Running database migrations...');
        try { await runMigrations(); } catch (e) { console.error('[Startup] Migration warning:', e.message); }

        // 3. Wait for static server and Orthanc
        updateSplashStatus('Waiting for services...');
        const [orthancReady, phpReady] = await Promise.all([orthancPromise, phpPromise]);
        console.log(`[Startup] Orthanc: ${orthancReady ? 'running' : 'not available'}`);
        console.log(`[Startup] Static server: ${phpReady ? 'running' : 'retrying...'}`);
        // Static server is always reliable - no hard failure needed

        // 4. Final dev-only checks
        if (isDev) {
            try {
                const viteRunning = await checkViteRunning();
                if (viteRunning) {
                    console.log(`[Startup] Vite dev server detected on port ${VITE_PORT}!`);
                    APP_URL = `http://localhost:${VITE_PORT}`;
                }
            } catch (e) { console.log('[Startup] Vite check skipped'); }
        }

        // 5. Show window
        updateSplashStatus('Loading application...');
        createMainWindow();
        console.log(`[Startup] Loading application from: ${APP_URL}`);
        mainWindow.loadURL(APP_URL);

    } catch (error) {
        console.error('[Startup] Global error:', error);
        dialog.showErrorBox('Startup Error', error.message);
        app.quit();
    }
}

// =====================================================
// DICOM File Server (port 3457)
// =====================================================
let dicomServer = null;

function startDicomServer() {
    dicomServer = http.createServer(async (req, res) => {
        const parsedUrl = url.parse(req.url, true);
        const origin = req.headers.origin || '';
        const allowedOrigins = new Set([APP_URL, `http://localhost:${VITE_PORT}`, `http://127.0.0.1:${VITE_PORT}`].map(v => {
            try { return new URL(v).origin; } catch { return v; }
        }));
        if (origin && allowedOrigins.has(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-OneClickz-Token');
        res.setHeader('Vary', 'Origin');
        if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
        const requestToken = parsedUrl.query.token || req.headers['x-oneclickz-token'];
        if (requestToken !== DICOM_ACCESS_TOKEN) {
            res.statusCode = 403;
            res.end('Forbidden');
            return;
        }

        // Serve a DICOM file by path
        if (parsedUrl.pathname === '/api/dicom/serve-file.php') {
            const filePath = parsedUrl.query.path;
            if (!filePath) { res.statusCode = 400; res.end('Missing path'); return; }

            try {
                const resolved = path.resolve(filePath);
                if (!isAllowedDicomPath(resolved, 'file') || !isPlausibleDicomPath(resolved)) {
                    res.statusCode = 403;
                    res.end('Forbidden');
                    return;
                }
                if (!fs.existsSync(resolved)) { res.statusCode = 404; res.end('Not found'); return; }
                const stat = fs.statSync(resolved);
                res.setHeader('Content-Type', 'application/dicom');
                res.setHeader('Content-Length', stat.size);
                res.setHeader('Cache-Control', 'public, max-age=86400');
                res.statusCode = 200;
                fs.createReadStream(resolved).pipe(res);
            } catch (err) {
                res.statusCode = 500; res.end(err.message);
            }
            return;
        }

        // Scan a directory for DICOM files and extract patient metadata
        // Supports streaming mode (?stream=1) for large directories
        if (parsedUrl.pathname === '/api/dicom/scan-patients') {
            const dirPath  = parsedUrl.query.dir;
            // NEW: also accept an explicit file list (JSON-encoded array of
            // absolute paths). Lets the renderer scan exactly the files the
            // user picked in the open dialog instead of an entire folder.
            const filesArg = parsedUrl.query.files;
            const limit = parseInt(parsedUrl.query.limit || '10000', 10);
            const streamMode = parsedUrl.query.stream === '1';

            // Support POST too - multi-file selections can exceed URL length.
            let postBody = null;
            if (req.method === 'POST') {
                postBody = await new Promise((resolve) => {
                    let buf = '';
                    req.on('data', c => buf += c);
                    req.on('end', () => { try { resolve(JSON.parse(buf || '{}')); } catch { resolve({}); } });
                    req.on('error', () => resolve({}));
                });
            }

            const explicitFiles = (postBody && Array.isArray(postBody.files))
                ? postBody.files
                : (filesArg ? (() => { try { return JSON.parse(filesArg); } catch { return null; } })() : null);

            if (!dirPath && (!explicitFiles || !explicitFiles.length)) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: false, error: 'Provide either `dir` or `files` (array of paths)' }));
                return;
            }

            try {
                const dicomFiles = [];
                let resolved = '';

                // The caller is token-authenticated and explicitly asked to scan
                // these paths, so authorize them before the allowed-roots checks
                // below — otherwise a legitimately-opened study's files get dropped.
                if (explicitFiles && explicitFiles.length) explicitFiles.forEach(authorizeDicomPath);
                if (dirPath) authorizeDicomPath(dirPath);

                if (explicitFiles && explicitFiles.length) {
                    // Use the files the user explicitly picked. Filter for
                    // plausible DICOM filenames AND verify each exists.
                    for (const fp of explicitFiles) {
                        if (dicomFiles.length >= limit) break;
                        try {
                            const abs = path.resolve(fp);
                            if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) continue;
                            if (!isAllowedDicomPath(abs, 'file') || !isPlausibleDicomPath(abs)) continue;
                            const lower = path.basename(abs).toLowerCase();
                            // Allow .dcm / .dicom / extensionless / unknown
                            // extensions - let the parser decide. We do skip
                            // common non-DICOM file types.
                            if (/\.(png|jpe?g|gif|bmp|webp|pdf|txt|json|xml|zip|exe|dll|csv|xlsx?|docx?)$/i.test(lower)) continue;
                            dicomFiles.push(abs);
                        } catch { /* skip unreadable */ }
                    }
                    resolved = explicitFiles[0] ? path.dirname(path.resolve(explicitFiles[0])) : '';
                } else {
                    resolved = path.resolve(dirPath);
                    if (!isAllowedDicomPath(resolved, 'directory')) {
                        res.statusCode = 403;
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify({ success: false, error: 'Directory is outside allowed DICOM roots' }));
                        return;
                    }
                    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
                        res.statusCode = 404;
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify({ success: false, error: 'Directory not found' }));
                        return;
                    }

                    // Collect files (non-blocking via setImmediate batches)
                    // Use exclusion-based filter: skip known non-DICOM types, include everything else.
                    // The parser will validate - non-DICOM files silently fail.
                    const NON_DICOM_RE = /\.(png|jpe?g|gif|bmp|webp|tiff?|pdf|txt|json|xml|html?|css|zip|rar|7z|gz|tar|exe|dll|msi|bat|sh|py|js|ts|csv|xlsx?|docx?|pptx?|ini|log|cfg|yaml|yml|md|sql|db|sqlite|mp[34]|avi|mov|mkv|wav|flac)$/i;
                    const collectFilesAsync = (dirs) => {
                        return new Promise((resolve) => {
                            let idx = 0;
                            function processBatch() {
                                const batchEnd = Math.min(idx + 200, dirs.length);
                                while (idx < batchEnd) {
                                    if (dicomFiles.length >= limit) { resolve(); return; }
                                    const dir = dirs[idx++];
                                    try {
                                        const entries = fs.readdirSync(dir, { withFileTypes: true });
                                        for (const entry of entries) {
                                            if (dicomFiles.length >= limit) { resolve(); return; }
                                            const fullPath = path.join(dir, entry.name);
                                            if (entry.isDirectory()) {
                                                dirs.push(fullPath);
                                            } else if (entry.isFile()) {
                                                const name = entry.name.toLowerCase();
                                                if (name === 'dicomdir') continue;
                                                if (NON_DICOM_RE.test(name)) continue;
                                                dicomFiles.push(fullPath);
                                            }
                                        }
                                    } catch { /* skip unreadable dirs */ }
                                }
                                if (idx < dirs.length && dicomFiles.length < limit) {
                                    setImmediate(processBatch);
                                } else {
                                    resolve();
                                }
                            }
                            processBatch();
                        });
                    };
                    await collectFilesAsync([resolved]);
                }

                let dicomParser;
                try {
                    dicomParser = require('dicom-parser');
                } catch {
                    try {
                        dicomParser = require(path.join(__dirname, 'www', 'node_modules', 'dicom-parser'));
                    } catch {
                        res.statusCode = 500;
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify({ success: false, error: 'dicom-parser not available' }));
                        return;
                    }
                }

                function readTag(dataSet, tag) {
                    try { return (dataSet.string(tag) || '').trim(); } catch { return ''; }
                }

                // Parse DICOMDIR files: extract patient/study metadata and referenced image file paths
                function parseDicomDir(filePath, fullBuffer, dicomParserLib) {
                    const results = []; // array of { studyUID, patientName, patientId, age, sex, studyDate, studyDescription, modality, accessionNumber, referringPhysician, referencedFiles[] }
                    try {
                        const dataSet = dicomParserLib.parseDicom(new Uint8Array(fullBuffer));
                        const dirRecSeq = dataSet.elements['x00041220'];
                        if (!dirRecSeq || !dirRecSeq.items) return results;

                        const dirBase = path.dirname(filePath);
                        let currentPatient = {};
                        let currentStudy = {};
                        let currentSeries = {};

                        for (const item of dirRecSeq.items) {
                            const ds = item.dataSet;
                            if (!ds) continue;
                            const recType = (ds.string('x00041430') || '').trim().toUpperCase();

                            if (recType === 'PATIENT') {
                                const rawName = (ds.string('x00100010') || '').replace(/\^/g, ' ').trim();
                                currentPatient = {
                                    patientName: rawName || 'Unknown',
                                    patientId: (ds.string('x00100020') || '').trim() || 'N/A',
                                    sex: (ds.string('x00100040') || '').trim(),
                                };
                            } else if (recType === 'STUDY') {
                                const rawDate = (ds.string('x00080020') || '').trim();
                                let formattedDate = rawDate;
                                if (rawDate.length === 8) {
                                    formattedDate = `${rawDate.slice(6, 8)}-${rawDate.slice(4, 6)}-${rawDate.slice(0, 4)}`;
                                }
                                currentStudy = {
                                    studyUID: (ds.string('x0020000d') || '').trim(),
                                    studyDate: formattedDate || new Date().toLocaleDateString(),
                                    studyDescription: (ds.string('x00081030') || '').trim(),
                                    accessionNumber: (ds.string('x00080050') || '').trim(),
                                    age: (ds.string('x00101010') || '').trim(),
                                };
                            } else if (recType === 'SERIES') {
                                currentSeries = {
                                    modality: (ds.string('x00080060') || '').trim() || 'OT',
                                };
                            } else if (recType === 'IMAGE') {
                                const refFileId = (ds.string('x00041500') || '').trim();
                                if (refFileId) {
                                    // Resolve the referenced file path relative to the DICOMDIR
                                    const refPath = path.join(dirBase, ...refFileId.split('\\'));
                                    const studyUID = currentStudy.studyUID || `dicomdir-${path.basename(filePath)}-${results.length}`;
                                    // Check if we already have an entry for this study
                                    let entry = results.find(r => r.studyUID === studyUID);
                                    if (!entry) {
                                        entry = {
                                            studyUID,
                                            patientName: currentPatient.patientName || 'Unknown',
                                            patientId: currentPatient.patientId || 'N/A',
                                            age: currentStudy.age || '',
                                            sex: currentPatient.sex || '',
                                            studyDate: currentStudy.studyDate || '',
                                            studyDescription: currentStudy.studyDescription || '',
                                            modality: currentSeries.modality || 'OT',
                                            accessionNumber: currentStudy.accessionNumber || '',
                                            referringPhysician: '',
                                            referencedFiles: [],
                                        };
                                        results.push(entry);
                                    }
                                    if (fs.existsSync(refPath) && fs.statSync(refPath).isFile()) {
                                        entry.referencedFiles.push(refPath);
                                    }
                                }
                            }
                        }

                        // If no referenced files were found on disk, create a study entry anyway
                        // using the DICOMDIR file itself so the patient at least appears in the list
                        if (results.length === 0 && dirRecSeq.items.length > 0) {
                            // Extract patient info from records
                            for (const item of dirRecSeq.items) {
                                const ds = item.dataSet;
                                if (!ds) continue;
                                const recType = (ds.string('x00041430') || '').trim().toUpperCase();
                                if (recType === 'PATIENT') {
                                    const rawName = (ds.string('x00100010') || '').replace(/\^/g, ' ').trim();
                                    const studyUID = `dicomdir-${path.basename(filePath)}-${results.length}`;
                                    results.push({
                                        studyUID,
                                        patientName: rawName || path.basename(filePath),
                                        patientId: (ds.string('x00100020') || '').trim() || 'N/A',
                                        age: '',
                                        sex: (ds.string('x00100040') || '').trim(),
                                        studyDate: new Date().toLocaleDateString(),
                                        studyDescription: '',
                                        modality: 'OT',
                                        accessionNumber: '',
                                        referringPhysician: '',
                                        referencedFiles: [filePath], // use DICOMDIR itself as fallback
                                    });
                                    break; // one patient entry per DICOMDIR
                                }
                            }
                        }
                    } catch { /* DICOMDIR parse failed - skip */ }
                    return results;
                }

                function addStudyEntry(studies, studyUID, meta, filePaths) {
                    if (!studies[studyUID]) {
                        studies[studyUID] = {
                            patientName: meta.patientName || 'Unknown',
                            patientId: meta.patientId || 'N/A',
                            age: meta.age || '',
                            sex: meta.sex || '',
                            studyDate: meta.studyDate || new Date().toLocaleDateString(),
                            studyDescription: meta.studyDescription || '',
                            modality: meta.modality || 'OT',
                            accessionNumber: meta.accessionNumber || '',
                            referringPhysician: meta.referringPhysician || '',
                            studyInstanceUID: studyUID,
                            files: [],
                            sopInstanceUIDs: new Set(),
                        };
                    }
                    for (const fp of filePaths) {
                        const normalized = fp.replace(/\\/g, '/');
                        if (!studies[studyUID].files.includes(normalized)) {
                            studies[studyUID].files.push(normalized);
                        }
                    }
                }

                /** Extract study metadata from a parsed DICOM DataSet and add
                 *  the file to the studies map. Returns true if successful. */
                function extractAndAddStudy(dataSet, studies, filePath) {
                    const rawStudyUID = readTag(dataSet, 'x0020000d');
                    const rawName     = readTag(dataSet, 'x00100010');
                    const rawPid      = readTag(dataSet, 'x00100020');
                    if (!rawStudyUID && !rawName && !rawPid) return false;

                    const studyUID = rawStudyUID || `unknown-${Object.keys(studies).length}`;
                    if (!studies[studyUID]) {
                        const rawDate = readTag(dataSet, 'x00080020');
                        let formattedDate = rawDate;
                        if (rawDate.length === 8) {
                            formattedDate = `${rawDate.slice(6, 8)}-${rawDate.slice(4, 6)}-${rawDate.slice(0, 4)}`;
                        }
                        studies[studyUID] = {
                            patientName: rawName.replace(/\^/g, ' ') || 'Unknown',
                            patientId: rawPid || 'N/A',
                            age: readTag(dataSet, 'x00101010') || '',
                            sex: readTag(dataSet, 'x00100040') || '',
                            studyDate: formattedDate || new Date().toLocaleDateString(),
                            studyDescription: readTag(dataSet, 'x00081030') || '',
                            modality: readTag(dataSet, 'x00080060') || 'OT',
                            accessionNumber: readTag(dataSet, 'x00080050') || '',
                            referringPhysician: (readTag(dataSet, 'x00080090') || '').replace(/\^/g, ' '),
                            studyInstanceUID: studyUID,
                            files: [],
                            sopInstanceUIDs: new Set(),
                        };
                    }
                    const sopInstanceUID = readTag(dataSet, 'x00080018');
                    if (sopInstanceUID && studies[studyUID].sopInstanceUIDs.has(sopInstanceUID)) return true;
                    if (sopInstanceUID) studies[studyUID].sopInstanceUIDs.add(sopInstanceUID);
                    studies[studyUID].files.push(filePath.replace(/\\/g, '/'));
                    return true;
                }

                /** Same as extractAndAddStudy but works with the partial
                 *  DataSet that dicom-parser throws when the buffer is
                 *  truncated (no readTag helper - call .string() directly). */
                function extractAndAddStudyFromPartial(ds, studies, filePath) {
                    const uid  = (ds.string('x0020000d') || '').trim();
                    const name = (ds.string('x00100010') || '').replace(/\^/g, ' ').trim();
                    const pid  = (ds.string('x00100020') || '').trim();
                    if (!uid && !name && !pid) return false;

                    const suid = uid || `unknown-${Object.keys(studies).length}`;
                    if (!studies[suid]) {
                        const rawDate = (ds.string('x00080020') || '').trim();
                        let formattedDate = rawDate;
                        if (rawDate.length === 8) formattedDate = `${rawDate.slice(6,8)}-${rawDate.slice(4,6)}-${rawDate.slice(0,4)}`;
                        studies[suid] = {
                            patientName: name || 'Unknown',
                            patientId: pid || 'N/A',
                            age: (ds.string('x00101010') || '').trim(),
                            sex: (ds.string('x00100040') || '').trim(),
                            studyDate: formattedDate || new Date().toLocaleDateString(),
                            studyDescription: (ds.string('x00081030') || '').trim(),
                            modality: (ds.string('x00080060') || '').trim() || 'OT',
                            accessionNumber: (ds.string('x00080050') || '').trim(),
                            referringPhysician: (ds.string('x00080090') || '').replace(/\^/g, ' ').trim(),
                            studyInstanceUID: suid,
                            files: [],
                            sopInstanceUIDs: new Set(),
                        };
                    }
                    const pSop = (ds.string('x00080018') || '').trim();
                    if (pSop && studies[suid].sopInstanceUIDs.has(pSop)) return true;
                    if (pSop) studies[suid].sopInstanceUIDs.add(pSop);
                    studies[suid].files.push(filePath.replace(/\\/g, '/'));
                    return true;
                }

                /** Full-fallback: reads the entire file, parses it, and adds
                 *  to studies. Handles both DICOMDIR and regular DICOM. */
                function fullFileFallback(filePath, studies) {
                    const fullBuf = fs.readFileSync(filePath);
                    const fullDs  = dicomParser.parseDicom(new Uint8Array(fullBuf));
                    const sop     = (fullDs.string('x00020002') || '').trim();
                    if (sop === '1.2.840.10008.1.3.10') {
                        const entries = parseDicomDir(filePath, fullBuf, dicomParser);
                        for (const entry of entries) {
                            addStudyEntry(studies, entry.studyUID, entry, entry.referencedFiles);
                        }
                    } else {
                        extractAndAddStudy(fullDs, studies, filePath);
                    }
                }

                // Stream mode: send progress events via SSE
                if (streamMode) {
                    res.setHeader('Content-Type', 'text/event-stream');
                    res.setHeader('Cache-Control', 'no-cache');
                    res.setHeader('Connection', 'keep-alive');
                    res.statusCode = 200;

                    // Send initial file count
                    res.write(`data: ${JSON.stringify({ type: 'progress', total: dicomFiles.length, processed: 0 })}\n\n`);

                    const studies = {};
                    const BATCH_SIZE = 50;

                    const processBatch = (startIdx) => {
                        const endIdx = Math.min(startIdx + BATCH_SIZE, dicomFiles.length);
                        for (let fi = startIdx; fi < endIdx; fi++) {
                            const filePath = dicomFiles[fi];
                            try {
                                const fileSize = fs.statSync(filePath).size;
                                const fd = fs.openSync(filePath, 'r');
                                const headerSize = Math.min(fileSize, 65536);
                                const buffer = Buffer.alloc(headerSize);
                                fs.readSync(fd, buffer, 0, headerSize, 0);
                                fs.closeSync(fd);

                                const byteArray = new Uint8Array(buffer);
                                const dataSet = dicomParser.parseDicom(byteArray, { untilTag: 'x7fe00010' });

                                const sopClassUID = readTag(dataSet, 'x00020002');

                                // DICOMDIR: parse directory records for patient metadata & referenced files
                                if (sopClassUID === '1.2.840.10008.1.3.10') {
                                    const fullBuf = fs.readFileSync(filePath);
                                    const entries = parseDicomDir(filePath, fullBuf, dicomParser);
                                    for (const entry of entries) {
                                        addStudyEntry(studies, entry.studyUID, entry, entry.referencedFiles);
                                    }
                                    continue;
                                }

                                extractAndAddStudy(dataSet, studies, filePath);
                            } catch (parseErr) {
                                // 1) Use partial dataSet from truncated-buffer parse
                                const partialDS = parseErr?.dataSet;
                                if (partialDS && extractAndAddStudyFromPartial(partialDS, studies, filePath)) {
                                    continue;
                                }
                                // 2) Full-file fallback: handles DICOMDIRs AND normal
                                //    DICOM files that need more than 64 KB to parse.
                                try { fullFileFallback(filePath, studies); } catch { /* truly unparseable - skip */ }
                            }
                        }

                        // Send progress
                        res.write(`data: ${JSON.stringify({ type: 'progress', total: dicomFiles.length, processed: endIdx })}\n\n`);

                        if (endIdx < dicomFiles.length) {
                            setImmediate(() => processBatch(endIdx));
                        } else {
                            // Send final result
                            const patients = Object.values(studies).map(s => ({
                                id: s.studyInstanceUID,
                                patientId: s.patientId,
                                patientName: s.patientName,
                                age: s.age,
                                sex: s.sex,
                                studyDate: s.studyDate,
                                studyDescription: s.studyDescription,
                                modality: s.modality,
                                accessionNumber: s.accessionNumber,
                                referringPhysician: s.referringPhysician,
                                images: s.files.length,
                                printed: false,
                                studyInstanceUID: s.studyInstanceUID,
                                filePaths: s.files,
                            }));

                            res.write(`data: ${JSON.stringify({ type: 'complete', success: true, directory: resolved, studyCount: patients.length, totalFiles: dicomFiles.length, patients })}\n\n`);
                            res.end();
                        }
                    };

                    processBatch(0);
                    return;
                }

                // Non-streaming mode: process in async batches to avoid blocking event loop
                const studies = {};
                const BATCH_SIZE = 100;

                const processFilesAsync = () => {
                    return new Promise((resolve) => {
                        let idx = 0;
                        function processBatch() {
                            const endIdx = Math.min(idx + BATCH_SIZE, dicomFiles.length);
                            for (let fi = idx; fi < endIdx; fi++) {
                                const filePath = dicomFiles[fi];
                                try {
                                    const fileSize = fs.statSync(filePath).size;
                                    const fd = fs.openSync(filePath, 'r');
                                    const headerSize = Math.min(fileSize, 65536);
                                    const buffer = Buffer.alloc(headerSize);
                                    fs.readSync(fd, buffer, 0, headerSize, 0);
                                    fs.closeSync(fd);

                                    const byteArray = new Uint8Array(buffer);
                                    const dataSet = dicomParser.parseDicom(byteArray, { untilTag: 'x7fe00010' });

                                    const sopClassUID = readTag(dataSet, 'x00020002');

                                    // DICOMDIR: parse directory records for patient metadata & referenced files
                                    if (sopClassUID === '1.2.840.10008.1.3.10') {
                                        const fullBuf = fs.readFileSync(filePath);
                                        const entries = parseDicomDir(filePath, fullBuf, dicomParser);
                                        for (const entry of entries) {
                                            addStudyEntry(studies, entry.studyUID, entry, entry.referencedFiles);
                                        }
                                        continue;
                                    }

                                    extractAndAddStudy(dataSet, studies, filePath);
                                } catch (parseErr) {
                                    // 1) Use partial dataSet from truncated-buffer parse
                                    const partialDS = parseErr?.dataSet;
                                    if (partialDS && extractAndAddStudyFromPartial(partialDS, studies, filePath)) {
                                        continue;
                                    }
                                    // 2) Full-file fallback: handles DICOMDIRs AND normal
                                    //    DICOM files that need more than 64 KB to parse.
                                    try { fullFileFallback(filePath, studies); } catch { /* truly unparseable - skip */ }
                                }
                            }
                            idx = endIdx;
                            if (idx < dicomFiles.length) {
                                setImmediate(processBatch);
                            } else {
                                resolve();
                            }
                        }
                        processBatch();
                    });
                };

                await processFilesAsync();

                const patients = Object.values(studies).map(s => ({
                    id: s.studyInstanceUID,
                    patientId: s.patientId,
                    patientName: s.patientName,
                    age: s.age,
                    sex: s.sex,
                    studyDate: s.studyDate,
                    studyDescription: s.studyDescription,
                    modality: s.modality,
                    accessionNumber: s.accessionNumber,
                    referringPhysician: s.referringPhysician,
                    images: s.files.length,
                    printed: false,
                    studyInstanceUID: s.studyInstanceUID,
                    filePaths: s.files,
                }));

                res.setHeader('Content-Type', 'application/json');
                res.statusCode = 200;
                res.end(JSON.stringify({
                    success: true,
                    directory: resolved,
                    studyCount: patients.length,
                    totalFiles: dicomFiles.length,
                    patients,
                }));
            } catch (err) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: false, error: err.message }));
            }
            return;
        }

        // Import DICOM files to managed storage
        if (parsedUrl.pathname === '/api/dicom/import-file' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk.toString(); });
            req.on('end', () => {
                try {
                    const { filePaths: srcPaths = [], destDir } = JSON.parse(body);
                    const os = require('os');
                    const managedDir = destDir ? path.resolve(destDir) : path.join(os.homedir(), 'dicom-storage');
                    if (!fs.existsSync(managedDir)) fs.mkdirSync(managedDir, { recursive: true });

                    const imported = [], errors = [];
                    for (const srcPath of srcPaths) {
                        try {
                            const resolved = path.resolve(srcPath);
                            if (!fs.existsSync(resolved)) { errors.push(`Not found: ${srcPath}`); continue; }
                            let destFile = path.join(managedDir, path.basename(resolved));
                            if (fs.existsSync(destFile)) {
                                const ext = path.extname(resolved);
                                const base = path.basename(resolved, ext);
                                destFile = path.join(managedDir, `${base}-${Date.now()}${ext}`);
                            }
                            fs.copyFileSync(resolved, destFile);
                            imported.push(destFile.replace(/\\/g, '/'));
                        } catch (e) { errors.push(`${srcPath}: ${e.message}`); }
                    }

                    res.setHeader('Content-Type', 'application/json');
                    res.statusCode = 200;
                    res.end(JSON.stringify({ success: true, managedDir: managedDir.replace(/\\/g, '/'), imported, errors }));
                } catch (err) {
                    res.statusCode = 500;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ success: false, error: err.message }));
                }
            });
            return;
        }

        // Scan local directory (for dicomLoader.ts scanLocalDirectory)
        if (parsedUrl.pathname === '/api/dicom/scan-local.php') {
            const dirPath = parsedUrl.query.dir;
            const limit = parseInt(parsedUrl.query.limit || '100', 10);
            if (!dirPath) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: false, error: 'Missing dir parameter' }));
                return;
            }

            try {
                const resolved = path.resolve(dirPath);
                if (!isAllowedDicomPath(resolved, 'directory')) {
                    res.statusCode = 403;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ success: false, error: 'Directory is outside allowed DICOM roots' }));
                    return;
                }
                if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
                    res.statusCode = 404;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ success: false, error: 'Directory not found' }));
                    return;
                }

                const files = [];
                function collect(dir) {
                    if (files.length >= limit) return;
                    try {
                        const entries = fs.readdirSync(dir, { withFileTypes: true });
                        for (const entry of entries) {
                            if (files.length >= limit) break;
                            const fullPath = path.join(dir, entry.name);
                            if (entry.isDirectory()) {
                                collect(fullPath);
                            } else if (entry.isFile()) {
                                const name = entry.name.toLowerCase();
                                if (name.endsWith('.dcm') || name.endsWith('.dicom') || (!name.includes('.') && name !== 'dicomdir')) {
                                    const stat = fs.statSync(fullPath);
                                    files.push({ path: fullPath.replace(/\\/g, '/'), filename: entry.name, size: stat.size });
                                }
                            }
                        }
                    } catch { /* skip unreadable */ }
                }
                collect(resolved);

                res.setHeader('Content-Type', 'application/json');
                res.statusCode = 200;
                res.end(JSON.stringify({ success: true, files }));
            } catch (err) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: false, error: err.message }));
            }
            return;
        }

        res.statusCode = 404;
        res.end('Not found');
    });

    dicomServer.listen(DICOM_PORT, '127.0.0.1', () => {
        console.log(`[Electron] DICOM file server running on port ${DICOM_PORT}`);
    });
    dicomServer.on('error', (err) => {
        console.error('[Electron] DICOM server error:', err.message);
    });
}

function stopDicomServer() {
    if (dicomServer) {
        dicomServer.close();
        dicomServer = null;
        console.log('[Electron] DICOM file server stopped');
    }
}

// =====================================================
// App Lifecycle
// =====================================================
// =====================================================
// Auto-update - polls the One Clickz website on launch + every 30 min and
// notifies the renderer. If the latest release for `viewer` has
// force_update=1, the renderer shows a non-dismissible modal that points
// the user at the new installer.
// =====================================================
const APP_NAME_FOR_UPDATES = 'viewer';
let LAST_KNOWN_RELEASE     = null;

async function checkForUpdate() {
    const https = require('https');
    const cur   = app.getVersion ? app.getVersion() : '0.0.0';
    const url   = LICENSE_API_BASE + '/release/check?app=' + APP_NAME_FOR_UPDATES + '&current=' + encodeURIComponent(cur);
    return new Promise((resolve) => {
        try {
            const u = new URL(url);
            const req = https.request({ hostname: u.hostname, port: 443, path: u.pathname + u.search, method: 'GET' }, (res) => {
                let body = '';
                res.on('data', (c) => body += c);
                res.on('end', () => {
                    try {
                        const data = JSON.parse(body);
                        LAST_KNOWN_RELEASE = data;
                        // Broadcast to every open window so any of them can show the modal.
                        BrowserWindow.getAllWindows().forEach(w => {
                            try { w.webContents.send('update-info', data); } catch {}
                        });
                        resolve(data);
                    } catch (e) { resolve(null); }
                });
            });
            req.on('error', () => resolve(null));
            req.setTimeout(15000, () => { req.destroy(); resolve(null); });
            req.end();
        } catch (e) { resolve(null); }
    });
}

// IPC: renderer asks for current update info (cached or fresh).
ipcMain.handle('check-for-update', async () => {
    return await checkForUpdate();
});
ipcMain.handle('get-update-info', () => LAST_KNOWN_RELEASE);

// IPC: renderer asks us to download + open the installer for the user.
ipcMain.handle('download-and-install-update', async (_evt, { downloadUrl } = {}) => {
    if (!downloadUrl) return { ok: false, error: 'No download URL' };
    const https = require('https');
    const dest  = path.join(app.getPath('temp'), `oneclickz-update-${Date.now()}.exe`);
    const validateDownloadUrl = (candidate, previous = null) => {
        let parsed;
        try { parsed = new URL(candidate, previous || undefined); } catch { return { ok: false, error: 'Invalid download URL' }; }
        if (parsed.protocol !== 'https:') return { ok: false, error: 'Update downloads must use HTTPS' };
        if (!UPDATE_DOWNLOAD_HOSTS.has(parsed.hostname.toLowerCase())) return { ok: false, error: 'Update host is not allowed' };
        const releaseUrl = LAST_KNOWN_RELEASE?.download_url || LAST_KNOWN_RELEASE?.downloadUrl || '';
        if (!previous && releaseUrl) {
            try {
                const expected = new URL(releaseUrl);
                if (parsed.href !== expected.href) return { ok: false, error: 'Update URL does not match the checked release' };
            } catch {}
        }
        if (!/\.exe($|\?)/i.test(parsed.pathname + parsed.search)) return { ok: false, error: 'Update must be a Windows installer' };
        return { ok: true, url: parsed };
    };
    const initial = validateDownloadUrl(downloadUrl);
    if (!initial.ok) return initial;

    return await new Promise((resolve) => {
        const file = fs.createWriteStream(dest);
        const get  = (link, redirects = 0) => {
            const req = https.get(link, (res) => {
            if ([301,302,303,307,308].includes(res.statusCode) && res.headers.location) {
                if (redirects >= 5) { file.close(); fs.unlink(dest, () => {}); return resolve({ ok: false, error: 'Too many redirects' }); }
                const next = validateDownloadUrl(res.headers.location, link);
                if (!next.ok) { file.close(); fs.unlink(dest, () => {}); return resolve(next); }
                return get(next.url.toString(), redirects + 1);
            }
            if (res.statusCode !== 200) { file.close(); fs.unlink(dest, () => {}); return resolve({ ok: false, error: 'HTTP ' + res.statusCode }); }
            res.pipe(file);
            file.on('finish', () => {
                file.close(() => {
                    // Hand off to the OS - the .exe is signed by you, Windows opens UAC.
                    shell.openPath(dest).then((err) => {
                        if (err) resolve({ ok: false, error: err });
                        else { resolve({ ok: true, path: dest }); setTimeout(() => app.quit(), 1500); }
                    });
                });
            });
            });
            req.on('error', (err) => {
                file.close();
                fs.unlink(dest, () => {});
                resolve({ ok: false, error: err.message });
            });
            req.setTimeout(30000, () => req.destroy(new Error('Update download timed out')));
        };
        get(initial.url.toString());
    });
});

app.whenReady().then(async () => {
    configureSessionSecurity();

    // GPU diagnostic - confirms whether hardware WebGL is active (needed for
    // smooth 3D volume rendering). Look for "gl: enabled" / "webgl2: enabled".
    // If these say "disabled_software" the 3D viewer will be slow/low quality.
    try {
        const status = app.getGPUFeatureStatus();
        console.log('[GPU] feature status:', JSON.stringify(status));
        app.getGPUInfo('basic').then((info) => {
            const g = (info && info.gpuDevice && info.gpuDevice[0]) || {};
            console.log('[GPU] device:', JSON.stringify(info && info.auxAttributes ? info.auxAttributes.glRenderer || g : g));
        }).catch(() => {});
    } catch (e) { console.log('[GPU] status unavailable:', e.message); }

    const lic = getLicenseData();
    if (lic) {
        // Has license key - validate it
        const result = await validateLicense();
        if (!result.valid) {
            if (result.reason === 'expired') {
                // Don't quit - let the UI show the activation page
                clearLicenseData();
            } else if (result.reason === 'revoked') {
                clearLicenseData();
            } else if (result.reason === 'deactivated') {
                clearLicenseData();
            } else if ([
                'offline_lease_expired',
                'lease_expired',
                'bad_signature',
                'fingerprint_mismatch',
                'malformed_lease',
                'lease_verify_failed',
            ].includes(result.reason)) {
                clearLicenseData();
            }
            // For network_error with valid grace period, validateLicense already returns valid
            // For other cases, clear license and let UI show activation page
        } else {
            // Start heartbeat interval
            setInterval(sendHeartbeat, 30 * 60 * 1000); // every 30 min
        }
    }
    // Check for desktop update on launch + every 30 min thereafter.
    setTimeout(checkForUpdate, 4000);                                // first check 4s after window
    setInterval(checkForUpdate, 30 * 60 * 1000);                     // every 30 min

    // Always start app - UI (LicenseGate) handles showing activation page if no license
    startApp();

    // Global keybinding: Ctrl+Shift+Q opens the password-gated quota panel
    // inside the active window. Mirrors Bridge's behaviour.
    try {
        const ok = globalShortcut.register('CommandOrControl+Shift+Q', () => {
            const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
            if (win && !win.isDestroyed()) {
                win.show();
                win.focus();
                win.webContents.send('mv:open-quota-settings');
            }
        });
        if (!ok) console.warn('[Shortcut] Ctrl+Shift+Q could not be registered');
    } catch (e) { console.warn('[Shortcut] register failed:', e.message); }
});

app.on('will-quit', () => {
    try { globalShortcut.unregisterAll(); } catch {}
});
app.on('window-all-closed', () => { stopDicomServer(); stopDicomNetworkReceiver(); stopPhpServer(); stopPhpApiServer(); stopOrthanc(); stopMySQL(); app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) startApp(); });
app.on('before-quit', () => { stopDicomServer(); stopDicomNetworkReceiver(); stopPhpServer(); stopPhpApiServer(); stopOrthanc(); stopMySQL(); });

// =====================================================
// IPC Handlers
// =====================================================

// License & Trial info
ipcMain.handle('get-trial-info', () => {
    const trial = getTrialInfo();
    return { remaining: trial.remaining, expired: trial.expired, totalDays: TRIAL_DAYS };
});

ipcMain.handle('get-license-status', () => {
    return getLicenseStatus();
});

ipcMain.handle('activate-license', async (_event, licenseKey) => {
    const result = await activateLicense(licenseKey);
    if (result?.success) {
        // The activation endpoint doesn't return quota fields, so pull them
        // straight away — otherwise the Recharge tab tile would stay blank
        // until the next minute's poll. broadcastQuotaChanged() then pushes
        // the freshly-cached numbers to every open renderer.
        try {
            const lic = getLicenseData();
            if (lic) {
                const r = await apiRequest('/license/quota', {
                    license_key: lic.licenseKey, fingerprint: lic.fingerprint, app: 'viewer',
                });
                if (r.status >= 200 && r.status < 300 && r.data && (r.data.ok || r.data.enabled !== undefined)) {
                    lic.quotaEnabled   = !!r.data.enabled;
                    lic.quotaRemaining = parseInt(r.data.remaining || 0, 10);
                    lic.quotaTotal     = parseInt(r.data.total     || 0, 10);
                    saveLicenseData(lic);
                }
            }
        } catch {}
        broadcastQuotaChanged();
    }
    return result;
});

ipcMain.handle('validate-license', async () => {
    return await validateLicense();
});

ipcMain.handle('deactivate-license', async () => {
    await deactivateLicense();
    return { success: true };
});

ipcMain.handle('get-fingerprint', () => {
    return getFingerprint();
});

// ── PCPNDT government portal — embedded window + autofill injection ──────────
// Opens the Maharashtra PCPNDT portal in its own persistent window and injects
// a floating "Autofill Form F" button. The doctor logs in, navigates to the
// Form F page, then clicks the button to fill it from the app's values.
// Field matching is heuristic (label / name / id / placeholder keywords) since
// the portal's exact field ids are not published; it reports how many fields
// it filled so the mapping can be tuned against the live form.
const PCPNDT_PORTAL_URL = 'https://pcpndt.maharashtra.gov.in/';
let pcpndtPortalWindow = null;

// Keyword map: app field key → substrings likely to appear in the portal's
// label / name / id / placeholder. Order matters (more specific first) so a
// generic word like "name" doesn't grab the wrong box.
const PCPNDT_KEYWORDS = {
    clinic_registration_no: ['clinic registration', 'centre registration', 'center registration', 'registration no', 'regn no', 'reg. no', 'reg no'],
    clinic_name: ['clinic name', 'centre name', 'center name', 'name of clinic', 'name of centre', 'name of the genetic', 'institution name', 'institution'],
    clinic_address: ['clinic address', 'centre address', 'address of clinic', 'address of the clinic'],
    ref_no: ['ref no', 'ref. no', 'reference no', 'form no', 'serial no'],
    husband_or_father_name: ['husband', 'father'],
    patient_name: ['name of pregnant', 'pregnant woman', 'name of patient', 'patient name', 'woman name', 'name of the woman'],
    patient_age: ['age'],
    phone: ['mobile', 'telephone', 'phone', 'contact no', 'contact number'],
    full_address: ['full address', 'residential address', 'postal address', 'address'],
    id_proof_type: ['id proof type', 'type of id', 'proof type', 'id type'],
    id_proof_number: ['id proof', 'id number', 'proof number', 'aadhaar', 'aadhar'],
    num_living_children: ['living children', 'no. of children', 'number of children', 'no of children'],
    children_details: ['children details', 'details of children', 'sex of children'],
    lmp_date: ['lmp', 'last menstrual'],
    gestational_age: ['gestational', 'period of gestation', 'gestation'],
    edd: ['edd', 'expected date of delivery', 'expected date'],
    family_history: ['family history', 'genetic history', 'medical history'],
    basis_of_diagnosis: ['basis of diagnosis', 'basis'],
    procedure_date: ['date of procedure', 'procedure date', 'date of test', 'date of examination'],
    complications: ['complication'],
    result: ['result of', 'result', 'finding'],
    referring_doctor_reg_no: ['referring doctor registration', 'referring registration', 'referred by reg'],
    referring_doctor_address: ['referring doctor address', 'address of referring'],
    referring_doctor: ['referring doctor', 'referred by', 'name of referring'],
    performing_doctor_qualification: ['qualification'],
    performing_doctor_reg_no: ['performing registration', 'performer registration', 'conducted by reg', 'doctor registration'],
    performing_doctor: ['conducted by', 'performed by', 'performing doctor', 'sonologist', 'name of doctor'],
};

function buildPcpndtAutofillScript(fields) {
    const payload = JSON.stringify({ fields, keywords: PCPNDT_KEYWORDS });
    // The script runs in the portal page's context (executeJavaScript bypasses
    // the page CSP). It is idempotent — re-running just re-adds the button.
    return `(function(){
      try {
        var DATA = ${payload};
        if (document.getElementById('__formf_btn__')) return 'exists';
        function labelText(el){
          var t = '';
          if (el.id){ var l = document.querySelector('label[for="'+CSS.escape(el.id)+'"]'); if(l) t += ' '+l.innerText; }
          var w = el.closest('label'); if(w) t += ' '+w.innerText;
          var p = el.previousElementSibling; if(p) t += ' '+(p.innerText||'');
          var td = el.closest('td'); if(td && td.previousElementSibling) t += ' '+(td.previousElementSibling.innerText||'');
          t += ' '+(el.name||'')+' '+(el.id||'')+' '+(el.placeholder||'')+' '+(el.getAttribute('aria-label')||'');
          return t.toLowerCase();
        }
        function setVal(el, value){
          var proto = el.tagName==='SELECT'?window.HTMLSelectElement.prototype:(el.tagName==='TEXTAREA'?window.HTMLTextAreaElement.prototype:window.HTMLInputElement.prototype);
          var setter = Object.getOwnPropertyDescriptor(proto,'value').set;
          setter.call(el, value);
          el.dispatchEvent(new Event('input',{bubbles:true}));
          el.dispatchEvent(new Event('change',{bubbles:true}));
        }
        function fillSelect(el, value){
          var v = String(value).toLowerCase();
          var opts = Array.prototype.slice.call(el.options);
          var m = opts.find(function(o){ return o.value.toLowerCase()===v || o.text.toLowerCase()===v; })
               || opts.find(function(o){ return o.text.toLowerCase().indexOf(v)>=0 || v.indexOf(o.text.toLowerCase())>=0; });
          if(m){ el.value = m.value; el.dispatchEvent(new Event('change',{bubbles:true})); return true; }
          return false;
        }
        function toDMY(s){ var m=/^(\\d{4})-(\\d{2})-(\\d{2})$/.exec(s); return m? m[3]+'/'+m[2]+'/'+m[1] : s; }
        function run(){
          var inputs = Array.prototype.slice.call(document.querySelectorAll('input, select, textarea'))
            .filter(function(el){ return el.type!=='hidden' && el.type!=='submit' && el.type!=='button' && !el.disabled && el.offsetParent!==null; });
          var used = new Set(), filled = 0;
          // 1) scalar text/select fields by keyword
          Object.keys(DATA.keywords).forEach(function(key){
            var val = DATA.fields[key];
            if(val==null || val==='' || Array.isArray(val)) return;
            var kws = DATA.keywords[key];
            var el = inputs.find(function(e){ return !used.has(e) && e.type!=='checkbox' && e.type!=='radio' && kws.some(function(k){ return labelText(e).indexOf(k)>=0; }); });
            if(!el) return;
            used.add(el);
            if(el.tagName==='SELECT'){ if(fillSelect(el, val)) filled++; }
            else if(el.type==='date'){ setVal(el, String(val)); filled++; }
            else {
              var out = String(val);
              // date-like value into a plain text box → dd/mm/yyyy (common on govt forms)
              if(/^\\d{4}-\\d{2}-\\d{2}$/.test(out) && (labelText(el).indexOf('date')>=0 || ['lmp_date','edd','procedure_date'].indexOf(key)>=0)) out = toDMY(out);
              setVal(el, out); filled++;
            }
          });
          // 2) array fields (indications, procedures) → tick matching checkboxes
          ['indications','procedures'].forEach(function(key){
            var arr = DATA.fields[key]; if(!Array.isArray(arr)) return;
            arr.forEach(function(opt){
              var o = String(opt).toLowerCase().slice(0, 24);
              var cb = inputs.find(function(e){ return (e.type==='checkbox'||e.type==='radio') && !used.has(e) && labelText(e).indexOf(o)>=0; });
              if(cb){ used.add(cb); if(!cb.checked){ cb.click(); } filled++; }
            });
          });
          return filled;
        }
        var btn = document.createElement('button');
        btn.id = '__formf_btn__';
        btn.textContent = '⚡ Autofill Form F';
        btn.style.cssText = 'position:fixed;z-index:2147483647;right:18px;bottom:18px;padding:12px 18px;background:#16a34a;color:#fff;border:0;border-radius:8px;font:600 14px system-ui;box-shadow:0 4px 14px rgba(0,0,0,.3);cursor:pointer';
        btn.onclick = function(){
          var n = run();
          btn.textContent = n>0 ? ('✓ Filled '+n+' fields — review & submit') : 'No matching fields found on this page';
          btn.style.background = n>0 ? '#15803d' : '#b91c1c';
          setTimeout(function(){ btn.textContent='⚡ Autofill Form F'; btn.style.background='#16a34a'; }, 4000);
        };
        document.body.appendChild(btn);
        return 'added';
      } catch(e){ return 'error: '+(e && e.message); }
    })();`;
}

ipcMain.handle('pcpndt:open-portal', (_e, { fields } = {}) => {
    const data = fields || {};
    if (pcpndtPortalWindow && !pcpndtPortalWindow.isDestroyed()) {
        pcpndtPortalWindow.focus();
        try { pcpndtPortalWindow.webContents.executeJavaScript(buildPcpndtAutofillScript(data)); } catch {}
        return { ok: true, reused: true };
    }
    pcpndtPortalWindow = new BrowserWindow({
        width: 1200, height: 860, show: true, autoHideMenuBar: true,
        title: 'PCPNDT Portal — Maharashtra',
        webPreferences: {
            partition: 'persist:pcpndt',   // keep the portal login across sessions
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
        },
    });
    const inject = () => {
        pcpndtPortalWindow?.webContents.executeJavaScript(buildPcpndtAutofillScript(data)).catch(() => {});
    };
    // Re-add the button after each navigation (login → form page → etc.).
    pcpndtPortalWindow.webContents.on('did-finish-load', inject);
    pcpndtPortalWindow.webContents.on('did-navigate-in-page', inject);
    pcpndtPortalWindow.on('closed', () => { pcpndtPortalWindow = null; });
    pcpndtPortalWindow.loadURL(PCPNDT_PORTAL_URL);
    return { ok: true };
});

// Read the latest print quota straight from the website (so super-admin
// changes show up immediately) and cache locally as a fallback for offline.
ipcMain.handle('get-license-quota', async () => {
    const lic = getLicenseData();
    if (!lic) {
        // No server license activated - fall back to the local install
        // trial print budget so the operator can still test printing
        // without first acquiring a key.
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
    const offlineTotal  = Math.max(0, parseInt(lic.offlineQuotaTotal  || 0, 10));
    // Offline-activated licence: serve purely from the local grant. No server
    // exists to ask, and the apiRequest retry budget would otherwise hang the
    // header refresh on a permanently-offline machine.
    if (lic.offlineActivated) {
        const expMs = lic.offlineExpiresAt ? new Date(lic.offlineExpiresAt).getTime() : 0;
        const valid = expMs > Date.now();
        return { enabled: true, remaining: valid ? offlineCredit : 0, total: offlineTotal,
                 valid, offline: true, offlineCredit, reason: valid ? undefined : 'expired' };
    }
    try {
        const r = await apiRequest('/license/quota', {
            license_key: lic.licenseKey, fingerprint: lic.fingerprint, app: 'viewer',
        });
        if (r.status >= 200 && r.status < 300 && r.data && (r.data.ok || r.data.enabled !== undefined)) {
            const prevEnabled   = !!lic.quotaEnabled;
            const prevRemaining = parseInt(lic.quotaRemaining || 0, 10);
            const prevTotal     = parseInt(lic.quotaTotal     || 0, 10);
            lic.quotaEnabled   = !!(r.data.enabled);
            lic.quotaRemaining = parseInt(r.data.remaining || 0, 10);
            lic.quotaTotal     = parseInt(r.data.total     || 0, 10);
            saveLicenseData(lic);
            // Whenever the server pushes new numbers, notify renderers so
            // the Recharge tab / header refresh immediately — fixes the
            // "blank prints left after re-activation" symptom where the
            // periodic poll updated the cache but no one was listening.
            if (prevEnabled   !== lic.quotaEnabled
             || prevRemaining !== lic.quotaRemaining
             || prevTotal     !== lic.quotaTotal) {
                broadcastQuotaChanged();
            }
            return {
                // offlineTotal (not live credit): a spent-down recharge stays
                // "on" so 0 reads as blocked, not unlimited.
                enabled:   lic.quotaEnabled || offlineTotal > 0,
                remaining: lic.quotaRemaining + offlineCredit,
                total:     lic.quotaTotal     + offlineTotal,
                valid:     true,
                offlineCredit,
            };
        }
        // Hard server reject - key deleted / revoked / wrong product. Purge
        // the local cache so we stop showing a phantom "X prints left".
        const hardReasons = ['not_found', 'revoked', 'deactivated', 'wrong_product', 'expired'];
        if (r.status >= 200 && r.status < 300 && r.data?.reason && hardReasons.includes(r.data.reason)) {
            clearLicenseData();
            resetTrialInfo();
            broadcastQuotaChanged();
            return { enabled: false, remaining: 0, total: 0, valid: false, reason: r.data.reason, invalidated: true };
        }
        return {
            enabled:   !!lic.quotaEnabled || offlineTotal > 0,
            remaining: (lic.quotaRemaining || 0) + offlineCredit,
            total:     (lic.quotaTotal     || 0) + offlineTotal,
            valid:     false,
            reason:    r.data?.reason,
            offlineCredit,
        };
    } catch (e) {
        return {
            enabled:   !!lic.quotaEnabled || offlineTotal > 0,
            remaining: (lic.quotaRemaining || 0) + offlineCredit,
            total:     (lic.quotaTotal     || 0) + offlineTotal,
            valid:     true,
            offline:   true,
            offlineCredit,
        };
    }
});

// Flip the sell-by-print mode (or set a counter directly). Requires the
// admin PIN that's verified server-side, so this can't be misused by anyone
// who only has renderer-process access.
ipcMain.handle('set-license-quota', async (_e, { enabled, remaining, adminPin } = {}) => {
    const lic = getLicenseData();
    if (!lic) return { ok: false, reason: 'no_license' };
    const body = { license_key: lic.licenseKey, fingerprint: lic.fingerprint, app: 'viewer', admin_pin: adminPin || '' };
    if (typeof enabled   === 'boolean') body.set_enabled   = enabled;
    if (Number.isFinite(remaining))     body.set_remaining = Math.max(0, parseInt(remaining, 10));
    try {
        const r = await apiRequest('/license/quota', body);
        if (r.status >= 200 && r.status < 300) {
            lic.quotaEnabled   = !!r.data.enabled;
            lic.quotaRemaining = parseInt(r.data.remaining || 0, 10);
            lic.quotaTotal     = parseInt(r.data.total     || 0, 10);
            saveLicenseData(lic);
            return { ok: true, enabled: lic.quotaEnabled, remaining: lic.quotaRemaining, total: lic.quotaTotal };
        }
        return { ok: false, reason: r.data?.error || 'rejected', status: r.status };
    } catch (e) {
        return { ok: false, reason: 'network', message: e.message };
    }
});

// Decrement quota when the viewer actually sends a print job.
ipcMain.handle('decrement-license-quota', async (_e, { pages = 1 } = {}) => {
    const lic = getLicenseData();
    if (!lic) {
        // Decrement the local install-trial counter so the header reflects
        // it. When the user activates a license, future calls hit the
        // server quota instead.
        const remaining = decrementTrialPrints(pages);
        broadcastQuotaChanged();
        return { ok: true, enabled: true, remaining, total: TRIAL_PRINTS, source: 'local_trial' };
    }
    // Eat vouchered prints first so the offline credit isn't wasted when the
    // server still has balance — mirrors the Bridge's behaviour.
    let remainingPages = Math.max(1, parseInt(pages, 10) || 1);
    const offlineCredit = Math.max(0, parseInt(lic.offlineQuotaCredit || 0, 10));
    if (offlineCredit > 0) {
        const usedOffline = Math.min(offlineCredit, remainingPages);
        lic.offlineQuotaCredit = offlineCredit - usedOffline;
        remainingPages -= usedOffline;
        saveLicenseData(lic);
        if (remainingPages <= 0) {
            broadcastQuotaChanged();
            const offlineTotal = Math.max(0, parseInt(lic.offlineQuotaTotal || 0, 10));
            return {
                ok: true,
                enabled: true,
                remaining: Math.max(0, parseInt(lic.quotaRemaining || 0, 10)) + lic.offlineQuotaCredit,
                total:     Math.max(0, parseInt(lic.quotaTotal     || 0, 10)) + offlineTotal,
                source: 'offline_recharge',
            };
        }
    }
    try {
        const r = await apiRequest('/license/quota', {
            license_key: lic.licenseKey, fingerprint: lic.fingerprint, app: 'viewer',
            decrement: remainingPages,
        });
        if (r.status >= 200 && r.status < 300) {
            lic.quotaRemaining = parseInt(r.data.remaining || 0, 10);
            lic.quotaTotal     = parseInt(r.data.total     || 0, 10);
            lic.quotaEnabled   = !!(r.data.enabled);
            saveLicenseData(lic);
            broadcastQuotaChanged();
            const localCredit = Math.max(0, parseInt(lic.offlineQuotaCredit || 0, 10));
            const localTotal  = Math.max(0, parseInt(lic.offlineQuotaTotal  || 0, 10));
            return {
                ok: true,
                enabled: lic.quotaEnabled || localTotal > 0,
                remaining: lic.quotaRemaining + localCredit,
            };
        }
        return { ok: false, reason: r.data?.reason || 'unknown' };
    } catch (e) {
        return { ok: false, reason: 'network', message: e.message };
    }
});

// Offline voucher recharge (Recharge tab) — short codes, works without internet.
ipcMain.handle('get-voucher-status', () => viewerVoucherStatus());
ipcMain.handle('redeem-voucher', (_e, { code } = {}) => redeemViewerVoucher(code));
// Same redeem path, but also accepts an optional licenseKey so a fresh install
// with no internet can create a server-less licence and leave trial.
ipcMain.handle('activate-offline', (_e, { licenseKey, code } = {}) => redeemViewerVoucher(code, licenseKey));

// ===== Print Wallet (synced with website backend) ====================
// These talk to the same wallet the dashboard at mehrgrewal.com reads,
// so the balance is always in sync. If no key is active, the desktop
// is in free mode - printing is disabled.

function walletApiGetOnce(path) {
    const https = require('https');
    return new Promise((resolve, reject) => {
        const urlObj = new URL(LICENSE_API_BASE + path);
        const req = https.request({
            hostname: urlObj.hostname, port: 443,
            path: urlObj.pathname + urlObj.search, method: 'GET',
        }, (res) => {
            let body = '';
            res.on('data', c => body += c);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
                catch { resolve({ status: res.statusCode, data: { error: body } }); }
            });
        });
        req.on('error', reject);
        req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
        req.end();
    });
}

/** Retrying GET — same flaky-link rationale as apiRequest, but fewer tries
 *  since this runs on a periodic background poll and shouldn't pile up. */
async function walletApiGet(path, { attempts = 3 } = {}) {
    let lastErr;
    for (let i = 0; i < attempts; i++) {
        try { return await walletApiGetOnce(path); }
        catch (e) {
            lastErr = e;
            if (i < attempts - 1) await apiSleep(700 * (i + 1));
        }
    }
    throw lastErr;
}

ipcMain.handle('wallet-balance', async (_event, { type = 'print' } = {}) => {
    const lic = getLicenseData();
    if (!lic) return { ok: false, reason: 'no_license', balance: 0, type };
    const q = new URLSearchParams({
        license_key: lic.licenseKey, fingerprint: lic.fingerprint, type,
    }).toString();
    try {
        const res = await walletApiGet('/wallet/balance?' + q);
        if (res.status >= 200 && res.status < 300) {
            return { ok: true, balance: (res.data.balance|0), type: res.data.type };
        }
        return { ok: false, reason: res.data?.error || 'http_' + res.status, balance: 0, type };
    } catch (e) {
        return { ok: false, reason: 'offline', balance: 0, type };
    }
});

ipcMain.handle('wallet-spend', async (_event, { type = 'print', credits, meta = '' } = {}) => {
    if (!credits || credits < 1) return { ok: false, reason: 'invalid_credits' };
    const lic = getLicenseData();
    if (!lic) return { ok: false, reason: 'no_license' };
    try {
        const res = await apiRequest('/wallet/spend', {
            license_key: lic.licenseKey,
            fingerprint:  lic.fingerprint,
            type, credits, meta,
        });
        if (res.status === 402) {
            return { ok: false, reason: 'insufficient', balance: (res.data.balance|0), required: credits };
        }
        if (res.status >= 200 && res.status < 300) {
            return { ok: true, balance: (res.data.balance|0) };
        }
        return { ok: false, reason: res.data?.error || ('http_' + res.status) };
    } catch (e) {
        return { ok: false, reason: 'offline' };
    }
});
// =====================================================

// Get system printers
ipcMain.handle('get-system-printers', async () => {
    try {
        if (!mainWindow) return { success: false, error: 'No window', printers: [] };
        const printers = await mainWindow.webContents.getPrintersAsync();
        return {
            success: true,
            printers: printers.map(p => ({
                name: p.name,
                displayName: p.displayName || p.name,
                description: p.description || '',
                status: p.status,
                isDefault: p.isDefault,
                options: p.options || {}
            }))
        };
    } catch (e) { return { success: false, error: e.message, printers: [] }; }
});

async function waitForPrintableContent(printWindow, timeoutMs = 5000) {
    const readinessScript = `
        (async () => {
            const images = Array.from(document.images || []);
            const imagePromises = images.map((img) => {
                if (img.complete) return Promise.resolve(true);
                return new Promise((resolve) => {
                    const done = () => resolve(true);
                    img.addEventListener('load', done, { once: true });
                    img.addEventListener('error', done, { once: true });
                });
            });

            if (document.fonts && document.fonts.ready) {
                try { await document.fonts.ready; } catch { }
            }

            await Promise.all(imagePromises);
            await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            return true;
        })();
    `;

    return await Promise.race([
        printWindow.webContents.executeJavaScript(readinessScript, true),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timed out waiting for printable content')), timeoutMs)),
    ]);
}

function buildElectronPrintOptions(printerName, printSettings = {}) {
    // Do NOT set `dpi` or `scaleFactor` here. On Windows displays with >100%
    // DPI scaling, Chromium re-applies those values as a layout scale on top
    // of the printable area and the page renders at half size, centred on the
    // sheet. Print quality already comes from the printer driver's native DPI;
    // we only need to tell Electron WHAT to print and on WHICH paper.
    const opts = {
        silent: true,
        printBackground: true,
        color: printSettings.colorMode !== 'grayscale',
        landscape: printSettings.orientation === 'landscape',
        copies: printSettings.copies || 1,
    };

    if (printSettings.margins) {
        opts.margins = { marginType: printSettings.margins };
    }
    if (printerName && printerName !== 'default') {
        opts.deviceName = printerName;
    }
    if (printSettings.paperSize) {
        opts.pageSize = printSettings.paperSize;
    }

    return opts;
}

async function runElectronPrint(webContents, opts, timeoutMs = 15000) {
    return await new Promise((resolve) => {
        let settled = false;
        const timeout = setTimeout(() => {
            if (settled) return;
            settled = true;
            resolve({ success: false, error: 'Print request timed out' });
        }, timeoutMs);

        webContents.print(opts, (success, errorType) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            resolve(success ? { success: true } : { success: false, error: errorType || 'Print failed' });
        });
    });
}

// Print report with Chromium print dialog (has built-in preview + all options)
ipcMain.handle('print-report-dialog', async (event, options) => {
    let tempHtml = null;
    let printWindow = null;
    try {
        const { htmlContent, paperSize } = options;
        const os = require('os');
        tempHtml = path.join(os.tmpdir(), `report_print_${Date.now()}.html`);
        fs.writeFileSync(tempHtml, htmlContent, 'utf8');

        // 2480x3508 is A4 @ 300 DPI. zoomFactor pushes rendering pixel ratio so
        // Chromium lays out the page at high DPI before rasterizing for print.
        printWindow = new BrowserWindow({
            show: false, width: 2480, height: 3508,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                webSecurity: true,
                allowRunningInsecureContent: false,
                zoomFactor: 1.0,
                backgroundThrottling: false,
            }
        });

        await printWindow.loadFile(tempHtml);
        await waitForPrintableContent(printWindow);

        // Map paper size for printToPDF
        const sizeMap = {
            A3: { width: 11.69, height: 16.54 },
            A4: { width: 8.27, height: 11.69 },
            A5: { width: 5.83, height: 8.27 },
            Letter: { width: 8.5, height: 11 },
            Legal: { width: 8.5, height: 14 }
        };
        const dims = sizeMap[paperSize] || sizeMap.A4;

        // Generate PDF from the rendered HTML at print-grade resolution.
        // scale: 1.0 prevents Chromium from downsampling embedded raster images.
        const pdfBuffer = await printWindow.webContents.printToPDF({
            pageSize: { width: dims.width, height: dims.height },
            preferCSSPageSize: true,
            printBackground: true,
            scale: 1.0,
            margins: { top: 0, bottom: 0, left: 0, right: 0 },
        });

        printWindow.close();
        printWindow = null;

        // Save PDF and open in system viewer (Edge, Adobe, etc.) for printing with full preview
        const pdfPath = path.join(os.tmpdir(), `report_${Date.now()}.pdf`);
        fs.writeFileSync(pdfPath, pdfBuffer);
        await shell.openPath(pdfPath);

        // Clean up HTML temp file immediately, PDF cleaned up on next print
        if (tempHtml && fs.existsSync(tempHtml)) try { fs.unlinkSync(tempHtml); } catch { }

        return { success: true, pdfPath };
    } catch (e) {
        console.error('[Print] PDF generation failed:', e);
        if (printWindow && !printWindow.isDestroyed()) printWindow.close();
        if (tempHtml && fs.existsSync(tempHtml)) try { fs.unlinkSync(tempHtml); } catch { }
        return { success: false, error: e.message };
    }
});

// Print HTML content to printer
ipcMain.handle('print-to-printer', async (event, options) => {
    let tempFile = null;
    let printWindow = null;
    try {
        const { printerName, htmlContent, printSettings = {} } = options;
        const os = require('os');
        tempFile = path.join(os.tmpdir(), `dicom_print_${Date.now()}.html`);
        fs.writeFileSync(tempFile, htmlContent, 'utf8');

        // 2480x3508 is A4 @ 300 DPI. zoomFactor pushes rendering pixel ratio so
        // Chromium lays out the page at high DPI before rasterizing for print.
        printWindow = new BrowserWindow({
            show: false, width: 2480, height: 3508,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                webSecurity: true,
                allowRunningInsecureContent: false,
                zoomFactor: 1.0,
                backgroundThrottling: false,
            }
        });

        await printWindow.loadFile(tempFile);
        await waitForPrintableContent(printWindow);

        // Detect "Print to PDF" virtual printers - they can't work in silent mode
        const isPdfPrinter = printerName && /pdf/i.test(printerName);

        if (isPdfPrinter) {
            // Use Electron's printToPDF + save dialog instead of webContents.print()
            // (virtual PDF printers like "Microsoft Print to PDF" can't work in silent mode)
            const landscape = printSettings.orientation === 'landscape';
            const pdfData = await printWindow.webContents.printToPDF({
                landscape,
                printBackground: true,
                pageSize: printSettings.paperSize || 'A4',
                margins: { top: 0, bottom: 0, left: 0, right: 0 },
            });
            const parentWin = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
            const saveResult = await dialog.showSaveDialog(parentWin, {
                title: 'Save PDF',
                defaultPath: path.join(app.getPath('documents'), `print_${Date.now()}.pdf`),
                filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
            });
            if (saveResult.canceled || !saveResult.filePath) {
                return { success: false, error: 'Save cancelled by user' };
            }
            fs.writeFileSync(saveResult.filePath, pdfData);
            return { success: true };
        }

        const opts = buildElectronPrintOptions(printerName, printSettings);
        let result = await runElectronPrint(printWindow.webContents, opts);

        // If silent print failed, retry with native OS print dialog
        if (!result.success) {
            console.warn('[Print] Silent print failed:', result.error, '- opening native print dialog');
            const dialogOpts = { ...opts, silent: false };
            printWindow.show();
            result = await runElectronPrint(printWindow.webContents, dialogOpts, 120000);
        }

        return result;
    } catch (e) {
        return { success: false, error: e.message };
    } finally {
        // Brief delay so the OS print spooler finishes queuing the job
        await new Promise(r => setTimeout(r, 500));
        if (printWindow && !printWindow.isDestroyed()) printWindow.close();
        if (tempFile && fs.existsSync(tempFile)) try { fs.unlinkSync(tempFile); } catch { }
    }
});

// Print current window
ipcMain.handle('print-current-to-printer', async (event, options) => {
    try {
        const { printerName, printSettings = {} } = options;
        const win = BrowserWindow.fromWebContents(event.sender);
        if (!win) return { success: false, error: 'Window not found' };

        return await runElectronPrint(win.webContents, buildElectronPrintOptions(printerName, printSettings));
    } catch (e) {
        return { success: false, error: e.message };
    }
});

// Focus main window
ipcMain.handle('focus-main-window', async () => {
    try { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } return { success: true }; }
    catch (e) { return { success: false, error: e.message }; }
});

// Mark patient as printed - broadcast to ALL windows so main window store is updated
ipcMain.handle('mark-patient-printed', async (event, { patientId, patientName }) => {
    try {
        const { BrowserWindow } = require('electron');
        for (const win of BrowserWindow.getAllWindows()) {
            if (!win.isDestroyed()) {
                win.webContents.send('patient-printed', { patientId, patientName });
            }
        }
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

// Credential management for auto-login
const credentialsPath = path.join(userDataPath, 'credentials.json');
const encryptedCredentialsPath = path.join(userDataPath, 'credentials.enc');

function encryptJsonForDisk(value) {
    const json = JSON.stringify(value);
    if (safeStorage.isEncryptionAvailable()) {
        return { encrypted: true, data: safeStorage.encryptString(json).toString('base64') };
    }
    return {
        encrypted: false,
        data: Buffer.from(json, 'utf8').toString('base64'),
        warning: 'safeStorage unavailable on this OS session',
    };
}

function decryptJsonFromDisk(payload) {
    if (!payload || typeof payload !== 'object') return null;
    const raw = Buffer.from(String(payload.data || ''), 'base64');
    const json = payload.encrypted ? safeStorage.decryptString(raw) : raw.toString('utf8');
    return JSON.parse(json);
}

ipcMain.handle('save-credentials', async (event, credentials) => {
    try {
        fs.writeFileSync(encryptedCredentialsPath, JSON.stringify(encryptJsonForDisk(credentials)), 'utf8');
        if (fs.existsSync(credentialsPath)) fs.unlinkSync(credentialsPath);
        return { success: true };
    }
    catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('get-credentials', async () => {
    try {
        if (fs.existsSync(encryptedCredentialsPath)) {
            return { success: true, credentials: decryptJsonFromDisk(JSON.parse(fs.readFileSync(encryptedCredentialsPath, 'utf8'))) };
        }
        if (!fs.existsSync(credentialsPath)) return { success: true, credentials: null };
        const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
        fs.writeFileSync(encryptedCredentialsPath, JSON.stringify(encryptJsonForDisk(credentials)), 'utf8');
        fs.unlinkSync(credentialsPath);
        return { success: true, credentials };
    } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('clear-credentials', async () => {
    try {
        if (fs.existsSync(credentialsPath)) fs.unlinkSync(credentialsPath);
        if (fs.existsSync(encryptedCredentialsPath)) fs.unlinkSync(encryptedCredentialsPath);
        return { success: true };
    }
    catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('has-credentials', async () => {
    return { success: true, hasCredentials: fs.existsSync(encryptedCredentialsPath) || fs.existsSync(credentialsPath) };
});

// Get DICOM server port
ipcMain.handle('get-dicom-port', () => {
    return { port: DICOM_PORT };
});

ipcMain.on('get-dicom-access-token', (event) => {
    event.returnValue = DICOM_ACCESS_TOKEN;
});

// Authorize the file paths of a study the user is explicitly opening so the
// DICOM file server (which is gated by DICOM_ACCESS_TOKEN + realpath + the
// allowed-roots check) will serve them. Studies opened from the patient list
// or a viewer popup carry absolute paths outside the fixed roots; without this
// the serve-file requests 403 and no images render. Sync so authorization is
// in place before the renderer starts requesting images.
ipcMain.on('authorize-dicom-paths-sync', (event, paths) => {
    try {
        if (Array.isArray(paths)) paths.forEach(authorizeDicomPath);
        else if (typeof paths === 'string') authorizeDicomPath(paths);
    } catch (e) { console.warn('[Security] authorize-dicom-paths failed:', e.message); }
    event.returnValue = { ok: true };
});

// =====================================================
// CR Viewer Popup Window
// =====================================================
let crViewerWindow = null;

ipcMain.handle('open-cr-viewer', (event, { isPortrait, imageCount, cols, rows }) => {
    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenW, height: screenH } = primaryDisplay.workAreaSize;

    // Calculate optimal window width so grid cells match DICOM image aspect ratio
    const winH = Math.round(screenH * 0.93);
    // CRViewerPage chrome: header(~36px) + CRToolbar(~38px) + bottom-bar(~36px) = ~110px
    const headerPx = 110;
    // CRSidebar is w-16 (64px) + 1px border + padding = ~70px
    const sidebarPx = 70;
    const availableH = winH - headerPx;
    const imageAR = 4 / 3; // standard DICOM image aspect ratio
    const cellH = availableH / (rows || 1);
    const cellW = cellH * imageAR;
    const gridW = cellW * (cols || 1);
    const winW = Math.round(Math.min(Math.max(gridW + sidebarPx, 500), screenW * 0.95));

    // Reuse the existing CR viewer window if it's already open - this keeps
    // the cornerstone image cache warm, so reopening the same (or a related)
    // study is essentially instant. Just resize/focus and notify the renderer
    // to pick up the new launch payload from localStorage.
    if (crViewerWindow && !crViewerWindow.isDestroyed()) {
        try { crViewerWindow.setSize(winW, winH); crViewerWindow.center(); } catch {}
        try { crViewerWindow.show(); crViewerWindow.focus(); } catch {}
        try { crViewerWindow.webContents.send('cr-viewer:reload-launch'); } catch {}
        return { success: true, width: winW, height: winH, reused: true };
    }

    crViewerWindow = new BrowserWindow({
        width: winW,
        height: winH,
        minWidth: 500,
        minHeight: 400,
        title: `One Clickz - Viewer (${imageCount} images)`,
        icon: path.join(__dirname, 'icon.ico'),
        webPreferences: viewerWebPreferences()
    });

    crViewerWindow.center();
    crViewerWindow.loadURL(`${APP_URL}/cr-viewer`);

    // Menu for CR viewer window
    const crMenu = Menu.buildFromTemplate([buildViewMenu()]);
    crViewerWindow.setMenu(crMenu);
    registerWindowSecurity(crViewerWindow);

    crViewerWindow.on('closed', () => { crViewerWindow = null; });

    return { success: true, width: winW, height: winH };
});

// =====================================================
// Main Viewer Popup Window
// =====================================================
let viewerWindow = null;

ipcMain.handle('open-viewer', (event, { isPortrait, imageCount, cols, rows }) => {
    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenW, height: screenH } = primaryDisplay.workAreaSize;

    // Calculate optimal window width so grid cells match ~4:3 DICOM image aspect ratio
    // This eliminates black bars around images in contain-fit mode
    const winH = Math.round(screenH * 0.93);
    // ViewerPage chrome: ViewerHeader(~36px) + ViewerBottomBar(~38px) = ~74px
    const headerToolbarPx = 74;
    // ViewerPage sidebars: study-tab(20) + ViewerActionBar(48) + ThumbnailSidebar(176) + ToolsPanel(288) = 532px
    const sidebarPx = 532;
    const availableH = winH - headerToolbarPx;
    const imageAR = 4 / 3; // typical DICOM (ultrasound) aspect ratio
    const cellH = availableH / (rows || 1);
    const cellW = cellH * imageAR;
    const gridW = cellW * (cols || 1);
    const winW = Math.round(Math.min(Math.max(gridW + sidebarPx, 600), screenW * 0.95));

    // Reuse the existing viewer window if it's already open (see CR viewer
    // handler above for the rationale). Avoids destroying the cornerstone
    // image cache between opens.
    if (viewerWindow && !viewerWindow.isDestroyed()) {
        try { viewerWindow.setSize(winW, winH); viewerWindow.center(); } catch {}
        try { viewerWindow.show(); viewerWindow.focus(); } catch {}
        try { viewerWindow.webContents.send('viewer:reload-launch'); } catch {}
        return { success: true, width: winW, height: winH, reused: true };
    }

    viewerWindow = new BrowserWindow({
        width: winW,
        height: winH,
        minWidth: 500,
        minHeight: 400,
        title: `One Clickz - CR Viewer (${imageCount} images)`,
        icon: path.join(__dirname, 'icon.ico'),
        webPreferences: viewerWebPreferences()
    });

    viewerWindow.center();
    viewerWindow.loadURL(`${APP_URL}/viewer`);

    // Menu for viewer window
    const viewerMenu = Menu.buildFromTemplate([buildViewMenu()]);
    viewerWindow.setMenu(viewerMenu);
    registerWindowSecurity(viewerWindow);

    viewerWindow.on('closed', () => { viewerWindow = null; });

    return { success: true, width: winW, height: winH };
});

// =====================================================
// 3D Volume Viewer Popup Window
// =====================================================
let volumeViewerWindow = null;

ipcMain.handle('open-volume-viewer', (event, { imageCount, payload } = {}) => {
    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenW, height: screenH } = primaryDisplay.workAreaSize;
    const launchFile = Array.isArray(payload?.filePaths) && payload.filePaths.length > 0
        ? writeNormalizedVolumeLaunchFile(payload)
        : null;
    const volumeUrl = launchFile
        ? `${APP_URL}/volume-3d?launchFile=${encodeURIComponent(launchFile)}`
        : `${APP_URL}/volume-3d`;

    // The 3D viewer benefits from a roughly square area for the quad
    // MPR + VR layout. Default to 80% of the working area so multi-monitor
    // setups still leave the source viewer visible.
    const winW = Math.round(screenW * 0.85);
    const winH = Math.round(screenH * 0.92);

    // Reuse the existing window if it's already open - destroying the
    // BrowserWindow tears down the WebGL2 context, and rebuilding the
    // cs3d engine is expensive (~hundreds of ms).
    if (volumeViewerWindow && !volumeViewerWindow.isDestroyed()) {
        try { volumeViewerWindow.setSize(winW, winH); volumeViewerWindow.center(); } catch {}
        try { volumeViewerWindow.show(); volumeViewerWindow.focus(); } catch {}
        try {
            if (launchFile) volumeViewerWindow.loadURL(volumeUrl);
            else volumeViewerWindow.webContents.send('volume-viewer:reload-launch');
        } catch {}
        return { success: true, width: winW, height: winH, reused: true };
    }

    volumeViewerWindow = new BrowserWindow({
        width: winW,
        height: winH,
        minWidth: 800,
        minHeight: 600,
        title: `One Clickz - 3D Volume Viewer${imageCount ? ` (${imageCount} slices)` : ''}`,
        icon: path.join(__dirname, 'icon.ico'),
        webPreferences: viewerWebPreferences()
    });

    volumeViewerWindow.center();
    volumeViewerWindow.loadURL(volumeUrl);

    const volumeMenu = Menu.buildFromTemplate([buildViewMenu()]);
    volumeViewerWindow.setMenu(volumeMenu);
    registerWindowSecurity(volumeViewerWindow);

    volumeViewerWindow.on('closed', () => { volumeViewerWindow = null; });

    return { success: true, width: winW, height: winH };
});

// Open the 3D volume viewer in the system default browser. The viewer page
// reads its study payload from a temp JSON file (handed off via ?launchFile),
// fetched over localhost - so this works fully offline. The browser uses its
// own GPU pipeline, which on some machines renders the volume more cleanly
// than the bundled Electron Chromium.
function loadDicomParserForVolumeLaunch() {
    try {
        return require('dicom-parser');
    } catch {
        try {
            return require(path.join(__dirname, 'www', 'node_modules', 'dicom-parser'));
        } catch {
            return null;
        }
    }
}

function readClockMarkFile() {
    try {
        if (!fs.existsSync(clockMarkFile)) return 0;
        const data = JSON.parse(fs.readFileSync(clockMarkFile, 'utf8'));
        return Number.isFinite(data.maxSeenMs) ? data.maxSeenMs : 0;
    } catch { return 0; }
}

function readClockMarkRegistry() {
    if (process.platform !== 'win32') return 0;
    try {
        const output = execSync(
            'reg query HKCU\\Software\\OneClickz\\Viewer /v LicenseClockMark',
            { stdio: 'pipe', windowsHide: true }
        ).toString();
        const match = output.match(/LicenseClockMark\s+REG_SZ\s+(\d+)/i);
        return match ? parseInt(match[1], 10) || 0 : 0;
    } catch { return 0; }
}

function writeClockMark(ms) {
    const mark = Math.max(ms, readClockMarkFile(), readClockMarkRegistry());
    try {
        fs.writeFileSync(clockMarkFile, JSON.stringify({ maxSeenMs: mark }), 'utf8');
    } catch {}
    if (process.platform === 'win32') {
        try {
            execSync(
                `reg add HKCU\\Software\\OneClickz\\Viewer /v ${clockMarkRegValue} /t REG_SZ /d ${mark} /f`,
                { stdio: 'ignore', windowsHide: true }
            );
        } catch {}
    }
    return mark;
}

function effectiveNowMs() {
    return writeClockMark(Date.now());
}

function parseLeaseToken(token) {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    try {
        const payloadJson = Buffer.from(parts[0], 'base64url').toString('utf8');
        return { payload: JSON.parse(payloadJson), signature: parts[1], signedPayload: parts[0] };
    } catch { return null; }
}

function verifyLeaseToken(token) {
    const parsed = parseLeaseToken(token);
    if (!parsed) return { valid: false, reason: 'malformed_lease' };
    if (!LICENSE_LEASE_PUBLIC_KEY_B64 || LICENSE_LEASE_PUBLIC_KEY_B64.includes('REPLACE_')) {
        return { valid: false, reason: 'lease_public_key_missing' };
    }
    try {
        const keyBytes = Buffer.from(LICENSE_LEASE_PUBLIC_KEY_B64, 'base64');
        const spki = keyBytes.length === 32
            ? Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), keyBytes])
            : keyBytes;
        const publicKey = crypto.createPublicKey({
            key: spki,
            format: 'der',
            type: 'spki',
        });
        const ok = crypto.verify(
            null,
            Buffer.from(parsed.signedPayload),
            publicKey,
            Buffer.from(parsed.signature, 'base64url')
        );
        if (!ok) return { valid: false, reason: 'bad_signature' };
    } catch (e) {
        return { valid: false, reason: 'lease_verify_failed' };
    }

    const payload = parsed.payload || {};
    if (payload.fingerprint !== getFingerprint()) return { valid: false, reason: 'fingerprint_mismatch' };
    const now = effectiveNowMs();
    const licenseExpiresAt = Date.parse(payload.licenseExpiresAt || payload.expiresAt || '');
    const nextCheckBy = Date.parse(payload.nextCheckBy || '');
    const leaseEnd = Math.min(
        Number.isFinite(licenseExpiresAt) ? licenseExpiresAt : Number.MAX_SAFE_INTEGER,
        Number.isFinite(nextCheckBy) ? nextCheckBy : Number.MAX_SAFE_INTEGER
    );
    if (!Number.isFinite(leaseEnd) || leaseEnd === Number.MAX_SAFE_INTEGER) return { valid: false, reason: 'lease_missing_expiry' };
    if (now > leaseEnd) return { valid: false, reason: 'lease_expired' };
    const daysUntilCheck = Math.ceil((leaseEnd - now) / (1000 * 60 * 60 * 24));
    return { valid: true, payload, daysUntilCheck, warn: daysUntilCheck <= LEASE_WARN_DAYS };
}

function normalizeVolumeLaunchPayloadForBrowser(payload = {}) {
    const filePaths = dedupeVolumeFilePaths(payload.filePaths);
    if (filePaths.length < 2) {
        return { ...(payload || {}), filePaths };
    }

    const dicomParserLib = loadDicomParserForVolumeLaunch();
    if (!dicomParserLib) {
        return { ...(payload || {}), filePaths: sortVolumeFallback(filePaths) };
    }

    const records = filePaths.map((filePath, index) =>
        readVolumeLaunchSliceRecord(filePath, index, dicomParserLib)
    );
    const recordsWithMetadata = records.filter((record) => record.hasDicomMetadata);
    if (recordsWithMetadata.length < Math.min(5, filePaths.length)) {
        return { ...(payload || {}), filePaths: sortVolumeRecords(records).map((record) => record.filePath) };
    }

    const selected = selectBestVolumeSeries(records, String(payload.modality || '').toUpperCase());
    const sorted = sortVolumeRecords(selected);
    return {
        ...(payload || {}),
        filePaths: sorted.map((record) => record.filePath),
        normalizedForBrowser: true,
        originalFileCount: filePaths.length,
    };
}

function writeNormalizedVolumeLaunchFile(payload = {}) {
    const tmpDir = app.getPath('temp');
    const tmpPath = path.join(tmpDir, `oneclickz-volume-launch-${Date.now()}.json`);
    const normalizedPayload = normalizeVolumeLaunchPayloadForBrowser(payload || {});
    fs.writeFileSync(tmpPath, JSON.stringify(normalizedPayload), 'utf8');
    return tmpPath;
}

function dedupeVolumeFilePaths(value) {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    const out = [];
    for (const raw of value) {
        const filePath = typeof raw === 'string' ? raw.trim() : '';
        const key = filePath.toLowerCase();
        if (!filePath || seen.has(key)) continue;
        seen.add(key);
        out.push(filePath);
    }
    return out;
}

function readVolumeLaunchSliceRecord(filePath, index, dicomParserLib) {
    const fallback = {
        filePath,
        index,
        hasDicomMetadata: false,
        studyUID: '',
        seriesUID: '',
        modality: '',
        rows: null,
        cols: null,
        orientationKey: '',
        position: null,
        sliceLocation: null,
        instanceNumber: null,
        pathNumber: volumePathNumber(filePath),
    };

    try {
        const dataSet = parseVolumeLaunchDicomHeader(filePath, dicomParserLib);
        if (!dataSet) return fallback;

        const orientation = readVolumeNumberList(dataSet, 'x00200037');
        const positionVector = readVolumeNumberList(dataSet, 'x00200032');
        const projectedPosition = projectVolumeSlicePosition(positionVector, orientation);
        const rows = readVolumeNumber(dataSet, 'x00280010');
        const cols = readVolumeNumber(dataSet, 'x00280011');

        return {
            ...fallback,
            hasDicomMetadata: true,
            studyUID: readVolumeDicomString(dataSet, 'x0020000d'),
            seriesUID: readVolumeDicomString(dataSet, 'x0020000e'),
            modality: readVolumeDicomString(dataSet, 'x00080060').toUpperCase(),
            rows,
            cols,
            orientationKey: volumeOrientationKey(orientation),
            position: projectedPosition,
            sliceLocation: readVolumeNumber(dataSet, 'x00201041'),
            instanceNumber: readVolumeNumber(dataSet, 'x00200013'),
        };
    } catch {
        return fallback;
    }
}

function parseVolumeLaunchDicomHeader(filePath, dicomParserLib) {
    let fd = null;
    try {
        fd = fs.openSync(filePath, 'r');
        const stat = fs.fstatSync(fd);
        const size = Math.min(stat.size, 512 * 1024);
        const buffer = Buffer.alloc(size);
        fs.readSync(fd, buffer, 0, size, 0);
        try {
            return dicomParserLib.parseDicom(new Uint8Array(buffer), { untilTag: 'x7fe00010' });
        } catch (e) {
            return e?.dataSet || null;
        }
    } finally {
        if (fd !== null) {
            try { fs.closeSync(fd); } catch { /* ignore */ }
        }
    }
}

function readVolumeDicomString(dataSet, tag) {
    try { return (dataSet.string(tag) || '').trim(); } catch { return ''; }
}

function readVolumeNumber(dataSet, tag) {
    const n = Number(readVolumeDicomString(dataSet, tag));
    return Number.isFinite(n) ? n : null;
}

function readVolumeNumberList(dataSet, tag) {
    const raw = readVolumeDicomString(dataSet, tag);
    if (!raw) return [];
    return raw
        .split('\\')
        .map((part) => Number(part.trim()))
        .filter((n) => Number.isFinite(n));
}

function projectVolumeSlicePosition(position, orientation) {
    if (position.length < 3) return null;
    if (orientation.length >= 6) {
        const row = orientation.slice(0, 3);
        const col = orientation.slice(3, 6);
        const normal = [
            row[1] * col[2] - row[2] * col[1],
            row[2] * col[0] - row[0] * col[2],
            row[0] * col[1] - row[1] * col[0],
        ];
        const projected = position[0] * normal[0] + position[1] * normal[1] + position[2] * normal[2];
        if (Number.isFinite(projected)) return projected;
    }
    return Number.isFinite(position[2]) ? position[2] : null;
}

function volumeOrientationKey(orientation) {
    if (orientation.length < 6) return '';
    return orientation.slice(0, 6).map((n) => Math.round(n * 1000) / 1000).join('\\');
}

function volumePathNumber(filePath) {
    const match = path.basename(filePath).match(/(\d+)(?!.*\d)/);
    if (!match) return null;
    const n = Number(match[1]);
    return Number.isFinite(n) ? n : null;
}

function volumeGroupingKey(record) {
    const uid = record.seriesUID || record.studyUID || '__unknown__';
    const geometry = [
        record.orientationKey || '__orientation_unknown__',
        record.rows || '__rows_unknown__',
        record.cols || '__cols_unknown__',
    ].join('|');
    return `${uid}|${geometry}`;
}

function selectBestVolumeSeries(records, requestedModality) {
    const groups = new Map();
    for (const record of records) {
        const key = record.hasDicomMetadata ? volumeGroupingKey(record) : '__unparsed__';
        if (!groups.has(key)) {
            groups.set(key, { records: [], modalities: new Set(), positioned: 0 });
        }
        const group = groups.get(key);
        group.records.push(record);
        if (record.modality) group.modalities.add(record.modality);
        if (Number.isFinite(record.position) || Number.isFinite(record.sliceLocation)) group.positioned += 1;
    }

    const ranked = Array.from(groups.values()).sort((a, b) => {
        const aRequested = requestedModality && a.modalities.has(requestedModality) ? 1 : 0;
        const bRequested = requestedModality && b.modalities.has(requestedModality) ? 1 : 0;
        if (aRequested !== bRequested) return bRequested - aRequested;

        const aVolumetric = (a.modalities.has('CT') || a.modalities.has('MR')) ? 1 : 0;
        const bVolumetric = (b.modalities.has('CT') || b.modalities.has('MR')) ? 1 : 0;
        if (aVolumetric !== bVolumetric) return bVolumetric - aVolumetric;

        if (a.records.length !== b.records.length) return b.records.length - a.records.length;
        return b.positioned - a.positioned;
    });

    const best = ranked[0]?.records || records;
    return best.length >= Math.min(20, records.length) ? best : records;
}

function sortVolumeFallback(filePaths) {
    return sortVolumeRecords(filePaths.map((filePath, index) => ({
        filePath,
        index,
        position: null,
        sliceLocation: null,
        instanceNumber: null,
        pathNumber: volumePathNumber(filePath),
    }))).map((record) => record.filePath);
}

function sortVolumeRecords(records) {
    return [...records].sort((a, b) => {
        const byPosition = compareNullableNumber(a.position, b.position, 1e-4);
        if (byPosition !== 0) return byPosition;
        const bySliceLocation = compareNullableNumber(a.sliceLocation, b.sliceLocation, 1e-4);
        if (bySliceLocation !== 0) return bySliceLocation;
        const byInstance = compareNullableNumber(a.instanceNumber, b.instanceNumber, 0);
        if (byInstance !== 0) return byInstance;
        const byPathNumber = compareNullableNumber(a.pathNumber, b.pathNumber, 0);
        if (byPathNumber !== 0) return byPathNumber;
        return a.index - b.index;
    });
}

function compareNullableNumber(a, b, epsilon) {
    const aOk = Number.isFinite(a);
    const bOk = Number.isFinite(b);
    if (aOk && bOk) {
        const diff = a - b;
        return Math.abs(diff) > epsilon ? diff : 0;
    }
    if (aOk) return -1;
    if (bOk) return 1;
    return 0;
}

ipcMain.handle('open-volume-in-browser', (event, payload = {}) => {
    try {
        const tmpPath = writeNormalizedVolumeLaunchFile(payload || {});
        const target = `${APP_URL}/volume-3d?launchFile=${encodeURIComponent(tmpPath)}`;
        shell.openExternal(target);
        return { success: true, target };
    } catch (e) {
        console.error('[open-volume-in-browser] failed:', e.message);
        return { success: false, error: e.message };
    }
});

// Resize viewer windows when layout changes
ipcMain.handle('resize-cr-viewer', (event, { cols, rows }) => {
    if (!crViewerWindow || crViewerWindow.isDestroyed()) return;
    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenW } = primaryDisplay.workAreaSize;
    const [, winH] = crViewerWindow.getSize();
    const headerPx = 110;
    const sidebarPx = 70;
    const imageAR = 4 / 3; // standard DICOM image aspect ratio
    const cellH = (winH - headerPx) / (rows || 1);
    const cellW = cellH * imageAR;
    const gridW = cellW * (cols || 1);
    const newW = Math.round(Math.min(Math.max(gridW + sidebarPx, 500), screenW * 0.95));
    crViewerWindow.setSize(newW, winH);
    crViewerWindow.center();
});

ipcMain.handle('resize-viewer', (event, { cols, rows }) => {
    if (!viewerWindow || viewerWindow.isDestroyed()) return;
    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenW } = primaryDisplay.workAreaSize;
    const [, winH] = viewerWindow.getSize();
    const headerToolbarPx = 74;
    const sidebarPx = 532;
    const imageAR = 4 / 3;
    const cellH = (winH - headerToolbarPx) / (rows || 1);
    const cellW = cellH * imageAR;
    const gridW = cellW * (cols || 1);
    const newW = Math.round(Math.min(Math.max(gridW + sidebarPx, 600), screenW * 0.95));
    viewerWindow.setSize(newW, winH);
    viewerWindow.center();
});

// =====================================================
// Open Viewer + Report Editor Side-by-Side
// =====================================================
let reportWindow = null;

ipcMain.handle('open-viewer-with-report', (event, { isPortrait, imageCount, cols, rows }) => {
    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenW, height: screenH } = primaryDisplay.workAreaSize;
    const workArea = primaryDisplay.workArea;

    const winH = Math.round(screenH * 0.93);
    const winY = workArea.y + Math.round(screenH * 0.02);

    // Viewer gets 60% of screen, report editor gets 40%
    const viewerW = Math.round(screenW * 0.6);
    const reportW = Math.round(screenW * 0.4);

    // Close existing windows
    if (viewerWindow && !viewerWindow.isDestroyed()) viewerWindow.close();
    if (reportWindow && !reportWindow.isDestroyed()) reportWindow.close();

    // Create viewer window (left side)
    viewerWindow = new BrowserWindow({
        width: viewerW,
        height: winH,
        x: workArea.x,
        y: winY,
        minWidth: 500,
        minHeight: 400,
        title: `One Clickz - Viewer (${imageCount} images)`,
        icon: path.join(__dirname, 'icon.ico'),
        webPreferences: viewerWebPreferences()
    });
    viewerWindow.loadURL(`${APP_URL}/viewer`);

    const viewerMenu = Menu.buildFromTemplate([buildViewMenu()]);
    viewerWindow.setMenu(viewerMenu);
    registerWindowSecurity(viewerWindow);
    viewerWindow.on('closed', () => { viewerWindow = null; });

    // Create report editor window (right side) - alwaysOnTop so it stays visible
    reportWindow = new BrowserWindow({
        width: reportW,
        height: winH,
        x: workArea.x + viewerW,
        y: winY,
        minWidth: 400,
        minHeight: 400,
        alwaysOnTop: true,
        title: 'One Clickz - Report Editor',
        icon: path.join(__dirname, 'icon.ico'),
        webPreferences: viewerWebPreferences()
    });
    reportWindow.loadURL(`${APP_URL}/report-editor`);

    const reportMenu = Menu.buildFromTemplate([buildViewMenu()]);
    reportWindow.setMenu(reportMenu);
    registerWindowSecurity(reportWindow);
    reportWindow.on('closed', () => { reportWindow = null; });

    return { success: true };
});

// =====================================================
// Open Standalone Report Editor (no viewer)
// =====================================================
ipcMain.handle('open-report-editor', async () => {
    const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize;
    const winW = Math.min(1000, Math.round(screenW * 0.65));
    const winH = Math.min(900, Math.round(screenH * 0.85));
    const winX = Math.round((screenW - winW) / 2);
    const winY = Math.round((screenH - winH) / 2);

    const win = new BrowserWindow({
        width: winW,
        height: winH,
        x: winX,
        y: winY,
        minWidth: 500,
        minHeight: 400,
        title: 'One Clickz - Report Editor',
        icon: path.join(__dirname, 'icon.ico'),
        webPreferences: viewerWebPreferences()
    });
    win.loadURL(`${APP_URL}/report-editor`);
    const menu = Menu.buildFromTemplate([buildViewMenu()]);
    win.setMenu(menu);
    registerWindowSecurity(win);
    return { success: true };
});

// =====================================================
// File / Folder Dialog
// =====================================================
ipcMain.handle('show-open-dialog', async (event, options) => {
    try {
        const result = await dialog.showOpenDialog(mainWindow, options);
        if (!result.canceled && Array.isArray(result.filePaths)) {
            result.filePaths.forEach(authorizeDicomPath);
        }
        return result; // { canceled, filePaths }
    } catch (e) {
        return { canceled: true, filePaths: [], error: e.message };
    }
});

// Read a file as ArrayBuffer (for passing image data to the renderer)
ipcMain.handle('read-file-buffer', async (_event, filePath) => {
    const resolved = path.resolve(filePath);
    if (!isAllowedDicomPath(resolved, 'file')) throw new Error('File is outside allowed roots');
    if (!fs.existsSync(resolved)) throw new Error('File not found: ' + filePath);
    const buf = fs.readFileSync(resolved);
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
});

// List image files (PNG/JPEG) in a folder (recursive, same pattern as list-dicom-files)
ipcMain.handle('list-image-files', async (_event, folderPath) => {
    try {
        const resolved = path.resolve(folderPath);
        if (!isAllowedDicomPath(resolved, 'directory')) {
            return { success: false, files: [], error: 'Directory is outside allowed roots' };
        }
        if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
            return { success: false, files: [], error: 'Not a valid directory' };
        }
        const IMAGE_RE = /\.(png|jpe?g)$/i;
        const files = [];
        const limit = 500;
        const walk = (dir) => {
            if (files.length >= limit) return;
            try {
                const entries = fs.readdirSync(dir, { withFileTypes: true });
                for (const entry of entries) {
                    if (files.length >= limit) return;
                    const fullPath = path.join(dir, entry.name);
                    if (entry.isDirectory()) {
                        walk(fullPath);
                    } else if (entry.isFile() && IMAGE_RE.test(entry.name)) {
                        files.push(fullPath);
                    }
                }
            } catch { /* skip unreadable dirs */ }
        };
        walk(resolved);
        return { success: true, files };
    } catch (e) {
        return { success: false, files: [], error: e.message };
    }
});

// =====================================================
// List DICOM files in a folder (recursive)
// =====================================================
ipcMain.handle('list-dicom-files', async (event, folderPath) => {
    try {
        const resolved = path.resolve(folderPath);
        if (!isAllowedDicomPath(resolved, 'directory')) {
            return { success: false, files: [], error: 'Directory is outside allowed roots' };
        }
        if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
            return { success: false, files: [], error: 'Not a valid directory' };
        }
        const files = [];
        const limit = 500;
        const walk = (dir) => {
            if (files.length >= limit) return;
            try {
                const entries = fs.readdirSync(dir, { withFileTypes: true });
                for (const entry of entries) {
                    if (files.length >= limit) return;
                    const fullPath = path.join(dir, entry.name);
                    if (entry.isDirectory()) {
                        walk(fullPath);
                    } else if (entry.isFile()) {
                        const name = entry.name.toLowerCase();
                        if (name.endsWith('.dcm') || name.endsWith('.dicom') || (!name.includes('.') && name !== 'dicomdir')) {
                            files.push(fullPath);
                        }
                    }
                }
            } catch { /* skip unreadable dirs */ }
        };
        walk(resolved);
        return { success: true, files };
    } catch (e) {
        return { success: false, files: [], error: e.message };
    }
});

// =====================================================
// DICOM Send (C-STORE SCU via Orthanc REST API)
// =====================================================
ipcMain.handle('dicom-send-to-modality', async (event, { modalityName, filePaths }) => {
    // Orthanc can send stored studies to remote modalities via:
    //   POST /modalities/{id}/store  body: ["studyOrInstanceOrthancId", ...]
    // But here filePaths are local files. We need to upload them to Orthanc first, then send.
    try {
        const uploaded = [];
        for (const fp of filePaths) {
            const data = fs.readFileSync(fp);
            await new Promise((resolve, reject) => {
                const req = http.request({
                    host: '127.0.0.1', port: ORTHANC_PORT, path: '/instances',
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/dicom',
                        'Content-Length': data.length,
                        Authorization: orthancAuthHeader(),
                    }
                }, (res) => {
                    let body = '';
                    res.on('data', d => body += d);
                    res.on('end', () => {
                        try { uploaded.push(JSON.parse(body).ID); resolve(null); }
                        catch { resolve(null); }
                    });
                });
                req.on('error', reject);
                req.write(data);
                req.end();
            });
        }
        // Now send uploaded instances to modality
        const sendPayload = JSON.stringify(uploaded);
        await new Promise((resolve, reject) => {
            const req = http.request({
                host: '127.0.0.1', port: ORTHANC_PORT,
                path: `/modalities/${encodeURIComponent(modalityName)}/store`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(sendPayload),
                    Authorization: orthancAuthHeader(),
                }
            }, (res) => {
                let body = '';
                res.on('data', d => body += d);
                res.on('end', () => resolve(body));
            });
            req.on('error', reject);
            req.write(sendPayload);
            req.end();
        });
        return { success: true, sent: uploaded.length };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

// DICOM Send to destination by host/port/aeTitle (auto-registers modality in Orthanc)
ipcMain.handle('dicom-send-to-destination', async (event, { host, port, aeTitle, filePaths }) => {
    try {
        if (!host || !port || !aeTitle || !filePaths || filePaths.length === 0) {
            return { success: false, error: 'Missing required parameters (host, port, aeTitle, filePaths)' };
        }
        const modalityAlias = `send_${aeTitle}_${host}_${port}`.replace(/[^a-zA-Z0-9_]/g, '_');

        // Register modality in Orthanc
        const modalityConfig = JSON.stringify([aeTitle, host, parseInt(port)]);
        await new Promise((resolve, reject) => {
            const req = http.request({
                host: '127.0.0.1', port: ORTHANC_PORT,
                path: `/modalities/${encodeURIComponent(modalityAlias)}`,
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(modalityConfig),
                    Authorization: orthancAuthHeader(),
                }
            }, (res) => {
                let body = '';
                res.on('data', d => body += d);
                res.on('end', () => resolve(body));
            });
            req.on('error', reject);
            req.write(modalityConfig);
            req.end();
        });

        // Upload local DICOM files to Orthanc
        const uploaded = [];
        for (const fp of filePaths) {
            try {
                const data = fs.readFileSync(fp);
                const result = await new Promise((resolve, reject) => {
                    const req = http.request({
                        host: '127.0.0.1', port: ORTHANC_PORT, path: '/instances',
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/dicom',
                            'Content-Length': data.length,
                            Authorization: orthancAuthHeader(),
                        }
                    }, (res) => {
                        let body = '';
                        res.on('data', d => body += d);
                        res.on('end', () => {
                            try { resolve(JSON.parse(body)); } catch { resolve(null); }
                        });
                    });
                    req.on('error', reject);
                    req.write(data);
                    req.end();
                });
                if (result && result.ID) uploaded.push(result.ID);
            } catch (uploadErr) {
                console.warn(`[DICOM Send] Failed to upload ${fp}:`, uploadErr.message);
            }
        }

        if (uploaded.length === 0) {
            return { success: false, error: 'No files could be uploaded to Orthanc' };
        }

        // Send uploaded instances to the remote modality via C-STORE
        const sendPayload = JSON.stringify(uploaded);
        const sendResult = await new Promise((resolve, reject) => {
            const req = http.request({
                host: '127.0.0.1', port: ORTHANC_PORT,
                path: `/modalities/${encodeURIComponent(modalityAlias)}/store`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(sendPayload),
                    Authorization: orthancAuthHeader(),
                }
            }, (res) => {
                let body = '';
                res.on('data', d => body += d);
                res.on('end', () => {
                    try { resolve(JSON.parse(body)); } catch { resolve({ error: body }); }
                });
            });
            req.on('error', reject);
            req.write(sendPayload);
            req.end();
        });

        return { success: true, sent: uploaded.length, total: filePaths.length, sendResult };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

// DICOM Echo (C-ECHO) to test connectivity
ipcMain.handle('dicom-echo', async (event, { host, port, aeTitle }) => {
    try {
        if (!host || !port || !aeTitle) {
            return { success: false, error: 'Missing required parameters (host, port, aeTitle)' };
        }
        const modalityAlias = `echo_${aeTitle}_${host}_${port}`.replace(/[^a-zA-Z0-9_]/g, '_');

        // Register modality in Orthanc
        const modalityConfig = JSON.stringify([aeTitle, host, parseInt(port)]);
        await new Promise((resolve, reject) => {
            const req = http.request({
                host: '127.0.0.1', port: ORTHANC_PORT,
                path: `/modalities/${encodeURIComponent(modalityAlias)}`,
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(modalityConfig),
                    Authorization: orthancAuthHeader(),
                }
            }, (res) => {
                let body = '';
                res.on('data', d => body += d);
                res.on('end', () => resolve(body));
            });
            req.on('error', reject);
            req.write(modalityConfig);
            req.end();
        });

        // Perform C-ECHO
        const echoResult = await new Promise((resolve, reject) => {
            const req = http.request({
                host: '127.0.0.1', port: ORTHANC_PORT,
                path: `/modalities/${encodeURIComponent(modalityAlias)}/echo`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: orthancAuthHeader(),
                }
            }, (res) => {
                let body = '';
                res.on('data', d => body += d);
                res.on('end', () => resolve({ statusCode: res.statusCode, body }));
            });
            req.on('error', reject);
            req.end();
        });

        return echoResult.statusCode === 200
            ? { success: true, message: 'C-ECHO successful - destination is reachable' }
            : { success: false, error: `C-ECHO failed (HTTP ${echoResult.statusCode}): ${echoResult.body}` };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

// Get/Set configured Orthanc modalities for DICOM send
ipcMain.handle('get-dicom-modalities', async () => {
    try {
        const result = await new Promise((resolve, reject) => {
            const req = http.request({
                host: '127.0.0.1', port: ORTHANC_PORT, path: '/modalities',
                headers: { Authorization: orthancAuthHeader() }
            }, (res) => {
                let body = '';
                res.on('data', d => body += d);
                res.on('end', () => {
                    try { resolve(JSON.parse(body)); } catch { resolve([]); }
                });
            });
            req.on('error', () => resolve([]));
            req.end();
        });
        return { success: true, modalities: result };
    } catch { return { success: true, modalities: [] }; }
});

// =====================================================
// =====================================================
// DICOM Network Receiver (C-STORE SCP) for USG/Network
// Implements DICOM Upper Layer Protocol for proper
// association negotiation and C-STORE reception.
// =====================================================
const DICOM_LISTEN_PORT = 10104;
const DICOM_AE_TITLE = 'ONECLICKZ';
const DICOM_MAX_PDU = 131072; // 128KB - compatible with most devices
let dicomNetworkServer = null;
const dicomSettingsPath = path.join(userDataPath, 'dicom-scp-settings.json');
let networkDicomStorage = loadDicomSettings().storagePath || path.join(userDataPath, 'network-dicom');

function loadDicomSettings() {
    try {
        if (fs.existsSync(dicomSettingsPath)) {
            return JSON.parse(fs.readFileSync(dicomSettingsPath, 'utf8'));
        }
    } catch (e) { console.warn('[DICOM SCP] Failed to load settings:', e.message); }
    return {};
}

function saveDicomSettings(settings) {
    try {
        const existing = loadDicomSettings();
        const merged = { ...existing, ...settings };
        fs.writeFileSync(dicomSettingsPath, JSON.stringify(merged, null, 2), 'utf8');
    } catch (e) { console.warn('[DICOM SCP] Failed to save settings:', e.message); }
}

function ensureNetworkDicomStorage() {
    if (!fs.existsSync(networkDicomStorage)) {
        fs.mkdirSync(networkDicomStorage, { recursive: true });
        console.log(`[DICOM SCP] Storage directory created: ${networkDicomStorage}`);
    }
}

// - DICOM Upper Layer PDU helpers -

function padAE(str) {
    return (str + '                ').slice(0, 16);
}

function padUID(str) {
    // UIDs are padded with NULL (0x00) to even length per DICOM PS3.5
    if (str.length % 2 !== 0) return str + '\0';
    return str;
}

function buildAssociateAC(rqBuffer) {
    const pduLength = rqBuffer.readUInt32BE(2);
    const calledAE = rqBuffer.slice(10, 26).toString('ascii').trim();
    const callingAE = rqBuffer.slice(26, 42).toString('ascii').trim();
    console.log(`[DICOM SCP] Association request: Called=${calledAE} Calling=${callingAE}`);

    // Parse variable items starting at offset 74
    const items = [];
    let offset = 74;
    const pduEnd = 6 + pduLength;
    while (offset + 4 <= pduEnd && offset + 4 <= rqBuffer.length) {
        const itemType = rqBuffer[offset];
        if (offset + 4 > rqBuffer.length) break;
        const itemLen = rqBuffer.readUInt16BE(offset + 2);
        if (itemLen === 0 && itemType === 0) break; // safety
        if (offset + 4 + itemLen > rqBuffer.length) break;

        if (itemType === 0x20) {
            // Presentation Context Item (RQ)
            const pcId = rqBuffer[offset + 4];
            let abstractSyntax = '';
            const transferSyntaxes = [];
            let subOffset = offset + 8;
            const pcEnd = offset + 4 + itemLen;
            while (subOffset + 4 <= pcEnd && subOffset + 4 <= rqBuffer.length) {
                const subType = rqBuffer[subOffset];
                const subLen = rqBuffer.readUInt16BE(subOffset + 2);
                if (subOffset + 4 + subLen > rqBuffer.length) break;
                if (subType === 0x30) {
                    abstractSyntax = rqBuffer.slice(subOffset + 4, subOffset + 4 + subLen).toString('ascii').replace(/\0+$/, '').trim();
                } else if (subType === 0x40) {
                    transferSyntaxes.push(rqBuffer.slice(subOffset + 4, subOffset + 4 + subLen).toString('ascii').replace(/\0+$/, '').trim());
                }
                subOffset += 4 + subLen;
            }
            items.push({ pcId, abstractSyntax, transferSyntaxes });
        }
        offset += 4 + itemLen;
    }

    // Build AC presentation context results - accept all
    const pcResults = [];
    for (const pc of items) {
        // Prefer Explicit VR Little Endian, then first offered
        let selectedTs = pc.transferSyntaxes[0] || '1.2.840.10008.1.2';
        const explicitLE = pc.transferSyntaxes.find(ts => ts === '1.2.840.10008.1.2.1');
        if (explicitLE) selectedTs = explicitLE;

        const tsBytes = Buffer.from(selectedTs, 'ascii');
        const tsSub = Buffer.alloc(4 + tsBytes.length);
        tsSub[0] = 0x40; tsSub[1] = 0x00;
        tsSub.writeUInt16BE(tsBytes.length, 2);
        tsBytes.copy(tsSub, 4);

        const pcItem = Buffer.alloc(8 + tsSub.length);
        pcItem[0] = 0x21; pcItem[1] = 0x00;
        pcItem.writeUInt16BE(4 + tsSub.length, 2);
        pcItem[4] = pc.pcId;
        pcItem[5] = 0x00; pcItem[6] = 0x00; pcItem[7] = 0x00; // accepted
        tsSub.copy(pcItem, 8);
        pcResults.push(pcItem);

        // Store the accepted TS back for later use
        pc.acceptedTransferSyntax = selectedTs;
    }

    // Application Context
    const appCtxUid = '1.2.840.10008.3.1.1.1';
    const appCtxBytes = Buffer.from(appCtxUid, 'ascii');
    const appCtxItem = Buffer.alloc(4 + appCtxBytes.length);
    appCtxItem[0] = 0x10; appCtxItem[1] = 0x00;
    appCtxItem.writeUInt16BE(appCtxBytes.length, 2);
    appCtxBytes.copy(appCtxItem, 4);

    // User Information
    const maxPduSub = Buffer.alloc(8);
    maxPduSub[0] = 0x51; maxPduSub[1] = 0x00;
    maxPduSub.writeUInt16BE(4, 2);
    maxPduSub.writeUInt32BE(DICOM_MAX_PDU, 4);

    const implUid = '1.2.826.0.1.3680043.8.498.1';
    const implUidBytes = Buffer.from(implUid, 'ascii');
    const implSub = Buffer.alloc(4 + implUidBytes.length);
    implSub[0] = 0x52; implSub[1] = 0x00;
    implSub.writeUInt16BE(implUidBytes.length, 2);
    implUidBytes.copy(implSub, 4);

    // Implementation Version Name
    const implVerName = 'ONECLICKZ_SCP';
    const implVerBytes = Buffer.from(implVerName, 'ascii');
    const implVerSub = Buffer.alloc(4 + implVerBytes.length);
    implVerSub[0] = 0x55; implVerSub[1] = 0x00;
    implVerSub.writeUInt16BE(implVerBytes.length, 2);
    implVerBytes.copy(implVerSub, 4);

    const userInfoContent = Buffer.concat([maxPduSub, implSub, implVerSub]);
    const userInfoItem = Buffer.alloc(4 + userInfoContent.length);
    userInfoItem[0] = 0x50; userInfoItem[1] = 0x00;
    userInfoItem.writeUInt16BE(userInfoContent.length, 2);
    userInfoContent.copy(userInfoItem, 4);

    const variableItems = Buffer.concat([appCtxItem, ...pcResults, userInfoItem]);

    const fixedLen = 2 + 2 + 16 + 16 + 32; // 68 bytes after length field
    const pduLen = fixedLen + variableItems.length;
    const acPdu = Buffer.alloc(6 + pduLen);
    acPdu[0] = 0x02; acPdu[1] = 0x00;
    acPdu.writeUInt32BE(pduLen, 2);
    acPdu.writeUInt16BE(1, 6); // protocol version
    acPdu.writeUInt16BE(0, 8);
    Buffer.from(padAE(DICOM_AE_TITLE)).copy(acPdu, 10);
    Buffer.from(padAE(callingAE)).copy(acPdu, 26);
    variableItems.copy(acPdu, 74);

    return { acPdu, items, callingAE };
}

function buildReleaseRP() {
    const rp = Buffer.alloc(10);
    rp[0] = 0x06; rp[1] = 0x00;
    rp.writeUInt32BE(4, 2);
    return rp;
}

function buildCStoreRSP(pcId, messageId, sopClassUid, sopInstanceUid) {
    // Command set is ALWAYS Implicit VR Little Endian (DICOM PS3.7 -6.3.1)
    const elements = [];

    function addUint16Elem(group, elem, val) {
        const b = Buffer.alloc(10);
        b.writeUInt16LE(group, 0);
        b.writeUInt16LE(elem, 2);
        b.writeUInt32LE(2, 4);
        b.writeUInt16LE(val, 8);
        return b;
    }

    function addStringElem(group, elem, val) {
        let v = Buffer.from(val, 'ascii');
        if (v.length % 2 !== 0) v = Buffer.concat([v, Buffer.from([0x00])]);
        const hdr = Buffer.alloc(8);
        hdr.writeUInt16LE(group, 0);
        hdr.writeUInt16LE(elem, 2);
        hdr.writeUInt32LE(v.length, 4);
        return Buffer.concat([hdr, v]);
    }

    elements.push(addStringElem(0x0000, 0x0002, sopClassUid));      // Affected SOP Class UID
    elements.push(addUint16Elem(0x0000, 0x0100, 0x8001));            // Command Field: C-STORE-RSP
    elements.push(addUint16Elem(0x0000, 0x0120, messageId));         // Message ID Being Responded To
    elements.push(addUint16Elem(0x0000, 0x0800, 0x0101));            // Data Set Type: none
    elements.push(addUint16Elem(0x0000, 0x0900, 0x0000));            // Status: Success
    elements.push(addStringElem(0x0000, 0x1000, sopInstanceUid));    // Affected SOP Instance UID

    const cmdData = Buffer.concat(elements);

    // Group Length element (0000,0000)
    const grpLenElem = Buffer.alloc(12);
    grpLenElem.writeUInt16LE(0x0000, 0);
    grpLenElem.writeUInt16LE(0x0000, 2);
    grpLenElem.writeUInt32LE(4, 4);
    grpLenElem.writeUInt32LE(cmdData.length, 8);

    const fullCmd = Buffer.concat([grpLenElem, cmdData]);

    // PDV: length(4) + pcId(1) + header(1) + data
    const pdvLen = 2 + fullCmd.length;
    const pdv = Buffer.alloc(4 + pdvLen);
    pdv.writeUInt32BE(pdvLen, 0);
    pdv[4] = pcId;
    pdv[5] = 0x03; // command + last fragment
    fullCmd.copy(pdv, 6);

    // P-DATA-TF
    const pdata = Buffer.alloc(6 + pdv.length);
    pdata[0] = 0x04; pdata[1] = 0x00;
    pdata.writeUInt32BE(pdv.length, 2);
    pdv.copy(pdata, 6);
    return pdata;
}

function buildCEchoRSP(pcId, messageId) {
    // C-ECHO-RSP: similar to C-STORE-RSP but with Command Field = 0x8030
    const elements = [];

    function addUint16Elem(group, elem, val) {
        const b = Buffer.alloc(10);
        b.writeUInt16LE(group, 0);
        b.writeUInt16LE(elem, 2);
        b.writeUInt32LE(2, 4);
        b.writeUInt16LE(val, 8);
        return b;
    }

    function addStringElem(group, elem, val) {
        let v = Buffer.from(val, 'ascii');
        if (v.length % 2 !== 0) v = Buffer.concat([v, Buffer.from([0x00])]);
        const hdr = Buffer.alloc(8);
        hdr.writeUInt16LE(group, 0);
        hdr.writeUInt16LE(elem, 2);
        hdr.writeUInt32LE(v.length, 4);
        return Buffer.concat([hdr, v]);
    }

    // Verification SOP Class UID
    elements.push(addStringElem(0x0000, 0x0002, '1.2.840.10008.1.1'));
    elements.push(addUint16Elem(0x0000, 0x0100, 0x8030));  // C-ECHO-RSP
    elements.push(addUint16Elem(0x0000, 0x0120, messageId));
    elements.push(addUint16Elem(0x0000, 0x0800, 0x0101));  // No dataset
    elements.push(addUint16Elem(0x0000, 0x0900, 0x0000));  // Success

    const cmdData = Buffer.concat(elements);
    const grpLenElem = Buffer.alloc(12);
    grpLenElem.writeUInt16LE(0x0000, 0);
    grpLenElem.writeUInt16LE(0x0000, 2);
    grpLenElem.writeUInt32LE(4, 4);
    grpLenElem.writeUInt32LE(cmdData.length, 8);

    const fullCmd = Buffer.concat([grpLenElem, cmdData]);
    const pdvLen = 2 + fullCmd.length;
    const pdv = Buffer.alloc(4 + pdvLen);
    pdv.writeUInt32BE(pdvLen, 0);
    pdv[4] = pcId;
    pdv[5] = 0x03;
    fullCmd.copy(pdv, 6);

    const pdata = Buffer.alloc(6 + pdv.length);
    pdata[0] = 0x04; pdata[1] = 0x00;
    pdata.writeUInt32BE(pdv.length, 2);
    pdv.copy(pdata, 6);
    return pdata;
}

function parseCommandSet(cmdBuffer) {
    // Command set is Implicit VR Little Endian: group(2)+elem(2)+len(4)+value
    const result = {};
    let offset = 0;
    while (offset + 8 <= cmdBuffer.length) {
        const group = cmdBuffer.readUInt16LE(offset);
        const elem = cmdBuffer.readUInt16LE(offset + 2);
        const len = cmdBuffer.readUInt32LE(offset + 4);
        if (len === 0xFFFFFFFF || len > cmdBuffer.length - offset - 8) break;
        const tag = `${group.toString(16).padStart(4, '0')},${elem.toString(16).padStart(4, '0')}`;
        if (len === 2) {
            result[tag] = cmdBuffer.readUInt16LE(offset + 8);
        } else if (len === 4 && group === 0x0000 && elem === 0x0000) {
            result[tag] = cmdBuffer.readUInt32LE(offset + 8);
        } else {
            result[tag] = cmdBuffer.slice(offset + 8, offset + 8 + len).toString('ascii').replace(/\0+$/, '');
        }
        offset += 8 + len;
    }
    return result;
}

// Build proper DICOM Part 10 File Meta Information header
// Uses Explicit VR Little Endian (mandatory for File Meta per DICOM PS3.10)
function buildFileMetaHeader(sopClassUid, sopInstanceUid, transferSyntax) {
    const parts = [];

    // Helper: Explicit VR LE element with short VR (UI, UL, SH, etc. - 2-byte length)
    function addShortVR(group, elem, vr, value) {
        const valBuf = Buffer.isBuffer(value) ? value : Buffer.from(padUID(value), 'ascii');
        const hdr = Buffer.alloc(8);
        hdr.writeUInt16LE(group, 0);
        hdr.writeUInt16LE(elem, 2);
        hdr[4] = vr.charCodeAt(0);
        hdr[5] = vr.charCodeAt(1);
        hdr.writeUInt16LE(valBuf.length, 6);
        return Buffer.concat([hdr, valBuf]);
    }

    // Helper: Explicit VR LE element with long VR (OB, OW, UN, etc. - 4-byte length)
    function addLongVR(group, elem, vr, value) {
        const valBuf = Buffer.isBuffer(value) ? value : Buffer.from(value, 'ascii');
        const hdr = Buffer.alloc(12);
        hdr.writeUInt16LE(group, 0);
        hdr.writeUInt16LE(elem, 2);
        hdr[4] = vr.charCodeAt(0);
        hdr[5] = vr.charCodeAt(1);
        hdr.writeUInt16LE(0, 6); // reserved 2 bytes
        hdr.writeUInt32LE(valBuf.length, 8);
        return Buffer.concat([hdr, valBuf]);
    }

    // (0002,0001) File Meta Information Version - OB, uses long VR format
    parts.push(addLongVR(0x0002, 0x0001, 'OB', Buffer.from([0x00, 0x01])));
    // (0002,0002) Media Storage SOP Class UID - UI
    parts.push(addShortVR(0x0002, 0x0002, 'UI', sopClassUid));
    // (0002,0003) Media Storage SOP Instance UID - UI
    parts.push(addShortVR(0x0002, 0x0003, 'UI', sopInstanceUid));
    // (0002,0010) Transfer Syntax UID - UI
    parts.push(addShortVR(0x0002, 0x0010, 'UI', transferSyntax));
    // (0002,0012) Implementation Class UID - UI
    parts.push(addShortVR(0x0002, 0x0012, 'UI', '1.2.826.0.1.3680043.8.498.1'));
    // (0002,0013) Implementation Version Name - SH
    const verName = 'ONECLICKZ_SCP ';
    parts.push(addShortVR(0x0002, 0x0013, 'SH', Buffer.from(verName.length % 2 !== 0 ? verName + ' ' : verName, 'ascii')));

    const metaContent = Buffer.concat(parts);

    // (0002,0000) File Meta Information Group Length - UL (short VR)
    const grpLen = addShortVR(0x0002, 0x0000, 'UL', Buffer.alloc(0));
    // Fix: UL is 4 bytes
    const grpLenBuf = Buffer.alloc(12);
    grpLenBuf.writeUInt16LE(0x0002, 0);
    grpLenBuf.writeUInt16LE(0x0000, 2);
    grpLenBuf[4] = 0x55; grpLenBuf[5] = 0x4C; // 'UL'
    grpLenBuf.writeUInt16LE(4, 6);
    grpLenBuf.writeUInt32LE(metaContent.length, 8);

    const preamble = Buffer.alloc(128, 0);
    const magic = Buffer.from('DICM');

    return Buffer.concat([preamble, magic, grpLenBuf, metaContent]);
}

function addFirewallRule() {
    if (process.platform !== 'win32') return;
    try {
        const { execSync, exec } = require('child_process');
        // Check if rule already exists
        try {
            const check = execSync('netsh advfirewall firewall show rule name="One Clickz SCP"', { encoding: 'utf8', timeout: 5000, windowsHide: true });
            if (check.includes('One Clickz SCP')) {
                console.log('[DICOM SCP] Firewall rule already exists');
                return;
            }
        } catch (e) { /* rule doesn't exist, create it */ }

        // Try adding directly first (works if app is already admin)
        try {
            execSync(`netsh advfirewall firewall add rule name="One Clickz SCP" dir=in action=allow protocol=TCP localport=${DICOM_LISTEN_PORT} profile=any`, { timeout: 10000, windowsHide: true });
            console.log(`[DICOM SCP] Firewall rule added for port ${DICOM_LISTEN_PORT}`);
            return;
        } catch (e) { /* needs elevation */ }

        // Request elevation via PowerShell - shows UAC prompt
        console.log('[DICOM SCP] Requesting admin elevation for firewall rule...');
        const cmd = `Start-Process -FilePath 'netsh' -ArgumentList 'advfirewall firewall add rule name=\\"One Clickz SCP\\" dir=in action=allow protocol=TCP localport=${DICOM_LISTEN_PORT} profile=any' -Verb RunAs -WindowStyle Hidden -Wait`;
        exec(`powershell -NoProfile -Command "${cmd}"`, { timeout: 30000, windowsHide: true }, (err) => {
            if (err) {
                console.warn(`[DICOM SCP] Firewall rule not added (user may have declined UAC): ${err.message}`);
            } else {
                console.log(`[DICOM SCP] Firewall rule added via elevation for port ${DICOM_LISTEN_PORT}`);
            }
        });
    } catch (e) {
        console.warn(`[DICOM SCP] Could not add firewall rule: ${e.message}`);
    }
}

function startDicomNetworkReceiver() {
    ensureNetworkDicomStorage();
    addFirewallRule();

    try {
        const net = require('net');
        dicomNetworkServer = net.createServer({ allowHalfOpen: false }, (socket) => {
            console.log(`[DICOM SCP] Connection from ${socket.remoteAddress}:${socket.remotePort}`);
            socket.setKeepAlive(true, 10000);
            socket.setTimeout(120000); // 2 min timeout for idle connections

            let recvBuffer = Buffer.alloc(0);
            let associationInfo = null;
            let currentCommand = null;
            let fileCount = 0;
            let socketAlive = true;

            function safeWrite(data) {
                if (socketAlive && !socket.destroyed) {
                    try { socket.write(data); } catch (e) {
                        console.error(`[DICOM SCP] Write error: ${e.message}`);
                    }
                }
            }

            function processPDU() {
                while (recvBuffer.length >= 6) {
                    const pduType = recvBuffer[0];
                    const pduLen = recvBuffer.readUInt32BE(2);
                    const totalLen = 6 + pduLen;

                    // Sanity check - reject absurdly large PDUs (>16MB)
                    if (pduLen > 16 * 1024 * 1024) {
                        console.error(`[DICOM SCP] PDU length too large (${pduLen}), closing connection`);
                        socket.destroy();
                        return;
                    }

                    if (recvBuffer.length < totalLen) break;

                    const pdu = Buffer.from(recvBuffer.slice(0, totalLen));
                    recvBuffer = recvBuffer.slice(totalLen);

                    try {
                        handlePDU(pduType, pdu);
                    } catch (e) {
                        console.error(`[DICOM SCP] Error handling PDU type 0x${pduType.toString(16)}: ${e.message}`);
                    }
                }
            }

            function handlePDU(pduType, pdu) {
                switch (pduType) {
                    case 0x01: { // A-ASSOCIATE-RQ
                        try {
                            const { acPdu, items, callingAE } = buildAssociateAC(pdu);
                            associationInfo = { items, callingAE };
                            safeWrite(acPdu);
                            console.log(`[DICOM SCP] Association accepted from ${callingAE} (${items.length} presentation contexts)`);
                        } catch (e) {
                            console.error(`[DICOM SCP] Association failed: ${e.message}`);
                            const rj = Buffer.alloc(10);
                            rj[0] = 0x03; rj[1] = 0x00;
                            rj.writeUInt32BE(4, 2);
                            rj[7] = 0x01; rj[8] = 0x01; rj[9] = 0x01;
                            safeWrite(rj);
                            socket.end();
                        }
                        break;
                    }

                    case 0x04: { // P-DATA-TF
                        if (!associationInfo) break;
                        const pduDataLen = pdu.readUInt32BE(2);
                        let offset = 6;
                        const end = 6 + pduDataLen;

                        while (offset + 6 <= end && offset + 6 <= pdu.length) {
                            const pdvLen = pdu.readUInt32BE(offset);
                            if (pdvLen < 2 || offset + 4 + pdvLen > pdu.length) break;
                            const pdvPcId = pdu[offset + 4];
                            const pdvHeader = pdu[offset + 5];
                            // Per DICOM PS3.7 E.2: bit 0 = 1 means Command, 0 means Dataset
                            // Per DICOM PS3.7 E.2: bit 1 = 1 means last fragment
                            const isCommand = (pdvHeader & 0x01) !== 0;
                            const isLast = (pdvHeader & 0x02) !== 0;
                            const data = pdu.slice(offset + 6, offset + 4 + pdvLen);

                            if (!currentCommand) {
                                currentCommand = { pcId: pdvPcId, cmdFragments: [], dataFragments: [], parsed: null };
                            }

                            if (isCommand) {
                                currentCommand.cmdFragments.push(data);
                                if (isLast) {
                                    const cmdData = Buffer.concat(currentCommand.cmdFragments);
                                    currentCommand.parsed = parseCommandSet(cmdData);
                                    currentCommand.cmdFragments = [];
                                    const dataSetType = currentCommand.parsed['0000,0800'];
                                    if (dataSetType === 0x0101) {
                                        handleCompleteMessage(pdvPcId);
                                    }
                                }
                            } else {
                                currentCommand.dataFragments.push(data);
                                if (isLast) {
                                    handleCompleteMessage(pdvPcId);
                                }
                            }

                            offset += 4 + pdvLen;
                        }
                        break;
                    }

                    case 0x05: { // A-RELEASE-RQ
                        console.log(`[DICOM SCP] Release (${fileCount} files received)`);
                        safeWrite(buildReleaseRP());
                        socket.end();
                        break;
                    }

                    case 0x07: { // A-ABORT
                        console.log('[DICOM SCP] Abort received');
                        socket.end();
                        break;
                    }

                    default:
                        console.warn(`[DICOM SCP] Unknown PDU type: 0x${pduType.toString(16)}`);
                }
            }

            function handleCompleteMessage(pcId) {
                if (!currentCommand || !currentCommand.parsed) {
                    currentCommand = null;
                    return;
                }
                const cmd = currentCommand.parsed;
                const commandField = cmd['0000,0100'];
                const messageId = cmd['0000,0110'] || 1;
                const sopClassUid = cmd['0000,0002'] || '';
                const sopInstanceUid = cmd['0000,1000'] || `1.2.${Date.now()}.${fileCount}`;

                if (commandField === 0x0030) {
                    // C-ECHO-RQ - respond with C-ECHO-RSP
                    console.log(`[DICOM SCP] C-ECHO from association`);
                    safeWrite(buildCEchoRSP(pcId, messageId));
                } else if (commandField === 0x0001) {
                    // C-STORE-RQ
                    const datasetData = Buffer.concat(currentCommand.dataFragments || []);

                    if (datasetData.length > 0) {
                        // Determine accepted transfer syntax for this PC
                        let transferSyntax = '1.2.840.10008.1.2';
                        if (associationInfo) {
                            const pc = associationInfo.items.find(i => i.pcId === pcId);
                            if (pc && pc.acceptedTransferSyntax) {
                                transferSyntax = pc.acceptedTransferSyntax;
                            }
                        }

                        // Build Part 10 file with correct File Meta Information
                        const fileHeader = buildFileMetaHeader(sopClassUid, sopInstanceUid, transferSyntax);
                        const fullFile = Buffer.concat([fileHeader, datasetData]);

                        const safeUid = sopInstanceUid.replace(/[^0-9.]/g, '');
                        const filename = `${safeUid || Date.now()}.dcm`;
                        const filepath = path.join(networkDicomStorage, filename);

                        try {
                            fs.writeFileSync(filepath, fullFile);
                            fileCount++;
                            console.log(`[DICOM SCP] Saved: ${filename} (${fullFile.length} bytes)`);

                            if (mainWindow && mainWindow.webContents) {
                                mainWindow.webContents.send('dicom-file-received', {
                                    filename, filepath, size: fullFile.length,
                                    timestamp: new Date().toISOString(),
                                    sopClassUid, sopInstanceUid
                                });
                            }
                        } catch (e) {
                            console.error(`[DICOM SCP] Save error: ${e.message}`);
                        }
                    }

                    safeWrite(buildCStoreRSP(pcId, messageId, sopClassUid, sopInstanceUid));
                } else {
                    console.warn(`[DICOM SCP] Unsupported command: 0x${commandField?.toString(16)}`);
                }

                currentCommand = null;
            }

            socket.on('data', (data) => {
                recvBuffer = Buffer.concat([recvBuffer, data]);
                processPDU();
            });

            socket.on('end', () => {
                socketAlive = false;
                // Process any remaining buffered data
                if (recvBuffer.length > 0) {
                    try { processPDU(); } catch (e) { /* ignore */ }
                }
                // Save any buffered data that looks like DICOM as fallback
                if (fileCount === 0 && recvBuffer.length > 132) {
                    const hasDicm = recvBuffer.length > 132 && recvBuffer.toString('ascii', 128, 132) === 'DICM';
                    if (hasDicm) {
                        const filename = `raw_${Date.now()}.dcm`;
                        const filepath = path.join(networkDicomStorage, filename);
                        try {
                            fs.writeFileSync(filepath, recvBuffer);
                            console.log(`[DICOM SCP] Saved raw DICOM: ${filename} (${recvBuffer.length} bytes)`);
                        } catch (e) { /* ignore */ }
                    }
                }
                if (fileCount > 0) {
                    console.log(`[DICOM SCP] Connection closed (${fileCount} files received)`);
                }
            });

            socket.on('error', (err) => {
                socketAlive = false;
                if (err.code !== 'ECONNRESET') {
                    console.error(`[DICOM SCP] Socket error: ${err.message}`);
                }
            });

            socket.on('timeout', () => {
                console.warn('[DICOM SCP] Socket timeout, closing');
                socket.destroy();
            });

            socket.on('close', () => { socketAlive = false; });
        });

        dicomNetworkServer.listen(DICOM_LISTEN_PORT, '0.0.0.0', () => {
            console.log(`[DICOM SCP] Listening on port ${DICOM_LISTEN_PORT} (AET: ${DICOM_AE_TITLE}), storage: ${networkDicomStorage}`);
        });

        dicomNetworkServer.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.error(`[DICOM SCP] Port ${DICOM_LISTEN_PORT} is already in use, retrying in 3s...`);
                dicomNetworkServer = null;
                setTimeout(() => startDicomNetworkReceiver(), 3000);
            } else {
                console.error(`[DICOM SCP] Server error: ${err.message}`);
            }
        });

        dicomNetworkServer.maxConnections = 10; // Prevent resource exhaustion
    } catch (e) {
        console.error(`[DICOM SCP] Failed to start: ${e.message}`);
    }
}

function stopDicomNetworkReceiver() {
    if (dicomNetworkServer) {
        dicomNetworkServer.close();
        dicomNetworkServer = null;
        console.log('[DICOM Network] Receiver stopped');
    }
}

// IPC Handler: Get network DICOM storage path
ipcMain.handle('get-network-dicom-path', () => {
    // Get local network IP - skip virtual adapters (WSL, Hyper-V, VPN, Bluetooth, loopback-like)
    const os = require('os');
    const nets = os.networkInterfaces();
    let localIp = '127.0.0.1';
    const skipPatterns = /vethernet|wsl|hyper-v|docker|vmware|virtualbox|bluetooth|loopback/i;
    // Prefer Wi-Fi and Ethernet interfaces
    const preferred = ['Wi-Fi', 'Ethernet', 'eth0', 'en0', 'wlan0'];
    const candidates = [];
    for (const name of Object.keys(nets)) {
        if (skipPatterns.test(name)) continue;
        for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal && !net.address.startsWith('169.254.')) {
                const priority = preferred.findIndex(p => name.toLowerCase().includes(p.toLowerCase()));
                candidates.push({ ip: net.address, priority: priority >= 0 ? priority : 99, name });
            }
        }
    }
    candidates.sort((a, b) => a.priority - b.priority);
    if (candidates.length > 0) localIp = candidates[0].ip;
    return {
        path: networkDicomStorage,
        port: DICOM_LISTEN_PORT,
        ip: localIp,
        aet: 'ONECLICKZ',
        isRunning: dicomNetworkServer !== null,
        success: true
    };
});

// IPC Handler: Update network DICOM storage path
ipcMain.handle('set-network-dicom-path', (event, newPath) => {
    try {
        if (!newPath || typeof newPath !== 'string') throw new Error('Invalid path');
        if (!fs.existsSync(newPath)) {
            fs.mkdirSync(newPath, { recursive: true });
        }
        networkDicomStorage = newPath;
        authorizeDicomPath(networkDicomStorage);
        saveDicomSettings({ storagePath: newPath });
        console.log(`[DICOM Network] Storage path updated to: ${newPath}`);
        return { success: true, path: networkDicomStorage };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

// IPC Handler: Restart DICOM network receiver
ipcMain.handle('restart-network-receiver', () => {
    try {
        stopDicomNetworkReceiver();
        startDicomNetworkReceiver();
        return { success: true, port: DICOM_LISTEN_PORT };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

// IPC Handler: Open folder in file explorer
ipcMain.handle('open-folder', async (event, folderPath) => {
    try {
        shell.openPath(folderPath);
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

// IPC Handler: Get list of received DICOM files
ipcMain.handle('get-received-dicom-files', async () => {
    try {
        ensureNetworkDicomStorage();
        const files = fs.readdirSync(networkDicomStorage).filter(f => f.endsWith('.dcm')).map(f => ({
            name: f,
            path: path.join(networkDicomStorage, f).replace(/\\/g, '/'),
            size: fs.statSync(path.join(networkDicomStorage, f)).size,
            mtime: fs.statSync(path.join(networkDicomStorage, f)).mtime.toISOString()
        }));
        return { success: true, files };
    } catch (e) {
        return { success: false, error: e.message, files: [] };
    }
});

// - Node.js Tesseract OCR (reliable, uses local WASM not CDN) -
ipcMain.handle('ocr-image-base64', async (event, { base64, langPath }) => {
    try {
        const os = require('os');
        const { createWorker } = require('tesseract.js');

        // Save base64 PNG to temp file
        const tmpFile = path.join(os.tmpdir(), `dicom-ocr-${Date.now()}.png`);
        const imgBuffer = Buffer.from(base64, 'base64');
        fs.writeFileSync(tmpFile, imgBuffer);

        // Save debug crops to a folder for inspection
        const debugDir = path.join(__dirname, 'ocr-debug');
        if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });
        const debugFile = path.join(debugDir, `crop-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.png`);
        fs.writeFileSync(debugFile, imgBuffer);

        const worker = await createWorker('eng', 1, {
            logger: () => { },
            langPath: langPath || undefined,
        });
        await worker.setParameters({
            tessedit_pageseg_mode: '6',       // assume single uniform block of text
        });
        const { data } = await worker.recognize(tmpFile);
        await worker.terminate();
        fs.unlinkSync(tmpFile); // cleanup

        const ocrText = data.text || '';
        if (ocrText.trim()) {
            console.log('[OCR] Extracted text:', JSON.stringify(ocrText.substring(0, 500)));
        }
        return { text: ocrText, success: true };
    } catch (err) {
        console.warn('[OCR] Node.js Tesseract failed:', err.message);
        return { text: '', success: false, error: err.message };
    }
});

// - Comprehensive DICOM reading extraction (ALL tag sources in one call) -
// Reads: SR sequences, graphic annotations, overlay text, private tags, all text-bearing tags.
// Returns structured measurements (100% confidence) + text fragments (need regex parsing).
ipcMain.handle('extract-dicom-all-readings', async (event, { filePaths }) => {
    const dicomParserLib = require('dicom-parser');
    const structured = [];    // Typed SR measurements (name + value + unit)
    const textFragments = []; // Free text from tags that needs regex parsing

    function safeString(ds, tag) {
        try { return ds.string(tag); } catch { return ''; }
    }

    /**
     * Recursively walk DICOM SR Content Sequence (0040,A730).
     * Handles: NUM (numeric), TEXT (text), CODE (coded), CONTAINER (nested).
     */
    function walkSRContent(dataSet, depth = 0) {
        if (depth > 20) return;
        const contentSeq = dataSet.elements['x0040a730'];
        if (!contentSeq || !contentSeq.items) return;

        for (const item of contentSeq.items) {
            if (!item.dataSet) continue;
            const ds = item.dataSet;
            const valueType = safeString(ds, 'x0040a040');

            // Get concept name from Concept Name Code Sequence (0040,A043)
            let conceptMeaning = '';
            let conceptCode = '';
            const conceptSeq = ds.elements['x0040a043'];
            if (conceptSeq && conceptSeq.items && conceptSeq.items[0]?.dataSet) {
                conceptMeaning = safeString(conceptSeq.items[0].dataSet, 'x00080104') || '';
                conceptCode = safeString(conceptSeq.items[0].dataSet, 'x00080100') || '';
            }

            if (valueType === 'NUM') {
                const measSeq = ds.elements['x0040a300'];
                if (measSeq && measSeq.items && measSeq.items[0]?.dataSet) {
                    const measDS = measSeq.items[0].dataSet;
                    const numericValue = safeString(measDS, 'x0040a30a');
                    let unitMeaning = '';
                    const unitSeq = measDS.elements['x004008ea'];
                    if (unitSeq && unitSeq.items && unitSeq.items[0]?.dataSet) {
                        unitMeaning = safeString(unitSeq.items[0].dataSet, 'x00080100') ||
                            safeString(unitSeq.items[0].dataSet, 'x00080104') || '';
                    }
                    if (numericValue) {
                        structured.push({
                            source: 'sr', name: conceptMeaning || conceptCode,
                            value: numericValue.trim(), unit: unitMeaning.trim(),
                        });
                    }
                }
            } else if (valueType === 'TEXT') {
                const textValue = safeString(ds, 'x0040a160');
                if (textValue && (conceptMeaning || textValue.length > 3)) {
                    structured.push({
                        source: 'sr-text', name: conceptMeaning || 'Observation',
                        value: textValue.trim(), unit: '',
                    });
                }
            } else if (valueType === 'CODE') {
                const codeSeq = ds.elements['x0040a168'];
                if (codeSeq && codeSeq.items && codeSeq.items[0]?.dataSet) {
                    const codeMeaning = safeString(codeSeq.items[0].dataSet, 'x00080104');
                    if (codeMeaning && conceptMeaning) {
                        structured.push({
                            source: 'sr-code', name: conceptMeaning,
                            value: codeMeaning.trim(), unit: '',
                        });
                    }
                }
            }

            // Recurse into nested content
            if (ds.elements['x0040a730']) {
                walkSRContent(ds, depth + 1);
            }
        }
    }

    /**
     * Recursively extract text from any DICOM sequence items.
     * Catches text nested inside vendor-specific / unknown sequences.
     */
    function walkSequenceForText(dataSet, TEXT_VRS, depth = 0) {
        if (depth > 10) return;
        for (const tag of Object.keys(dataSet.elements)) {
            try {
                const el = dataSet.elements[tag];
                if (!el) continue;
                if (el.items && el.items.length > 0) {
                    for (const item of el.items) {
                        if (item.dataSet) walkSequenceForText(item.dataSet, TEXT_VRS, depth + 1);
                    }
                } else if (TEXT_VRS.has(el.vr)) {
                    const val = dataSet.string(tag);
                    if (val && val.trim().length > 2) {
                        textFragments.push(val.trim());
                    }
                } else if (el.vr === 'UN' && el.length > 3 && el.length < 2000) {
                    // Try to decode Unknown VR as text (many private tags use this)
                    try {
                        const val = dataSet.string(tag);
                        if (val && /^[\x20-\x7E\r\n\t]+$/.test(val) && val.trim().length > 2) {
                            textFragments.push(val.trim());
                        }
                    } catch { /* not text */ }
                }
            } catch { /* skip */ }
        }
    }

    const TEXT_VRS = new Set(['ST', 'LO', 'LT', 'SH', 'UT', 'DS', 'IS']);

    for (const filePath of (filePaths || []).slice(0, 50)) {
        try {
            const buffer = fs.readFileSync(filePath);
            const byteArray = new Uint8Array(buffer);
            // Parse FULL file - don't stop at pixel data (tags can follow pixels)
            const dataset = dicomParserLib.parseDicom(byteArray);

            // - 1. DICOM SR Content Sequence (0040,A730) - the gold standard -
            walkSRContent(dataset);

            // - 2. Graphic Annotation Sequence (0070,0001) - text overlays -
            const graphicAnnotSeq = dataset.elements['x00700001'];
            if (graphicAnnotSeq && graphicAnnotSeq.items) {
                for (const item of graphicAnnotSeq.items) {
                    if (!item.dataSet) continue;
                    const textObjSeq = item.dataSet.elements['x00700008'];
                    if (textObjSeq && textObjSeq.items) {
                        for (const textItem of textObjSeq.items) {
                            if (!textItem.dataSet) continue;
                            const unformatted = safeString(textItem.dataSet, 'x00700006');
                            if (unformatted && unformatted.trim().length > 1) {
                                textFragments.push(unformatted.trim());
                            }
                        }
                    }
                    const directText = safeString(item.dataSet, 'x00700006');
                    if (directText && directText.trim().length > 1) {
                        textFragments.push(directText.trim());
                    }
                }
            }

            // - 3. Overlay text (60xx groups) - up to 16 overlay planes -
            for (let g = 0x6000; g <= 0x601E; g += 2) {
                const prefix = g.toString(16).padStart(4, '0');
                const overlayDesc = safeString(dataset, 'x' + prefix + '0022');
                if (overlayDesc && overlayDesc.trim().length > 1) textFragments.push(overlayDesc.trim());
                const overlayLabel = safeString(dataset, 'x' + prefix + '1500');
                if (overlayLabel && overlayLabel.trim().length > 1) textFragments.push(overlayLabel.trim());
            }

            // - 4. Known text tags with measurement summaries -
            const knownTextTags = [
                'x00204000', // Image Comments
                'x00402400', // Imaging Service Request Comments
                'x00400254', // Performed Procedure Step Description
                'x00400007', // Scheduled Procedure Step Description
                'x00102000', // Medical Alerts
                'x00181400', // Acquisition Device Processing Description
                'x00700081', // Content Description (Presentation State)
                'x00081030', // Study Description
                'x0008103e', // Series Description
                'x00181030', // Protocol Name
            ];
            for (const tag of knownTextTags) {
                const val = safeString(dataset, tag);
                if (val && val.trim().length > 2) textFragments.push(val.trim());
            }

            // - 5. Recursive text from ALL sequences (vendor private data) -
            walkSequenceForText(dataset, TEXT_VRS);

        } catch (err) {
            console.warn(`[DICOM all-readings] Failed to parse ${filePath}:`, err.message);
        }
    }

    const uniqueText = [...new Set(textFragments)];
    console.log(`[DICOM all-readings] ${structured.length} structured, ${uniqueText.length} text fragments`);
    if (structured.length > 0) console.log('[DICOM all-readings] Structured:', JSON.stringify(structured.slice(0, 10)));

    return { structured, textFragments: uniqueText };
});

// - DICOM measurement text extraction (Node.js side - no browser OCR needed) -
ipcMain.handle('extract-dicom-text', async (event, { filePaths }) => {
    const dicomParserLib = require('dicom-parser');
    const textStrings = [];

    const TEXT_VRS = new Set(['ST', 'LO', 'LT', 'SH', 'UN', 'CS', 'UT', 'PN', 'DS', 'IS']);

    for (const filePath of (filePaths || []).slice(0, 10)) {
        try {
            const buffer = fs.readFileSync(filePath);
            const byteArray = new Uint8Array(buffer);
            const dataset = dicomParserLib.parseDicom(byteArray, { untilTag: '7fe00010' });

            for (const tag of Object.keys(dataset.elements)) {
                try {
                    const el = dataset.elements[tag];
                    if (!el || !TEXT_VRS.has(el.vr)) continue;
                    const val = dataset.string(tag);
                    if (val && val.trim().length > 0) {
                        textStrings.push(val.trim());
                    }
                } catch { /* skip unreadable element */ }
            }

            const measureTags = [
                '00204000', '00402400', '00181030', '00400254',
                '00400007', '00102000', '00181400',
            ];
            for (const tag of measureTags) {
                try {
                    const val = dataset.string(tag);
                    if (val && val.trim().length > 1) textStrings.push(val.trim());
                } catch { /* tag absent */ }
            }
        } catch (err) {
            console.warn(`[DICOM text] Failed to parse ${filePath}:`, err.message);
        }
    }

    return { textStrings: [...new Set(textStrings)] };
});

// - DICOM metadata extraction (patient/study/machine info) -
ipcMain.handle('extract-dicom-metadata', async (event, { filePaths }) => {
    const dicomParserLib = require('dicom-parser');
    const metadata = {};

    // Standard DICOM tags for important clinical info
    const TAG_MAP = {
        patientName: 'x00100010',
        patientId: 'x00100020',
        patientBirthDate: 'x00100030',
        patientSex: 'x00100040',
        patientAge: 'x00101010',
        studyDate: 'x00080020',
        studyTime: 'x00080030',
        studyDescription: 'x00081030',
        seriesDescription: 'x0008103e',
        modality: 'x00080060',
        manufacturer: 'x00080070',
        modelName: 'x00081090',
        institutionName: 'x00080080',
        stationName: 'x00081010',
        referringPhysician: 'x00080090',
        performingPhysician: 'x00081050',
        bodyPart: 'x00180015',
        protocolName: 'x00181030',
        accessionNumber: 'x00080050',
    };

    for (const filePath of (filePaths || []).slice(0, 1)) {
        try {
            const buffer = fs.readFileSync(filePath);
            const byteArray = new Uint8Array(buffer);
            const dataset = dicomParserLib.parseDicom(byteArray, { untilTag: '7fe00010' });

            for (const [key, tag] of Object.entries(TAG_MAP)) {
                try {
                    const val = dataset.string(tag);
                    if (val && val.trim()) metadata[key] = val.trim();
                } catch { /* tag absent */ }
            }
        } catch (err) {
            console.warn(`[DICOM metadata] Failed:`, err.message);
        }
    }

    console.log('[DICOM metadata]', JSON.stringify(metadata));
    return metadata;
});

// - Helper: write a 24-bit BMP from an RGB Uint8Array -
function makeBmp24(rgbBuf, cols, rows) {
    const rowBytes = cols * 3;
    const paddedRowBytes = Math.ceil(rowBytes / 4) * 4;
    const padding = paddedRowBytes - rowBytes;
    const dataSize = paddedRowBytes * rows;
    const fileSize = 54 + dataSize;
    const bmp = Buffer.alloc(fileSize);
    bmp.write('BM', 0);
    bmp.writeUInt32LE(fileSize, 2);
    bmp.writeUInt32LE(0, 6);
    bmp.writeUInt32LE(54, 10);
    bmp.writeUInt32LE(40, 14);
    bmp.writeInt32LE(cols, 18);
    bmp.writeInt32LE(-rows, 22);
    bmp.writeUInt16LE(1, 26);
    bmp.writeUInt16LE(24, 28);
    bmp.writeUInt32LE(0, 30);
    bmp.writeUInt32LE(dataSize, 34);
    bmp.writeInt32LE(2835, 38);
    bmp.writeInt32LE(2835, 42);
    bmp.writeUInt32LE(0, 46);
    bmp.writeUInt32LE(0, 50);
    let offset = 54;
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const si = (y * cols + x) * 3;
            bmp[offset++] = rgbBuf[si + 2]; // B
            bmp[offset++] = rgbBuf[si + 1]; // G
            bmp[offset++] = rgbBuf[si];     // R
        }
        for (let p = 0; p < padding; p++) bmp[offset++] = 0;
    }
    return bmp;
}

// - Full-resolution DICOM pixel OCR (reads file -> extracts pixels -> BMP -> Tesseract) -
// Multi-pass approach: full grayscale (PSM 11) + right-crop (PSM 6) for universal coverage
ipcMain.handle('ocr-dicom-file', async (event, { filePath }) => {
    try {
        const os = require('os');
        const dicomParserLib = require('dicom-parser');
        const { createWorker } = require('tesseract.js');

        const buffer = fs.readFileSync(filePath);
        const byteArray = new Uint8Array(buffer);
        const dataset = dicomParserLib.parseDicom(byteArray);

        const rows = dataset.uint16('x00280010');
        const cols = dataset.uint16('x00280011');
        const bitsAllocated = dataset.uint16('x00280100') || 8;
        const bitsStored = dataset.uint16('x00280101') || bitsAllocated;
        const samplesPerPixel = dataset.uint16('x00280002') || 1;
        const photometric = (dataset.string('x00280004') || '').trim();
        const pixelRepresentation = dataset.uint16('x00280103') || 0;
        const windowCenter = parseFloat(dataset.string('x00281050') || '127');
        const windowWidth = parseFloat(dataset.string('x00281051') || '255');

        console.log(`[OCR-file] ${filePath}: ${cols}x${rows}, ${bitsAllocated}bit, ${samplesPerPixel}spp, ${photometric}`);

        if (!rows || !cols) {
            return { text: '', success: false, error: 'No pixel dimensions in DICOM' };
        }

        const pixelDataElement = dataset.elements['x7fe00010'];
        if (!pixelDataElement) {
            return { text: '', success: false, error: 'No pixel data in DICOM' };
        }

        const pixelData = new Uint8Array(buffer.buffer, pixelDataElement.dataOffset, pixelDataElement.length);

        // Convert DICOM pixels to 8-bit RGB for BMP
        const rgbPixels = new Uint8Array(rows * cols * 3);

        if (samplesPerPixel === 3) {
            // RGB or YBR - direct copy (most USG color images)
            const isYBR = photometric.startsWith('YBR');
            for (let i = 0; i < rows * cols; i++) {
                let r, g, b;
                if (bitsAllocated === 8) {
                    r = pixelData[i * 3];
                    g = pixelData[i * 3 + 1];
                    b = pixelData[i * 3 + 2];
                } else {
                    // 16-bit per channel
                    r = pixelData[i * 6] | (pixelData[i * 6 + 1] << 8);
                    g = pixelData[i * 6 + 2] | (pixelData[i * 6 + 3] << 8);
                    b = pixelData[i * 6 + 4] | (pixelData[i * 6 + 5] << 8);
                    const shift = bitsStored - 8;
                    r = r >> shift; g = g >> shift; b = b >> shift;
                }
                if (isYBR) {
                    // YBR_FULL to RGB
                    const y = r, cb = g, cr = b;
                    r = Math.max(0, Math.min(255, Math.round(y + 1.402 * (cr - 128))));
                    g = Math.max(0, Math.min(255, Math.round(y - 0.344136 * (cb - 128) - 0.714136 * (cr - 128))));
                    b = Math.max(0, Math.min(255, Math.round(y + 1.772 * (cb - 128))));
                }
                rgbPixels[i * 3] = r;
                rgbPixels[i * 3 + 1] = g;
                rgbPixels[i * 3 + 2] = b;
            }
        } else {
            // Monochrome - apply window level
            const isInverted = photometric === 'MONOCHROME1';
            const wLow = windowCenter - windowWidth / 2;
            const wHigh = windowCenter + windowWidth / 2;

            for (let i = 0; i < rows * cols; i++) {
                let raw;
                if (bitsAllocated === 16) {
                    raw = pixelData[i * 2] | (pixelData[i * 2 + 1] << 8);
                    if (pixelRepresentation === 1 && raw > 32767) raw -= 65536;
                } else {
                    raw = pixelData[i];
                }

                // Window level transform
                let gray;
                if (raw <= wLow) gray = 0;
                else if (raw >= wHigh) gray = 255;
                else gray = Math.round(((raw - wLow) / windowWidth) * 255);

                if (isInverted) gray = 255 - gray;

                rgbPixels[i * 3] = gray;
                rgbPixels[i * 3 + 1] = gray;
                rgbPixels[i * 3 + 2] = gray;
            }
        }

        // - Preprocessing: grayscale + contrast stretch -
        // Produces cleaner text separation from background (critical for Doppler images)
        const grayBuf = new Uint8Array(rows * cols);
        let gMin = 255, gMax = 0;
        for (let i = 0; i < rows * cols; i++) {
            const g = Math.round(0.299 * rgbPixels[i * 3] + 0.587 * rgbPixels[i * 3 + 1] + 0.114 * rgbPixels[i * 3 + 2]);
            grayBuf[i] = g;
            if (g < gMin) gMin = g;
            if (g > gMax) gMax = g;
        }
        const gRange = gMax - gMin || 1;
        const grayRgb = new Uint8Array(rows * cols * 3);
        for (let i = 0; i < rows * cols; i++) {
            const s = Math.min(255, Math.round((grayBuf[i] - gMin) / gRange * 255));
            grayRgb[i * 3] = s; grayRgb[i * 3 + 1] = s; grayRgb[i * 3 + 2] = s;
        }

        // Right 45% crop - where Mindray/GE/Philips put measurement panels on Doppler images
        const cropX = Math.floor(cols * 0.55);
        const cropW = cols - cropX;
        const cropRgb = new Uint8Array(rows * cropW * 3);
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cropW; x++) {
                const g = grayBuf[y * cols + cropX + x];
                const di = (y * cropW + x) * 3;
                cropRgb[di] = g; cropRgb[di + 1] = g; cropRgb[di + 2] = g;
            }
        }

        // Bottom 25% crop - for machines that put measurements at the bottom
        const cropTopY = Math.floor(rows * 0.75);
        const cropH = rows - cropTopY;
        const btmRgb = new Uint8Array(cropH * cols * 3);
        for (let y = 0; y < cropH; y++) {
            for (let x = 0; x < cols; x++) {
                const g = grayBuf[(cropTopY + y) * cols + x];
                const di = (y * cols + x) * 3;
                btmRgb[di] = g; btmRgb[di + 1] = g; btmRgb[di + 2] = g;
            }
        }

        // - Binary threshold image - isolates bright text from dark ultrasound background -
        // This dramatically improves OCR accuracy for measurement overlays on Doppler images.
        // Uses adaptive threshold based on image brightness distribution.
        const histogram = new Uint32Array(256);
        for (let i = 0; i < rows * cols; i++) histogram[grayBuf[i]]++;
        // Find threshold: text is typically in top 15-20% brightness
        let totalPixels = rows * cols;
        let cumul = 0;
        let threshVal = 160;
        for (let i = 255; i >= 0; i--) {
            cumul += histogram[i];
            if (cumul / totalPixels > 0.15) { // top 15% of brightness
                threshVal = Math.max(i, 120); // never go below 120
                break;
            }
        }
        const threshRgb = new Uint8Array(rows * cols * 3);
        for (let i = 0; i < rows * cols; i++) {
            const v = grayBuf[i] >= threshVal ? 255 : 0;
            threshRgb[i * 3] = v; threshRgb[i * 3 + 1] = v; threshRgb[i * 3 + 2] = v;
        }

        const ts = Date.now();
        const grayFile = path.join(os.tmpdir(), `dicom-gray-${ts}.bmp`);
        const cropFile = path.join(os.tmpdir(), `dicom-crop-${ts}.bmp`);
        const btmFile = path.join(os.tmpdir(), `dicom-btm-${ts}.bmp`);
        const threshFile = path.join(os.tmpdir(), `dicom-thresh-${ts}.bmp`);
        fs.writeFileSync(grayFile, makeBmp24(grayRgb, cols, rows));
        fs.writeFileSync(cropFile, makeBmp24(cropRgb, cropW, rows));
        fs.writeFileSync(btmFile, makeBmp24(btmRgb, cols, cropH));
        fs.writeFileSync(threshFile, makeBmp24(threshRgb, cols, rows));
        console.log(`[OCR-file] BMPs: full ${cols}x${rows}, right ${cropW}x${rows}, bottom ${cols}x${cropH}, thresh(${threshVal})`);

        // Single Tesseract worker, 4 passes:
        //   PSM 11 on full grayscale   - sparse text, catches scattered labels
        //   PSM 6  on right crop       - block mode for structured measurement panels
        //   PSM 6  on bottom crop      - block mode for bottom measurement strips
        //   PSM 11 on thresholded full - isolates bright text overlays from dark bg
        const worker = await createWorker('eng', 1, { logger: () => { } });

        await worker.setParameters({ tessedit_pageseg_mode: '11' });
        const { data: d1 } = await worker.recognize(grayFile);

        await worker.setParameters({ tessedit_pageseg_mode: '6' });
        const { data: d2 } = await worker.recognize(cropFile);

        await worker.setParameters({ tessedit_pageseg_mode: '6' });
        const { data: d3 } = await worker.recognize(btmFile);

        await worker.setParameters({ tessedit_pageseg_mode: '11' });
        const { data: d4 } = await worker.recognize(threshFile);

        await worker.terminate();
        for (const f of [grayFile, cropFile, btmFile, threshFile]) { try { fs.unlinkSync(f); } catch { } }

        const ocrText = [d1.text, d2.text, d3.text, d4.text].filter(t => t?.trim()).join('\n');
        console.log(`[OCR-file] Combined text (${ocrText.length} chars):`, JSON.stringify(ocrText.substring(0, 1200)));
        return { text: ocrText, success: true };
    } catch (err) {
        console.warn('[OCR-file] Failed:', err.message);
        return { text: '', success: false, error: err.message };
    }
});

// - Batch OCR: parallel Tesseract worker pool with persistent disk cache -
//
// Speed: 3-4 workers in parallel + per-file disk cache keyed by
// (path|size|mtime). Re-opening a study is INSTANT (cache hit).
//
// SERIALIZED: only one batch runs at a time. If a new request arrives while
// one is running, the in-flight batch is aborted (workers terminated, queue
// drained) so the user can flip studies without stacking OCR jobs.
const OCR_WORKER_COUNT = Math.max(1, Math.min(4, (require('os').cpus()?.length || 4) - 1));
const OCR_CACHE_PATH = path.join(app.getPath('userData'), 'ocr-cache.json');
const OCR_CACHE_MAX = 5000;
let ocrCache = null; // lazy-loaded { [key: string]: string }
let ocrCacheDirty = false;
let ocrCacheSaveTimer = null;

function loadOcrCache() {
    if (ocrCache !== null) return ocrCache;
    try {
        ocrCache = JSON.parse(fs.readFileSync(OCR_CACHE_PATH, 'utf8'));
        if (!ocrCache || typeof ocrCache !== 'object') ocrCache = {};
    } catch { ocrCache = {}; }
    return ocrCache;
}
function ocrCacheKey(filePath) {
    try {
        const st = fs.statSync(filePath);
        // v4: bumped when pipeline changed (JPEG Baseline decompression support).
        return `v4:${st.size}:${Math.floor(st.mtimeMs)}:${filePath}`;
    } catch { return null; }
}
function scheduleOcrCacheSave() {
    if (!ocrCacheDirty || ocrCacheSaveTimer) return;
    ocrCacheSaveTimer = setTimeout(() => {
        ocrCacheSaveTimer = null;
        if (!ocrCacheDirty) return;
        try {
            // Trim oldest entries if over cap (insertion order preserved by V8 maps)
            const keys = Object.keys(ocrCache);
            if (keys.length > OCR_CACHE_MAX) {
                const trimmed = {};
                for (const k of keys.slice(keys.length - OCR_CACHE_MAX)) trimmed[k] = ocrCache[k];
                ocrCache = trimmed;
            }
            fs.writeFileSync(OCR_CACHE_PATH, JSON.stringify(ocrCache), 'utf8');
            ocrCacheDirty = false;
        } catch (err) { console.warn('[OCR-cache] write failed:', err.message); }
    }, 1500);
}

let currentOcrGeneration = 0;
let currentOcrWorkers = []; // pool of active workers - terminated on next batch
ipcMain.handle('ocr-dicom-batch', async (event, { filePaths }) => {
    const myGen = ++currentOcrGeneration;
    // Abort any in-flight batch by terminating its workers; the queue loop
    // exits on the gen-mismatch check at the start of each file.
    if (currentOcrWorkers.length) {
        const old = currentOcrWorkers.slice();
        currentOcrWorkers = [];
        for (const w of old) { try { await w.terminate(); } catch {} }
    }
    try {
        const os = require('os');
        const dicomParserLib = require('dicom-parser');
        const { createWorker } = require('tesseract.js');

        const batchStart = Date.now();
        const cache = loadOcrCache();

        // - Phase 0: cache lookup -
        // Pre-compute cache key and prepared result slot per file. Indices
        // missing from the cache go onto the work queue.
        const results = new Array(filePaths.length);
        const queue = []; // indices needing OCR
        const keys = new Array(filePaths.length);
        for (let i = 0; i < filePaths.length; i++) {
            const k = ocrCacheKey(filePaths[i]);
            keys[i] = k;
            if (k && Object.prototype.hasOwnProperty.call(cache, k)) {
                results[i] = { text: cache[k], success: true, cached: true };
            } else {
                queue.push(i);
            }
        }

        if (queue.length === 0) {
            console.log(`[OCR-batch] Cache hit: ${filePaths.length}/${filePaths.length} files (${Date.now() - batchStart}ms)`);
            return results;
        }
        console.log(`[OCR-batch] Cache: ${filePaths.length - queue.length}/${filePaths.length} hit, ${queue.length} to OCR`);

        // - Phase 1: spin up worker pool -
        const poolSize = Math.min(OCR_WORKER_COUNT, queue.length);
        const workerStart = Date.now();
        const workers = await Promise.all(
            Array.from({ length: poolSize }, () => createWorker('eng', 1, { logger: () => { } }))
        );
        currentOcrWorkers = workers;
        if (myGen !== currentOcrGeneration) {
            for (const w of workers) { try { await w.terminate(); } catch {} }
            return [];
        }
        console.log(`[OCR-batch] ${poolSize} worker(s) ready in ${Date.now() - workerStart}ms`);

        // - Phase 2: consume queue with shared cursor -
        let cursor = 0;
        const processOne = async (worker) => {
            while (true) {
                if (myGen !== currentOcrGeneration) return;
                const fi = cursor++;
                if (fi >= queue.length) return;
                const fileIndex = queue[fi];
                const filePath = filePaths[fileIndex];
                const fileStart = Date.now();
                try {
                    const r = await ocrOneDicom(worker, filePath, dicomParserLib, fi);
                    results[fileIndex] = { text: r.text, success: true };
                    if (keys[fileIndex]) {
                        cache[keys[fileIndex]] = r.text;
                        ocrCacheDirty = true;
                    }
                    console.log(`[OCR-batch] File ${fi + 1}/${queue.length} (${Date.now() - fileStart}ms): ${r.text.length} chars`);
                } catch (err) {
                    console.warn(`[OCR-batch] File ${fi + 1} failed:`, err.message);
                    results[fileIndex] = { text: '', success: false, error: err.message };
                }
            }
        };
        await Promise.all(workers.map(processOne));

        // - Phase 3: cleanup -
        for (const w of workers) { try { await w.terminate(); } catch {} }
        if (currentOcrWorkers === workers) currentOcrWorkers = [];
        scheduleOcrCacheSave();
        console.log(`[OCR-batch] Total: ${Date.now() - batchStart}ms for ${filePaths.length} files (${queue.length} fresh, ${filePaths.length - queue.length} cached)`);
        return results;
    } catch (err) {
        if (currentOcrWorkers.length) {
            const old = currentOcrWorkers.slice();
            currentOcrWorkers = [];
            for (const w of old) { try { await w.terminate(); } catch {} }
        }
        console.warn('[OCR-batch] Failed:', err.message);
        return [];
    }
});

/**
 * Run the existing 2-pass OCR pipeline on a single DICOM file using the
 * given Tesseract worker. Returns { text }. Throws on hard failures.
 */
async function ocrOneDicom(worker, filePath, dicomParserLib, slotIdx) {
    const os = require('os');
    const buffer = fs.readFileSync(filePath);
    const byteArray = new Uint8Array(buffer);
    const dataset = dicomParserLib.parseDicom(byteArray);

    const rows = dataset.uint16('x00280010');
    const cols = dataset.uint16('x00280011');
    const bitsAllocated = dataset.uint16('x00280100') || 8;
    const bitsStored = dataset.uint16('x00280101') || bitsAllocated;
    let samplesPerPixel = dataset.uint16('x00280002') || 1;
    let photometric = (dataset.string('x00280004') || '').trim();
    const pixelRepresentation = dataset.uint16('x00280103') || 0;
    const windowCenter = parseFloat(dataset.string('x00281050') || '127');
    const windowWidth = parseFloat(dataset.string('x00281051') || '255');
    const transferSyntax = (dataset.string('x00020010') || '1.2.840.10008.1.2').trim();

    if (!rows || !cols) return { text: '' };
    const pixelDataElement = dataset.elements['x7fe00010'];
    if (!pixelDataElement) return { text: '' };

    // - Decode pixel data -
    // Uncompressed transfer syntaxes give us raw bytes at dataOffset.
    // Encapsulated (JPEG/RLE) syntaxes wrap fragments in (FFFE,E000) item
    // delimiters - we need to extract + decompress.
    const UNCOMPRESSED_TS = new Set([
        '1.2.840.10008.1.2',     // Implicit VR LE
        '1.2.840.10008.1.2.1',   // Explicit VR LE
        '1.2.840.10008.1.2.2',   // Explicit VR BE
    ]);
    const JPEG_BASELINE_TS = new Set([
        '1.2.840.10008.1.2.4.50', // JPEG Baseline (Process 1)
        '1.2.840.10008.1.2.4.51', // JPEG Extended (Process 2 & 4)
    ]);

    let pixelData;
    if (UNCOMPRESSED_TS.has(transferSyntax)) {
        pixelData = new Uint8Array(buffer.buffer, pixelDataElement.dataOffset, pixelDataElement.length);
    } else if (JPEG_BASELINE_TS.has(transferSyntax) && pixelDataElement.fragments?.length) {
        // Encapsulated - use dicom-parser helper to assemble frame 0 from
        // ALL its fragments (Philips often splits a single frame across
        // multiple fragments; taking only fragments[0] truncates the JPEG).
        try {
            const jpegJs = require('jpeg-js');
            let jpegBytes;
            try {
                // Preferred: helper concats fragments per BOT/frame
                const bot = pixelDataElement.basicOffsetTable || [];
                jpegBytes = dicomParserLib.readEncapsulatedImageFrame(dataset, pixelDataElement, 0, bot);
            } catch {
                // Fallback: concat every fragment as one blob (single-frame studies)
                const total = pixelDataElement.fragments.reduce((s, f) => s + f.length, 0);
                jpegBytes = new Uint8Array(total);
                let off = 0;
                for (const f of pixelDataElement.fragments) {
                    jpegBytes.set(new Uint8Array(buffer.buffer, f.position, f.length), off);
                    off += f.length;
                }
            }
            const decoded = jpegJs.decode(jpegBytes, { useTArray: true, formatAsRGBA: false });
            pixelData = decoded.data; // RGB triplets, 8-bit
            samplesPerPixel = 3;
            // After JPEG decode the photometric is RGB regardless of stored value
            photometric = 'RGB';
            console.log(`[OCR] JPEG decoded ${decoded.width}x${decoded.height} for ${path.basename(filePath)}`);
        } catch (jerr) {
            console.warn(`[OCR] JPEG decode failed for ${path.basename(filePath)} (TS=${transferSyntax}):`, jerr.message);
            return { text: '' };
        }
    } else {
        // Other compressed syntaxes (JPEG-LS, JPEG 2000, RLE) - would need
        // heavier decoders. For now skip OCR and let parser handle DICOM tags.
        console.warn(`[OCR] Unsupported transfer syntax for OCR: ${transferSyntax} (${path.basename(filePath)})`);
        return { text: '' };
    }

    // Convert to grayscale
    const grayBuf = new Uint8Array(rows * cols);
    if (samplesPerPixel === 3) {
        const isYBR = photometric.startsWith('YBR');
        for (let i = 0; i < rows * cols; i++) {
            let r = pixelData[i * 3], g = pixelData[i * 3 + 1], b = pixelData[i * 3 + 2];
            if (bitsAllocated === 16) {
                r = (pixelData[i * 6] | (pixelData[i * 6 + 1] << 8)) >> (bitsStored - 8);
                g = (pixelData[i * 6 + 2] | (pixelData[i * 6 + 3] << 8)) >> (bitsStored - 8);
                b = (pixelData[i * 6 + 4] | (pixelData[i * 6 + 5] << 8)) >> (bitsStored - 8);
            }
            if (isYBR) {
                const y = r, cb = g, cr = b;
                r = Math.max(0, Math.min(255, Math.round(y + 1.402 * (cr - 128))));
                g = Math.max(0, Math.min(255, Math.round(y - 0.344136 * (cb - 128) - 0.714136 * (cr - 128))));
                b = Math.max(0, Math.min(255, Math.round(y + 1.772 * (cb - 128))));
            }
            grayBuf[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
        }
    } else {
        const isInverted = photometric === 'MONOCHROME1';
        const wLow = windowCenter - windowWidth / 2;
        const wHigh = windowCenter + windowWidth / 2;
        for (let i = 0; i < rows * cols; i++) {
            let raw;
            if (bitsAllocated === 16) {
                raw = pixelData[i * 2] | (pixelData[i * 2 + 1] << 8);
                if (pixelRepresentation === 1 && raw > 32767) raw -= 65536;
            } else { raw = pixelData[i]; }
            let gray;
            if (raw <= wLow) gray = 0;
            else if (raw >= wHigh) gray = 255;
            else gray = Math.round(((raw - wLow) / windowWidth) * 255);
            if (isInverted) gray = 255 - gray;
            grayBuf[i] = gray;
        }
    }

    // Adaptive thresholds - TWO levels (HIGH + MID) to catch both bright Mindray-style
    // text and softer GE/Voluson colored text. Plus a raw grayscale pass for Philips/Samsung
    // anti-aliased text. The MID + raw passes only fire when HIGH+crop yielded no labels,
    // so Mindray/SonoScape stay at 2 passes per file.
    const histogram = new Uint32Array(256);
    for (let i = 0; i < rows * cols; i++) histogram[grayBuf[i]]++;
    const total = rows * cols;
    // HIGH: top 15% (Mindray, SonoScape, Siemens - pure white text)
    let cumul = 0, threshHigh = 160;
    for (let i = 255; i >= 0; i--) {
        cumul += histogram[i];
        if (cumul / total > 0.15) { threshHigh = Math.max(i, 120); break; }
    }
    // MID: top 30% (GE Voluson colored text -> gray ~100-140, Canon Aplio)
    cumul = 0;
    let threshMid = 90;
    for (let i = 255; i >= 0; i--) {
        cumul += histogram[i];
        if (cumul / total > 0.30) { threshMid = Math.max(i, 80); break; }
    }
    // If MID and HIGH are too close, MID won't help - skip it
    const useMid = (threshHigh - threshMid) >= 25;

    // Pass 1: Thresholded full image (PSM 11 sparse text) - HIGH threshold
    const threshRgb = new Uint8Array(rows * cols * 3);
    for (let i = 0; i < rows * cols; i++) {
        const v = grayBuf[i] >= threshHigh ? 255 : 0;
        threshRgb[i * 3] = v; threshRgb[i * 3 + 1] = v; threshRgb[i * 3 + 2] = v;
    }

    // Pass 2: Right 45% crop thresholded (PSM 6 block - measurement panels)
    const cropX = Math.floor(cols * 0.55);
    const cropW = cols - cropX;
    const cropRgb = new Uint8Array(rows * cropW * 3);
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cropW; x++) {
            const v = grayBuf[y * cols + cropX + x] >= threshHigh ? 255 : 0;
            const di = (y * cropW + x) * 3;
            cropRgb[di] = v; cropRgb[di + 1] = v; cropRgb[di + 2] = v;
        }
    }

    // Use per-worker tmp file names so parallel workers don't collide
    const tag = `${process.pid}-${Date.now()}-${slotIdx}-${Math.floor(Math.random() * 1e6)}`;
    const threshFile = path.join(os.tmpdir(), `dcm-batch-thresh-${tag}.bmp`);
    const cropFile = path.join(os.tmpdir(), `dcm-batch-crop-${tag}.bmp`);
    const rawFile = path.join(os.tmpdir(), `dcm-batch-raw-${tag}.bmp`);
    const midFile = useMid ? path.join(os.tmpdir(), `dcm-batch-mid-${tag}.bmp`) : null;
    fs.writeFileSync(threshFile, makeBmp24(threshRgb, cols, rows));
    fs.writeFileSync(cropFile, makeBmp24(cropRgb, cropW, rows));

    const LABEL_HIT = /\b(BPD|HC|AC|FL|CRL|EFW|GA|FHR|AFI|HL|EDD|RI|PI|PSV|EDV|Vel|HR)\b|\d+\s*(cm\/s|cm|mm|ml)\b/i;
    const collected = [];
    try {
        await worker.setParameters({ tessedit_pageseg_mode: '11' });
        const { data: d1 } = await worker.recognize(threshFile);
        collected.push(d1.text || '');

        await worker.setParameters({ tessedit_pageseg_mode: '6' });
        const { data: d2 } = await worker.recognize(cropFile);
        collected.push(d2.text || '');

        // Rescue passes only if HIGH-threshold passes found no labels/units.
        // Costs ~1-3s extra but unlocks Philips/GE/Samsung - and is cached afterwards.
        const needsRescue = !LABEL_HIT.test(collected.join('\n'));

        if (needsRescue && useMid) {
            const midRgb = new Uint8Array(rows * cols * 3);
            for (let i = 0; i < rows * cols; i++) {
                const v = grayBuf[i] >= threshMid ? 255 : 0;
                midRgb[i * 3] = v; midRgb[i * 3 + 1] = v; midRgb[i * 3 + 2] = v;
            }
            fs.writeFileSync(midFile, makeBmp24(midRgb, cols, rows));
            const { data: dm } = await worker.recognize(midFile);
            collected.push(dm.text || '');
        }

        if (needsRescue && !LABEL_HIT.test(collected.join('\n'))) {
            // Raw grayscale rescue (Philips HD15, Samsung Hera, Voluson)
            const rawRgb = new Uint8Array(rows * cols * 3);
            for (let i = 0; i < rows * cols; i++) {
                const v = grayBuf[i];
                rawRgb[i * 3] = v; rawRgb[i * 3 + 1] = v; rawRgb[i * 3 + 2] = v;
            }
            fs.writeFileSync(rawFile, makeBmp24(rawRgb, cols, rows));
            const { data: d3 } = await worker.recognize(rawFile);
            collected.push(d3.text || '');
        }

        const text = collected.filter(t => t && t.trim()).join('\n');
        return { text };
    } finally {
        const tmps = [threshFile, cropFile];
        if (fs.existsSync(rawFile)) tmps.push(rawFile);
        if (midFile && fs.existsSync(midFile)) tmps.push(midFile);
        for (const f of tmps) { try { fs.unlinkSync(f); } catch {} }
    }
}

// Start network receiver on app startup
// NOTE: Port 3458 is now owned by Orthanc (DICOM SCP with AE=ONECLICKZ).
// The custom TCP receiver is disabled to avoid port conflict.
function startNetworkReceiverOnAppReady() {
    startDicomNetworkReceiver();
    console.log(`[DICOM Network] Custom TCP receiver started on port ${DICOM_LISTEN_PORT}`);
}

