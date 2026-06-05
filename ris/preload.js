const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('risAPI', {
    getConfig: () => ipcRenderer.invoke('ris:get-config'),
    getLicenseStatus: () => ipcRenderer.invoke('ris:get-license-status'),
    activateLicense: (key) => ipcRenderer.invoke('ris:activate-license', key),
    validateLicense: () => ipcRenderer.invoke('ris:validate-license'),
    deactivateLicense: () => ipcRenderer.invoke('ris:deactivate-license'),
    getFingerprint: () => ipcRenderer.invoke('ris:get-fingerprint'),
});
