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
const fs = require('fs');

// Configuration
const PHP_PORT = 8080;
const MYSQL_PORT = 3307;
const ORTHANC_PORT = 8042;
const APP_URL = `http://localhost:${PHP_PORT}`;

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
                        title: 'About DICOM Viewer Pro',
                        message: 'Hospital DICOM Viewer Pro',
                        detail: 'Version 1.0.0 - Modern Desktop Edition\n\nOffline DICOM viewing and analysis for healthcare professionals.'
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
    console.log('[MySQL] First run - initializing...');
    if (!fs.existsSync(mysqlDataDir)) fs.mkdirSync(mysqlDataDir, { recursive: true });
    execSync(`"${mysqldPath}" --initialize-insecure --datadir="${mysqlDataSubDir}" --basedir="${mysqlDir}"`, {
        timeout: 120000, stdio: 'pipe'
    });
    console.log('[MySQL] Data directory initialized');
    return true;
}

function startMySQL() {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(mysqldPath)) {
            if (isDev) { console.log('[MySQL] Using system MySQL (dev mode)'); resolve(); return; }
            reject(new Error('MySQL not found: ' + mysqldPath)); return;
        }
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
        setTimeout(resolve, 3000);
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

    console.log('[MySQL] Creating database...');
    try {
        execSync(`${cmd} -e "CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"`, {
            timeout: 10000, stdio: 'pipe', shell: true
        });
    } catch (e) { console.error('[MySQL] DB create failed:', e.message); }

    const migrationsDir = path.join(wwwPath, 'database', 'migrations');
    if (!fs.existsSync(migrationsDir)) return;

    const sqlFiles = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
    console.log(`[MySQL] Running ${sqlFiles.length} migrations...`);

    for (const sqlFile of sqlFiles) {
        try {
            execSync(`${cmd} "${dbName}" < "${path.join(migrationsDir, sqlFile)}"`, {
                timeout: 30000, stdio: 'pipe', shell: true
            });
            console.log(`[MySQL] + ${sqlFile}`);
        } catch (e) {
            const msg = e.stderr ? e.stderr.toString() : e.message;
            if (msg.includes('already exists') || msg.includes('Duplicate')) {
                console.log(`[MySQL] = ${sqlFile} (exists)`);
            } else {
                console.warn(`[MySQL] ! ${sqlFile}: ${msg.substring(0, 100)}`);
            }
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
        DicomPort: 4242,
        DicomServerEnabled: true,
        DicomAet: 'HOSPITAL_ORTHANC',
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
        console.log('[Orthanc] Starting...');
        const configPath = generateOrthancConfig();
        orthancProcess = spawn(orthancExePath, [configPath], { cwd: orthancDir, stdio: ['ignore', 'pipe', 'pipe'] });
        orthancProcess.stdout.on('data', d => console.log(`[Orthanc] ${d.toString().trim()}`));
        orthancProcess.stderr.on('data', d => console.log(`[Orthanc] ${d.toString().trim()}`));
        orthancProcess.on('error', err => { console.warn('[Orthanc] Error:', err.message); resolve(); });
        orthancProcess.on('close', code => { console.log(`[Orthanc] Exited: ${code}`); orthancProcess = null; });
        setTimeout(resolve, 2000);
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
        } catch { await new Promise(r => setTimeout(r, 1000)); }
    }
    return false;
}

// =====================================================
// PHP Server
// =====================================================
function startPhpServer() {
    return new Promise((resolve, reject) => {
        console.log('[PHP] Starting server...');
        const env = { ...process.env, APP_DATA_PATH: userDataPath };
        if (!isDev || fs.existsSync(mysqldPath)) {
            env.DB_PORT = String(MYSQL_PORT);
            env.DB_HOST = '127.0.0.1';
            env.DB_USER = 'root';
            env.DB_PASSWORD = '';
        }

        // Use router.php to handle SPA routing
        const routerPath = path.join(wwwPath, 'router.php');
        const phpArgs = fs.existsSync(routerPath)
            ? ['-S', `localhost:${PHP_PORT}`, '-t', wwwPath, routerPath]
            : ['-S', `localhost:${PHP_PORT}`, '-t', wwwPath];

        phpProcess = spawn(phpPath, phpArgs, {
            cwd: wwwPath,
            stdio: ['ignore', 'pipe', 'pipe'],
            env
        });
        phpProcess.stdout.on('data', d => console.log(`[PHP] ${d.toString().trim()}`));
        phpProcess.stderr.on('data', d => console.log(`[PHP] ${d.toString().trim()}`));
        phpProcess.on('error', reject);
        phpProcess.on('close', code => { console.log(`[PHP] Exited: ${code}`); phpProcess = null; });
        setTimeout(resolve, 1000);
    });
}

function stopPhpServer() {
    if (phpProcess) { console.log('[PHP] Stopping...'); phpProcess.kill('SIGTERM'); phpProcess = null; }
}

async function waitForServer(maxAttempts = 30) {
    for (let i = 0; i < maxAttempts; i++) {
        try {
            await new Promise((resolve, reject) => {
                const req = http.request({ host: 'localhost', port: PHP_PORT, timeout: 2000 }, () => resolve(true));
                req.on('error', reject);
                req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
                req.end();
            });
            console.log('[PHP] Server ready!');
            return true;
        } catch { await new Promise(r => setTimeout(r, 500)); }
    }
    return false;
}

// =====================================================
// Main Startup
// =====================================================
async function startApp() {
    try {
        createSplashWindow();
        ensureDirectories();

        const usePortableMySQL = fs.existsSync(mysqldPath);

        // Start MySQL
        if (usePortableMySQL) {
            const firstRun = !fs.existsSync(mysqlDataSubDir) || fs.readdirSync(mysqlDataSubDir).length === 0;
            if (firstRun) await initMySQLData();
            await startMySQL();
        }

        const mysqlReady = await waitForMySQL(30);
        if (!mysqlReady) {
            if (isDev && !usePortableMySQL) {
                const result = await dialog.showMessageBox({
                    type: 'warning', title: 'MySQL Required',
                    message: 'MySQL is not running. Start MySQL from XAMPP, then click Retry.',
                    buttons: ['Retry', 'Exit']
                });
                if (result.response === 1) { app.quit(); return; }
                if (!await waitForMySQL(10)) { dialog.showErrorBox('Error', 'MySQL still not running.'); app.quit(); return; }
            } else {
                dialog.showErrorBox('Error', 'Failed to start MySQL.'); app.quit(); return;
            }
        }

        // Run migrations
        try { await runMigrations(); } catch (e) { console.error('[Startup] Migration warning:', e.message); }

        // Start Orthanc
        await startOrthanc();
        waitForOrthanc(15).then(ready => console.log(`[Startup] Orthanc: ${ready ? 'running' : 'not available'}`));

        // Start PHP
        await startPhpServer();
        if (!await waitForServer()) {
            dialog.showErrorBox('Error', 'Failed to start PHP server.');
            app.quit(); return;
        }

        // Create window and load React app
        createMainWindow();
        console.log('[Startup] Loading application...');
        mainWindow.loadURL(APP_URL);

    } catch (error) {
        console.error('[Startup] Error:', error);
        dialog.showErrorBox('Startup Error', error.message);
        app.quit();
    }
}

// =====================================================
// App Lifecycle
// =====================================================
app.whenReady().then(startApp);
app.on('window-all-closed', () => { stopPhpServer(); stopOrthanc(); stopMySQL(); app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) startApp(); });
app.on('before-quit', () => { stopPhpServer(); stopOrthanc(); stopMySQL(); });

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
