// Settings Manager Component
window.DICOM_VIEWER.SettingsManager = {
    settings: {
        // Display Settings
        theme: 'dark',
        showOverlay: true,
        showMeasurements: true,
        interpolation: 1, // 0=Nearest, 1=Linear, 2=Cubic
        
        // Performance Settings
        cacheSize: 500, // MB
        maxConcurrentLoads: 3,
        imageQuality: 'high', // low, medium, high
        
        // MPR Settings
        mprQuality: 'medium', // low, medium, high
        mprAutoLoad: true,
        
        // Mouse Controls
        zoomSensitivity: 1.0,
        panSensitivity: 1.0,
        wlSensitivity: 1.0,
        invertMouseWheel: false,
        
        // Keyboard Shortcuts
        keyboardEnabled: true,
        
        // Auto-save Settings
        autoSaveReports: true,
        autoSaveInterval: 30, // seconds
        
        // Export Settings
        exportFormat: 'png', // png, jpg
        exportQuality: 0.95,
        includeOverlays: true,
        
        // Advanced
        debugMode: false,
        showFPS: false,
        logErrors: true
    },

    initialize() {
        console.log('Initializing Settings Manager...');
        this.loadSettings();
        this.setupSettingsButton();
        this.createSettingsModal();
    },

    setupSettingsButton() {
        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                this.openSettings();
            });
        }
    },

    createSettingsModal() {
        const modalHTML = `
        <div class="modal fade" id="settingsModal" tabindex="-1" data-bs-backdrop="static">
            <div class="modal-dialog modal-lg modal-dialog-scrollable">
                <div class="modal-content bg-dark text-light">
                    <div class="modal-header border-secondary">
                        <h5 class="modal-title">
                            <i class="bi bi-gear-fill me-2"></i>Settings
                        </h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <!-- Tabs -->
                        <ul class="nav nav-tabs mb-3" role="tablist">
                            <li class="nav-item">
                                <button class="nav-link active" data-bs-toggle="tab" data-bs-target="#displayTab">
                                    <i class="bi bi-display"></i> Display
                                </button>
                            </li>
                            <li class="nav-item">
                                <button class="nav-link" data-bs-toggle="tab" data-bs-target="#performanceTab">
                                    <i class="bi bi-speedometer2"></i> Performance
                                </button>
                            </li>
                            <li class="nav-item">
                                <button class="nav-link" data-bs-toggle="tab" data-bs-target="#controlsTab">
                                    <i class="bi bi-mouse"></i> Controls
                                </button>
                            </li>
                            <li class="nav-item">
                                <button class="nav-link" data-bs-toggle="tab" data-bs-target="#exportTab">
                                    <i class="bi bi-download"></i> Export
                                </button>
                            </li>
                            <li class="nav-item">
                                <button class="nav-link" data-bs-toggle="tab" data-bs-target="#advancedTab">
                                    <i class="bi bi-tools"></i> Advanced
                                </button>
                            </li>
                        </ul>

                        <!-- Tab Content -->
                        <div class="tab-content">
                            <!-- Display Tab -->
                            <div class="tab-pane fade show active" id="displayTab">
                                ${this.createDisplaySettings()}
                            </div>

                            <!-- Performance Tab -->
                            <div class="tab-pane fade" id="performanceTab">
                                ${this.createPerformanceSettings()}
                            </div>

                            <!-- Controls Tab -->
                            <div class="tab-pane fade" id="controlsTab">
                                ${this.createControlsSettings()}
                            </div>

                            <!-- Export Tab -->
                            <div class="tab-pane fade" id="exportTab">
                                ${this.createExportSettings()}
                            </div>

                            <!-- Advanced Tab -->
                            <div class="tab-pane fade" id="advancedTab">
                                ${this.createAdvancedSettings()}
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer border-secondary">
                        <button type="button" class="btn btn-secondary" id="resetSettingsBtn">
                            <i class="bi bi-arrow-counterclockwise"></i> Reset to Default
                        </button>
                        <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-primary" id="saveSettingsBtn">
                            <i class="bi bi-check-lg"></i> Save Settings
                        </button>
                    </div>
                </div>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.attachEventListeners();
    },

    createDisplaySettings() {
        return `
        <div class="settings-section">
            <h6 class="text-info mb-3"><i class="bi bi-palette"></i> Appearance</h6>
            
            <div class="mb-3">
                <label class="form-label">Image Interpolation</label>
                <select class="form-select" id="setting-interpolation">
                    <option value="0">Nearest Neighbor (Pixelated)</option>
                    <option value="1">Linear (Balanced)</option>
                    <option value="2">Cubic (Smooth)</option>
                </select>
                <small class="text-muted">Image smoothing method</small>
            </div>

            <div class="form-check form-switch mb-3">
                <input class="form-check-input" type="checkbox" id="setting-showOverlay">
                <label class="form-check-label">Show Image Overlay Info</label>
                <small class="text-muted d-block">Display patient info and measurements on images</small>
            </div>

            <div class="form-check form-switch mb-3">
                <input class="form-check-input" type="checkbox" id="setting-showMeasurements">
                <label class="form-check-label">Show Measurements</label>
                <small class="text-muted d-block">Display measurement annotations</small>
            </div>

            <h6 class="text-info mb-3 mt-4"><i class="bi bi-layers"></i> MPR Settings</h6>
            
            <div class="mb-3">
                <label class="form-label">MPR Quality</label>
                <select class="form-select" id="setting-mprQuality">
                    <option value="low">Low (Fast)</option>
                    <option value="medium">Medium (Balanced)</option>
                    <option value="high">High (Slow)</option>
                </select>
                <small class="text-muted">Higher quality = slower processing</small>
            </div>

            <div class="form-check form-switch mb-3">
                <input class="form-check-input" type="checkbox" id="setting-mprAutoLoad">
                <label class="form-check-label">Auto-load MPR for Multi-slice Series</label>
                <small class="text-muted d-block">Automatically build MPR volume when loading series</small>
            </div>
        </div>`;
    },

    createPerformanceSettings() {
        return `
        <div class="settings-section">
            <h6 class="text-info mb-3"><i class="bi bi-lightning"></i> Cache & Memory</h6>
            
            <div class="mb-3">
                <label class="form-label">
                    Image Cache Size: <span id="cacheSizeLabel">500</span> MB
                </label>
                <input type="range" class="form-range" id="setting-cacheSize" 
                       min="100" max="2000" step="100" value="500">
                <small class="text-muted">Amount of RAM for caching images (requires page reload)</small>
            </div>

            <div class="mb-3">
                <label class="form-label">
                    Max Concurrent Image Loads: <span id="concurrentLoadsLabel">3</span>
                </label>
                <input type="range" class="form-range" id="setting-maxConcurrentLoads" 
                       min="1" max="10" step="1" value="3">
                <small class="text-muted">Number of images loaded simultaneously</small>
            </div>

            <div class="mb-3">
                <label class="form-label">Image Quality</label>
                <select class="form-select" id="setting-imageQuality">
                    <option value="low">Low (Faster)</option>
                    <option value="medium">Medium</option>
                    <option value="high">High (Slower)</option>
                </select>
                <small class="text-muted">Rendering quality vs performance</small>
            </div>

            <h6 class="text-info mb-3 mt-4"><i class="bi bi-info-circle"></i> System Info</h6>
            <div class="alert alert-info">
                <div class="row">
                    <div class="col-6">
                        <strong>Browser:</strong><br>
                        <small id="browserInfo">Loading...</small>
                    </div>
                    <div class="col-6">
                        <strong>Memory Usage:</strong><br>
                        <small id="memoryInfo">Loading...</small>
                    </div>
                </div>
                <div class="row mt-2">
                    <div class="col-6">
                        <strong>Cache Status:</strong><br>
                        <small id="cacheInfo">Loading...</small>
                    </div>
                    <div class="col-6">
                        <strong>Images Loaded:</strong><br>
                        <small id="imagesInfo">0</small>
                    </div>
                </div>
            </div>

            <button class="btn btn-warning btn-sm" id="clearCacheBtn">
                <i class="bi bi-trash"></i> Clear Image Cache
            </button>
        </div>`;
    },

    createControlsSettings() {
        return `
        <div class="settings-section">
            <h6 class="text-info mb-3"><i class="bi bi-mouse2"></i> Mouse Controls</h6>
            
            <div class="mb-3">
                <label class="form-label">
                    Zoom Sensitivity: <span id="zoomSensLabel">1.0</span>x
                </label>
                <input type="range" class="form-range" id="setting-zoomSensitivity" 
                       min="0.5" max="2.0" step="0.1" value="1.0">
                <small class="text-muted">Mouse wheel zoom speed</small>
            </div>

            <div class="mb-3">
                <label class="form-label">
                    Pan Sensitivity: <span id="panSensLabel">1.0</span>x
                </label>
                <input type="range" class="form-range" id="setting-panSensitivity" 
                       min="0.5" max="2.0" step="0.1" value="1.0">
                <small class="text-muted">Middle-click pan speed</small>
            </div>

            <div class="mb-3">
                <label class="form-label">
                    Window/Level Sensitivity: <span id="wlSensLabel">1.0</span>x
                </label>
                <input type="range" class="form-range" id="setting-wlSensitivity" 
                       min="0.5" max="2.0" step="0.1" value="1.0">
                <small class="text-muted">Right-click W/L adjustment speed</small>
            </div>

            <div class="form-check form-switch mb-3">
                <input class="form-check-input" type="checkbox" id="setting-invertMouseWheel">
                <label class="form-check-label">Invert Mouse Wheel Zoom</label>
                <small class="text-muted d-block">Reverse zoom direction</small>
            </div>

            <h6 class="text-info mb-3 mt-4"><i class="bi bi-keyboard"></i> Keyboard Shortcuts</h6>
            
            <div class="form-check form-switch mb-3">
                <input class="form-check-input" type="checkbox" id="setting-keyboardEnabled">
                <label class="form-check-label">Enable Keyboard Shortcuts</label>
            </div>

            <div class="alert alert-secondary">
                <strong>Available Shortcuts:</strong><br>
                <small>
                    <kbd>←</kbd> <kbd>→</kbd> Navigate images<br>
                    <kbd>Ctrl</kbd>+<kbd>R</kbd> Create report<br>
                    <kbd>T</kbd> Toggle layout<br>
                    <kbd>R</kbd> Reset viewport<br>
                    <kbd>I</kbd> Invert image<br>
                    <kbd>F</kbd> Flip horizontal<br>
                    <kbd>Space</kbd> Play/Pause cine
                </small>
            </div>
        </div>`;
    },

    createExportSettings() {
        return `
        <div class="settings-section">
            <h6 class="text-info mb-3"><i class="bi bi-file-earmark-image"></i> Export Preferences</h6>
            
            <div class="mb-3">
                <label class="form-label">Default Export Format</label>
                <select class="form-select" id="setting-exportFormat">
                    <option value="png">PNG (Lossless)</option>
                    <option value="jpg">JPEG (Smaller file)</option>
                </select>
                <small class="text-muted">Format for "Export as Image"</small>
            </div>

            <div class="mb-3">
                <label class="form-label">
                    JPEG Quality: <span id="exportQualityLabel">95</span>%
                </label>
                <input type="range" class="form-range" id="setting-exportQuality" 
                       min="0.5" max="1.0" step="0.05" value="0.95">
                <small class="text-muted">Only applies to JPEG exports</small>
            </div>

            <div class="form-check form-switch mb-3">
                <input class="form-check-input" type="checkbox" id="setting-includeOverlays">
                <label class="form-check-label">Include Overlays in Exports</label>
                <small class="text-muted d-block">Export images with measurements and annotations</small>
            </div>

            <h6 class="text-info mb-3 mt-4"><i class="bi bi-save"></i> Auto-save</h6>
            
            <div class="form-check form-switch mb-3">
                <input class="form-check-input" type="checkbox" id="setting-autoSaveReports">
                <label class="form-check-label">Auto-save Reports</label>
                <small class="text-muted d-block">Automatically save draft reports</small>
            </div>

            <div class="mb-3">
                <label class="form-label">
                    Auto-save Interval: <span id="autoSaveLabel">30</span> seconds
                </label>
                <input type="range" class="form-range" id="setting-autoSaveInterval" 
                       min="10" max="300" step="10" value="30">
                <small class="text-muted">How often to auto-save drafts</small>
            </div>
        </div>`;
    },

    createAdvancedSettings() {
        return `
        <div class="settings-section">
            <h6 class="text-info mb-3"><i class="bi bi-bug"></i> Developer Options</h6>
            
            <div class="form-check form-switch mb-3">
                <input class="form-check-input" type="checkbox" id="setting-debugMode">
                <label class="form-check-label">Debug Mode</label>
                <small class="text-muted d-block">Show detailed console logs</small>
            </div>

            <div class="form-check form-switch mb-3">
                <input class="form-check-input" type="checkbox" id="setting-showFPS">
                <label class="form-check-label">Show FPS Counter</label>
                <small class="text-muted d-block">Display frames per second</small>
            </div>

            <div class="form-check form-switch mb-3">
                <input class="form-check-input" type="checkbox" id="setting-logErrors">
                <label class="form-check-label">Log Errors to Console</label>
                <small class="text-muted d-block">Enable error logging</small>
            </div>

            <h6 class="text-info mb-3 mt-4"><i class="bi bi-database"></i> Data Management</h6>
            
            <div class="alert alert-warning">
                <strong>⚠️ Danger Zone</strong><br>
                <small>These actions cannot be undone!</small>
            </div>

            <div class="d-grid gap-2">
                <button class="btn btn-outline-warning" id="clearLocalStorageBtn">
                    <i class="bi bi-trash"></i> Clear Browser Storage
                </button>
                <button class="btn btn-outline-danger" id="resetAllBtn">
                    <i class="bi bi-exclamation-triangle"></i> Reset Everything & Reload
                </button>
            </div>

            <h6 class="text-info mb-3 mt-4"><i class="bi bi-info-circle"></i> About</h6>
            <div class="alert alert-secondary">
                <strong>DICOM Viewer Pro</strong><br>
                <small>
                    Version: 2.0.0<br>
                    Build: Enhanced MPR<br>
                    Engine: Cornerstone.js 2.6.1<br>
                    <br>
                    <a href="https://github.com/cornerstonejs/cornerstone" target="_blank" class="text-info">
                        <i class="bi bi-box-arrow-up-right"></i> Cornerstone Documentation
                    </a>
                </small>
            </div>
        </div>`;
    },

    attachEventListeners() {
        // Range sliders with live labels
        const rangeInputs = {
            'setting-cacheSize': 'cacheSizeLabel',
            'setting-maxConcurrentLoads': 'concurrentLoadsLabel',
            'setting-zoomSensitivity': 'zoomSensLabel',
            'setting-panSensitivity': 'panSensLabel',
            'setting-wlSensitivity': 'wlSensLabel',
            'setting-exportQuality': 'exportQualityLabel',
            'setting-autoSaveInterval': 'autoSaveLabel'
        };

        Object.entries(rangeInputs).forEach(([inputId, labelId]) => {
            const input = document.getElementById(inputId);
            const label = document.getElementById(labelId);
            if (input && label) {
                input.addEventListener('input', (e) => {
                    let value = e.target.value;
                    if (inputId === 'setting-exportQuality') {
                        value = Math.round(value * 100);
                    }
                    label.textContent = value;
                });
            }
        });

        // Save settings button
        document.getElementById('saveSettingsBtn')?.addEventListener('click', () => {
            this.saveSettings();
        });

        // Reset settings button
        document.getElementById('resetSettingsBtn')?.addEventListener('click', () => {
            if (confirm('Reset all settings to default values?')) {
                this.resetSettings();
            }
        });

        // Clear cache button
        document.getElementById('clearCacheBtn')?.addEventListener('click', () => {
            this.clearCache();
        });

        // Clear local storage
        document.getElementById('clearLocalStorageBtn')?.addEventListener('click', () => {
            if (confirm('Clear all browser storage? This will remove saved preferences.')) {
                localStorage.clear();
                sessionStorage.clear();
                alert('Browser storage cleared!');
            }
        });

        // Reset everything
        document.getElementById('resetAllBtn')?.addEventListener('click', () => {
            if (confirm('Reset EVERYTHING and reload? This will clear all settings and cache!')) {
                localStorage.clear();
                sessionStorage.clear();
                if (cornerstone.imageCache) {
                    cornerstone.imageCache.purgeCache();
                }
                location.reload();
            }
        });
    },

    openSettings() {
        console.log('Opening settings...');
        this.loadSettingsIntoForm();
        this.updateSystemInfo();
        
        const modal = new bootstrap.Modal(document.getElementById('settingsModal'));
        modal.show();
    },

    loadSettingsIntoForm() {
        // Load each setting into the form
        Object.keys(this.settings).forEach(key => {
            const element = document.getElementById(`setting-${key}`);
            if (element) {
                if (element.type === 'checkbox') {
                    element.checked = this.settings[key];
                } else {
                    element.value = this.settings[key];
                }
                
                // Trigger input event to update labels
                element.dispatchEvent(new Event('input'));
            }
        });
    },

    saveSettings() {
        console.log('Saving settings...');
        
        // Read all settings from form
        Object.keys(this.settings).forEach(key => {
            const element = document.getElementById(`setting-${key}`);
            if (element) {
                if (element.type === 'checkbox') {
                    this.settings[key] = element.checked;
                } else if (element.type === 'range') {
                    this.settings[key] = parseFloat(element.value);
                } else {
                    this.settings[key] = element.value;
                }
            }
        });

        // Save to localStorage
        localStorage.setItem('dicomViewerSettings', JSON.stringify(this.settings));
        
        // Apply settings
        this.applySettings();
        
        // Close modal
        bootstrap.Modal.getInstance(document.getElementById('settingsModal')).hide();
        
        window.DICOM_VIEWER.showAISuggestion('Settings saved successfully!');
    },

    loadSettings() {
        const saved = localStorage.getItem('dicomViewerSettings');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                this.settings = { ...this.settings, ...parsed };
                console.log('Settings loaded from storage');
            } catch (error) {
                console.error('Error loading settings:', error);
            }
        }
        
        // Apply loaded settings
        this.applySettings();
    },

    applySettings() {
        console.log('Applying settings...', this.settings);
        
        // Apply interpolation
        const interpolationSelect = document.getElementById('interpolationSelect');
        if (interpolationSelect) {
            interpolationSelect.value = this.settings.interpolation;
            window.DICOM_VIEWER.changeInterpolation({ target: interpolationSelect });
        }
        
        // Apply MPR quality
        const mprQualitySelect = document.getElementById('mprQuality');
        if (mprQualitySelect) {
            mprQualitySelect.value = this.settings.mprQuality;
        }
        
        // Apply cache size
        if (cornerstone.imageCache) {
            const cacheSizeBytes = this.settings.cacheSize * 1024 * 1024;
            cornerstone.imageCache.setMaximumSizeBytes(cacheSizeBytes);
            console.log(`Cache size set to ${this.settings.cacheSize}MB`);
        }
        
        // Apply debug mode
        if (this.settings.debugMode) {
            window.DICOM_VIEWER.DEBUG_MODE = true;
        }
    },

    resetSettings() {
        // Reset to defaults
        this.settings = {
            theme: 'dark',
            showOverlay: true,
            showMeasurements: true,
            interpolation: 1,
            cacheSize: 500,
            maxConcurrentLoads: 3,
            imageQuality: 'high',
            mprQuality: 'medium',
            mprAutoLoad: true,
            zoomSensitivity: 1.0,
            panSensitivity: 1.0,
            wlSensitivity: 1.0,
            invertMouseWheel: false,
            keyboardEnabled: true,
            autoSaveReports: true,
            autoSaveInterval: 30,
            exportFormat: 'png',
            exportQuality: 0.95,
            includeOverlays: true,
            debugMode: false,
            showFPS: false,
            logErrors: true
        };
        
        localStorage.removeItem('dicomViewerSettings');
        this.loadSettingsIntoForm();
        this.applySettings();
        
        window.DICOM_VIEWER.showAISuggestion('Settings reset to default');
    },

    clearCache() {
        if (cornerstone.imageCache) {
            cornerstone.imageCache.purgeCache();
            window.DICOM_VIEWER.showAISuggestion('Image cache cleared!');
        }
    },

    updateSystemInfo() {
        // Browser info
        const browserInfo = document.getElementById('browserInfo');
        if (browserInfo) {
            browserInfo.textContent = navigator.userAgent.split(' ').pop();
        }
        
        // Memory info (if available)
        if (performance.memory) {
            const memoryInfo = document.getElementById('memoryInfo');
            if (memoryInfo) {
                const used = (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(1);
                const total = (performance.memory.totalJSHeapSize / 1024 / 1024).toFixed(1);
                memoryInfo.textContent = `${used} MB / ${total} MB`;
            }
        }
        
        // Cache info
        if (cornerstone.imageCache) {
            const cacheInfo = document.getElementById('cacheInfo');
            if (cacheInfo) {
                const stats = cornerstone.imageCache.getCacheInfo();
                const used = (stats.cacheSizeInBytes / 1024 / 1024).toFixed(1);
                const max = (stats.maximumSizeInBytes / 1024 / 1024).toFixed(1);
                cacheInfo.textContent = `${used} MB / ${max} MB`;
            }
        }
        
        // Images loaded
        const imagesInfo = document.getElementById('imagesInfo');
        if (imagesInfo && window.DICOM_VIEWER.STATE) {
            imagesInfo.textContent = window.DICOM_VIEWER.STATE.totalImages || 0;
        }
    },

    getSetting(key) {
        return this.settings[key];
    },

    setSetting(key, value) {
        this.settings[key] = value;
        localStorage.setItem('dicomViewerSettings', JSON.stringify(this.settings));
        this.applySettings();
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    if (window.DICOM_VIEWER && window.DICOM_VIEWER.SettingsManager) {
        setTimeout(() => {
            window.DICOM_VIEWER.SettingsManager.initialize();
        }, 1500);
    }
});

console.log('Settings Manager module loaded');
