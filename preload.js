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
    printReportDialog: (options) => ipcRenderer.invoke('print-report-dialog', options),
    focusMainWindow: () => ipcRenderer.invoke('focus-main-window'),

    // Auto-login credentials
    saveCredentials: (credentials) => ipcRenderer.invoke('save-credentials', credentials),
    getCredentials: () => ipcRenderer.invoke('get-credentials'),
    clearCredentials: () => ipcRenderer.invoke('clear-credentials'),
    hasAutoLoginCredentials: () => ipcRenderer.invoke('has-credentials'),

    // License management
    getLicenseStatus: () => ipcRenderer.invoke('get-license-status'),
    activateLicense: (key) => ipcRenderer.invoke('activate-license', key),
    validateLicense: () => ipcRenderer.invoke('validate-license'),
    deactivateLicense: () => ipcRenderer.invoke('deactivate-license'),
    getTrialInfo: () => ipcRenderer.invoke('get-trial-info'),
    getFingerprint: () => ipcRenderer.invoke('get-fingerprint'),

    // DICOM File Server
    getDicomPort: () => ipcRenderer.invoke('get-dicom-port'),

    // CR Viewer popup
    openCRViewer: (params) => ipcRenderer.invoke('open-cr-viewer', params),

    // Main Viewer popup
    openViewer: (params) => ipcRenderer.invoke('open-viewer', params),

    // Viewer + Report Editor side-by-side
    openViewerWithReport: (params) => ipcRenderer.invoke('open-viewer-with-report', params),

    // Standalone Report Editor window
    openReportEditor: () => ipcRenderer.invoke('open-report-editor'),

    // Resize viewer windows when layout changes
    resizeCRViewer: (params) => ipcRenderer.invoke('resize-cr-viewer', params),
    resizeViewer: (params) => ipcRenderer.invoke('resize-viewer', params),

    // Network DICOM Receiver
    getNetworkDicomPath: () => ipcRenderer.invoke('get-network-dicom-path'),
    setNetworkDicomPath: (newPath) => ipcRenderer.invoke('set-network-dicom-path', newPath),
    restartNetworkReceiver: () => ipcRenderer.invoke('restart-network-receiver'),
    getReceivedDicomFiles: () => ipcRenderer.invoke('get-received-dicom-files'),
    openFolder: (folderPath) => ipcRenderer.invoke('open-folder', folderPath),

    // DICOM Send
    dicomSendToDestination: (params) => ipcRenderer.invoke('dicom-send-to-destination', params),
    dicomEcho: (params) => ipcRenderer.invoke('dicom-echo', params),

    // Generic IPC (fallback)
    invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
    on: (channel, callback) => {
        const sub = (_event, ...args) => callback(...args);
        ipcRenderer.on(channel, sub);
        return () => ipcRenderer.removeListener(channel, sub);
    },
    off: (channel, callback) => ipcRenderer.removeListener(channel, callback)
});
