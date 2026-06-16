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

    // Print-quota (sell-by-print). Backed by /license/quota on the website.
    getLicenseQuota: () => ipcRenderer.invoke('get-license-quota'),
    decrementLicenseQuota: (pages) => ipcRenderer.invoke('decrement-license-quota', { pages }),
    setLicenseQuota: (opts) => ipcRenderer.invoke('set-license-quota', opts),
    onOpenQuotaSettings: (cb) => {
      const sub = () => cb();
      ipcRenderer.on('mv:open-quota-settings', sub);
      return () => ipcRenderer.removeListener('mv:open-quota-settings', sub);
    },

    // Print/AI wallet — same wallet the dashboard reads, so the two stay in sync.
    getWalletBalance: (type = 'print')         => ipcRenderer.invoke('wallet-balance', { type }),
    spendWalletCredits: (credits, type = 'print', meta = '') =>
                                                  ipcRenderer.invoke('wallet-spend', { type, credits, meta }),

    // Auto-update — admin uploads a release on the website, every desktop
    // polls on launch + every 30 min and shows a forced modal if needed.
    checkForUpdate:        () => ipcRenderer.invoke('check-for-update'),
    getUpdateInfo:         () => ipcRenderer.invoke('get-update-info'),
    downloadAndInstallUpdate: (downloadUrl) => ipcRenderer.invoke('download-and-install-update', { downloadUrl }),
    onUpdateInfo: (callback) => {
      const sub = (_e, info) => callback(info);
      ipcRenderer.on('update-info', sub);
      return () => ipcRenderer.removeListener('update-info', sub);
    },

    // DICOM File Server
    getDicomPort: () => ipcRenderer.invoke('get-dicom-port'),
    dicomAccessToken: ipcRenderer.sendSync('get-dicom-access-token'),
    // Authorize a study's file paths before the renderer loads its images.
    // Sync so the allow-list is updated before any serve-file request fires.
    authorizeDicomPaths: (paths) => ipcRenderer.sendSync('authorize-dicom-paths-sync', paths),

    // CR Viewer popup
    openCRViewer: (params) => ipcRenderer.invoke('open-cr-viewer', params),

    // Main Viewer popup
    openViewer: (params) => ipcRenderer.invoke('open-viewer', params),

    // 3D Volume Viewer popup
    openVolumeViewer: (params) => ipcRenderer.invoke('open-volume-viewer', params),

    // 3D Volume Viewer in the system default browser (renders identically to
    // Electron but uses the OS browser's GPU pipeline). Works offline — the
    // payload is handed off via a temp file served over localhost.
    openVolumeInBrowser: (payload) => ipcRenderer.invoke('open-volume-in-browser', payload),

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

    // File/import helpers
    showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
    readFileBuffer: (filePath) => ipcRenderer.invoke('read-file-buffer', filePath),
    listImageFiles: (folderPath) => ipcRenderer.invoke('list-image-files', folderPath),
    listDicomFiles: (folderPath) => ipcRenderer.invoke('list-dicom-files', folderPath),
    markPatientPrinted: (payload) => ipcRenderer.invoke('mark-patient-printed', payload),

    // OCR / metadata helpers
    ocrImageBase64: (payload) => ipcRenderer.invoke('ocr-image-base64', payload),
    extractDicomAllReadings: (payload) => ipcRenderer.invoke('extract-dicom-all-readings', payload),
    extractDicomText: (payload) => ipcRenderer.invoke('extract-dicom-text', payload),
    extractDicomMetadata: (payload) => ipcRenderer.invoke('extract-dicom-metadata', payload),
    ocrDicomFile: (payload) => ipcRenderer.invoke('ocr-dicom-file', payload),
    ocrDicomBatch: (payload) => ipcRenderer.invoke('ocr-dicom-batch', payload),

    onVolumeViewerReloadLaunch: (callback) => {
        const sub = () => callback();
        ipcRenderer.on('volume-viewer:reload-launch', sub);
        return () => ipcRenderer.removeListener('volume-viewer:reload-launch', sub);
    },
    onViewerReloadLaunch: (callback) => {
        const sub = () => callback();
        ipcRenderer.on('viewer:reload-launch', sub);
        return () => ipcRenderer.removeListener('viewer:reload-launch', sub);
    },
    onCRViewerReloadLaunch: (callback) => {
        const sub = () => callback();
        ipcRenderer.on('cr-viewer:reload-launch', sub);
        return () => ipcRenderer.removeListener('cr-viewer:reload-launch', sub);
    },
    onDicomFileReceived: (callback) => {
        const sub = (_event, data) => callback(data);
        ipcRenderer.on('dicom-file-received', sub);
        return () => ipcRenderer.removeListener('dicom-file-received', sub);
    },
    onPatientPrinted: (callback) => {
        const sub = (_event, data) => callback(data);
        ipcRenderer.on('patient-printed', sub);
        return () => ipcRenderer.removeListener('patient-printed', sub);
    }
});
