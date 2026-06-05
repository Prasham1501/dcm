/**
 * One Clickz RIS — Electron Main Process
 *
 * Slim sibling app to the DICOM Viewer. Reuses the same bundled services
 * (MariaDB, Orthanc, PHP) and shared data directory (%APPDATA%/one-clickz).
 *
 * Service-start policy ("first app wins"):
 *   - On launch, probe each port. If something already listens → assume the
 *     Viewer started it, just connect.
 *   - If the port is free → spawn the bundled binary ourselves.
 *   - On quit, only stop the services WE spawned. Services started by the
 *     Viewer (or another instance) are left running.
 */

const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron');
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const net = require('net');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const os = require('os');

// -------- Ports (must match the Viewer's main.js) --------
const MYSQL_PORT   = 3307;
const ORTHANC_HTTP = 8042;
const ORTHANC_DCM  = 3458;
const PHP_PORT     = 8081;     // bundled PHP built-in server
const UI_PORT      = 8090;     // RIS static + API proxy (Viewer uses 8080)

// -------- Environment / paths --------
const isDev = !app.isPackaged;
const appPath = isDev ? path.join(__dirname, '..') : process.resourcesPath;

// In dev, reuse the Viewer's repo paths so we don't need to copy binaries.
const phpPath     = isDev ? 'C:\\xampp\\php\\php.exe'
                          : path.join(appPath, 'php', 'php.exe');
const wwwPath     = isDev ? path.join(appPath, 'www')
                          : path.join(appPath, 'www');
// RIS-specific PHP doc-root. Holds RIS API endpoints + a router script that
// falls back to wwwPath for any URL not present locally (e.g. /api/auth/login.php).
const risServerPath = isDev ? path.join(__dirname, 'server')
                            : path.join(appPath, 'ris-server');
const risRouter     = path.join(risServerPath, 'router.php');
const mysqlDir    = isDev ? path.join(appPath, 'mysql')
                          : path.join(appPath, 'mysql');
const mysqldPath  = path.join(mysqlDir, 'bin', 'mysqld.exe');
const mysqlClient = path.join(mysqlDir, 'bin', 'mysql.exe');
const orthancDir  = isDev ? path.join(appPath, 'orthanc')
                          : path.join(appPath, 'orthanc');
const orthancExe  = path.join(orthancDir, 'Orthanc.exe');
const orthancCfgDir = isDev ? path.join(appPath, 'orthanc-config')
                            : path.join(appPath, 'orthanc-config');

// Shared user data dir (same as Viewer — so they share MariaDB data + Orthanc storage)
const sharedDataDir = path.join(app.getPath('appData'), 'one-clickz');
const mysqlDataDir  = path.join(sharedDataDir, 'mysql-data');
const orthancStorage = path.join(sharedDataDir, 'orthanc-storage');
const orthancDb     = path.join(sharedDataDir, 'orthanc-db');
const orthancWorklists = path.join(sharedDataDir, 'orthanc-worklists');
const orthancJson   = path.join(sharedDataDir, 'orthanc.json');
const licenseFile   = path.join(sharedDataDir, '.ris-license');
const LICENSE_API_BASE = 'https://mehrgrewal.com/mediview/api';

// Track which services we own so we don't kill someone else's processes.
const owned = { mysql: null, orthanc: null, php: null };
let staticServer = null;
let mainWindow = null;
let licenseHeartbeatTimer = null;

// ------------------------------------------------------------------
// License
// ------------------------------------------------------------------
function getFingerprint() {
    const raw = [
        os.hostname(), os.platform(), os.arch(),
        os.cpus()[0]?.model || '', String(os.totalmem()),
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

function startLicenseHeartbeat() {
    if (licenseHeartbeatTimer) return;
    licenseHeartbeatTimer = setInterval(sendRisHeartbeat, 30 * 60 * 1000);
    sendRisHeartbeat();
}

function risApiRequest(endpoint, body) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(body);
        const urlObj = new URL(LICENSE_API_BASE + endpoint);
        const req = https.request({
            hostname: urlObj.hostname,
            port: 443,
            path: urlObj.pathname,
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
        }, (res) => {
            let responseBody = '';
            res.on('data', chunk => responseBody += chunk);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, data: JSON.parse(responseBody) }); }
                catch { resolve({ status: res.statusCode, data: { error: responseBody } }); }
            });
        });
        req.on('error', reject);
        req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
        req.write(data);
        req.end();
    });
}

async function activateRisLicense(licenseKey) {
    const fingerprint = getFingerprint();
    try {
        const res = await risApiRequest('/license/activate', {
            license_key: licenseKey,
            fingerprint,
            machine_name: os.hostname() + ' (RIS)',
            os: `${os.platform()} ${os.release()}`,
            app: 'ris',
            app_version: app.getVersion ? app.getVersion() : '1.0.0',
        });
        if (res.status >= 200 && res.status < 300) {
            saveLicenseData({
                licenseKey,
                fingerprint,
                deviceId: res.data.device_id,
                plan: res.data.plan || 'unknown',
                expiresAt: res.data.expires_at,
                activatedAt: new Date().toISOString(),
                lastValidated: new Date().toISOString(),
            });
            startLicenseHeartbeat();
            return { success: true, data: res.data };
        }
        return { success: false, error: res.data?.error || res.data?.message || 'Activation failed' };
    } catch (e) {
        return { success: false, error: 'Network error: ' + e.message };
    }
}

async function validateRisLicense() {
    const lic = getLicenseData();
    if (!lic) return { valid: false, reason: 'no_license' };
    try {
        const res = await risApiRequest('/license/validate', {
            license_key: lic.licenseKey,
            fingerprint: lic.fingerprint,
            app: 'ris',
        });
        if (res.data?.valid) {
            lic.lastValidated = new Date().toISOString();
            lic.plan = res.data.plan || lic.plan;
            lic.expiresAt = res.data.expires_at || lic.expiresAt;
            saveLicenseData(lic);
            return { valid: true, plan: lic.plan, expiresAt: lic.expiresAt };
        }
        const reason = res.data?.reason || 'invalid';
        if (['not_found', 'revoked', 'deactivated', 'wrong_product', 'expired'].includes(reason)) {
            clearLicenseData();
        }
        return { valid: false, reason };
    } catch {
        if (lic.lastValidated) {
            const daysSince = (Date.now() - new Date(lic.lastValidated).getTime()) / (1000 * 60 * 60 * 24);
            if (daysSince < 7 && (!lic.expiresAt || new Date(lic.expiresAt).getTime() > Date.now())) {
                return { valid: true, plan: lic.plan, expiresAt: lic.expiresAt, offline: true };
            }
        }
        return { valid: false, reason: 'network_error' };
    }
}

async function sendRisHeartbeat() {
    const lic = getLicenseData();
    if (!lic) return;
    try {
        await risApiRequest('/license/heartbeat', {
            license_key: lic.licenseKey,
            fingerprint: lic.fingerprint,
            app_version: app.getVersion ? app.getVersion() : '1.0.0',
        });
    } catch {}
}

function getLicenseStatus() {
    const lic = getLicenseData();
    if (!lic) return { type: 'none', expired: true };
    let daysLeft = null;
    if (lic.expiresAt) {
        daysLeft = Math.max(0, Math.ceil((new Date(lic.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
    }
    return {
        type: 'licensed',
        licenseKey: lic.licenseKey,
        plan: lic.plan,
        expiresAt: lic.expiresAt,
        lastValidated: lic.lastValidated,
        daysLeft,
        expired: daysLeft !== null && daysLeft <= 0,
    };
}

// ------------------------------------------------------------------
// Utilities
// ------------------------------------------------------------------
function ensureDirs() {
    for (const d of [sharedDataDir, mysqlDataDir, orthancStorage, orthancDb]) {
        try { fs.mkdirSync(d, { recursive: true }); } catch {}
    }
}

function probePort(port, host = '127.0.0.1', timeout = 600) {
    return new Promise((resolve) => {
        const sock = new net.Socket();
        let done = false;
        const finish = (up) => { if (done) return; done = true; try { sock.destroy(); } catch {} resolve(up); };
        sock.setTimeout(timeout);
        sock.once('connect', () => finish(true));
        sock.once('timeout', () => finish(false));
        sock.once('error', () => finish(false));
        sock.connect(port, host);
    });
}

function probeHttp(url, timeout = 1500) {
    return new Promise((resolve) => {
        const req = http.get(url, { timeout }, (res) => {
            res.resume();
            resolve(res.statusCode && res.statusCode < 500);
        });
        req.on('error', () => resolve(false));
        req.on('timeout', () => { req.destroy(); resolve(false); });
    });
}

async function waitForHttp(url, maxAttempts = 30, delayMs = 500) {
    for (let i = 0; i < maxAttempts; i++) {
        if (await probeHttp(url)) return true;
        await new Promise(r => setTimeout(r, delayMs));
    }
    return false;
}

// ------------------------------------------------------------------
// MariaDB
// ------------------------------------------------------------------
function ensureMySqlData() {
    const dataInit = path.join(mysqlDataDir, 'data', 'mysql');
    if (fs.existsSync(dataInit)) return;
    const installer = path.join(mysqlDir, 'bin', 'mysql_install_db.exe');
    if (!fs.existsSync(installer)) {
        console.error('[RIS][MySQL] mysql_install_db.exe missing — cannot init data dir');
        return;
    }
    console.log('[RIS][MySQL] Initializing data dir at', mysqlDataDir);
    try {
        execSync(`"${installer}" --datadir="${path.join(mysqlDataDir, 'data')}"`,
            { stdio: 'pipe', timeout: 120000 });
    } catch (e) {
        console.error('[RIS][MySQL] init failed:', e.message);
    }
}

function startMySQL() {
    return new Promise((resolve) => {
        if (!fs.existsSync(mysqldPath)) {
            console.warn('[RIS][MySQL] mysqld.exe missing at', mysqldPath);
            resolve(false); return;
        }
        ensureMySqlData();
        console.log('[RIS][MySQL] Starting on port', MYSQL_PORT);
        const proc = spawn(mysqldPath, [
            `--datadir=${path.join(mysqlDataDir, 'data')}`,
            `--port=${MYSQL_PORT}`,
            '--skip-grant-tables',
            '--skip-networking=0',
            '--bind-address=127.0.0.1',
            '--console',
        ], { windowsHide: true });
        proc.stdout.on('data', d => process.stdout.write('[RIS][MySQL] ' + d));
        proc.stderr.on('data', d => process.stdout.write('[RIS][MySQL] ' + d));
        proc.on('exit', (code) => { console.log('[RIS][MySQL] exited', code); owned.mysql = null; });
        owned.mysql = proc;
        resolve(true);
    });
}

async function waitForMySQL(maxAttempts = 30) {
    for (let i = 0; i < maxAttempts; i++) {
        if (await probePort(MYSQL_PORT)) return true;
        await new Promise(r => setTimeout(r, 500));
    }
    return false;
}

// ------------------------------------------------------------------
// Orthanc
// ------------------------------------------------------------------
function ensureOrthancConfig() {
    if (!fs.existsSync(orthancWorklists)) fs.mkdirSync(orthancWorklists, { recursive: true });
    let cfg = {};
    if (fs.existsSync(orthancJson)) {
        try { cfg = JSON.parse(fs.readFileSync(orthancJson, 'utf8')); } catch { cfg = {}; }
    }
    cfg = {
        ...cfg,
        Name: 'OneClickzPACS',
        StorageDirectory: orthancStorage.replace(/\\/g, '/'),
        IndexDirectory: orthancDb.replace(/\\/g, '/'),
        HttpPort: ORTHANC_HTTP,
        DicomPort: ORTHANC_DCM,
        DicomAet: 'ONECLICKZ',
        RemoteAccessAllowed: true,
        AuthenticationEnabled: cfg.AuthenticationEnabled ?? false,
        Plugins: [orthancDir.replace(/\\/g, '/')],
        Worklists: {
            ...(cfg.Worklists || {}),
            Enable: true,
            Database: orthancWorklists.replace(/\\/g, '/'),
        },
    };
    fs.writeFileSync(orthancJson, JSON.stringify(cfg, null, 2));
}

function startOrthanc() {
    return new Promise((resolve) => {
        if (!fs.existsSync(orthancExe)) {
            console.warn('[RIS][Orthanc] missing'); resolve(false); return;
        }
        ensureOrthancConfig();
        console.log('[RIS][Orthanc] Starting');
        const proc = spawn(orthancExe, [orthancJson], { windowsHide: true });
        proc.stdout.on('data', d => process.stdout.write('[RIS][Orthanc] ' + d));
        proc.stderr.on('data', d => process.stdout.write('[RIS][Orthanc] ' + d));
        proc.on('exit', (code) => { console.log('[RIS][Orthanc] exited', code); owned.orthanc = null; });
        owned.orthanc = proc;
        resolve(true);
    });
}

// ------------------------------------------------------------------
// PHP (built-in server)
// ------------------------------------------------------------------
async function startPHP() {
    // Pick whichever MySQL is alive: prefer bundled MariaDB on MYSQL_PORT (3307),
    // fall back to XAMPP on 3306. Outside of dev we always use the bundled one.
    let dbPort = String(MYSQL_PORT);
    if (isDev) {
        if (await probePort(MYSQL_PORT))      dbPort = String(MYSQL_PORT);
        else if (await probePort(3306))       dbPort = '3306';
        else                                  dbPort = String(MYSQL_PORT);
    }
    return new Promise((resolve) => {
        if (!fs.existsSync(phpPath)) {
            console.warn('[RIS][PHP] php.exe missing'); resolve(false); return;
        }
        console.log('[RIS][PHP] Spawning 127.0.0.1:' + PHP_PORT, '→', risServerPath, '(fallback:', wwwPath + ')', '(DB port:', dbPort + ')');
        const env = {
            ...process.env,
            DB_HOST: '127.0.0.1',
            DB_PORT: dbPort,
            DB_USER: 'root',
            DB_PASSWORD: '',
            DB_NAME: 'dicom_viewer_pro',
            ORTHANC_URL: `http://localhost:${ORTHANC_HTTP}`,
            ORTHANC_USER: 'orthanc',
            ORTHANC_PASSWORD: 'orthanc',
            OCZ_WORKLIST_DIR: orthancWorklists,
            RIS_UI_PORT: String(UI_PORT),  // shown in the "connect your devices" panel
        };
        const args = fs.existsSync(risRouter)
            ? ['-S', `127.0.0.1:${PHP_PORT}`, '-t', risServerPath, risRouter]
            : ['-S', `127.0.0.1:${PHP_PORT}`, '-t', wwwPath];
        const proc = spawn(phpPath, args, {
            cwd: risServerPath, windowsHide: true, env,
        });
        proc.stdout.on('data', d => process.stdout.write('[RIS][PHP] ' + d));
        proc.stderr.on('data', d => process.stdout.write('[RIS][PHP] ' + d));
        proc.on('exit', (code) => { console.log('[RIS][PHP] exited', code); owned.php = null; });
        owned.php = proc;
        // Quick liveness probe
        const t0 = Date.now();
        const tick = async () => {
            if (await probeHttp(`http://127.0.0.1:${PHP_PORT}/api/health.php`)) return resolve(true);
            if (Date.now() - t0 > 5000) return resolve(true); // give up waiting but proceed
            setTimeout(tick, 250);
        };
        setTimeout(tick, 300);
    });
}

// ------------------------------------------------------------------
// Static SPA server + /api proxy
// ------------------------------------------------------------------
function startStaticServer() {
    return new Promise((resolve) => {
        const uiRoot = isDev ? null : path.join(__dirname, 'ui', 'dist');
        // In dev, the Vite dev server on :5174 serves the UI directly,
        // so we only need a server for prod builds.
        if (isDev) { resolve(true); return; }

        const mime = (p) => ({
            '.html': 'text/html; charset=utf-8',
            '.js': 'application/javascript; charset=utf-8',
            '.mjs': 'application/javascript; charset=utf-8',
            '.css': 'text/css; charset=utf-8',
            '.json': 'application/json; charset=utf-8',
            '.svg': 'image/svg+xml',
            '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
            '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
        }[path.extname(p).toLowerCase()] || 'application/octet-stream');

        staticServer = http.createServer((req, res) => {
            // Proxy /api/* → bundled PHP
            if (req.url.startsWith('/api/')) {
                const opts = {
                    host: '127.0.0.1', port: PHP_PORT,
                    method: req.method, path: req.url, headers: req.headers,
                };
                const proxy = http.request(opts, (pres) => {
                    res.writeHead(pres.statusCode || 502, pres.headers);
                    pres.pipe(res);
                });
                proxy.on('error', (e) => {
                    res.writeHead(502, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'PHP unreachable: ' + e.message }));
                });
                req.pipe(proxy);
                return;
            }
            // Static
            let p = req.url.split('?')[0];
            if (p === '/' || !path.extname(p)) p = '/index.html';
            const file = path.join(uiRoot, p);
            if (!file.startsWith(uiRoot) || !fs.existsSync(file)) {
                // SPA fallback
                const fallback = path.join(uiRoot, 'index.html');
                if (fs.existsSync(fallback)) {
                    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                    fs.createReadStream(fallback).pipe(res);
                    return;
                }
                res.writeHead(404); res.end('not found'); return;
            }
            res.writeHead(200, { 'Content-Type': mime(file) });
            fs.createReadStream(file).pipe(res);
        });
        staticServer.listen(UI_PORT, '0.0.0.0', () => {
            console.log('[RIS][Static] Listening on 0.0.0.0:' + UI_PORT);
            resolve(true);
        });
        staticServer.on('error', (e) => {
            console.error('[RIS][Static] error:', e.message);
            resolve(false);
        });
    });
}

// ------------------------------------------------------------------
// Orchestration
// ------------------------------------------------------------------
async function bootServices() {
    ensureDirs();

    // MySQL — in dev, reuse whichever local DB is already running; otherwise
    // start the bundled MariaDB so RIS APIs are not blank on machines without XAMPP MySQL.
    if (isDev && await probePort(3306)) {
        console.log('[RIS] Dev mode: using XAMPP MySQL on 3306.');
    } else if (isDev && await probePort(MYSQL_PORT)) {
        console.log('[RIS] Dev mode: bundled MariaDB already running on', MYSQL_PORT, '— reusing.');
    } else if (await probePort(MYSQL_PORT)) {
        console.log('[RIS] MySQL already running on', MYSQL_PORT, '— reusing.');
    } else {
        await startMySQL();
        await waitForMySQL();
    }

    // Orthanc
    if (await probePort(ORTHANC_HTTP)) {
        console.log('[RIS] Orthanc already running on', ORTHANC_HTTP, '— reusing.');
    } else {
        await startOrthanc();
    }

    // PHP
    if (await probePort(PHP_PORT)) {
        console.log('[RIS] PHP already running on', PHP_PORT, '— reusing.');
    } else {
        await startPHP();
    }

    // Static
    await startStaticServer();
}

function shutdownOwned() {
    if (staticServer) { try { staticServer.close(); } catch {} staticServer = null; }
    for (const key of ['php', 'orthanc', 'mysql']) {
        const p = owned[key];
        if (!p) continue;
        try {
            if (key === 'mysql' && fs.existsSync(mysqlClient)) {
                execSync(`"${mysqlClient}" -u root --port=${MYSQL_PORT} -e "SHUTDOWN"`,
                    { stdio: 'pipe', timeout: 6000 });
            } else {
                p.kill('SIGTERM');
            }
        } catch {}
        owned[key] = null;
    }
}

// ------------------------------------------------------------------
// Window
// ------------------------------------------------------------------
async function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400, height: 900,
        minWidth: 1100, minHeight: 700,
        title: 'One Clickz RIS',
        icon: path.join(__dirname, 'icon.ico'),
        backgroundColor: '#0f1115',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
        autoHideMenuBar: true,
    });
    Menu.setApplicationMenu(null);

    const target = isDev ? 'http://localhost:5174' : `http://127.0.0.1:${UI_PORT}`;
    console.log('[RIS] Loading', target);
    const retryLoad = () => {
        setTimeout(() => {
            mainWindow?.loadURL(target).catch((e) => {
                console.error('[RIS] retry load failed:', e.message);
                retryLoad();
            });
        }, 1000);
    };

    mainWindow.webContents.on('did-fail-load', (_e, code, desc) => {
        console.error('[RIS] load failed:', code, desc);
        retryLoad();
    });
    mainWindow.webContents.on('render-process-gone', (_event, details) => {
        console.error('[RIS] renderer process gone:', details.reason, details.exitCode);
    });
    mainWindow.webContents.on('console-message', (_event, level, message) => {
        if (level >= 2) console.error('[RIS][Renderer]', message);
    });

    // DevTools available via F12 / Ctrl+Shift+I — do not auto-open.
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url); return { action: 'deny' };
    });

    if (isDev) {
        const ready = await waitForHttp(target, 60, 500);
        if (!ready) {
            console.error('[RIS] Vite dev server did not become ready at', target);
        }
    }
    mainWindow.loadURL(target).catch((e) => {
        console.error('[RIS] initial load failed:', e.message);
        retryLoad();
    });
}

// ------------------------------------------------------------------
// App lifecycle
// ------------------------------------------------------------------
ipcMain.handle('ris:get-config', () => ({
    apiBase: `http://localhost:${isDev ? 5174 : UI_PORT}`,
    isDev,
}));
ipcMain.handle('ris:get-license-status', () => getLicenseStatus());
ipcMain.handle('ris:activate-license', async (_e, key) => activateRisLicense(key));
ipcMain.handle('ris:validate-license', async () => validateRisLicense());
ipcMain.handle('ris:get-fingerprint', () => getFingerprint());
ipcMain.handle('ris:deactivate-license', async () => {
    const lic = getLicenseData();
    if (lic) {
        try {
            await risApiRequest('/license/deactivate', {
                license_key: lic.licenseKey,
                fingerprint: lic.fingerprint,
            });
        } catch {}
        clearLicenseData();
    }
    if (licenseHeartbeatTimer) {
        clearInterval(licenseHeartbeatTimer);
        licenseHeartbeatTimer = null;
    }
    return { success: true };
});

app.whenReady().then(async () => {
    try {
        await bootServices();
    } catch (e) {
        console.error('[RIS] bootServices failed:', e);
    }
    const validation = await validateRisLicense();
    if (validation.valid) {
        startLicenseHeartbeat();
    }
    await createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    shutdownOwned();
    if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
    shutdownOwned();
});
