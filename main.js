/**
 * Hospital DICOM Viewer Pro - Modern Desktop Edition
 * Electron Main Process
 *
 * Manages:
 * - Portable MariaDB server (auto-start/stop)
 * - PHP built-in server (auto-start/stop)
 * - Orthanc DICOM server (auto-start/stop)
 * - Database initialization on first run
 * - React SPA served via PHP
 */

const { app, BrowserWindow, dialog, Menu, shell, ipcMain } = require('electron');
const path = require('path');
const { spawn, execSync } = require('child_process');
const http = require('http');
const url = require('url');
const fs = require('fs');

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

// ===== License & Trial System =====
const LICENSE_API_BASE = 'https://mehrgrewal.com/mediview/api';
const TRIAL_DAYS = 7;
const trialFile = path.join(userDataPath, '.trial');
const licenseFile = path.join(userDataPath, '.license');

function getFingerprint() {
    const crypto = require('crypto');
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
        if (fs.existsSync(licenseFile)) {
            return JSON.parse(fs.readFileSync(licenseFile, 'utf8'));
        }
    } catch { /* corrupt */ }
    return null;
}

function saveLicenseData(data) {
    try {
        fs.writeFileSync(licenseFile, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) { console.error('[License] Failed to save:', e.message); }
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
    } catch { /* corrupt file — treat as new install */ }

    if (!installDate || isNaN(installDate.getTime())) {
        installDate = new Date();
        try {
            fs.writeFileSync(trialFile, JSON.stringify({ installDate: installDate.toISOString() }), 'utf8');
        } catch { /* ignore write errors */ }
    }

    const now = new Date();
    const elapsed = Math.floor((now - installDate) / (1000 * 60 * 60 * 24));
    const remaining = Math.max(0, TRIAL_DAYS - elapsed);
    return { installDate, elapsed, remaining, expired: remaining <= 0 };
}

async function apiRequest(endpoint, body) {
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
        req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
        req.write(data);
        req.end();
    });
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
            saveLicenseData({
                licenseKey,
                fingerprint,
                deviceId: res.data.device_id,
                plan: res.data.plan || 'unknown',
                expiresAt: res.data.expires_at,
                activatedAt: new Date().toISOString(),
                lastValidated: new Date().toISOString(),
            });
            return { success: true, data: res.data };
        }
        return { success: false, error: res.data?.error || res.data?.message || 'Activation failed' };
    } catch (e) {
        return { success: false, error: 'Network error: ' + e.message };
    }
}

async function validateLicense() {
    const lic = getLicenseData();
    if (!lic) return { valid: false, reason: 'no_license' };

    try {
        const res = await apiRequest('/license/validate', {
            license_key: lic.licenseKey,
            fingerprint: lic.fingerprint,
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
        // Offline grace: if validated within last 7 days, allow
        if (lic.lastValidated) {
            const lastCheck = new Date(lic.lastValidated);
            const daysSince = (Date.now() - lastCheck.getTime()) / (1000 * 60 * 60 * 24);
            if (daysSince < 7) {
                return { valid: true, plan: lic.plan, expiresAt: lic.expiresAt, offline: true };
            }
        }
        return { valid: false, reason: 'network_error' };
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
}

function getLicenseStatus() {
    const lic = getLicenseData();
    if (lic) {
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
    const trial = getTrialInfo();
    return {
        type: 'trial',
        remaining: trial.remaining,
        expired: trial.expired,
        totalDays: TRIAL_DAYS,
    };
}
const mysqlDataDir = path.join(userDataPath, 'mysql-data');
const mysqlDataSubDir = path.join(mysqlDataDir, 'data');
const orthancDir = isDev ? path.join(__dirname, 'orthanc') : path.join(appPath, 'orthanc');
const orthancExePath = path.join(orthancDir, 'Orthanc.exe');
const orthancStorageDir = path.join(userDataPath, 'orthanc-storage');
const orthancDbDir = path.join(userDataPath, 'orthanc-db');
const logsDir = path.join(userDataPath, 'logs');

console.log('[Electron] Starting DICOM Viewer Pro...');
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

    console.log('[Frontend] www/dist missing — building React app...');
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

// =====================================================
// Main Window
// =====================================================
function createMainWindow() {
    const preloadPath = path.join(__dirname, 'preload.js');

    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 768,
        show: false,
        title: (() => {
            const lic = getLicenseData();
            if (lic) return `Accurate — ${lic.plan.charAt(0).toUpperCase() + lic.plan.slice(1)} License`;
            const trial = getTrialInfo();
            return `Accurate — Trial (${trial.remaining} days remaining)`;
        })(),
        icon: path.join(__dirname, 'icon.ico'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: preloadPath
        }
    });

    // Application menu
    const menu = Menu.buildFromTemplate([
        {
            label: 'File',
            submenu: [
                { label: 'Patients', click: () => mainWindow.loadURL(`${APP_URL}`) },
                { type: 'separator' },
                { label: 'Settings', click: () => mainWindow.loadURL(`${APP_URL}/admin/settings`) },
                { type: 'separator' },
                { role: 'quit', label: 'Exit' }
            ]
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' }
            ]
        },
        {
            label: 'Tools',
            submenu: [
                { role: 'toggleDevTools', label: 'Developer Tools', accelerator: 'F12' },
                { type: 'separator' },
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
                        title: 'About Accurate',
                        message: 'Accurate',
                        detail: 'Version 1.0.0 - Modern Desktop Edition\n\nProfessional DICOM viewing and analysis for healthcare professionals.\n\nFeatures:\n• Multi-format DICOM viewing\n• Network file receiving from USG/medical devices\n• Advanced image analysis tools\n• Offline operation\n• Secure file management'
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

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('http://localhost') || url.startsWith('about:') || url.startsWith('blob:')) {
            return {
                action: 'allow',
                overrideBrowserWindowOptions: {
                    webPreferences: {
                        nodeIntegration: false,
                        contextIsolation: true,
                        preload: path.join(__dirname, 'preload.js')
                    }
                }
            };
        }
        shell.openExternal(url);
        return { action: 'deny' };
    });
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

async function runMigrations() {
    const dbName = 'dicom_viewer_pro';
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

    const migrationsDir = path.join(wwwPath, 'database', 'migrations');
    if (!fs.existsSync(migrationsDir)) return;

    // Get applied migrations
    let appliedMigrations = [];
    try {
        const output = execSync(`${cmd} "${dbName}" -N -e "SELECT filename FROM app_migrations"`, {
            timeout: 10000, stdio: 'pipe', shell: true
        }).toString();
        appliedMigrations = output.split('\n').map(s => s.trim()).filter(Boolean);
    } catch (e) { console.warn('[MySQL] Failed to fetch applied migrations:', e.message); }

    const sqlFiles = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
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
        DicomAet: 'ACCURATE',
        DicomCheckCalledAet: false,
        AuthenticationEnabled: true,
        RegisteredUsers: { orthanc: 'orthanc', admin: 'admin123' },
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
                    headers: { Authorization: 'Basic ' + Buffer.from('orthanc:orthanc').toString('base64') }
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
// Static File Server (replaces PHP — serves Vite dist)
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

function startStaticServer() {
    return new Promise((resolve) => {
        ensurePortFree(PHP_PORT);
        const distPath = path.join(wwwPath, 'dist');
        console.log('[StaticServer] Starting on port', PHP_PORT, '→', distPath);

        staticServer = http.createServer((req, res) => {
            // Strip query string
            let reqPath = url.parse(req.url).pathname;

            // Try exact file first
            let filePath = path.join(distPath, reqPath);
            const ext = path.extname(filePath).toLowerCase();

            // SPA fallback: any non-file request → index.html
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
                // Known asset — serve directly, fallback to 404
                fs.access(filePath, fs.constants.F_OK, (err) => {
                    if (err) { res.writeHead(404); res.end('Not found'); }
                    else serveFile(filePath);
                });
            } else {
                // SPA route — always serve index.html
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
    // Static server resolves synchronously — just do a quick health check
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
    return true; // Static server is reliable — don't block startup
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
        { name: 'Accurate DICOM Viewer - Web Server', port: PHP_PORT },
        { name: 'Accurate DICOM Viewer - DICOM Server', port: DICOM_PORT },
        { name: 'Accurate DICOM Viewer - Orthanc HTTP', port: ORTHANC_PORT },
        { name: 'Accurate DICOM Viewer - Orthanc DICOM', port: 3458 },
        { name: 'Accurate DICOM Viewer - Network Receiver', port: 10104 },
        { name: 'Accurate DICOM Viewer - MySQL', port: MYSQL_PORT },
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

        // Configure firewall rules (non-blocking — warn on failure)
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
            await startPhpServer();
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
                    '• The mysql/ folder exists in the application directory\n' +
                    '• XAMPP MySQL is running on port 3306\n' +
                    '• MySQL/MariaDB is installed and running on the system\n\n' +
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
        // Static server is always reliable — no hard failure needed

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

        // CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }

        // Serve a DICOM file by path
        if (parsedUrl.pathname === '/api/dicom/serve-file.php') {
            const filePath = parsedUrl.query.path;
            if (!filePath) { res.statusCode = 400; res.end('Missing path'); return; }

            try {
                const resolved = path.resolve(filePath);
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
            const dirPath = parsedUrl.query.dir;
            const limit = parseInt(parsedUrl.query.limit || '10000', 10);
            const streamMode = parsedUrl.query.stream === '1';
            if (!dirPath) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: false, error: 'Missing dir parameter' }));
                return;
            }

            try {
                const resolved = path.resolve(dirPath);
                if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
                    res.statusCode = 404;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ success: false, error: 'Directory not found' }));
                    return;
                }

                // Collect files (non-blocking via setImmediate batches)
                const dicomFiles = [];
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
                                            if (name.endsWith('.dcm') || name.endsWith('.dicom') || (!name.includes('.') && name !== 'dicomdir')) {
                                                dicomFiles.push(fullPath);
                                            }
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
                                const fd = fs.openSync(filePath, 'r');
                                const headerSize = Math.min(fs.statSync(filePath).size, 65536);
                                const buffer = Buffer.alloc(headerSize);
                                fs.readSync(fd, buffer, 0, headerSize, 0);
                                fs.closeSync(fd);

                                const byteArray = new Uint8Array(buffer);
                                const dataSet = dicomParser.parseDicom(byteArray, { untilTag: 'x7fe00010' });

                                const sopClassUID = readTag(dataSet, 'x00020002');
                                if (sopClassUID === '1.2.840.10008.1.3.10') continue;

                                const rawStudyUID = readTag(dataSet, 'x0020000d');
                                if (!rawStudyUID && !readTag(dataSet, 'x00100010') && !readTag(dataSet, 'x00100020')) continue;

                                const studyUID = rawStudyUID || `unknown-${Object.keys(studies).length}`;

                                if (!studies[studyUID]) {
                                    const rawDate = readTag(dataSet, 'x00080020');
                                    let formattedDate = rawDate;
                                    if (rawDate.length === 8) {
                                        formattedDate = `${rawDate.slice(6, 8)}-${rawDate.slice(4, 6)}-${rawDate.slice(0, 4)}`;
                                    }
                                    const rawName = readTag(dataSet, 'x00100010').replace(/\^/g, ' ');
                                    studies[studyUID] = {
                                        patientName: rawName || 'Unknown',
                                        patientId: readTag(dataSet, 'x00100020') || 'N/A',
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
                                if (sopInstanceUID && studies[studyUID].sopInstanceUIDs.has(sopInstanceUID)) continue;
                                if (sopInstanceUID) studies[studyUID].sopInstanceUIDs.add(sopInstanceUID);
                                studies[studyUID].files.push(filePath.replace(/\\/g, '/'));
                            } catch { /* skip unparseable files */ }
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
                                    const fd = fs.openSync(filePath, 'r');
                                    const headerSize = Math.min(fs.statSync(filePath).size, 65536);
                                    const buffer = Buffer.alloc(headerSize);
                                    fs.readSync(fd, buffer, 0, headerSize, 0);
                                    fs.closeSync(fd);

                                    const byteArray = new Uint8Array(buffer);
                                    const dataSet = dicomParser.parseDicom(byteArray, { untilTag: 'x7fe00010' });

                                    const sopClassUID = readTag(dataSet, 'x00020002');
                                    if (sopClassUID === '1.2.840.10008.1.3.10') continue;

                                    const rawStudyUID = readTag(dataSet, 'x0020000d');
                                    if (!rawStudyUID && !readTag(dataSet, 'x00100010') && !readTag(dataSet, 'x00100020')) continue;

                                    const studyUID = rawStudyUID || `unknown-${Object.keys(studies).length}`;

                                    if (!studies[studyUID]) {
                                        const rawDate = readTag(dataSet, 'x00080020');
                                        let formattedDate = rawDate;
                                        if (rawDate.length === 8) {
                                            formattedDate = `${rawDate.slice(6, 8)}-${rawDate.slice(4, 6)}-${rawDate.slice(0, 4)}`;
                                        }
                                        const rawName = readTag(dataSet, 'x00100010').replace(/\^/g, ' ');
                                        studies[studyUID] = {
                                            patientName: rawName || 'Unknown',
                                            patientId: readTag(dataSet, 'x00100020') || 'N/A',
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
                                    if (sopInstanceUID && studies[studyUID].sopInstanceUIDs.has(sopInstanceUID)) continue;
                                    if (sopInstanceUID) studies[studyUID].sopInstanceUIDs.add(sopInstanceUID);
                                    studies[studyUID].files.push(filePath.replace(/\\/g, '/'));
                                } catch { /* skip unparseable files */ }
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
app.whenReady().then(async () => {
    const lic = getLicenseData();
    if (lic) {
        // Has license key — validate it
        const result = await validateLicense();
        if (!result.valid) {
            if (result.reason === 'expired') {
                // Don't quit — let the UI show the activation page
                clearLicenseData();
            } else if (result.reason === 'revoked') {
                clearLicenseData();
            } else if (result.reason === 'deactivated') {
                clearLicenseData();
            }
            // For network_error with valid grace period, validateLicense already returns valid
            // For other cases, clear license and let UI show activation page
        } else {
            // Start heartbeat interval
            setInterval(sendHeartbeat, 30 * 60 * 1000); // every 30 min
        }
    }
    // Always start app — UI (LicenseGate) handles showing activation page if no license
    startApp();
});
app.on('window-all-closed', () => { stopDicomServer(); stopDicomNetworkReceiver(); stopPhpServer(); stopOrthanc(); stopMySQL(); app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) startApp(); });
app.on('before-quit', () => { stopDicomServer(); stopDicomNetworkReceiver(); stopPhpServer(); stopOrthanc(); stopMySQL(); });

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
    return await activateLicense(licenseKey);
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
                zoomFactor: 1.0,
                backgroundThrottling: false,
            }
        });

        await printWindow.loadFile(tempFile);
        await waitForPrintableContent(printWindow);

        const opts = buildElectronPrintOptions(printerName, printSettings);
        let result = await runElectronPrint(printWindow.webContents, opts);

        // If silent print failed, retry with native OS print dialog
        if (!result.success) {
            console.warn('[Print] Silent print failed:', result.error, '— opening native print dialog');
            const dialogOpts = { ...opts, silent: false };
            printWindow.showInactive();
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

// Credential management for auto-login
const credentialsPath = path.join(userDataPath, 'credentials.json');

ipcMain.handle('save-credentials', async (event, credentials) => {
    try { fs.writeFileSync(credentialsPath, JSON.stringify(credentials), 'utf8'); return { success: true }; }
    catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('get-credentials', async () => {
    try {
        if (!fs.existsSync(credentialsPath)) return { success: true, credentials: null };
        return { success: true, credentials: JSON.parse(fs.readFileSync(credentialsPath, 'utf8')) };
    } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('clear-credentials', async () => {
    try { if (fs.existsSync(credentialsPath)) fs.unlinkSync(credentialsPath); return { success: true }; }
    catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('has-credentials', async () => {
    return { success: true, hasCredentials: fs.existsSync(credentialsPath) };
});

// Get DICOM server port
ipcMain.handle('get-dicom-port', () => {
    return { port: DICOM_PORT };
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

    // Close existing CR viewer window if open
    if (crViewerWindow && !crViewerWindow.isDestroyed()) {
        crViewerWindow.close();
    }

    crViewerWindow = new BrowserWindow({
        width: winW,
        height: winH,
        minWidth: 500,
        minHeight: 400,
        title: `DICOM Viewer Pro - Viewer (${imageCount} images)`,
        icon: path.join(__dirname, 'icon.ico'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    crViewerWindow.center();
    crViewerWindow.loadURL(`${APP_URL}/cr-viewer`);

    // Menu for CR viewer window
    const crMenu = Menu.buildFromTemplate([
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' }
            ]
        },
        {
            label: 'Tools',
            submenu: [
                { role: 'toggleDevTools', label: 'Developer Tools', accelerator: 'F12' }
            ]
        }
    ]);
    crViewerWindow.setMenu(crMenu);

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

    // Close existing viewer window if open
    if (viewerWindow && !viewerWindow.isDestroyed()) {
        viewerWindow.close();
    }

    viewerWindow = new BrowserWindow({
        width: winW,
        height: winH,
        minWidth: 500,
        minHeight: 400,
        title: `DICOM Viewer Pro - CR Viewer (${imageCount} images)`,
        icon: path.join(__dirname, 'icon.ico'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    viewerWindow.center();
    viewerWindow.loadURL(`${APP_URL}/viewer`);

    // Menu for viewer window
    const viewerMenu = Menu.buildFromTemplate([
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' }
            ]
        },
        {
            label: 'Tools',
            submenu: [
                { role: 'toggleDevTools', label: 'Developer Tools', accelerator: 'F12' }
            ]
        }
    ]);
    viewerWindow.setMenu(viewerMenu);

    viewerWindow.on('closed', () => { viewerWindow = null; });

    return { success: true, width: winW, height: winH };
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
        title: `DICOM Viewer Pro - Viewer (${imageCount} images)`,
        icon: path.join(__dirname, 'icon.ico'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });
    viewerWindow.loadURL(`${APP_URL}/viewer`);

    const viewerMenu = Menu.buildFromTemplate([
        { label: 'View', submenu: [{ role: 'reload' }, { role: 'forceReload' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }] },
        { label: 'Tools', submenu: [{ role: 'toggleDevTools', label: 'Developer Tools', accelerator: 'F12' }] }
    ]);
    viewerWindow.setMenu(viewerMenu);
    viewerWindow.on('closed', () => { viewerWindow = null; });

    // Create report editor window (right side) — alwaysOnTop so it stays visible
    reportWindow = new BrowserWindow({
        width: reportW,
        height: winH,
        x: workArea.x + viewerW,
        y: winY,
        minWidth: 400,
        minHeight: 400,
        alwaysOnTop: true,
        title: 'DICOM Viewer Pro - Report Editor',
        icon: path.join(__dirname, 'icon.ico'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });
    reportWindow.loadURL(`${APP_URL}/report-editor`);

    const reportMenu = Menu.buildFromTemplate([
        { label: 'View', submenu: [{ role: 'reload' }, { role: 'forceReload' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }] },
        { label: 'Tools', submenu: [{ role: 'toggleDevTools', label: 'Developer Tools', accelerator: 'F12' }] }
    ]);
    reportWindow.setMenu(reportMenu);
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
        title: 'DICOM Viewer Pro - Report Editor',
        icon: path.join(__dirname, 'icon.ico'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });
    win.loadURL(`${APP_URL}/report-editor`);
    const menu = Menu.buildFromTemplate([
        { label: 'View', submenu: [{ role: 'reload' }, { role: 'forceReload' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }] },
        { label: 'Tools', submenu: [{ role: 'toggleDevTools', label: 'Developer Tools', accelerator: 'F12' }] }
    ]);
    win.setMenu(menu);
    return { success: true };
});

// =====================================================
// File / Folder Dialog
// =====================================================
ipcMain.handle('show-open-dialog', async (event, options) => {
    try {
        const result = await dialog.showOpenDialog(mainWindow, options);
        return result; // { canceled, filePaths }
    } catch (e) {
        return { canceled: true, filePaths: [], error: e.message };
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
                        Authorization: 'Basic ' + Buffer.from('orthanc:orthanc').toString('base64'),
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
                    Authorization: 'Basic ' + Buffer.from('orthanc:orthanc').toString('base64'),
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
                    Authorization: 'Basic ' + Buffer.from('orthanc:orthanc').toString('base64'),
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
                            Authorization: 'Basic ' + Buffer.from('orthanc:orthanc').toString('base64'),
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
                    Authorization: 'Basic ' + Buffer.from('orthanc:orthanc').toString('base64'),
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
                    Authorization: 'Basic ' + Buffer.from('orthanc:orthanc').toString('base64'),
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
                    Authorization: 'Basic ' + Buffer.from('orthanc:orthanc').toString('base64'),
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
            ? { success: true, message: 'C-ECHO successful — destination is reachable' }
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
                headers: { Authorization: 'Basic ' + Buffer.from('orthanc:orthanc').toString('base64') }
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
const DICOM_AE_TITLE = 'ACCURATE';
const DICOM_MAX_PDU = 131072; // 128KB — compatible with most devices
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

// ── DICOM Upper Layer PDU helpers ──

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

    // Build AC presentation context results — accept all
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
    const implVerName = 'ACCURATE_SCP';
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
    // Command set is ALWAYS Implicit VR Little Endian (DICOM PS3.7 §6.3.1)
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

    // Helper: Explicit VR LE element with short VR (UI, UL, SH, etc. — 2-byte length)
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

    // Helper: Explicit VR LE element with long VR (OB, OW, UN, etc. — 4-byte length)
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

    // (0002,0001) File Meta Information Version — OB, uses long VR format
    parts.push(addLongVR(0x0002, 0x0001, 'OB', Buffer.from([0x00, 0x01])));
    // (0002,0002) Media Storage SOP Class UID — UI
    parts.push(addShortVR(0x0002, 0x0002, 'UI', sopClassUid));
    // (0002,0003) Media Storage SOP Instance UID — UI
    parts.push(addShortVR(0x0002, 0x0003, 'UI', sopInstanceUid));
    // (0002,0010) Transfer Syntax UID — UI
    parts.push(addShortVR(0x0002, 0x0010, 'UI', transferSyntax));
    // (0002,0012) Implementation Class UID — UI
    parts.push(addShortVR(0x0002, 0x0012, 'UI', '1.2.826.0.1.3680043.8.498.1'));
    // (0002,0013) Implementation Version Name — SH
    const verName = 'ACCURATE_SCP ';
    parts.push(addShortVR(0x0002, 0x0013, 'SH', Buffer.from(verName.length % 2 !== 0 ? verName + ' ' : verName, 'ascii')));

    const metaContent = Buffer.concat(parts);

    // (0002,0000) File Meta Information Group Length — UL (short VR)
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
            const check = execSync('netsh advfirewall firewall show rule name="DICOM Viewer Pro SCP"', { encoding: 'utf8', timeout: 5000, windowsHide: true });
            if (check.includes('DICOM Viewer Pro SCP')) {
                console.log('[DICOM SCP] Firewall rule already exists');
                return;
            }
        } catch (e) { /* rule doesn't exist, create it */ }

        // Try adding directly first (works if app is already admin)
        try {
            execSync(`netsh advfirewall firewall add rule name="DICOM Viewer Pro SCP" dir=in action=allow protocol=TCP localport=${DICOM_LISTEN_PORT} profile=any`, { timeout: 10000, windowsHide: true });
            console.log(`[DICOM SCP] Firewall rule added for port ${DICOM_LISTEN_PORT}`);
            return;
        } catch (e) { /* needs elevation */ }

        // Request elevation via PowerShell — shows UAC prompt
        console.log('[DICOM SCP] Requesting admin elevation for firewall rule...');
        const cmd = `Start-Process -FilePath 'netsh' -ArgumentList 'advfirewall firewall add rule name=\\"DICOM Viewer Pro SCP\\" dir=in action=allow protocol=TCP localport=${DICOM_LISTEN_PORT} profile=any' -Verb RunAs -WindowStyle Hidden -Wait`;
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

                    // Sanity check — reject absurdly large PDUs (>16MB)
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
                    // C-ECHO-RQ — respond with C-ECHO-RSP
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
    // Get local network IP — skip virtual adapters (WSL, Hyper-V, VPN, Bluetooth, loopback-like)
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
        aet: 'ACCURATE',
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

// ── Node.js Tesseract OCR (reliable, uses local WASM not CDN) ──
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

// ── Comprehensive DICOM reading extraction (ALL tag sources in one call) ──
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

    for (const filePath of (filePaths || []).slice(0, 15)) {
        try {
            const buffer = fs.readFileSync(filePath);
            const byteArray = new Uint8Array(buffer);
            // Parse FULL file — don't stop at pixel data (tags can follow pixels)
            const dataset = dicomParserLib.parseDicom(byteArray);

            // ── 1. DICOM SR Content Sequence (0040,A730) — the gold standard ──
            walkSRContent(dataset);

            // ── 2. Graphic Annotation Sequence (0070,0001) — text overlays ──
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

            // ── 3. Overlay text (60xx groups) — up to 16 overlay planes ──
            for (let g = 0x6000; g <= 0x601E; g += 2) {
                const prefix = g.toString(16).padStart(4, '0');
                const overlayDesc = safeString(dataset, 'x' + prefix + '0022');
                if (overlayDesc && overlayDesc.trim().length > 1) textFragments.push(overlayDesc.trim());
                const overlayLabel = safeString(dataset, 'x' + prefix + '1500');
                if (overlayLabel && overlayLabel.trim().length > 1) textFragments.push(overlayLabel.trim());
            }

            // ── 4. Known text tags with measurement summaries ──
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

            // ── 5. Recursive text from ALL sequences (vendor private data) ──
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

// ── DICOM measurement text extraction (Node.js side — no browser OCR needed) ──
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

// ── DICOM metadata extraction (patient/study/machine info) ──
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

// ── Helper: write a 24-bit BMP from an RGB Uint8Array ──
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

// ── Full-resolution DICOM pixel OCR (reads file → extracts pixels → BMP → Tesseract) ──
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
            // RGB or YBR — direct copy (most USG color images)
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
            // Monochrome — apply window level
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

        // ── Preprocessing: grayscale + contrast stretch ──
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

        // Right 45% crop — where Mindray/GE/Philips put measurement panels on Doppler images
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

        // Bottom 25% crop — for machines that put measurements at the bottom
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

        // ── Binary threshold image — isolates bright text from dark ultrasound background ──
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
        console.log(`[OCR-file] BMPs: full ${cols}×${rows}, right ${cropW}×${rows}, bottom ${cols}×${cropH}, thresh(${threshVal})`);

        // Single Tesseract worker, 4 passes:
        //   PSM 11 on full grayscale   — sparse text, catches scattered labels
        //   PSM 6  on right crop       — block mode for structured measurement panels
        //   PSM 6  on bottom crop      — block mode for bottom measurement strips
        //   PSM 11 on thresholded full — isolates bright text overlays from dark bg
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

// Start network receiver on app startup
// NOTE: Port 3458 is now owned by Orthanc (DICOM SCP with AE=ACCURATE).
// The custom TCP receiver is disabled to avoid port conflict.
function startNetworkReceiverOnAppReady() {
    startDicomNetworkReceiver();
    console.log(`[DICOM Network] Custom TCP receiver started on port ${DICOM_LISTEN_PORT}`);
}
