/**
 * Preload script - Exposes safe APIs to the renderer process
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    isElectron: true,
    isDesktop: true,
    platform: process.platform,
    versions: {
        electron: process.versions.electron,
        node: process.versions.node,
        chrome: process.versions.chrome
    },

    // Printer APIs
    getSystemPrinters: () => ipcRenderer.invoke('get-system-printers'),
    printToPrinter: (options) => ipcRenderer.invoke('print-to-printer', options),
    printCurrentToPrinter: (options) => ipcRenderer.invoke('print-current-to-printer', options),
    focusMainWindow: () => ipcRenderer.invoke('focus-main-window'),

    // Auto-login credentials
    saveCredentials: (credentials) => ipcRenderer.invoke('save-credentials', credentials),
    getCredentials: () => ipcRenderer.invoke('get-credentials'),
    clearCredentials: () => ipcRenderer.invoke('clear-credentials'),
    hasAutoLoginCredentials: () => ipcRenderer.invoke('has-credentials'),

    // DICOM File Server
    getDicomPort: () => ipcRenderer.invoke('get-dicom-port'),

    // Network DICOM Receiver
    invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
    on: (channel, callback) => ipcRenderer.on(channel, callback),
    off: (channel, callback) => ipcRenderer.off(channel, callback)
});
