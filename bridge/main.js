/**
 * Accurate Bridge — Electron main process.
 *
 * Tray-only app (config window opens on demand). Auto-starts at Windows
 * login. Owns:
 *   - Logger (rotating file in %APPDATA%/AccurateBridge/logs)
 *   - ConfigStore (%APPDATA%/AccurateBridge/config.json)
 *   - SlotManager (one DICOM Storage SCP per enabled printer slot)
 *   - JobQueue (debounced by Study UID)
 *   - PrintWorker (renders DICOM to PNG and prints via Electron)
 */

const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, Notification, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const { Logger } = require('./src/log/logger');
const { ConfigStore } = require('./src/config/store');
const { defaultSlot, validateSlot } = require('./src/config/schema');
const { SlotManager } = require('./src/scp/slotManager');
const { JobQueue } = require('./src/print/jobQueue');
const { PrintWorker } = require('./src/print/printWorker');
const { ensureFirewallRules } = require('./src/firewall/addFirewallRule');
const { registerStartup, getStartupStatus } = require('./src/autostart/registerStartup');
const { parseStudyUid } = require('./src/render/dicomRender');

// --- Single instance lock ---
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}

// --- Paths ---
const userDataRoot = path.join(app.getPath('appData'), 'AccurateBridge');
const logDir = path.join(userDataRoot, 'logs');
const configPath = path.join(userDataRoot, 'config.json');
const incomingRoot = path.join(userDataRoot, 'incoming');
const printedRoot = path.join(userDataRoot, 'printed');
const failedRoot = path.join(userDataRoot, 'failed');
for (const d of [userDataRoot, logDir, incomingRoot, printedRoot, failedRoot]) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

// --- Singletons ---
const logger = new Logger({ logDir });
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
    { label: 'Accurate Bridge', enabled: false },
    { type: 'separator' },
    ...(slotItems.length ? slotItems : [{ label: 'No slots configured', enabled: false }]),
    { type: 'separator' },
    { label: 'Open Config…', click: openConfigWindow },
    { label: 'Open Logs Folder', click: () => shell.openPath(logDir) },
    { label: 'Open Storage Folder', click: () => shell.openPath(userDataRoot) },
    { type: 'separator' },
    { label: 'Quit Accurate Bridge', click: () => quitApp() },
  ]);
}

function refreshTray() {
  if (!tray) return;
  const status = slotManager ? slotManager.getStatus() : [];
  tray.setContextMenu(buildTrayMenu(status));
  const enabled = status.filter((s) => s.listening).length;
  tray.setToolTip(`Accurate Bridge — ${enabled} slot${enabled === 1 ? '' : 's'} listening`);
}

function setupTray() {
  const iconPath = path.join(__dirname, 'icon.ico');
  const icon = fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : nativeImage.createEmpty();
  tray = new Tray(icon);
  tray.setToolTip('Accurate Bridge');
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
    title: 'Accurate Bridge',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // In dev mode (vite dev server), load from localhost
  const isDev = process.argv.includes('--dev') || !app.isPackaged;
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

  ipcMain.handle('bridge:get-log-tail', (_e, n) => logger.tail(n || 500));

  ipcMain.handle('bridge:hide-to-tray', () => {
    if (configWindow && !configWindow.isDestroyed()) configWindow.hide();
  });

  ipcMain.handle('bridge:quit-app', () => quitApp());

  // Forward log lines to renderer for the live tail viewer
  logger.on('line', (line) => {
    if (configWindow && !configWindow.isDestroyed()) {
      configWindow.webContents.send('bridge:log-line', line);
    }
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
  logger.info(`[Boot] Accurate Bridge starting (hidden=${isHiddenLaunch()})`);

  // Always register auto-start unless user opts out
  registerStartup(app, true);

  printWorker = new PrintWorker({ logger });
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
  });
  jobQueue.on('failed', (job) => {
    notifySlotEvent('failed', { slotId: job.slot.id, error: job.error });
    if (Notification.isSupported()) {
      new Notification({
        title: 'Accurate Bridge — print failed',
        body: `${job.slot.name}: ${job.error}`,
      }).show();
    }
  });

  const archiveRoot = path.join(__dirname, 'received');
  slotManager = new SlotManager({ incomingRoot, archiveRoot, logger, jobQueue });
  slotManager.on('file', ({ slot, info }) => {
    notifySlotEvent('file', { slotId: slot.id, callingAE: info.callingAE, sopInstanceUid: info.sopInstanceUid });
  });
  slotManager.on('slot-error', ({ slot, error }) => {
    notifySlotEvent('slot-error', { slotId: slot.id, error });
  });

  setupTray();
  setupIpc();

  await applyConfig();

  if (!isHiddenLaunch()) openConfigWindow();
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
