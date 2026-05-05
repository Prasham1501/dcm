/**
 * Bridge preload — exposes a small typed API to the renderer via contextBridge.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bridgeAPI', {
  isElectron: true,
  platform: process.platform,

  // Config
  getConfig: () => ipcRenderer.invoke('bridge:get-config'),
  setStartupBehavior: (mode) => ipcRenderer.invoke('bridge:set-startup-behavior', mode),
  upsertSlot: (slot) => ipcRenderer.invoke('bridge:upsert-slot', slot),
  removeSlot: (slotId) => ipcRenderer.invoke('bridge:remove-slot', slotId),
  newSlot: () => ipcRenderer.invoke('bridge:new-slot'),
  applyConfig: () => ipcRenderer.invoke('bridge:apply-config'),

  // Printers
  getSystemPrinters: () => ipcRenderer.invoke('bridge:get-system-printers'),

  // Status
  getSlotStatus: () => ipcRenderer.invoke('bridge:get-slot-status'),
  getStartupStatus: () => ipcRenderer.invoke('bridge:get-startup-status'),

  // Logs
  getLogTail: (n) => ipcRenderer.invoke('bridge:get-log-tail', n),
  onLogLine: (callback) => {
    const sub = (_event, line) => callback(line);
    ipcRenderer.on('bridge:log-line', sub);
    return () => ipcRenderer.removeListener('bridge:log-line', sub);
  },
  onSlotEvent: (callback) => {
    const sub = (_event, evt) => callback(evt);
    ipcRenderer.on('bridge:slot-event', sub);
    return () => ipcRenderer.removeListener('bridge:slot-event', sub);
  },

  // Window
  hideToTray: () => ipcRenderer.invoke('bridge:hide-to-tray'),
  quitApp: () => ipcRenderer.invoke('bridge:quit-app'),

  // Branding
  saveBranding: (branding) => ipcRenderer.invoke('bridge:save-branding', branding),
  pickAndEncodeLogo: () => ipcRenderer.invoke('bridge:pick-and-encode-logo'),
});
