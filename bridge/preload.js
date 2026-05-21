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
  // Local LAN IPv4(s) so the user can show modalities where to send DICOM.
  getLocalIps: () => ipcRenderer.invoke('bridge:get-local-ips'),

  // Logs
  getLogTail: (n) => ipcRenderer.invoke('bridge:get-log-tail', n),
  getSlotHistory: (q) => ipcRenderer.invoke('bridge:get-slot-history', q),

  // Per-slot print quota
  setSlotQuota: (q) => ipcRenderer.invoke('bridge:set-slot-quota', q),
  onConfigChanged: (cb) => {
    const sub = (_e, cfg) => cb(cfg);
    ipcRenderer.on('bridge:config-changed', sub);
    return () => ipcRenderer.removeListener('bridge:config-changed', sub);
  },
  onOpenQuotaSettings: (cb) => {
    const sub = () => cb();
    ipcRenderer.on('bridge:open-quota-settings', sub);
    return () => ipcRenderer.removeListener('bridge:open-quota-settings', sub);
  },
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

  // License management
  getLicenseStatus: () => ipcRenderer.invoke('bridge:get-license-status'),
  activateLicense: (key) => ipcRenderer.invoke('bridge:activate-license', key),
  validateLicense: () => ipcRenderer.invoke('bridge:validate-license'),
  deactivateLicense: () => ipcRenderer.invoke('bridge:deactivate-license'),
  getTrialInfo: () => ipcRenderer.invoke('bridge:get-trial-info'),
  getFingerprint: () => ipcRenderer.invoke('bridge:get-fingerprint'),

  // Branding
  saveBranding: (branding) => ipcRenderer.invoke('bridge:save-branding', branding),
  pickAndEncodeLogo: () => ipcRenderer.invoke('bridge:pick-and-encode-logo'),

  // Auto-update — admin uploads a Bridge release on the website; we poll
  // /release/check, surface a system notification, and show a non-dismissible
  // modal in the config window when force_update is on.
  checkForUpdate:           () => ipcRenderer.invoke('bridge:check-for-update'),
  getUpdateInfo:            () => ipcRenderer.invoke('bridge:get-update-info'),
  downloadAndInstallUpdate: (downloadUrl) => ipcRenderer.invoke('bridge:download-and-install-update', { downloadUrl }),
  onUpdateInfo: (callback) => {
    const sub = (_e, info) => callback(info);
    ipcRenderer.on('bridge:update-info', sub);
    return () => ipcRenderer.removeListener('bridge:update-info', sub);
  },
});
