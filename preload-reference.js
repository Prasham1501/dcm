/**
 * Preload script - runs before web page loads
 * Exposes safe APIs to the renderer process
 */

console.error('========================================');
console.error('[PRELOAD] SCRIPT IS RUNNING!!!');
console.error('========================================');

const { contextBridge, ipcRenderer } = require('electron');

console.error('[Preload] Script starting...');
console.error('[Preload] contextBridge available:', !!contextBridge);
console.error('[Preload] ipcRenderer available:', !!ipcRenderer);

// Expose safe APIs to the renderer
contextBridge.exposeInMainWorld('electronAPI', {
    // App info
    isElectron: true,
    isDesktop: true,

    // Platform info
    platform: process.platform,

    // Version info
    versions: {
        electron: process.versions.electron,
        node: process.versions.node,
        chrome: process.versions.chrome
    },

    // ============================================
    // Printer APIs for Custom Print Dialog
    // ============================================

    /**
     * Get list of system printers
     * @returns {Promise<{success: boolean, printers: Array, error?: string}>}
     */
    getSystemPrinters: () => ipcRenderer.invoke('get-system-printers'),

    /**
     * Print HTML content to a specific printer
     * @param {Object} options - Print options
     * @param {string} options.printerName - Name of the printer (use 'default' for system default)
     * @param {string} options.htmlContent - Full HTML document to print
     * @param {Object} options.printSettings - Print settings (paperSize, orientation, colorMode, copies)
     * @returns {Promise<{success: boolean, message?: string, error?: string}>}
     */
    printToPrinter: (options) => ipcRenderer.invoke('print-to-printer', options),

    /**
     * Print current window content to a specific printer
     * @param {Object} options - Print options
     * @param {string} options.printerName - Name of the printer
     * @param {Object} options.printSettings - Print settings
     * @returns {Promise<{success: boolean, message?: string, error?: string}>}
     */
    printCurrentToPrinter: (options) => ipcRenderer.invoke('print-current-to-printer', options),

    /**
     * Bring main window to front (useful when showing modals from child windows)
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    focusMainWindow: () => ipcRenderer.invoke('focus-main-window'),

    // ============================================
    // Auto-Login / Session Persistence APIs
    // ============================================

    /**
     * Save login credentials for auto-login on next app start
     * @param {Object} credentials - { username, passwordHash (or token), userId }
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    saveCredentials: (credentials) => ipcRenderer.invoke('save-credentials', credentials),

    /**
     * Get saved credentials for auto-login
     * @returns {Promise<{success: boolean, credentials?: Object, error?: string}>}
     */
    getCredentials: () => ipcRenderer.invoke('get-credentials'),

    /**
     * Clear saved credentials (on logout)
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    clearCredentials: () => ipcRenderer.invoke('clear-credentials'),

    /**
     * Check if auto-login credentials exist
     * @returns {Promise<{success: boolean, hasCredentials: boolean}>}
     */
    hasAutoLoginCredentials: () => ipcRenderer.invoke('has-credentials')
});

console.error('[Preload] electronAPI exposed to window');
console.error('[Preload] DICOM Viewer Desktop APIs loaded (with Printer support)');
console.error('========================================');
console.error('[PRELOAD] SCRIPT COMPLETED SUCCESSFULLY!!!');
console.error('========================================');
