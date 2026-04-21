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
const ORTHANC_PORT = 8043;
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
// Splash Screen
// =====================================================
function createSplashWindow() {
    splashWindow = new BrowserWindow({
        width: 450,
        height: 350,
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        webPreferences: { nodeIntegration: false, contextIsolation: true }
    });
    splashWindow.loadFile(path.join(__dirname, 'splash.html'));
    splashWindow.center();
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
                        title: 'About MediView Pro',
                        message: 'MediView Pro',
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
const mariadbInstallDbPath = path.join(mysqlDir, 'bin', 'mariadb-install-db.exe');

async function initMySQLData() {
    if (fs.existsSync(mysqlDataSubDir) && fs.readdirSync(mysqlDataSubDir).length > 0) return false;
    console.log('[MySQL] First run - initializing...');
    if (!fs.existsSync(mysqlDataSubDir)) fs.mkdirSync(mysqlDataSubDir, { recursive: true });
    // Use mariadb-install-db.exe (preferred for MariaDB) if available, else fall back to mysqld --initialize-insecure
    if (fs.existsSync(mariadbInstallDbPath)) {
        execSync(`"${mariadbInstallDbPath}" --datadir="${mysqlDataSubDir}" --password=""`, {
            timeout: 120000, stdio: 'pipe'
        });
    } else {
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
    const cmd = isDev && !fs.existsSync(mysqlClientPath)
        ? 'C:\\xampp\\mysql\\bin\\mysql.exe -u root -e "SELECT 1"'
        : `"${mysqlClientPath}" -u root --port=${MYSQL_PORT} -e "SELECT 1"`;
    for (let i = 0; i < maxAttempts; i++) {
        try { execSync(cmd, { timeout: 5000, stdio: 'pipe', shell: true }); console.log('[MySQL] Ready!'); return true; }
        catch { console.log(`[MySQL] Waiting... (${i + 1}/${maxAttempts})`); await new Promise(r => setTimeout(r, 1000)); }
    }
    return false;
}

async function runMigrations() {
    const dbName = 'dicom_viewer_pro';
    const cmd = isDev && !fs.existsSync(mysqlClientPath)
        ? 'C:\\xampp\\mysql\\bin\\mysql.exe -u root'
        : `"${mysqlClientPath}" -u root --port=${MYSQL_PORT}`;

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
                } catch(e2) {}
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
    const luaScript = path.join(wwwPath, 'orthanc-config', 'dicom-callbacks.lua');
    const config = {
        Name: 'Hospital_DICOM_Server',
        HttpPort: ORTHANC_PORT,
        RemoteAccessAllowed: true,
        DicomPort: 3458,
        DicomServerEnabled: true,
        DicomAet: 'MEDIVIEW',
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
                    host: 'localhost', port: ORTHANC_PORT, path: '/system', timeout: 2000,
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
    '.js':   'application/javascript',
    '.css':  'text/css',
    '.json': 'application/json',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.gif':  'image/gif',
    '.svg':  'image/svg+xml',
    '.ico':  'image/x-icon',
    '.woff': 'font/woff',
    '.woff2':'font/woff2',
    '.ttf':  'font/ttf',
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
// Main Startup
// =====================================================
async function startApp() {
    try {
        ensureDirectories();
        createSplashWindow();

        const usePortableMySQL = true; // This was fs.existsSync(mysqldPath) in original, now hardcoded to true

        // 1. Kick off all services in parallel
        console.log('[Startup] Initializing services in parallel...');
        
        const mysqlPromise = (async () => {
            if (usePortableMySQL) {
                const firstRun = !fs.existsSync(mysqlDataSubDir) || fs.readdirSync(mysqlDataSubDir).length === 0;
                if (firstRun) await initMySQLData();
                await startMySQL();
            }
            return await waitForMySQL(30);
        })();

        const orthancPromise = (async () => {
            await startOrthanc();
            return await waitForOrthanc(15);
        })();

        const phpPromise = (async () => {
            await startPhpServer();
            return await waitForServer();
        })();

        // Start independent services
        startDicomServer();
        startNetworkReceiverOnAppReady();

        // 2. Wait for MySQL to finish so we can run migrations
        const mysqlReady = await mysqlPromise;
        if (!mysqlReady) {
            dialog.showErrorBox('Error', 'Failed to start MySQL.');
            app.quit(); return;
        }

        // Run migrations (blocks until done, but only runs new ones)
        try { await runMigrations(); } catch (e) { console.error('[Startup] Migration warning:', e.message); }

        // 3. Wait for static server and Orthanc
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
    dicomServer = http.createServer((req, res) => {
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
        if (parsedUrl.pathname === '/api/dicom/scan-patients') {
            const dirPath = parsedUrl.query.dir;
            const limit = parseInt(parsedUrl.query.limit || '5000', 10);
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

                const dicomFiles = [];
                function collectFiles(dir) {
                    if (dicomFiles.length >= limit) return;
                    try {
                        const entries = fs.readdirSync(dir, { withFileTypes: true });
                        for (const entry of entries) {
                            if (dicomFiles.length >= limit) break;
                            const fullPath = path.join(dir, entry.name);
                            if (entry.isDirectory()) {
                                collectFiles(fullPath);
                            } else if (entry.isFile()) {
                                const name = entry.name.toLowerCase();
                                if (name.endsWith('.dcm') || name.endsWith('.dicom') || (!name.includes('.') && name !== 'dicomdir')) {
                                    dicomFiles.push(fullPath);
                                }
                            }
                        }
                    } catch { /* skip unreadable dirs */ }
                }
                collectFiles(resolved);

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

                const studies = {};
                for (const filePath of dicomFiles) {
                    try {
                        const fd = fs.openSync(filePath, 'r');
                        const headerSize = Math.min(fs.statSync(filePath).size, 65536);
                        const buffer = Buffer.alloc(headerSize);
                        fs.readSync(fd, buffer, 0, headerSize, 0);
                        fs.closeSync(fd);

                        const byteArray = new Uint8Array(buffer);
                        const dataSet = dicomParser.parseDicom(byteArray, { untilTag: 'x7fe00010' });

                        // Skip DICOMDIR files
                        const sopClassUID = readTag(dataSet, 'x00020002');
                        if (sopClassUID === '1.2.840.10008.1.3.10') continue;

                        // Skip files with no useful tags
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
                            };
                        }
                        studies[studyUID].files.push(filePath.replace(/\\/g, '/'));
                    } catch { /* skip unparseable files */ }
                }

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
app.whenReady().then(startApp);
app.on('window-all-closed', () => { stopDicomServer(); stopDicomNetworkReceiver(); stopPhpServer(); stopOrthanc(); stopMySQL(); app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) startApp(); });
app.on('before-quit', () => { stopDicomServer(); stopDicomNetworkReceiver(); stopPhpServer(); stopOrthanc(); stopMySQL(); });

// =====================================================
// IPC Handlers
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

// Print HTML content to printer
ipcMain.handle('print-to-printer', async (event, options) => {
    return new Promise(async resolve => {
        let tempFile = null;
        try {
            const { printerName, htmlContent, printSettings = {} } = options;
            const os = require('os');
            tempFile = path.join(os.tmpdir(), `dicom_print_${Date.now()}.html`);
            fs.writeFileSync(tempFile, htmlContent, 'utf8');

            const printWindow = new BrowserWindow({
                show: false, width: 1200, height: 900,
                webPreferences: { nodeIntegration: false, contextIsolation: true }
            });

            await printWindow.loadFile(tempFile);

            printWindow.webContents.on('did-finish-load', async () => {
                await new Promise(r => setTimeout(r, 500));
                const opts = {
                    silent: true, printBackground: true,
                    color: printSettings.colorMode !== 'grayscale',
                    margins: { marginType: printSettings.margins || 'default' },
                    landscape: printSettings.orientation === 'landscape',
                    copies: printSettings.copies || 1
                };
                if (printerName && printerName !== 'default') opts.deviceName = printerName;
                if (printSettings.paperSize) opts.pageSize = printSettings.paperSize;

                printWindow.webContents.print(opts, (success, errorType) => {
                    resolve(success ? { success: true } : { success: false, error: errorType || 'Print failed' });
                    printWindow.close();
                    if (tempFile && fs.existsSync(tempFile)) try { fs.unlinkSync(tempFile); } catch {}
                });
            });
        } catch (e) {
            resolve({ success: false, error: e.message });
            if (tempFile && fs.existsSync(tempFile)) try { fs.unlinkSync(tempFile); } catch {}
        }
    });
});

// Print current window
ipcMain.handle('print-current-to-printer', async (event, options) => {
    return new Promise(resolve => {
        try {
            const { printerName, printSettings = {} } = options;
            const win = BrowserWindow.fromWebContents(event.sender);
            if (!win) { resolve({ success: false, error: 'Window not found' }); return; }

            const opts = {
                silent: true, printBackground: true,
                color: printSettings.colorMode !== 'grayscale',
                landscape: printSettings.orientation === 'landscape',
                copies: printSettings.copies || 1
            };
            if (printerName && printerName !== 'default') opts.deviceName = printerName;
            if (printSettings.paperSize) opts.pageSize = printSettings.paperSize;

            win.webContents.print(opts, (success, errorType) => {
                resolve(success ? { success: true } : { success: false, error: errorType || 'Print failed' });
            });
        } catch (e) { resolve({ success: false, error: e.message }); }
    });
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
// Dual Viewer Popup Window
// =====================================================
let dualViewerWindow = null;

ipcMain.handle('open-dual-viewer', (event) => {
    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenW, height: screenH } = primaryDisplay.workAreaSize;

    const winW = Math.round(screenW * 0.93);
    const winH = Math.round(screenH * 0.93);

    if (dualViewerWindow && !dualViewerWindow.isDestroyed()) {
        dualViewerWindow.close();
    }

    dualViewerWindow = new BrowserWindow({
        width: winW,
        height: winH,
        minWidth: 800,
        minHeight: 500,
        title: 'DICOM Viewer Pro - Dual Comparison',
        icon: path.join(__dirname, 'icon.ico'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    dualViewerWindow.center();
    dualViewerWindow.loadURL(`${APP_URL}/dual-viewer`);

    const dualMenu = Menu.buildFromTemplate([
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
    dualViewerWindow.setMenu(dualMenu);

    dualViewerWindow.on('closed', () => { dualViewerWindow = null; });

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
                    host: 'localhost', port: ORTHANC_PORT, path: '/instances',
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
                host: 'localhost', port: ORTHANC_PORT,
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

// Get/Set configured Orthanc modalities for DICOM send
ipcMain.handle('get-dicom-modalities', async () => {
    try {
        const result = await new Promise((resolve, reject) => {
            const req = http.request({
                host: 'localhost', port: ORTHANC_PORT, path: '/modalities',
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
// DICOM Network Receiver (C-STORE) for USG/Network
// =====================================================
const DICOM_LISTEN_PORT = 3458; // DICOM network listening port
let dicomNetworkServer = null;
let networkDicomStorage = path.join(userDataPath, 'network-dicom');

function ensureNetworkDicomStorage() {
    if (!fs.existsSync(networkDicomStorage)) {
        fs.mkdirSync(networkDicomStorage, { recursive: true });
        console.log(`[DICOM Network] Storage directory created: ${networkDicomStorage}`);
    }
}

function startDicomNetworkReceiver() {
    ensureNetworkDicomStorage();

    try {
        const net = require('net');
        dicomNetworkServer = net.createServer((socket) => {
            console.log(`[DICOM Network] New connection from ${socket.remoteAddress}:${socket.remotePort}`);

            let buffer = Buffer.alloc(0);

            socket.on('data', (data) => {
                buffer = Buffer.concat([buffer, data]);

                // Simple DICOM file detection (DICOM files start with specific bytes or have DICM at offset 128)
                if (buffer.length > 132) {
                    const hasDicmSignature = buffer.toString('utf8', 128, 132) === 'DICM';
                    const isParseable = buffer[0] === 0x28 || hasDicmSignature; // (28,xx) or DICM signature

                    if (isParseable) {
                        const timestamp = Date.now();
                        const filename = `received_${timestamp}.dcm`;
                        const filepath = path.join(networkDicomStorage, filename);

                        try {
                            fs.writeFileSync(filepath, buffer);
                            console.log(`[DICOM Network] Received and saved: ${filename} (${buffer.length} bytes)`);

                            // Notify UI that a new file was received
                            if (mainWindow && mainWindow.webContents) {
                                mainWindow.webContents.send('dicom-file-received', {
                                    filename: filename,
                                    filepath: filepath,
                                    size: buffer.length,
                                    timestamp: new Date().toISOString()
                                });
                            }

                            // Send acknowledgment
                            socket.write(Buffer.from([0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00]));
                            socket.end();
                        } catch (e) {
                            console.error(`[DICOM Network] Error saving file: ${e.message}`);
                            socket.end();
                        }
                    }
                }
            });

            socket.on('end', () => {
                console.log(`[DICOM Network] Connection closed from ${socket.remoteAddress}`);
            });

            socket.on('error', (err) => {
                console.error(`[DICOM Network] Socket error: ${err.message}`);
            });
        });

        dicomNetworkServer.listen(DICOM_LISTEN_PORT, '0.0.0.0', () => {
            console.log(`[DICOM Network] Receiver listening on port ${DICOM_LISTEN_PORT}`);
        });

        dicomNetworkServer.on('error', (err) => {
            console.error(`[DICOM Network] Server error: ${err.message}`);
        });
    } catch (e) {
        console.error(`[DICOM Network] Failed to start receiver: ${e.message}`);
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
    return {
        path: networkDicomStorage,
        port: DICOM_LISTEN_PORT,
        success: true
    };
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
        const { createWorker } = require(path.join(__dirname, 'www', 'node_modules', 'tesseract.js'));

        // Save base64 PNG to temp file
        const tmpFile = path.join(os.tmpdir(), `dicom-ocr-${Date.now()}.png`);
        const imgBuffer = Buffer.from(base64, 'base64');
        fs.writeFileSync(tmpFile, imgBuffer);

        const worker = await createWorker('eng', 1, {
            logger: () => {},
            // Use local lang data if provided, otherwise Tesseract downloads it
            langPath: langPath || undefined,
        });
        await worker.setParameters({ tessedit_pageseg_mode: '11' }); // sparse text
        const { data } = await worker.recognize(tmpFile);
        await worker.terminate();
        fs.unlinkSync(tmpFile); // cleanup

        return { text: data.text || '', success: true };
    } catch (err) {
        console.warn('[OCR] Node.js Tesseract failed:', err.message);
        return { text: '', success: false, error: err.message };
    }
});

// ── DICOM measurement text extraction (Node.js side — no browser OCR needed) ──
ipcMain.handle('extract-dicom-text', async (event, { filePaths }) => {
    const dicomParserLib = require('dicom-parser');
    const textStrings = [];

    // VRs that can hold text/measurement data in DICOM
    const TEXT_VRS = new Set(['ST', 'LO', 'LT', 'SH', 'UN', 'CS', 'UT', 'PN', 'DS', 'IS']);

    for (const filePath of (filePaths || []).slice(0, 10)) {
        try {
            const buffer = fs.readFileSync(filePath);
            const byteArray = new Uint8Array(buffer);
            // Stop before pixel data to keep parsing fast
            const dataset = dicomParserLib.parseDicom(byteArray, { untilTag: '7fe00010' });

            // Walk all parsed elements looking for text
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

            // Also check specific measurement-bearing tags explicitly
            const measureTags = [
                '00204000', // Image Comments
                '00402400', // Imaging Service Request Comments
                '00181030', // Protocol Name
                '00400254', // Performed Procedure Step Description
                '00400007', // Scheduled Procedure Step Description
                '00102000', // Medical Alerts
                '00181400', // Acquisition Device Processing Description
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

    return { textStrings: [...new Set(textStrings)] }; // deduplicate
});

// Start network receiver on app startup
// NOTE: Port 3458 is now owned by Orthanc (DICOM SCP with AE=MEDIVIEW).
// The custom TCP receiver is disabled to avoid port conflict.
function startNetworkReceiverOnAppReady() {
    console.log('[DICOM Network] Orthanc handles DICOM receives on port 3458 (AE: MEDIVIEW) — custom TCP receiver disabled.');
}
