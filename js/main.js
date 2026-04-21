// Base path configuration
window.basePath = document.querySelector('meta[name="base-path"]')?.content || '';
window.baseUrl = document.querySelector('meta[name="base-url"]')?.content || window.location.origin;
console.log('Base Path:', window.basePath);
console.log('Base URL:', window.baseUrl);

document.addEventListener('DOMContentLoaded', function () {
    // Initialize managers namespace
    window.DICOM_VIEWER.MANAGERS = {};

    // PACS functionality removed - not in use
    // const urlParams = new URLSearchParams(window.location.search);
    // if (urlParams.get('source') === 'pacs') {
    //     loadImagesFromPACS();
    // }
    // addPACSSearchButton();

    try {
        // Initialize Cornerstone
        window.DICOM_VIEWER.CornerstoneInit.initialize();

        // Initialize managers
        window.DICOM_VIEWER.MANAGERS.enhancementManager = new window.DICOM_VIEWER.ImageEnhancementManager();
        window.DICOM_VIEWER.MANAGERS.viewportManager = new window.DICOM_VIEWER.MPRViewportManager();
        window.DICOM_VIEWER.MANAGERS.crosshairManager = new window.DICOM_VIEWER.CrosshairManager();
        window.DICOM_VIEWER.MANAGERS.mprManager = new window.DICOM_VIEWER.MPRManager();
        // Medical notes manager removed - script no longer loaded
        window.DICOM_VIEWER.MANAGERS.reportingSystem = new window.DICOM_VIEWER.ReportingSystem();
        window.DICOM_VIEWER.MANAGERS.mouseControls = new window.DICOM_VIEWER.MouseControlsManager();

        // ⬇️ INITIALIZE THE NEW MANAGER HERE ⬇️
        window.DICOM_VIEWER.MANAGERS.referenceLinesManager = new window.DICOM_VIEWER.ReferenceLinesManager();

        // Enable crosshairs by default
        window.DICOM_VIEWER.MANAGERS.crosshairManager.enable();
        console.log('Crosshairs enabled by default');


        window.DICOM_VIEWER.MANAGERS.reportingSystem.initialize();

        console.log('Modern DICOM Viewer managers initialized');

        // Initialize viewports with default layout
        window.DICOM_VIEWER.MANAGERS.viewportManager.createViewports('2x2');

        // Initialize components with individual error handling
        // This prevents one component failure from breaking the entire viewer

        // Upload Handler - may not be needed in Orthanc-only mode
        try {
            if (window.DICOM_VIEWER.UploadHandler && typeof window.DICOM_VIEWER.UploadHandler.initialize === 'function') {
                window.DICOM_VIEWER.UploadHandler.initialize();
            } else {
                console.log('Upload handler not available - this is OK for Orthanc-only mode');
            }
        } catch (uploadError) {
            console.warn('Upload handler initialization skipped:', uploadError.message);
            console.log('Viewer will continue without local upload functionality');
        }

        // UI Controls
        try {
            if (window.DICOM_VIEWER.UIControls && typeof window.DICOM_VIEWER.UIControls.initialize === 'function') {
                window.DICOM_VIEWER.UIControls.initialize();
            }
        } catch (uiError) {
            console.warn('UI controls initialization warning:', uiError.message);
        }

        // Event Handlers
        try {
            if (window.DICOM_VIEWER.EventHandlers && typeof window.DICOM_VIEWER.EventHandlers.initialize === 'function') {
                window.DICOM_VIEWER.EventHandlers.initialize();
            }
        } catch (eventError) {
            console.warn('Event handlers initialization warning:', eventError.message);
        }

        setTimeout(() => {
            try {
                if (window.DICOM_VIEWER.MANAGERS.mouseControls) {
                    window.DICOM_VIEWER.MANAGERS.mouseControls.initialize();
                }

                // ⬇️ START THE REFERENCE LINES MANAGER HERE ⬇️
                if (window.DICOM_VIEWER.MANAGERS.referenceLinesManager) {
                    window.DICOM_VIEWER.MANAGERS.referenceLinesManager.initialize();
                }
            } catch (delayedError) {
                console.warn('Delayed initialization warning:', delayedError.message);
            }
        }, 1500);

        // FIXED: Set initial active viewport with proper delay
        setTimeout(() => {
            const viewportManager = window.DICOM_VIEWER.MANAGERS.viewportManager;
            let initialViewport = viewportManager.getViewport('original');
            if (!initialViewport) {
                const allViewports = viewportManager.getAllViewports();
                initialViewport = allViewports[0];
            }

            if (initialViewport) {
                viewportManager.setActiveViewport(initialViewport);
                console.log('Initial active viewport set successfully');
            } else {
                console.error('No viewports available for initial activation');
            }
        }, 800);

        // Initialize UI
        initializeUI();

        console.log('Enhanced DICOM Viewer fully initialized with modern controls');

    } catch (error) {
        console.error('Failed to initialize DICOM Viewer:', error);
        showErrorMessage('Failed to initialize DICOM Viewer: ' + error.message);
    }

    if (window.DICOM_VIEWER.ReportingEvents) {
        window.DICOM_VIEWER.ReportingEvents.initialize();
    }

    // Initialize reporting features
    if (window.DICOM_VIEWER.initializeReportingFeatures) {
        window.DICOM_VIEWER.initializeReportingFeatures();
    }



    // Core application functions
    function initializeUI() {
        // No default tool on initialization - all tools disabled
        const toolsPanel = document.getElementById('tools-panel');
        toolsPanel.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.remove('btn-primary', 'active');
            btn.classList.add('btn-secondary');
        });

        ['mprAxial', 'mprSagittal', 'mprCoronal', 'mprAll'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) btn.disabled = true;
        });

        setTimeout(() => {
            window.DICOM_VIEWER.showAISuggestion('Welcome to Accurate Viewer! Upload DICOM files to start. MPR views will be automatically generated for multi-slice series.');
        }, 1000);

        console.log('Accurate Viewer initialized - no default tool active');
    }


    function loadImagesFromPACS() {
        const pacsImages = sessionStorage.getItem('pacsImages');
        const patientName = sessionStorage.getItem('pacsPatientName');

        if (pacsImages) {
            try {
                const images = JSON.parse(pacsImages);

                // Show loading indicator
                window.DICOM_VIEWER.showLoadingIndicator(`Loading ${images.length} images from PACS...`);

                // Load images into your existing viewer
                window.DICOM_VIEWER.loadImageSeries(images);

                // Show success message
                setTimeout(() => {
                    window.DICOM_VIEWER.showAISuggestion(`Successfully loaded ${images.length} images for ${patientName} from PACS!`);
                }, 1000);

                // Clear session storage
                sessionStorage.removeItem('pacsImages');
                sessionStorage.removeItem('pacsPatientName');

            } catch (error) {
                console.error('Error loading PACS images:', error);
                window.DICOM_VIEWER.showErrorMessage('Failed to load images from PACS');
            }
        }
    }


    function addPACSSearchButton() {
        // Add PACS search button to your existing interface
        const uploadSection = document.querySelector('.btn-group'); // Adjust selector as needed

        if (uploadSection) {
            const pacsButton = document.createElement('button');
            pacsButton.className = 'btn btn-info';
            pacsButton.innerHTML = '<i class="bi bi-search me-2"></i>Search PACS';
            pacsButton.onclick = () => {
                window.open('pacs_search.php', '_blank', 'width=1200,height=800');
            };

            uploadSection.appendChild(pacsButton);
        }
    }


    // Add PACS integration to your upload handler
    if (window.DICOM_VIEWER && window.DICOM_VIEWER.UploadHandler) {
        // Extend upload handler to support PACS
        window.DICOM_VIEWER.UploadHandler.searchPACS = function (patientName, patientID) {
            return fetch(`pacs_search.php?action=search&patientName=${encodeURIComponent(patientName)}&patientID=${encodeURIComponent(patientID)}`)
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        return data.results;
                    } else {
                        throw new Error('PACS search failed');
                    }
                });
        };

        // 6. Add keyboard shortcut support (add this to your main.js or as a separate module):
        document.addEventListener('keydown', function (event) {
            // Don't trigger if user is typing
            if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
                return;
            }

            // 'T' key for toggle layout
            if (event.key.toLowerCase() === 't') {
                event.preventDefault();
                const viewportManager = window.DICOM_VIEWER.MANAGERS.viewportManager;
                const activeViewport = viewportManager.activeViewport;

                if (activeViewport) {
                    const viewportName = activeViewport.dataset.viewportName;
                    viewportManager.handleViewportDoubleClick(activeViewport, viewportName);
                }
            }
        });
        console.log('Viewport double-click functionality added');


        // Add this function to your main.js for testing
        window.DICOM_VIEWER.testZoomFunction = function () {
            const viewports = document.querySelectorAll('.viewport');
            viewports.forEach(viewport => {
                try {
                    const enabledElement = cornerstone.getEnabledElement(viewport);
                    if (enabledElement && enabledElement.image) {
                        const cornerstoneViewport = cornerstone.getViewport(viewport);
                        console.log('Current viewport scale:', cornerstoneViewport.scale);

                        // Test zoom in
                        cornerstoneViewport.scale = cornerstoneViewport.scale * 1.2;
                        cornerstone.setViewport(viewport, cornerstoneViewport);
                        console.log('Zoomed to:', cornerstoneViewport.scale);
                    }
                } catch (error) {
                    console.error('Error testing zoom on viewport:', error);
                }
            });
        };

        window.DICOM_VIEWER.UploadHandler.loadFromPACS = function (studyUID) {
            window.DICOM_VIEWER.showLoadingIndicator('Loading study from PACS...');

            return fetch(`pacs_search.php?action=load_study&studyUID=${studyUID}`)
                .then(response => response.json())
                .then(data => {
                    if (data.success && data.images.length > 0) {
                        window.DICOM_VIEWER.loadImageSeries(data.images);
                        window.DICOM_VIEWER.showAISuggestion(`Loaded ${data.images.length} images from PACS successfully!`);
                    } else {
                        throw new Error('No images found in study');
                    }
                })
                .catch(error => {
                    window.DICOM_VIEWER.showAISuggestion(`Failed to load from PACS: ${error.message}`);
                })
                .finally(() => {
                    window.DICOM_VIEWER.hideLoadingIndicator();
                });
        };
    }

    function showErrorMessage(message) {
        const viewportContainer = document.getElementById('viewport-container');
        viewportContainer.innerHTML = `
            <div class="d-flex justify-content-center align-items-center" style="grid-column: 1 / -1; grid-row: 1 / -1;">
                <div class="text-center">
                    <i class="bi bi-exclamation-triangle text-warning fs-1 mb-3"></i>
                    <div class="text-light h5">${message}</div>
                    <button class="btn btn-primary mt-3" onclick="location.reload()">Reload Page</button>
                </div>
            </div>
        `;
    }
});


// Enhanced reporting integration
// NOTE: The createMedicalReport and medicalReportBtn click handlers are now managed by
// advanced-reporting-system.js which provides auto-detection of modality and structured templates
window.DICOM_VIEWER.initializeReportingFeatures = function () {
    // The old modal-based template selector is disabled in favor of advanced-reporting-system.js
    // which provides auto-detection and better UX

    // Keyboard shortcut for reporting (Ctrl+R) - triggers the advanced reporting system
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'r') {
            e.preventDefault();
            // Use the advanced reporting system if available
            if (window.DICOM_VIEWER.MANAGERS.advancedReporting) {
                window.DICOM_VIEWER.MANAGERS.advancedReporting.openReportingInterface();
            } else {
                document.getElementById('medicalReportBtn')?.click();
            }
        }
    });

    console.log('Reporting features initialized (using Advanced Reporting System)');
};
// ===== GLOBAL UTILITY FUNCTIONS =====

// Enhanced loading indicator with multiple status support
window.DICOM_VIEWER.showLoadingIndicator = function (message, showInViewport = true) {
    const loadingProgress = document.getElementById('loadingProgress');

    if (loadingProgress) {
        loadingProgress.style.display = 'block';
        loadingProgress.querySelector('span').textContent = message;
    }

    // Also show loading message in viewport container for better visibility
    if (showInViewport) {
        const viewportContainer = document.getElementById('viewport-container');
        if (viewportContainer) {
            // Create or update loading overlay in viewport
            let viewportLoading = document.getElementById('viewport-loading-overlay');
            if (!viewportLoading) {
                viewportLoading = document.createElement('div');
                viewportLoading.id = 'viewport-loading-overlay';
                viewportLoading.style.cssText = `
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.8);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                    backdrop-filter: blur(2px);
                `;
                viewportContainer.appendChild(viewportLoading);
            }

            viewportLoading.innerHTML = `
                <div class="text-center text-white">
                    <div class="spinner-border mb-3" role="status" style="width: 3rem; height: 3rem;"></div>
                    <h5>${message}</h5>
                    <div class="progress mt-3" style="width: 300px; height: 8px;">
                        <div class="progress-bar progress-bar-striped progress-bar-animated" 
                             role="progressbar" style="width: 100%"></div>
                    </div>
                </div>
            `;
            viewportLoading.style.display = 'flex';
        }
    }

    console.log('Loading indicator shown:', message);
};

window.DICOM_VIEWER.hideLoadingIndicator = function () {
    const loadingProgress = document.getElementById('loadingProgress');
    if (loadingProgress) {
        loadingProgress.style.display = 'none';
    }

    // Hide viewport loading overlay
    const viewportLoading = document.getElementById('viewport-loading-overlay');
    if (viewportLoading) {
        viewportLoading.style.display = 'none';
        // Remove it after a delay to prevent flashing
        setTimeout(() => {
            if (viewportLoading.parentNode) {
                viewportLoading.parentNode.removeChild(viewportLoading);
            }
        }, 300);
    }

    console.log('Loading indicator hidden');
};

// Enhanced loading with progress support
window.DICOM_VIEWER.updateLoadingProgress = function (message, progress = null) {
    const loadingProgress = document.getElementById('loadingProgress');
    if (loadingProgress) {
        loadingProgress.querySelector('span').textContent = message;
    }

    const viewportLoading = document.getElementById('viewport-loading-overlay');
    if (viewportLoading) {
        const messageElement = viewportLoading.querySelector('h5');
        const progressBar = viewportLoading.querySelector('.progress-bar');

        if (messageElement) {
            messageElement.textContent = message;
        }

        if (progressBar && progress !== null) {
            progressBar.style.width = `${Math.min(100, Math.max(0, progress))}%`;
            progressBar.textContent = `${Math.round(progress)}%`;
        }
    }
};

window.DICOM_VIEWER.showErrorMessage = function (message) {
    window.DICOM_VIEWER.hideLoadingIndicator();
    const viewportContainer = document.getElementById('viewport-container');
    viewportContainer.innerHTML = `
        <div class="d-flex justify-content-center align-items-center" style="grid-column: 1 / -1; grid-row: 1 / -1;">
            <div class="text-center">
                <i class="bi bi-exclamation-triangle text-warning fs-1 mb-3"></i>
                <div class="text-light h5">${message}</div>
                <button class="btn btn-primary mt-3" onclick="location.reload()">Reload Page</button>
            </div>
        </div>
    `;
};

window.DICOM_VIEWER.showAISuggestion = function (text) {
    const aiSuggestions = document.getElementById('aiSuggestions');
    const suggestionText = document.getElementById('suggestionText');

    if (aiSuggestions && suggestionText) {
        suggestionText.textContent = text;
        aiSuggestions.style.display = 'block';

        setTimeout(() => {
            aiSuggestions.style.display = 'none';
        }, 5000);
    }
};


//
// ➡️ PASTE THIS IN: main.js
//

// ENHANCED: Replace the entire loadImageSeries function in main.js with this robust version.
window.DICOM_VIEWER.loadImageSeries = async function (uploadedFiles) {
    console.log('=== ROBUST SERIES LOAD SEQUENCE INITIATED ===');
    const state = window.DICOM_VIEWER.STATE;

    // FIX: Stop any ongoing processes like cine playback.
    if (state.isPlaying) {
        window.DICOM_VIEWER.stopCine();
    }

    window.DICOM_VIEWER.showLoadingIndicator('Preparing new session...', false);
    await new Promise(resolve => setTimeout(resolve, 50)); // Allow UI to update.

    // --- AGGRESSIVE CLEANUP ---
    console.log('Step 1: Aggressive Cleanup of Previous State');

    // FIX: Dispose of the old MPR Manager instance completely to release the 3D volume from memory.
    if (window.DICOM_VIEWER.MANAGERS.mprManager) {
        window.DICOM_VIEWER.MANAGERS.mprManager.dispose();
        // Create a fresh, clean instance for the new series.
        window.DICOM_VIEWER.MANAGERS.mprManager = new window.DICOM_VIEWER.MPRManager();
        console.log('Old MPR Manager disposed. New instance created.');
    }

    // FIX: Purge Cornerstone's internal cache of all image objects. This is crucial for releasing memory.
    cornerstone.imageCache.purgeCache();
    console.log('Cornerstone image cache purged.');

    // FIX: Tell the Web Worker to clear its cache to prevent it from holding onto old images.
    if (window.DICOM_VIEWER.imageLoaderWorker) {
        window.DICOM_VIEWER.imageLoaderWorker.postMessage({ type: 'CLEAR_CACHE' });
        console.log('Instructed Web Worker to clear its cache.');
    }

    // FIX: Reset all relevant global state variables to their defaults.
    state.currentSeriesImages = [];
    state.mprViewports = {};
    state.currentSlicePositions = { axial: 0.5, sagittal: 0.5, coronal: 0.5 };
    state.totalImages = 0;
    state.currentImageIndex = 0;
    state.currentFileId = null;
    console.log('Global state has been reset.');

    // --- SETUP FOR NEW SERIES ---
    console.log('Step 2: Setting up for New Series');

    // Set new series data
    state.currentSeriesImages = uploadedFiles;
    state.totalImages = uploadedFiles.length;

    // Create a fresh set of viewports for the new session. This calls cleanup internally.
    window.DICOM_VIEWER.MANAGERS.viewportManager.createViewports('2x2');
    await new Promise(resolve => setTimeout(resolve, 100)); // Allow viewports to be created.

    // --- LOAD NEW DATA ---
    console.log('Step 3: Loading New Series Data');

    // CRITICAL FIX: Always populate series list to make studies visible
    console.log('Populating series list with', uploadedFiles.length, 'images');
    window.DICOM_VIEWER.populateSeriesList(uploadedFiles);

    if (uploadedFiles.length > 0) {
        state.currentFileId = uploadedFiles[0].id;
        console.log(`Auto-loading first image: ${state.currentFileId}`);

        // Set the primary viewport as active before loading.
        const primaryViewport = window.DICOM_VIEWER.MANAGERS.viewportManager.getViewport('original') || window.DICOM_VIEWER.MANAGERS.viewportManager.getAllViewports()[0];
        if (primaryViewport) {
            window.DICOM_VIEWER.MANAGERS.viewportManager.setActiveViewport(primaryViewport);
        }

        // Load the first image and update UI.
        await window.DICOM_VIEWER.loadCurrentImage();
        window.DICOM_VIEWER.setupImageNavigation();
        window.DICOM_VIEWER.updateImageCounter();
        window.DICOM_VIEWER.updateImageSlider();

        // Auto-select the first item in the series list.
        const firstSeriesItem = document.querySelector('.series-item');
        if (firstSeriesItem) firstSeriesItem.classList.add('selected');

        // Enable or disable MPR based on the number of images.
        const mprNav = document.getElementById('mprNavigation');
        const mprButtons = ['mprAxial', 'mprSagittal', 'mprCoronal', 'mprAll'];
        if (uploadedFiles.length > 1 && state.mprEnabled) {
            if (mprNav) mprNav.style.display = 'block';
            mprButtons.forEach(id => {
                const btn = document.getElementById(id);
                if (btn) btn.disabled = false;
            });
            window.DICOM_VIEWER.showAISuggestion(`New series loaded with ${uploadedFiles.length} images. MPR is ready.`);
        } else {
            if (mprNav) mprNav.style.display = 'none';
            mprButtons.forEach(id => {
                const btn = document.getElementById(id);
                if (btn) btn.disabled = true;
            });
            window.DICOM_VIEWER.showAISuggestion('Single image loaded successfully.');
        }
    } else {
        window.DICOM_VIEWER.showErrorMessage('No valid DICOM files were loaded.');
    }

    // NEW: Check for existing reports after loading images
    if (window.DICOM_VIEWER.MANAGERS.reportingSystem) {
        setTimeout(async () => {
            await window.DICOM_VIEWER.MANAGERS.reportingSystem.checkAndShowReportStatus();
        }, 1000);
    }

    // Show floating report button
    const floatingBtn = document.getElementById('floating-report-btn');
    if (floatingBtn && uploadedFiles.length > 0) {
        floatingBtn.style.display = 'flex';
        floatingBtn.style.alignItems = 'center';
        floatingBtn.style.justifyContent = 'center';
    }


    window.DICOM_VIEWER.hideLoadingIndicator();
    console.log('=== ROBUST SERIES LOAD SEQUENCE COMPLETED ===');

    // At the end of window.DICOM_VIEWER.loadImageSeries function, AFTER hideLoadingIndicator(), add:

    // Check for existing reports for ALL images in the series
    if (window.DICOM_VIEWER.MANAGERS.reportingSystem && uploadedFiles.length > 0) {
        setTimeout(async () => {
            console.log('Starting comprehensive report check for all series images');
            await window.DICOM_VIEWER.MANAGERS.reportingSystem.checkAllSeriesImagesForReports(uploadedFiles);
        }, 2000); // Delay to let UI fully render
    }
};


window.DICOM_VIEWER.ThumbnailManager = class {
    constructor() {
        this.thumbnailCache = new Map();
        this.loadingThumbnails = new Set();
        this.thumbnailSize = 80; // pixels
        this.maxConcurrentLoads = 3;
        this.currentLoadCount = 0;
        this.loadQueue = [];
    }

    // js/main.js (inside the ThumbnailManager class)

    async generateThumbnail(fileId, imageData = null) {
        // Check cache first
        if (this.thumbnailCache.has(fileId)) {
            return this.thumbnailCache.get(fileId);
        }

        if (this.loadingThumbnails.has(fileId)) {
            return new Promise((resolve) => {
                const checkInterval = setInterval(() => {
                    if (this.thumbnailCache.has(fileId)) {
                        clearInterval(checkInterval);
                        resolve(this.thumbnailCache.get(fileId));
                    }
                }, 100);
            });
        }

        this.loadingThumbnails.add(fileId);

        try {
            let imageId;

            // MODIFIED: This logic now correctly handles Orthanc images.
            const fileInfo = window.DICOM_VIEWER.STATE.currentSeriesImages.find(img =>
                img.id === fileId || img.orthancInstanceId === fileId || img.instanceId === fileId
            );

            if (fileInfo && (fileInfo.isOrthancImage || fileInfo.orthancInstanceId)) {
                // If it's an Orthanc image, get it from the Orthanc proxy.
                const orthancInstanceId = fileInfo.orthancInstanceId || fileInfo.instanceId || fileInfo.id;
                const basePath = window.basePath || '';
                imageId = `wadouri:${window.location.origin}${basePath}/api/get_dicom_from_orthanc.php?instanceId=${orthancInstanceId}`;
                console.log('Generating thumbnail from Orthanc instance:', orthancInstanceId);
            } else if (imageData) {
                // Use provided image data (for PACS images with embedded data)
                imageId = 'wadouri:data:application/dicom;base64,' + imageData;
            } else if (fileInfo && fileInfo.file_data) {
                // Image has embedded base64 data
                imageId = 'wadouri:data:application/dicom;base64,' + fileInfo.file_data;
            } else {
                // Otherwise, load from the local server database. This is the original path.
                // First check if this might be an Orthanc image based on ID format (UUID-like)
                const isOrthancId = /^[a-f0-9]{8}-[a-f0-9]{8}-[a-f0-9]{8}-[a-f0-9]{8}-[a-f0-9]{8}$/i.test(fileId);

                if (isOrthancId) {
                    // This is likely an Orthanc instance ID - use the Orthanc proxy
                    const basePath = window.basePath || '';
                    imageId = `wadouri:${window.location.origin}${basePath}/api/get_dicom_from_orthanc.php?instanceId=${fileId}`;
                    console.log('Generating thumbnail from detected Orthanc ID:', fileId);
                } else {
                    // Try local database
                    const basePath = window.basePath || '';
                    const response = await fetch(`${basePath}/get_dicom_fast.php?id=${fileId}&format=base64`);
                    const data = await response.json();

                    if (!data.success && !data.data) {
                        // This will now correctly show an error if a local file is missing
                        throw new Error('Failed to load image data for thumbnail');
                    }

                    const base64Data = data.data || data.file_data;
                    imageId = 'wadouri:data:application/dicom;base64,' + base64Data;
                }
            }

            const image = await cornerstone.loadImage(imageId);
            const thumbnailDataUrl = await this.createThumbnailCanvas(image);
            this.thumbnailCache.set(fileId, thumbnailDataUrl);
            return thumbnailDataUrl;

        } catch (error) {
            console.error(`Failed to generate thumbnail for ${fileId}:`, error);
            const fallbackThumbnail = this.createFallbackThumbnail();
            this.thumbnailCache.set(fileId, fallbackThumbnail);
            return fallbackThumbnail;

        } finally {
            this.loadingThumbnails.delete(fileId);
        }
    }

    async createThumbnailCanvas(image) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Set canvas size
        canvas.width = this.thumbnailSize;
        canvas.height = this.thumbnailSize;

        // Calculate scaling to maintain aspect ratio
        const aspectRatio = image.width / image.height;
        let drawWidth, drawHeight, offsetX = 0, offsetY = 0;

        if (aspectRatio > 1) {
            // Landscape image
            drawWidth = this.thumbnailSize;
            drawHeight = this.thumbnailSize / aspectRatio;
            offsetY = (this.thumbnailSize - drawHeight) / 2;
        } else {
            // Portrait image
            drawHeight = this.thumbnailSize;
            drawWidth = this.thumbnailSize * aspectRatio;
            offsetX = (this.thumbnailSize - drawWidth) / 2;
        }

        // Create a temporary canvas for image processing
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = image.width;
        tempCanvas.height = image.height;

        // Get pixel data and apply medical image processing
        const pixelData = image.getPixelData();
        const imageData = tempCtx.createImageData(image.width, image.height);

        // Apply optimal window/level for thumbnail visibility
        const windowWidth = image.windowWidth || this.calculateOptimalWindow(pixelData);
        const windowCenter = image.windowCenter || this.calculateOptimalLevel(pixelData);

        // Convert pixel data to RGB with proper windowing
        this.applyWindowLevel(pixelData, imageData.data, windowWidth, windowCenter, image);

        // Put processed image data to temp canvas
        tempCtx.putImageData(imageData, 0, 0);

        // Fill background with black (medical standard)
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, this.thumbnailSize, this.thumbnailSize);

        // Apply high-quality scaling
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Draw the scaled image
        ctx.drawImage(tempCanvas, offsetX, offsetY, drawWidth, drawHeight);

        // Add subtle border for better visibility
        ctx.strokeStyle = 'rgba(100, 149, 237, 0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, 0, this.thumbnailSize, this.thumbnailSize);

        return canvas.toDataURL('image/png', 0.9);
    }

    // Apply window/level to pixel data for optimal thumbnail contrast
    applyWindowLevel(pixelData, outputData, windowWidth, windowCenter, image) {
        const slope = image.slope || 1;
        const intercept = image.intercept || 0;

        const windowLow = windowCenter - windowWidth / 2;
        const windowHigh = windowCenter + windowWidth / 2;

        for (let i = 0; i < pixelData.length; i++) {
            // Apply slope and intercept
            let pixelValue = pixelData[i] * slope + intercept;

            // Apply windowing
            let intensity;
            if (pixelValue <= windowLow) {
                intensity = 0;
            } else if (pixelValue >= windowHigh) {
                intensity = 255;
            } else {
                intensity = Math.round(((pixelValue - windowLow) / windowWidth) * 255);
            }

            // Handle photometric interpretation
            if (image.photometricInterpretation === 'MONOCHROME1') {
                intensity = 255 - intensity; // Invert for MONOCHROME1
            }

            const outputIndex = i * 4;
            outputData[outputIndex] = intensity;     // R
            outputData[outputIndex + 1] = intensity; // G
            outputData[outputIndex + 2] = intensity; // B
            outputData[outputIndex + 3] = 255;       // A
        }
    }

    // Calculate optimal window width for thumbnail
    calculateOptimalWindow(pixelData) {
        const sortedPixels = Array.from(pixelData).sort((a, b) => a - b);
        const p5 = sortedPixels[Math.floor(sortedPixels.length * 0.05)];
        const p95 = sortedPixels[Math.floor(sortedPixels.length * 0.95)];
        return Math.max(p95 - p5, 1);
    }

    // Calculate optimal window level for thumbnail
    calculateOptimalLevel(pixelData) {
        const sortedPixels = Array.from(pixelData).sort((a, b) => a - b);
        const median = sortedPixels[Math.floor(sortedPixels.length * 0.5)];
        return median;
    }

    // Create fallback thumbnail for failed loads
    createFallbackThumbnail() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        canvas.width = this.thumbnailSize;
        canvas.height = this.thumbnailSize;

        // Create gradient background
        const gradient = ctx.createLinearGradient(0, 0, this.thumbnailSize, this.thumbnailSize);
        gradient.addColorStop(0, '#2c3e50');
        gradient.addColorStop(1, '#34495e');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, this.thumbnailSize, this.thumbnailSize);

        // Add medical icon
        ctx.fillStyle = '#7f8c8d';
        ctx.font = '24px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('📊', this.thumbnailSize / 2, this.thumbnailSize / 2);

        return canvas.toDataURL('image/png');
    }

    // Queue-based thumbnail loading to prevent overwhelming
    async loadThumbnailsInQueue(fileIds) {
        this.loadQueue = [...fileIds];

        // Start loading with limited concurrency
        const loadPromises = [];
        for (let i = 0; i < Math.min(this.maxConcurrentLoads, this.loadQueue.length); i++) {
            loadPromises.push(this.processLoadQueue());
        }

        await Promise.all(loadPromises);
    }

    async processLoadQueue() {
        while (this.loadQueue.length > 0 && this.currentLoadCount < this.maxConcurrentLoads) {
            const fileId = this.loadQueue.shift();
            if (!fileId) break;

            this.currentLoadCount++;

            try {
                await this.generateThumbnail(fileId);

                // Update UI immediately after each thumbnail loads
                this.updateThumbnailInUI(fileId);

            } catch (error) {
                console.error(`Thumbnail load failed for ${fileId}:`, error);
            } finally {
                this.currentLoadCount--;

                // Small delay to prevent overwhelming the browser
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }
    }


    // Update thumbnail in the UI
    // Update thumbnail in the UI
    updateThumbnailInUI(fileId) {
        const seriesItem = document.querySelector(`[data-file-id="${fileId}"]`);
        if (!seriesItem) return;

        const thumbnailContainer = seriesItem.querySelector('.series-thumbnail');
        if (!thumbnailContainer) return;

        const cachedThumbnail = this.thumbnailCache.get(fileId);
        if (cachedThumbnail) {
            thumbnailContainer.innerHTML = `
                <img src="${cachedThumbnail}" 
                     alt="DICOM Preview" 
                     style="width: 100%; height: 100%; object-fit: cover; border-radius: 4px;">
            `;

            // Add loading class removal
            thumbnailContainer.classList.remove('loading');
        }
    }


    // Clear cache to free memory
    clearCache() {
        this.thumbnailCache.clear();
        this.loadingThumbnails.clear();
        console.log('Thumbnail cache cleared');
    }
}
// ===== IMAGE LOADING AND SERIES MANAGEMENT =====

// Replace the loadCurrentImage function in main.js with this version

window.DICOM_VIEWER.loadCurrentImage = async function (skipLoadingIndicator = false) {
    const state = window.DICOM_VIEWER.STATE;
    let targetViewport = state.activeViewport;

    // Enhanced viewport selection logic (keeping existing code)
    if (!targetViewport && window.DICOM_VIEWER.MANAGERS.viewportManager) {
        if (state.activeViewport) {
            try {
                cornerstone.getEnabledElement(state.activeViewport);
                targetViewport = state.activeViewport;
            } catch (error) {
                console.log('Active viewport not enabled, trying alternatives...');
            }
        }

        if (!targetViewport) {
            const currentLayout = window.DICOM_VIEWER.MANAGERS.viewportManager.currentLayout;
            const primaryViewportNames = {
                '2x2': 'original',
                '1x1': 'main',
                '2x1': 'left'
            };

            const primaryName = primaryViewportNames[currentLayout];
            if (primaryName) {
                const primaryVp = window.DICOM_VIEWER.MANAGERS.viewportManager.getViewport(primaryName);
                if (primaryVp) {
                    try {
                        cornerstone.getEnabledElement(primaryVp);
                        targetViewport = primaryVp;
                    } catch (error) {
                        try {
                            cornerstone.enable(primaryVp);
                            targetViewport = primaryVp;
                            console.log(`Re-enabled primary viewport: ${primaryName}`);
                        } catch (enableError) {
                            console.warn(`Could not enable primary viewport: ${primaryName}`);
                        }
                    }
                }
            }
        }

        if (!targetViewport) {
            const allViewports = window.DICOM_VIEWER.MANAGERS.viewportManager.getAllViewports();
            for (const viewport of allViewports) {
                if (viewport) {
                    try {
                        cornerstone.getEnabledElement(viewport);
                        targetViewport = viewport;
                        break;
                    } catch (error) {
                        try {
                            cornerstone.enable(viewport);
                            targetViewport = viewport;
                            console.log('Re-enabled fallback viewport for image loading');
                            break;
                        } catch (enableError) {
                            console.warn('Could not enable fallback viewport');
                            continue;
                        }
                    }
                }
            }
        }

        if (targetViewport) {
            window.DICOM_VIEWER.MANAGERS.viewportManager.setActiveViewport(targetViewport);
        }
    }

    if (!targetViewport) {
        console.error('Cannot load image: No viewports available after all strategies tried.');
        window.DICOM_VIEWER.showErrorMessage('No viewports available for image display. Please refresh the page.');
        return;
    }

    try {
        cornerstone.getEnabledElement(targetViewport);
    } catch (error) {
        console.error('Target viewport is not enabled after selection:', error);
        try {
            cornerstone.enable(targetViewport);
            console.log('Successfully enabled target viewport as last resort');
        } catch (enableError) {
            console.error('Failed to enable target viewport as last resort:', enableError);
            window.DICOM_VIEWER.showErrorMessage('Failed to prepare viewport for image display. Please refresh the page.');
            return;
        }
    }

    if (state.currentImageIndex >= state.currentSeriesImages.length || !state.currentFileId) {
        console.error('Cannot load image: invalid index or no file ID');
        return;
    }

    console.log(`Loading image with ID: ${state.currentFileId} into viewport: ${targetViewport.dataset.viewportName}`);

    // Loading indicator management
    let loadingDiv = null;
    if (!skipLoadingIndicator && !state.isPlaying) {
        loadingDiv = document.createElement('div');
        loadingDiv.style.cssText = `
            position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background: rgba(0,0,0,0.9); color: white; padding: 12px 16px; border-radius: 6px;
            z-index: 100; pointer-events: none; font-size: 12px; font-weight: 500;
            border: 1px solid rgba(255,255,255,0.2);
        `;
        loadingDiv.innerHTML = `
            <div class="d-flex align-items-center">
                <div class="spinner-border spinner-border-sm me-2" style="width: 16px; height: 16px;"></div>
                Loading image...
            </div>
        `;
        targetViewport.appendChild(loadingDiv);
    }

    try {
        const currentImage = state.currentSeriesImages[state.currentImageIndex];

        // *** CHECK IF THIS IS AN ORTHANC IMAGE ***
        if (currentImage && currentImage.isOrthancImage && currentImage.orthancInstanceId) {
            console.log('Loading Orthanc image with instance ID:', currentImage.orthancInstanceId);

            // Remove loading indicator immediately
            if (loadingDiv && loadingDiv.parentNode) {
                loadingDiv.parentNode.removeChild(loadingDiv);
                loadingDiv = null;
            }

            // Create image ID for Orthanc instance using absolute URL
            const baseUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1)}`;
            const imageId = `wadouri:${baseUrl}api/get_dicom_from_orthanc.php?instanceId=${currentImage.orthancInstanceId}`;

            console.log('Base URL:', baseUrl);
            console.log('Loading image with ID:', imageId);
            console.log('Instance ID:', currentImage.orthancInstanceId);

            let image;
            try {
                // Load and display image
                image = await cornerstone.loadImage(imageId);
                console.log('Image loaded successfully:', image.width, 'x', image.height);
                cornerstone.displayImage(targetViewport, image);
            } catch (error) {
                console.error('ERROR loading Orthanc image:', error);
                console.error('Image ID was:', imageId);
                console.error('Instance ID was:', currentImage.orthancInstanceId);
                throw new Error(`Failed to load DICOM image: ${error.message}`);
            }

            // Update UI only during non-cine operations
            if (!state.isPlaying) {
                window.DICOM_VIEWER.updateViewportInfo();
                // Create patient info from Orthanc data
                const orthancPatientInfo = {
                    patient_name: currentImage.patient_name || 'Unknown',
                    study_description: currentImage.study_description || 'PACS Study',
                    series_description: currentImage.series_description || 'PACS Series',
                    modality: 'CT', // Default, could be extracted from DICOM
                    columns: image.columns,
                    rows: image.rows
                };
                window.DICOM_VIEWER.updatePatientInfo(orthancPatientInfo);
            }

            // Store original state for enhancements
            if (window.DICOM_VIEWER.MANAGERS.enhancementManager) {
                window.DICOM_VIEWER.MANAGERS.enhancementManager.storeOriginalState(targetViewport, image);
            }

            console.log('Orthanc image loaded and displayed successfully');

            // Update series list selection
            if (!state.isPlaying) {
                const seriesItems = document.querySelectorAll('.series-item');
                seriesItems.forEach((item, index) => {
                    if (index === state.currentImageIndex) {
                        item.classList.add('selected');
                    } else {
                        item.classList.remove('selected');
                    }
                });
            }

            return;
        }

        // *** NEW: Check if this is a PACS-loaded image with embedded data ***
        if (currentImage && currentImage.file_data) {
            console.log('Loading PACS image with embedded data');

            // Remove loading indicator immediately
            if (loadingDiv && loadingDiv.parentNode) {
                loadingDiv.parentNode.removeChild(loadingDiv);
                loadingDiv = null;
            }

            // Create image ID from base64 data (PACS format)
            const imageId = 'wadouri:data:application/dicom;base64,' + currentImage.file_data;

            // Load and display image
            const image = await cornerstone.loadImage(imageId);
            cornerstone.displayImage(targetViewport, image);

            // Update UI only during non-cine operations
            if (!state.isPlaying) {
                window.DICOM_VIEWER.updateViewportInfo();
                // Create fake patient info from PACS data
                const pacsPatientInfo = {
                    patient_name: currentImage.patient_name || 'Unknown',
                    study_description: currentImage.study_description || 'PACS Study',
                    series_description: currentImage.series_description || 'PACS Series'
                };
                window.DICOM_VIEWER.updatePatientInfo(pacsPatientInfo);
            }

            // Store original state for enhancements
            if (window.DICOM_VIEWER.MANAGERS.enhancementManager) {
                window.DICOM_VIEWER.MANAGERS.enhancementManager.storeOriginalState(targetViewport, image);
            }

            console.log('PACS image loaded and displayed successfully');

            // Update series list selection
            if (!state.isPlaying) {
                const seriesItems = document.querySelectorAll('.series-item');
                seriesItems.forEach((item, index) => {
                    if (index === state.currentImageIndex) {
                        item.classList.add('selected');
                    } else {
                        item.classList.remove('selected');
                    }
                });
            }

            return;
        }

        // *** EXISTING: Regular database image loading ***
        const response = await fetch(`get_dicom_fast.php?id=${state.currentFileId}`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (!data.success || !data.file_data) {
            throw new Error('Invalid response: ' + (data.error || 'No file data received'));
        }

        // Remove loading indicator immediately on success
        if (loadingDiv && loadingDiv.parentNode) {
            loadingDiv.parentNode.removeChild(loadingDiv);
            loadingDiv = null;
        }

        const imageId = 'wadouri:data:application/dicom;base64,' + data.file_data;

        // Load and display image
        const image = await cornerstone.loadImage(imageId);
        cornerstone.displayImage(targetViewport, image);

        // Update UI only during non-cine operations
        if (!state.isPlaying) {
            window.DICOM_VIEWER.updateViewportInfo();
            window.DICOM_VIEWER.updatePatientInfo(data);
        }

        // Store original state for enhancements
        if (window.DICOM_VIEWER.MANAGERS.enhancementManager) {
            window.DICOM_VIEWER.MANAGERS.enhancementManager.storeOriginalState(targetViewport, image);
        }

        if (window.DICOM_VIEWER.MANAGERS.medicalNotes && data) {
            window.DICOM_VIEWER.MANAGERS.medicalNotes.loadNotesForImage(state.currentFileId, data);
        }

        console.log('Database image loaded and displayed successfully');

        // Update series list selection
        if (!state.isPlaying) {
            const seriesItems = document.querySelectorAll('.series-item');
            seriesItems.forEach((item, index) => {
                if (index === state.currentImageIndex) {
                    item.classList.add('selected');
                } else {
                    item.classList.remove('selected');
                }
            });
        }

    } catch (error) {
        console.error('Error loading image:', error);

        // Remove loading indicator on error
        if (loadingDiv && loadingDiv.parentNode) {
            loadingDiv.parentNode.removeChild(loadingDiv);
        }

        // Show error only if not playing cine
        if (!state.isPlaying) {
            targetViewport.innerHTML = `
                <div style="color: white; text-align: center; padding: 20px; display: flex; flex-direction: column; justify-content: center; height: 100%; background: #000;">
                    <i class="bi bi-exclamation-triangle text-warning fs-1 mb-3"></i>
                    <h5>Image Load Error</h5>
                    <p class="small text-muted">${error.message}</p>
                    <div class="mt-3">
                        <button onclick="window.DICOM_VIEWER.loadCurrentImage()" class="btn btn-primary btn-sm me-2">Retry</button>
                        <button onclick="location.reload()" class="btn btn-secondary btn-sm">Reload Page</button>
                    </div>
                </div>
            `;
        }
    }
};

// ===== UI UPDATE FUNCTIONS =====

// Replace the populateSeriesList function in main.js with this new version
window.DICOM_VIEWER.populateSeriesList = function (files) {
    const seriesList = document.getElementById('series-list');
    seriesList.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'padding: 8px 0; min-height: 100%;';

    const groupedFiles = {};
    files.forEach((file, index) => {
        const patientKey = file.patient_name || file.patientFolder || 'Unknown Patient';
        if (!groupedFiles[patientKey]) {
            groupedFiles[patientKey] = [];
        }
        groupedFiles[patientKey].push({ ...file, originalIndex: index });
    });

    // Initialize thumbnail manager if not already initialized
    if (!window.DICOM_VIEWER.thumbnailManager) {
        window.DICOM_VIEWER.thumbnailManager = new window.DICOM_VIEWER.ThumbnailManager();
    }

    Object.keys(groupedFiles).forEach(patientKey => {
        if (Object.keys(groupedFiles).length > 1) {
            const patientHeader = document.createElement('div');
            patientHeader.className = 'patient-header bg-primary bg-opacity-10 text-primary p-2 rounded mb-2';
            patientHeader.innerHTML = `<strong><i class="bi bi-person-fill me-2"></i>${patientKey}</strong>`;
            wrapper.appendChild(patientHeader);
        }

        groupedFiles[patientKey].forEach(file => {
            const itemElement = document.createElement('div');
            itemElement.className = 'series-item d-flex align-items-center p-2 rounded border mb-1';
            itemElement.dataset.fileId = file.id;
            itemElement.style.cssText = 'flex-shrink: 0; min-height: 80px;';

            const folderInfo = file.studyFolder || file.seriesFolder ?
                `<div class="small text-info"><i class="bi bi-folder2 me-1"></i>${file.studyFolder || 'Study'}/${file.seriesFolder || 'Series'}</div>` : '';

            const mprBadge = files.length > 1 && window.DICOM_VIEWER.STATE.mprEnabled ? '<span class="mpr-badge">MPR</span>' : '';

            // --- STAR FEATURE UI ---
            const isStarred = file.is_starred == 1;
            const starClass = isStarred ? 'bi-star-fill text-warning' : 'bi-star';
            const starIconHTML = `<i class="bi ${starClass} series-star-icon" onclick="window.DICOM_VIEWER.toggleStarStatus(event, '${file.id}')"></i>`;

            itemElement.innerHTML = `
                <div style="flex-shrink: 0; margin-right: 12px; position: relative;">
                    <div class="series-thumbnail loading">
                        <i class="bi bi-file-medical fs-6 text-muted"></i>
                    </div>
                    ${mprBadge}
                </div>
                <div style="flex: 1; min-width: 0; overflow: hidden;">
                    <div class="fw-medium text-light text-truncate">
                        ${file.series_description || file.study_description || 'DICOM Series'}
                    </div>
                    <div class="text-muted small text-truncate">${file.file_name}</div>
                    ${folderInfo}
                    <div class="viewport-badges mt-1" data-file-id="${file.id}" style="display: flex; gap: 4px; flex-wrap: wrap;"></div>
                </div>
                <div class="ms-2 d-flex align-items-center">
                    ${starIconHTML}
                </div>
            `;

            itemElement.addEventListener('click', () => {
                window.DICOM_VIEWER.selectSeriesItem(itemElement, file.originalIndex);
            });

            wrapper.appendChild(itemElement);

            // Generate thumbnail asynchronously
            setTimeout(async () => {
                try {
                    const thumbnailUrl = await window.DICOM_VIEWER.thumbnailManager.generateThumbnail(file.id);
                    const thumbnailContainer = itemElement.querySelector('.series-thumbnail');
                    if (thumbnailContainer && thumbnailUrl) {
                        thumbnailContainer.classList.remove('loading');
                        thumbnailContainer.innerHTML = `<img src="${thumbnailUrl}" alt="DICOM Preview" />`;
                    }
                } catch (error) {
                    console.error('Failed to generate thumbnail for', file.id, error);
                    const thumbnailContainer = itemElement.querySelector('.series-thumbnail');
                    if (thumbnailContainer) {
                        thumbnailContainer.classList.remove('loading');
                    }
                }
            }, 50); // Small delay to allow DOM to render
        });
    });

    const spacer = document.createElement('div');
    spacer.style.height = '20px';
    wrapper.appendChild(spacer);

    seriesList.appendChild(wrapper);
    seriesList.scrollTop = 0;

    console.log(`Populated series list with ${files.length} items grouped by patient - thumbnails generating`);
};


// Add this new function to main.js
window.DICOM_VIEWER.toggleStarStatus = async function (event, fileId) {
    event.stopPropagation(); // Prevents the series item click event from firing
    const starIcon = event.target;
    const isCurrentlyStarred = starIcon.classList.contains('bi-star-fill');
    const newStarredStatus = !isCurrentlyStarred;

    // --- Optimistic UI Update ---
    // Immediately change the icon for a responsive feel.
    starIcon.classList.toggle('bi-star', isCurrentlyStarred);
    starIcon.classList.toggle('bi-star-fill', !isCurrentlyStarred);
    starIcon.classList.toggle('text-warning', !isCurrentlyStarred);

    try {
        const response = await fetch('toggle_star.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: fileId,
                is_starred: newStarredStatus ? 1 : 0
            })
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.error || 'Failed to update star status on the server.');
        }

        // --- Update the local state ---
        // Find the image in the global state and update its is_starred property
        const imageInState = window.DICOM_VIEWER.STATE.currentSeriesImages.find(img => img.id === fileId);
        if (imageInState) {
            imageInState.is_starred = newStarredStatus;
        }

        console.log(`Successfully updated star status for ${fileId} to ${newStarredStatus}`);

    } catch (error) {
        console.error('Error toggling star status:', error);

        // --- Revert UI on Failure ---
        // If the server update fails, change the icon back to its original state.
        starIcon.classList.toggle('bi-star', !isCurrentlyStarred);
        starIcon.classList.toggle('bi-star-fill', isCurrentlyStarred);
        starIcon.classList.toggle('text-warning', isCurrentlyStarred);

        window.DICOM_VIEWER.showAISuggestion('Could not save star status. Check connection.');
    }
};

// FIXED: selectSeriesItem with proper viewport management
window.DICOM_VIEWER.selectSeriesItem = function (element, index) {
    // Remove selection from all series items
    document.querySelectorAll('.series-item').forEach(el => {
        el.classList.remove('selected');
    });

    // Add selection to clicked item
    element.classList.add('selected');

    const state = window.DICOM_VIEWER.STATE;
    state.currentImageIndex = index;
    state.currentFileId = state.currentSeriesImages[state.currentImageIndex].id;

    // Ensure we have an active viewport before loading
    if (!state.activeViewport && window.DICOM_VIEWER.MANAGERS.viewportManager) {
        // Try to get original viewport first, then any available viewport
        const originalViewport = window.DICOM_VIEWER.MANAGERS.viewportManager.getViewport('original');
        const firstViewport = window.DICOM_VIEWER.MANAGERS.viewportManager.getAllViewports()[0];

        if (originalViewport) {
            window.DICOM_VIEWER.MANAGERS.viewportManager.setActiveViewport(originalViewport);
        } else if (firstViewport) {
            window.DICOM_VIEWER.MANAGERS.viewportManager.setActiveViewport(firstViewport);
        }
    }

    // Update UI controls
    window.DICOM_VIEWER.updateImageCounter();
    window.DICOM_VIEWER.updateImageSlider();

    // Load the selected image
    window.DICOM_VIEWER.loadCurrentImage();

    // Update MPR views if they exist and volume is available
    if (state.mprEnabled &&
        window.DICOM_VIEWER.MANAGERS.mprManager &&
        window.DICOM_VIEWER.MANAGERS.mprManager.volumeData &&
        state.mprViewports) {

        // Small delay to ensure main image loads first
        setTimeout(() => {
            window.DICOM_VIEWER.updateAllMPRViews();
        }, 200);
    }

    // Scroll selected item into view
    const container = document.getElementById('series-list');
    const containerRect = container.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();

    if (elementRect.top < containerRect.top || elementRect.bottom > containerRect.bottom) {
        element.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest'
        });
    }
};

window.DICOM_VIEWER.updateImageSlider = function () {
    const imageSlider = document.getElementById('imageSlider');
    const state = window.DICOM_VIEWER.STATE;
    imageSlider.min = 0;
    imageSlider.max = Math.max(0, state.totalImages - 1);
    imageSlider.value = state.currentImageIndex;
};

window.DICOM_VIEWER.updateImageCounter = function () {
    const imageCounter = document.getElementById('imageCounter');
    const state = window.DICOM_VIEWER.STATE;
    imageCounter.textContent = `${state.currentImageIndex + 1} / ${state.totalImages}`;
};

window.DICOM_VIEWER.updatePatientInfo = function (data) {
    const patientInfo = document.getElementById('patientInfo');
    const studyInfo = document.getElementById('studyInfo');
    const imageInfo = document.getElementById('imageInfo');
    const mprInfo = document.getElementById('mprInfo');

    // Update sidebar patient info (existing)
    if (patientInfo) {
        patientInfo.innerHTML = `
            <div>Name: ${data.patient_name || '-'}</div>
            <div>ID: ${data.patient_id || '-'}</div>
            <div>DOB: ${data.patient_birth_date || '-'}</div>
            <div>Sex: ${data.patient_sex || '-'}</div>
        `;
    }

    if (studyInfo) {
        studyInfo.innerHTML = `
            <div>Date: ${data.study_date || '-'}</div>
            <div>Time: ${data.study_time || '-'}</div>
            <div>Modality: ${data.modality || '-'}</div>
            <div>Body Part: ${data.body_part || '-'}</div>
        `;
    }

    if (imageInfo) {
        const windowSlider = document.getElementById('windowSlider');
        const levelSlider = document.getElementById('levelSlider');
        imageInfo.innerHTML = `
            <div>Matrix: ${data.columns || '-'}x${data.rows || '-'}</div>
            <div>Pixel Spacing: ${data.pixel_spacing || '-'}</div>
            <div>Slice Thickness: ${data.slice_thickness || '-'}</div>
            <div>Window: ${windowSlider ? windowSlider.value : '-'}</div>
            <div>Level: ${levelSlider ? levelSlider.value : '-'}</div>
        `;
    }

    if (mprInfo && window.DICOM_VIEWER.MANAGERS.mprManager.volumeData) {
        const dimensions = window.DICOM_VIEWER.MANAGERS.mprManager.dimensions;
        mprInfo.innerHTML = `
            <div>Volume: ${dimensions.width}x${dimensions.height}x${dimensions.depth}</div>
            <div>Orientation: Multi-planar</div>
            <div>Slice Position: Active</div>
        `;
    }

    // Update the main viewer patient info bar (#13)
    window.DICOM_VIEWER.updateViewerPatientInfoBar(data);
};

// New function to update the patient info bar in the NAVBAR (#13)
window.DICOM_VIEWER.updateViewerPatientInfoBar = function (data) {
    // Debug logging
    console.log('=== updateViewerPatientInfoBar called ===');
    console.log('Data received:', data);
    console.log('Patient name:', data?.patient_name);
    console.log('Patient ID:', data?.patient_id);

    // Update navbar patient info
    const navbarInfo = document.getElementById('navbar-patient-info');
    if (!navbarInfo) {
        console.warn('navbar-patient-info element not found!');
        return;
    }

    // Show the info bar when we have data
    if (data && (data.patient_name || data.patient_id)) {
        navbarInfo.style.display = 'flex';
        navbarInfo.style.cssText = 'display: flex !important;';
        console.log('Navbar info display set to flex');
    } else {
        console.warn('No patient name or ID found in data');
    }

    // Update patient name
    const nameEl = document.getElementById('nav-patient-name');
    if (nameEl) nameEl.textContent = data.patient_name || 'Unknown';

    // Update patient ID
    const idEl = document.getElementById('nav-patient-id');
    if (idEl) idEl.textContent = data.patient_id || '-';

    // Calculate and update age
    const ageEl = document.getElementById('nav-patient-age');
    if (ageEl) {
        let age = '-';

        // First check if age is directly provided
        if (data.patient_age) {
            age = data.patient_age;
        } else if (data.age) {
            age = data.age;
        } else if (data.patient_birth_date) {
            // Calculate from birth date
            const birthDateStr = String(data.patient_birth_date);
            let birthDate;

            // Handle DICOM format YYYYMMDD
            if (birthDateStr.length === 8 && !birthDateStr.includes('-')) {
                birthDate = new Date(
                    parseInt(birthDateStr.substr(0, 4)),
                    parseInt(birthDateStr.substr(4, 2)) - 1,
                    parseInt(birthDateStr.substr(6, 2))
                );
            } else if (birthDateStr.includes('-')) {
                birthDate = new Date(birthDateStr);
            }

            if (birthDate && !isNaN(birthDate.getTime())) {
                const today = new Date();
                let calcAge = today.getFullYear() - birthDate.getFullYear();
                const monthDiff = today.getMonth() - birthDate.getMonth();
                if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                    calcAge--;
                }
                age = calcAge + ' yrs';
            }
        }
        ageEl.textContent = age;
    }

    // Update sex with icon
    const sexEl = document.getElementById('nav-patient-sex');
    const sexIcon = document.getElementById('nav-sex-icon');
    const sexBadge = document.getElementById('nav-sex-badge');
    if (sexEl && sexIcon) {
        const sex = (data.patient_sex || data.sex || '').toUpperCase();
        if (sex === 'M' || sex === 'MALE') {
            sexEl.textContent = 'Male';
            sexIcon.className = 'bi bi-gender-male text-info me-1';
        } else if (sex === 'F' || sex === 'FEMALE') {
            sexEl.textContent = 'Female';
            sexIcon.className = 'bi bi-gender-female text-danger me-1';
        } else {
            sexEl.textContent = sex || '-';
            sexIcon.className = 'bi bi-gender-ambiguous text-warning me-1';
        }
    }

    console.log('Navbar patient info updated:', data.patient_name, 'Age:', ageEl?.textContent);
};

window.DICOM_VIEWER.updateViewportInfo = function () {
    const viewports = document.querySelectorAll('.viewport');
    const state = window.DICOM_VIEWER.STATE;

    viewports.forEach((viewport, index) => {
        try {
            const enabledElement = cornerstone.getEnabledElement(viewport);
            if (enabledElement && enabledElement.image) {
                const cornerstoneViewport = cornerstone.getViewport(viewport);
                const info = viewport.querySelector('.viewport-info');

                if (info && cornerstoneViewport) {
                    const zoomText = `Zoom: ${(cornerstoneViewport.scale * 100).toFixed(0)}%`;
                    const windowText = `W: ${Math.round(cornerstoneViewport.voi.windowWidth)} L: ${Math.round(cornerstoneViewport.voi.windowCenter)}`;
                    const frameText = state.totalImages > 1 ? `Frame: ${state.currentImageIndex + 1}/${state.totalImages}` : '';

                    info.innerHTML = `
                        <div>${windowText}</div>
                        <div>${zoomText}</div>
                        ${frameText ? `<div>${frameText}</div>` : ''}
                    `;
                }
            }
        } catch (error) {
            // This can throw an error if the viewport is not yet displaying an image.
        }
    });
};

// ===== VIEWPORT AND TOOL FUNCTIONS =====

window.DICOM_VIEWER.setupViewports = function () {
    return window.DICOM_VIEWER.MANAGERS.viewportManager.createViewports(window.DICOM_VIEWER.MANAGERS.viewportManager.currentLayout);
};

window.DICOM_VIEWER.setViewportLayout = function (layout) {
    return window.DICOM_VIEWER.MANAGERS.viewportManager.switchLayout(layout);
};

window.DICOM_VIEWER.setActiveTool = function (toolName, clickedButton) {
    const toolNameMap = window.DICOM_VIEWER.CONSTANTS.TOOL_NAME_MAP;
    const toolsPanel = document.getElementById('tools-panel');
    const state = window.DICOM_VIEWER.STATE;

    // Track current active tool in state
    if (!state.activeTool) state.activeTool = null;

    try {
        // If clicking the same tool that's already active, disable it (toggle off)
        if (state.activeTool === toolName) {
            console.log(`Toggling off active tool: ${toolName}`);

            // Disable the tool
            try {
                cornerstoneTools.setToolDisabled(toolName);
            } catch (error) { /* ignore */ }

            // Clear active state
            state.activeTool = null;

            // Re-enable crosshairs when tool is deactivated
            if (window.DICOM_VIEWER.MANAGERS.crosshairManager) {
                window.DICOM_VIEWER.MANAGERS.crosshairManager.enable();
                console.log('Crosshairs re-enabled');
            }

            // Re-enable mouse controls when tool is deactivated
            if (window.DICOM_VIEWER.MANAGERS.mouseControls) {
                window.DICOM_VIEWER.MANAGERS.mouseControls.enable();
                console.log('Mouse controls re-enabled');
            }

            // Update button styling - remove active classes
            if (clickedButton) {
                clickedButton.classList.remove('btn-primary', 'active');
                clickedButton.classList.add('btn-secondary');
                clickedButton.removeAttribute('aria-pressed');
                clickedButton.style.transform = '';
            }

            window.DICOM_VIEWER.showAISuggestion('Tool disabled - drag and drop now available');
            return;
        }

        console.log(`Setting active tool: ${toolName}`);

        // Disable crosshairs when a tool is activated
        if (window.DICOM_VIEWER.MANAGERS.crosshairManager) {
            window.DICOM_VIEWER.MANAGERS.crosshairManager.disable();
            console.log('Crosshairs disabled while tool is active');
        }

        // Disable mouse controls when a tool is activated
        if (window.DICOM_VIEWER.MANAGERS.mouseControls) {
            window.DICOM_VIEWER.MANAGERS.mouseControls.disable();
            console.log('Mouse controls disabled while tool is active');
        }

        // Set annotation tools to passive mode (keep visible) and disable non-annotation tools
        const annotationTools = ['Length', 'Angle', 'FreehandRoi', 'EllipticalRoi', 'RectangleRoi', 'Probe'];

        Object.values(toolNameMap).forEach(tool => {
            try {
                if (annotationTools.includes(tool)) {
                    // Keep annotation tools passive so their markings remain visible
                    cornerstoneTools.setToolPassive(tool);
                } else {
                    // Disable non-annotation tools
                    cornerstoneTools.setToolDisabled(tool);
                }
            } catch (error) { /* ignore */ }
        });

        // Activate the selected tool
        cornerstoneTools.setToolActive(toolName, { mouseButtonMask: 1 });

        // Update state
        state.activeTool = toolName;

        // Update all button states - remove active classes first
        toolsPanel.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.remove('btn-primary', 'active');
            btn.classList.add('btn-secondary');
            btn.removeAttribute('aria-pressed');
            btn.style.transform = '';
        });

        // Set the clicked button as active with enhanced styling
        if (clickedButton) {
            clickedButton.classList.remove('btn-secondary');
            clickedButton.classList.add('btn-primary', 'active');
            clickedButton.setAttribute('aria-pressed', 'true');

            // Add visual feedback
            clickedButton.style.transform = 'scale(1.05)';
        }

        console.log(`Tool ${toolName} activated successfully`);

    } catch (error) {
        console.error('Error setting active tool:', error);
    }
};
// ===== EVENT HANDLERS =====

// 2. Enhanced tool selection handler with better visual feedback
window.DICOM_VIEWER.handleToolSelection = function (event) {
    const button = event.target.closest('button');
    if (button && button.dataset.tool) {
        const cornerstoneToolName = window.DICOM_VIEWER.CONSTANTS.TOOL_NAME_MAP[button.dataset.tool];
        if (cornerstoneToolName) {
            // Add click animation
            button.style.transform = 'scale(0.95)';
            setTimeout(() => {
                window.DICOM_VIEWER.setActiveTool(cornerstoneToolName, button);
            }, 100);

            // Show tool selection feedback
            if (window.DICOM_VIEWER.showAISuggestion) {
                const toolDisplayNames = {
                    'Pan': 'Pan Tool',
                    'Zoom': 'Zoom Tool',
                    'Wwwc': 'Window/Level Tool',
                    'Length': 'Length Measurement',
                    'Angle': 'Angle Measurement',
                    'FreehandRoi': 'Freehand Drawing',
                    'EllipticalRoi': 'Elliptical ROI',
                    'RectangleRoi': 'Rectangle ROI',
                    'Probe': 'Pixel Probe'
                };
                const displayName = toolDisplayNames[button.dataset.tool] || button.dataset.tool;
                window.DICOM_VIEWER.showAISuggestion(`${displayName} activated`);
            }
        }
    }
};

// 3. No default tool on initialization - all tools disabled by default
function setDefaultTool() {
    console.log('Initializing with no default tool - all tools disabled');
    const toolsPanel = document.getElementById('tools-panel');
    const state = window.DICOM_VIEWER.STATE;

    // Clear any active tool state
    state.activeTool = null;

    // Deactivate all tools
    const toolNameMap = window.DICOM_VIEWER.CONSTANTS.TOOL_NAME_MAP;
    Object.values(toolNameMap).forEach(tool => {
        try {
            cornerstoneTools.setToolDisabled(tool);
        } catch (error) { /* ignore */ }
    });

    // Remove active styling from all buttons
    toolsPanel.querySelectorAll('.tool-btn').forEach(btn => {
        btn.classList.remove('btn-primary', 'active');
        btn.classList.add('btn-secondary');
        btn.removeAttribute('aria-pressed');
        btn.style.transform = '';
    });

    console.log('All tools disabled - drag and drop is now available');
}

window.DICOM_VIEWER.handleImageSliderChange = function (event) {
    const state = window.DICOM_VIEWER.STATE;
    const newIndex = parseInt(event.target.value);
    if (newIndex !== state.currentImageIndex && newIndex >= 0 && newIndex < state.totalImages) {
        state.currentImageIndex = newIndex;
        if (state.currentSeriesImages[state.currentImageIndex]) {
            state.currentFileId = state.currentSeriesImages[state.currentImageIndex].id;
            window.DICOM_VIEWER.updateImageCounter();
            window.DICOM_VIEWER.loadCurrentImage();
            window.DICOM_VIEWER.setupImageNavigation();

            if (state.mprEnabled && window.DICOM_VIEWER.MANAGERS.mprManager.volumeData) {
                window.DICOM_VIEWER.updateAllMPRViews();
            }
        }
    }
};

window.DICOM_VIEWER.handleFPSChange = function (event) {
    const state = window.DICOM_VIEWER.STATE;
    state.currentFPS = parseInt(event.target.value);
    document.getElementById('fpsDisplay').textContent = state.currentFPS;
    if (state.isPlaying) {
        window.DICOM_VIEWER.stopCine();
        window.DICOM_VIEWER.startCine();
    }
};

// ===== IMAGE NAVIGATION =====

window.DICOM_VIEWER.navigateImage = function (direction) {
    const state = window.DICOM_VIEWER.STATE;
    const newIndex = state.currentImageIndex + direction;

    console.log('[DEBUG] navigateImage called. Direction:', direction, 'Current:', state.currentImageIndex, 'New:', newIndex, 'Total:', state.totalImages);

    if (newIndex >= 0 && newIndex < state.totalImages) {
        state.currentImageIndex = newIndex;
        const slider = document.getElementById('imageSlider');
        if (slider) {
            slider.value = state.currentImageIndex;
        }
        state.currentFileId = state.currentSeriesImages[state.currentImageIndex].id;
        console.log('[DEBUG] Navigating to image:', state.currentFileId);
        window.DICOM_VIEWER.updateImageCounter();
        window.DICOM_VIEWER.loadCurrentImage();
        window.DICOM_VIEWER.setupImageNavigation();
    } else {
        console.warn('[DEBUG] Navigation blocked - index out of bounds');
    }
};

window.DICOM_VIEWER.setupImageNavigation = function () {
    const state = window.DICOM_VIEWER.STATE;
    const prevBtn = document.getElementById('prevImage');
    const nextBtn = document.getElementById('nextImage');
    const imageSlider = document.getElementById('imageSlider');

    console.log('[DEBUG] setupImageNavigation called. Total images:', state.totalImages, 'Current index:', state.currentImageIndex);

    if (prevBtn && nextBtn) {
        prevBtn.disabled = state.currentImageIndex <= 0;
        nextBtn.disabled = state.currentImageIndex >= state.totalImages - 1;
        console.log('[DEBUG] Navigation buttons updated. Prev disabled:', prevBtn.disabled, 'Next disabled:', nextBtn.disabled);
    }

    if (imageSlider) {
        imageSlider.disabled = state.totalImages <= 1;
        imageSlider.style.opacity = state.totalImages > 1 ? '1' : '0.5';
        console.log('[DEBUG] Image slider updated. Disabled:', imageSlider.disabled);
    }

    const playBtn = document.getElementById('playPause');
    const stopBtn = document.getElementById('stopCine');

    if (playBtn && stopBtn) {
        playBtn.disabled = state.totalImages <= 1;
        stopBtn.disabled = state.totalImages <= 1;
        console.log('[DEBUG] Cine buttons updated. Play disabled:', playBtn.disabled, 'Stop disabled:', stopBtn.disabled);
    }
};

// ===== CINE FUNCTIONS (FIXED for smooth playback) =====

window.DICOM_VIEWER.toggleCinePlay = function () {
    const state = window.DICOM_VIEWER.STATE;

    console.log('[DEBUG] toggleCinePlay called. Total images:', state.totalImages, 'Currently playing:', state.isPlaying);

    if (state.totalImages <= 1) {
        console.warn('[DEBUG] Cannot play cine: Only one frame available');
        alert('Cannot play cine: Only one frame available');
        return;
    }

    if (state.isPlaying) {
        console.log('[DEBUG] Stopping cine playback');
        window.DICOM_VIEWER.stopCine();
    } else {
        console.log('[DEBUG] Starting cine playback');
        window.DICOM_VIEWER.startCine();
    }
};

window.DICOM_VIEWER.startCine = function () {
    const state = window.DICOM_VIEWER.STATE;

    if (state.totalImages <= 1) return;

    state.isPlaying = true;
    document.getElementById('playPause').innerHTML = '<i class="bi bi-pause-fill"></i>';

    state.cineInterval = setInterval(() => {
        let nextIndex = state.currentImageIndex + 1;
        if (nextIndex >= state.totalImages) {
            nextIndex = 0;
        }

        state.currentImageIndex = nextIndex;
        document.getElementById('imageSlider').value = state.currentImageIndex;
        state.currentFileId = state.currentSeriesImages[state.currentImageIndex].id;

        // Update counter but skip loading indicators for smooth playback
        window.DICOM_VIEWER.updateImageCounter();
        window.DICOM_VIEWER.loadCurrentImage(true); // Skip loading indicator during cine
    }, 1000 / state.currentFPS);
};

window.DICOM_VIEWER.stopCine = function () {
    const state = window.DICOM_VIEWER.STATE;

    state.isPlaying = false;
    document.getElementById('playPause').innerHTML = '<i class="bi bi-play-fill"></i>';

    if (state.cineInterval) {
        clearInterval(state.cineInterval);
        state.cineInterval = null;
    }
};

// ===== WINDOW/LEVEL FUNCTIONS =====

window.DICOM_VIEWER.applyWindowLevelPreset = function (presetName) {
    const preset = window.DICOM_VIEWER.CONSTANTS.WINDOW_LEVEL_PRESETS[presetName];
    const event = window.event;
    if (preset && event.target) {
        const windowSlider = document.getElementById('windowSlider');
        const levelSlider = document.getElementById('levelSlider');
        const windowValue = document.getElementById('windowValue');
        const levelValue = document.getElementById('levelValue');

        windowSlider.value = preset.window;
        levelSlider.value = preset.level;
        windowValue.textContent = preset.window;
        levelValue.textContent = preset.level;
        window.DICOM_VIEWER.applyWindowLevel(preset.window, preset.level);

        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.classList.remove('btn-primary');
            btn.classList.add('btn-outline-secondary');
        });
        event.target.classList.remove('btn-outline-secondary');
        event.target.classList.add('btn-primary');
    }
};

window.DICOM_VIEWER.applyWindowLevel = function (windowWidth, windowLevel) {
    const elements = document.querySelectorAll('.viewport');

    elements.forEach(element => {
        try {
            const enabledElement = cornerstone.getEnabledElement(element);
            if (enabledElement && enabledElement.image) {
                const viewport = cornerstone.getViewport(element);
                viewport.voi.windowWidth = windowWidth;
                viewport.voi.windowCenter = windowLevel;
                cornerstone.setViewport(element, viewport);
            }
        } catch (error) {
            console.warn('Error applying window/level:', error);
        }
    });

    window.DICOM_VIEWER.updateViewportInfo();
};

// ===== IMAGE MANIPULATION FUNCTIONS (FIXED TYPO) =====

window.DICOM_VIEWER.resetActiveViewport = function () {
    const state = window.DICOM_VIEWER.STATE;

    // Get the active viewport only (not all viewports)
    const targetViewport = state.activeViewport ||
        (window.DICOM_VIEWER.MANAGERS.viewportManager ?
            window.DICOM_VIEWER.MANAGERS.viewportManager.getAllViewports()[0] :
            document.querySelector('.viewport'));

    if (!targetViewport) {
        console.error('No active viewport found to reset');
        return;
    }

    try {
        const enabledElement = cornerstone.getEnabledElement(targetViewport);
        if (!enabledElement || !enabledElement.image) {
            console.error('Viewport does not have an enabled image');
            return;
        }

        // Clear all tool annotations/measurements from this viewport
        const imageId = enabledElement.image.imageId;

        // Method 1: Clear from global image-specific tool state manager
        const toolStateManager = cornerstoneTools.globalImageIdSpecificToolStateManager;
        if (toolStateManager && imageId) {
            const toolState = toolStateManager.toolState;
            if (toolState && toolState[imageId]) {
                delete toolState[imageId];
                console.log('Cleared tool state from globalImageIdSpecificToolStateManager');
            }
        }

        // Method 2: Clear from element-specific tool state manager
        try {
            const elementToolStateManager = cornerstoneTools.getElementToolStateManager(targetViewport);
            if (elementToolStateManager) {
                elementToolStateManager.clear(targetViewport);
                console.log('Cleared tool state from elementToolStateManager');
            }
        } catch (e) {
            console.log('elementToolStateManager not available');
        }

        // Method 3: Clear tool state directly from all annotation tools
        const annotationTools = ['Length', 'Angle', 'FreehandRoi', 'EllipticalRoi', 'RectangleRoi', 'Probe'];
        annotationTools.forEach(toolName => {
            try {
                cornerstoneTools.clearToolState(targetViewport, toolName);
                console.log(`Cleared ${toolName} tool state`);
            } catch (e) {
                // Tool might not have any state
            }
        });

        // Reset Cornerstone viewport (zoom, pan, W/L to default)
        cornerstone.reset(targetViewport);

        // Reset enhancements
        if (window.DICOM_VIEWER.MANAGERS.enhancementManager) {
            window.DICOM_VIEWER.MANAGERS.enhancementManager.resetEnhancement(targetViewport);
        }

        // Force viewport update to reflect changes
        cornerstone.updateImage(targetViewport);

        // Reset UI controls
        const brightnessSlider = document.getElementById('brightnessSlider');
        const contrastSlider = document.getElementById('contrastSlider');
        const sharpenSlider = document.getElementById('sharpenSlider');

        if (brightnessSlider) brightnessSlider.value = 0;
        if (contrastSlider) contrastSlider.value = 1;
        if (sharpenSlider) sharpenSlider.value = 0;

        window.DICOM_VIEWER.updateViewportInfo();
        window.DICOM_VIEWER.showAISuggestion('Active viewport reset: zoom, pan, W/L, and annotations cleared');

    } catch (error) {
        console.error('Error resetting viewport:', error);
    }
};

window.DICOM_VIEWER.invertImage = function () {
    let activeViewport = window.DICOM_VIEWER.STATE.activeViewport;

    // If no active viewport, try to get the first available viewport with an image
    if (!activeViewport) {
        const viewports = document.querySelectorAll('.viewport');
        for (let vp of viewports) {
            try {
                const enabled = cornerstone.getEnabledElement(vp);
                if (enabled && enabled.image) {
                    activeViewport = vp;
                    break;
                }
            } catch (e) { /* ignore */ }
        }
    }

    if (!activeViewport) {
        console.warn('No viewport available for invert operation');
        return;
    }

    try {
        const viewport = cornerstone.getViewport(activeViewport);
        viewport.invert = !viewport.invert;
        cornerstone.setViewport(activeViewport, viewport);
    } catch (error) {
        console.error('Error inverting image:', error);
    }
};

window.DICOM_VIEWER.flipImage = function (direction) {
    let activeViewport = window.DICOM_VIEWER.STATE.activeViewport;

    // If no active viewport, try to get the first available viewport with an image
    if (!activeViewport) {
        const viewports = document.querySelectorAll('.viewport');
        for (let vp of viewports) {
            try {
                const enabled = cornerstone.getEnabledElement(vp);
                if (enabled && enabled.image) {
                    activeViewport = vp;
                    break;
                }
            } catch (e) { /* ignore */ }
        }
    }

    if (!activeViewport) {
        console.warn('No viewport available for flip operation');
        return;
    }

    try {
        const viewport = cornerstone.getViewport(activeViewport);
        if (direction === 'horizontal') {
            viewport.hflip = !viewport.hflip;
        } else {
            viewport.vflip = !viewport.vflip;
        }
        cornerstone.setViewport(activeViewport, viewport);
    } catch (error) {
        console.error('Error flipping image:', error);
    }
};

window.DICOM_VIEWER.rotateImage = function (angle) {
    let activeViewport = window.DICOM_VIEWER.STATE.activeViewport;

    // If no active viewport, try to get the first available viewport with an image
    if (!activeViewport) {
        const viewports = document.querySelectorAll('.viewport');
        for (let vp of viewports) {
            try {
                const enabled = cornerstone.getEnabledElement(vp);
                if (enabled && enabled.image) {
                    activeViewport = vp;
                    break;
                }
            } catch (e) { /* ignore */ }
        }
    }

    if (!activeViewport) {
        console.warn('No viewport available for rotate operation');
        return;
    }

    try {
        const viewport = cornerstone.getViewport(activeViewport);
        viewport.rotation += angle;
        cornerstone.setViewport(activeViewport, viewport);
    } catch (error) {
        console.error('Error rotating image:', error);
    }
};

// ===== DISPLAY OPTIONS =====

window.DICOM_VIEWER.toggleOverlay = function (event) {
    const show = event.target.checked;
    document.querySelectorAll('.viewport-overlay').forEach(overlay => {
        overlay.style.display = show ? 'block' : 'none';
    });
};

window.DICOM_VIEWER.toggleMeasurements = function (event) {
    const show = event.target.checked;
    document.querySelectorAll('.viewport').forEach(element => {
        try {
            cornerstone.updateImage(element);
        } catch (error) { /* ignore */ }
    });
};

window.DICOM_VIEWER.toggleReferenceLines = function () {
    const show = document.getElementById('showReferenceLines').checked;
    console.log(`Reference lines toggled: ${show}. (Implementation needed)`);
};

// Replace the changeInterpolation function in main.js
window.DICOM_VIEWER.changeInterpolation = function (event) {
    const interpolationMode = parseInt(event.target.value);
    let pixelReplication = false;
    let imageRendering = 'auto';

    console.log(`Changing interpolation to mode: ${interpolationMode}`);

    // Set interpolation settings based on selection
    switch (interpolationMode) {
        case 0: // Nearest Neighbor
            pixelReplication = true;
            imageRendering = 'pixelated';
            console.log('Applied: Nearest Neighbor (Pixelated)');
            break;
        case 1: // Linear (default)
            pixelReplication = false;
            imageRendering = 'auto';
            console.log('Applied: Linear Interpolation');
            break;
        case 2: // Cubic (smooth)
            pixelReplication = false;
            imageRendering = 'smooth';
            console.log('Applied: Cubic Interpolation (Smooth)');
            break;
        default:
            pixelReplication = false;
            imageRendering = 'auto';
    }

    // Apply to all current viewports
    const viewports = document.querySelectorAll('.viewport');
    let appliedCount = 0;

    viewports.forEach(element => {
        try {
            const enabledElement = cornerstone.getEnabledElement(element);
            if (enabledElement && enabledElement.image) {
                // Apply Cornerstone viewport settings
                const viewport = cornerstone.getViewport(element);
                viewport.pixelReplication = pixelReplication;
                cornerstone.setViewport(element, viewport);

                // Apply CSS rendering hints
                const canvas = element.querySelector('canvas');
                if (canvas) {
                    canvas.style.imageRendering = imageRendering;

                    // Additional CSS for better interpolation control
                    if (interpolationMode === 0) {
                        canvas.style.imageRendering = 'pixelated';
                        canvas.style.msInterpolationMode = 'nearest-neighbor'; // IE support
                    } else if (interpolationMode === 2) {
                        canvas.style.imageRendering = 'smooth';
                        canvas.style.imageRendering = '-webkit-optimize-contrast';
                    } else {
                        canvas.style.imageRendering = 'auto';
                    }
                }

                // Force image update
                cornerstone.updateImage(element);
                appliedCount++;
            }
        } catch (error) {
            console.warn('Error applying interpolation to viewport:', error);
        }
    });

    const modeNames = ['Nearest Neighbor', 'Linear', 'Cubic'];
    const modeName = modeNames[interpolationMode] || 'Linear';

    if (appliedCount > 0) {
        window.DICOM_VIEWER.showAISuggestion(`Interpolation changed to ${modeName} (applied to ${appliedCount} viewport${appliedCount > 1 ? 's' : ''})`);
    } else {
        window.DICOM_VIEWER.showAISuggestion(`Interpolation set to ${modeName} (will apply to images when loaded)`);
    }
};


// Add this new function to main.js for MPR Quality control
window.DICOM_VIEWER.changeMPRQuality = function (event) {
    const quality = event.target.value;
    console.log(`Changing MPR Quality to: ${quality}`);

    // Store quality setting in state
    if (!window.DICOM_VIEWER.STATE.mprSettings) {
        window.DICOM_VIEWER.STATE.mprSettings = {};
    }
    window.DICOM_VIEWER.STATE.mprSettings.quality = quality;

    // Update MPR Manager settings if available
    if (window.DICOM_VIEWER.MANAGERS.mprManager) {
        const mprManager = window.DICOM_VIEWER.MANAGERS.mprManager;

        // Apply quality-specific settings
        switch (quality) {
            case 'low':
                mprManager.interpolationMethod = 'nearest';
                mprManager.processingThreads = 1;
                mprManager.cacheSize = 50;
                break;
            case 'medium':
                mprManager.interpolationMethod = 'trilinear';
                mprManager.processingThreads = 2;
                mprManager.cacheSize = 100;
                break;
            case 'high':
                mprManager.interpolationMethod = 'cubic';
                mprManager.processingThreads = 4;
                mprManager.cacheSize = 200;
                break;
        }

        console.log(`MPR Manager updated: interpolation=${mprManager.interpolationMethod}`);
    }

    // If MPR views are currently displayed, regenerate them with new quality
    if (window.DICOM_VIEWER.STATE.mprViewports &&
        window.DICOM_VIEWER.MANAGERS.mprManager &&
        window.DICOM_VIEWER.MANAGERS.mprManager.volumeData) {

        const activeOrientations = ['axial', 'sagittal', 'coronal'].filter(orientation => {
            const viewport = window.DICOM_VIEWER.STATE.mprViewports[orientation];
            if (!viewport) return false;

            try {
                const enabledElement = cornerstone.getEnabledElement(viewport);
                return enabledElement && enabledElement.image;
            } catch (error) {
                return false;
            }
        });

        if (activeOrientations.length > 0) {
            // Show loading indicator
            window.DICOM_VIEWER.showLoadingIndicator(`Updating MPR quality to ${quality}...`);

            // Regenerate active MPR views with new quality
            setTimeout(async () => {
                try {
                    for (const orientation of activeOrientations) {
                        const position = window.DICOM_VIEWER.STATE.currentSlicePositions[orientation] || 0.5;
                        window.DICOM_VIEWER.updateMPRSlice(orientation, position);
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }

                    window.DICOM_VIEWER.hideLoadingIndicator();

                    const qualityLabels = {
                        'low': 'Low (Fast)',
                        'medium': 'Medium',
                        'high': 'High (Slow)'
                    };

                    window.DICOM_VIEWER.showAISuggestion(
                        `MPR quality updated to ${qualityLabels[quality]}. ${activeOrientations.length} view${activeOrientations.length > 1 ? 's' : ''} regenerated.`
                    );

                } catch (error) {
                    window.DICOM_VIEWER.hideLoadingIndicator();
                    console.error('Error updating MPR quality:', error);
                    window.DICOM_VIEWER.showAISuggestion(`Error updating MPR quality: ${error.message}`);
                }
            }, 200);
        } else {
            const qualityLabels = {
                'low': 'Low (Fast)',
                'medium': 'Medium',
                'high': 'High (Slow)'
            };
            window.DICOM_VIEWER.showAISuggestion(`MPR quality set to ${qualityLabels[quality]} (will apply to future MPR views)`);
        }
    } else {
        const qualityLabels = {
            'low': 'Low (Fast)',
            'medium': 'Medium',
            'high': 'High (Slow)'
        };
        window.DICOM_VIEWER.showAISuggestion(`MPR quality set to ${qualityLabels[quality]} (will apply when MPR volume is built)`);
    }
};

window.DICOM_VIEWER.clearAllMeasurements = function () {
    const state = window.DICOM_VIEWER.STATE;
    const toolNameMap = window.DICOM_VIEWER.CONSTANTS.TOOL_NAME_MAP;

    state.measurements = [];
    document.querySelectorAll('.viewport').forEach(element => {
        Object.values(toolNameMap).forEach(tool => {
            try {
                cornerstoneTools.clearToolState(element, tool);
            } catch (error) { /* ignore */ }
        });
        try {
            cornerstone.updateImage(element);
        } catch (e) {/* ignore */ }
    });

    document.getElementById('measurements-list').innerHTML = '<div class="text-muted">No measurements</div>';
    window.DICOM_VIEWER.showAISuggestion('All measurements cleared.');
};

window.DICOM_VIEWER.toggleFullscreen = function () {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            alert(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
        });
        document.getElementById('fullscreenBtn').innerHTML = '<i class="bi bi-fullscreen-exit"></i>';
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
        document.getElementById('fullscreenBtn').innerHTML = '<i class="bi bi-arrows-fullscreen"></i>';
    }
};

// ===== MPR FUNCTIONS =====

window.DICOM_VIEWER.setupMPRViews = async function () {
    console.log('=== SETUP PROFESSIONAL MPR VIEWS ===');

    const state = window.DICOM_VIEWER.STATE;

    if (state.currentSeriesImages.length < 2) {
        console.log('SETUP MPR VIEWS: Need at least 2 images for MPR - skipping');
        window.DICOM_VIEWER.showAISuggestion(`MPR requires at least 2 images. Current series has only ${state.currentSeriesImages.length} image(s).`);
        return;
    }

    if (!state.mprEnabled) {
        console.log('SETUP MPR VIEWS: MPR is disabled - skipping');
        return;
    }

    // Ensure we have 2x2 layout first
    if (window.DICOM_VIEWER.MANAGERS.viewportManager.currentLayout !== '2x2') {
        console.log('SETUP MPR VIEWS: Switching to 2x2 layout first...');
        window.DICOM_VIEWER.MANAGERS.viewportManager.switchLayout('2x2');
        await new Promise(resolve => setTimeout(resolve, 800));
    }

    console.log('SETUP MPR VIEWS: Starting Professional MPR build process');

    try {
        const imageIds = [];
        const basePath = window.basePath || '';

        for (let i = 0; i < state.currentSeriesImages.length; i++) {
            const img = state.currentSeriesImages[i];
            console.log(`Processing image ${i + 1}/${state.currentSeriesImages.length}: ${img.id}`);

            try {
                let imageId;

                // Check if this is an Orthanc image
                if (img.isOrthancImage || img.orthancInstanceId || img.instanceId) {
                    // Orthanc image - use the Orthanc proxy endpoint
                    const orthancInstanceId = img.orthancInstanceId || img.instanceId || img.id;
                    imageId = `wadouri:${window.location.origin}${basePath}/api/get_dicom_from_orthanc.php?instanceId=${orthancInstanceId}`;
                    console.log(`Using Orthanc endpoint for image ${i + 1}: ${orthancInstanceId}`);
                    imageIds.push(imageId);
                } else {
                    // Local image - use the original base64 fetch method
                    const response = await fetch(`${basePath}/get_dicom_fast.php?id=${img.id}&format=base64`);

                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }

                    const data = await response.json();

                    if (data.success && data.file_data) {
                        imageId = 'wadouri:data:application/dicom;base64,' + data.file_data;
                        imageIds.push(imageId);
                    } else {
                        throw new Error('Invalid response data');
                    }
                }

                // Progress update every 10 images
                if ((i + 1) % 10 === 0) {
                    window.DICOM_VIEWER.updateLoadingProgress(`Building MPR volume: ${i + 1}/${state.currentSeriesImages.length} images...`, ((i + 1) / state.currentSeriesImages.length) * 50);
                    await new Promise(resolve => setTimeout(resolve, 10));
                }

            } catch (error) {
                console.error(`Failed to prepare image ${i + 1}:`, error.message);
                continue;
            }
        }

        if (imageIds.length === 0) {
            throw new Error('No valid images found for MPR volume');
        }

        console.log(`SETUP MPR VIEWS: Building professional volume with ${imageIds.length} images`);

        // Use the professional MPR manager
        const volumeBuilt = await window.DICOM_VIEWER.MANAGERS.mprManager.buildVolume(imageIds);

        if (volumeBuilt) {
            console.log('SETUP MPR VIEWS: Professional volume build successful, setting up viewports...');

            // Setup MPR viewports
            const viewportsReady = await window.DICOM_VIEWER.setupMPRViewports();

            if (!viewportsReady) {
                throw new Error('Failed to setup MPR viewports');
            }

            document.getElementById('mprNavigation').style.display = 'block';

            ['mprAxial', 'mprSagittal', 'mprCoronal', 'mprAll'].forEach(id => {
                const btn = document.getElementById(id);
                if (btn) btn.disabled = false;
            });

            // Run diagnostics
            const diagnostics = window.DICOM_VIEWER.MANAGERS.mprManager.runDiagnostics();

            const volumeInfo = window.DICOM_VIEWER.MANAGERS.mprManager.getVolumeInfo();
            window.DICOM_VIEWER.showAISuggestion(`Professional MPR volume ready! ${volumeInfo.dimensions.width}×${volumeInfo.dimensions.height}×${volumeInfo.dimensions.depth} voxels with ${(diagnostics.volumeStats.fillRatio * 100).toFixed(1)}% data density`);

            console.log('=== SETUP PROFESSIONAL MPR VIEWS COMPLETED SUCCESSFULLY ===');
        } else {
            throw new Error('Professional volume build failed');
        }

    } catch (error) {
        console.error('=== SETUP PROFESSIONAL MPR VIEWS FAILED ===');
        console.error('Professional MPR setup error:', error);

        window.DICOM_VIEWER.showAISuggestion(`Professional MPR setup failed: ${error.message}`);

        document.getElementById('mprNavigation').style.display = 'none';

        ['mprAxial', 'mprSagittal', 'mprCoronal', 'mprAll'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) btn.disabled = true;
        });
    }

    console.log('SETUP PROFESSIONAL MPR VIEWS: Process completed');
};

window.DICOM_VIEWER.setupMPRViewports = async function () {
    console.log('Setting up MPR viewports...');

    if (window.DICOM_VIEWER.MANAGERS.viewportManager.currentLayout !== '2x2') {
        console.log('MPR requires 2x2 layout, switching...');
        window.DICOM_VIEWER.MANAGERS.viewportManager.switchLayout('2x2');

        // Wait for layout switch to complete
        await new Promise(resolve => setTimeout(resolve, 800));
    }

    // Wait for viewports to be fully created and enabled
    await new Promise(resolve => setTimeout(resolve, 500));

    window.DICOM_VIEWER.STATE.mprViewports = {
        axial: window.DICOM_VIEWER.MANAGERS.viewportManager.getViewport('axial'),
        sagittal: window.DICOM_VIEWER.MANAGERS.viewportManager.getViewport('sagittal'),
        coronal: window.DICOM_VIEWER.MANAGERS.viewportManager.getViewport('coronal'),
        original: window.DICOM_VIEWER.MANAGERS.viewportManager.getViewport('original')
    };

    console.log('MPR viewports configured:', Object.keys(window.DICOM_VIEWER.STATE.mprViewports));

    // Verify and enable all viewports
    let allEnabled = true;
    for (const [name, viewport] of Object.entries(window.DICOM_VIEWER.STATE.mprViewports)) {
        if (!viewport) {
            console.error(`Missing MPR viewport: ${name}`);
            allEnabled = false;
            continue;
        }

        try {
            cornerstone.getEnabledElement(viewport);
            console.log(`✓ Viewport ${name} is already enabled`);
        } catch (error) {
            try {
                cornerstone.enable(viewport);
                console.log(`✓ Enabled viewport ${name}`);
                await new Promise(resolve => setTimeout(resolve, 100)); // Small delay after enabling
            } catch (enableError) {
                console.error(`✗ Failed to enable viewport ${name}:`, enableError);
                allEnabled = false;
            }
        }
    }

    if (!allEnabled) {
        console.error('Not all MPR viewports are properly enabled');
        return false;
    }

    console.log('All MPR viewports are enabled and ready');
    return true;
};

window.DICOM_VIEWER.updateMPRSlice = function (orientation, position) {
    const validPosition = Math.max(0, Math.min(1, parseFloat(position)));
    window.DICOM_VIEWER.STATE.currentSlicePositions[orientation] = validPosition;

    if (!window.DICOM_VIEWER.MANAGERS.mprManager.volumeData) {
        console.warn(`Cannot update ${orientation} slice - missing volume data`);
        return;
    }

    // Get the viewport
    const viewport = window.DICOM_VIEWER.STATE.mprViewports && window.DICOM_VIEWER.STATE.mprViewports[orientation];
    if (!viewport) {
        console.warn(`Cannot update ${orientation} slice - missing viewport`);
        return;
    }

    // Verify viewport is enabled
    let isEnabled = false;
    try {
        cornerstone.getEnabledElement(viewport);
        isEnabled = true;
    } catch (error) {
        console.log(`Viewport ${orientation} is not enabled, attempting to enable...`);

        try {
            cornerstone.enable(viewport);
            console.log(`Successfully re-enabled viewport: ${orientation}`);
            isEnabled = true;

            setTimeout(() => {
                window.DICOM_VIEWER.updateMPRSlice(orientation, position);
            }, 200);
            return;

        } catch (enableError) {
            console.error(`Failed to re-enable viewport ${orientation}:`, enableError);

            viewport.innerHTML = `
                <div style="color: white; text-align: center; padding: 20px; display: flex; flex-direction: column; justify-content: center; height: 100%;">
                    <h6>MPR ${orientation.toUpperCase()} Error</h6>
                    <p class="small">Viewport not enabled</p>
                    <button onclick="window.DICOM_VIEWER.setupMPRViews()" class="btn btn-primary btn-sm">Rebuild MPR</button>
                </div>
            `;
            return;
        }
    }

    if (!isEnabled) return;

    try {
        console.log(`Updating ${orientation} slice to position ${validPosition} using Professional MPR`);

        // Use the professional MPR manager to generate the slice
        const sliceData = window.DICOM_VIEWER.MANAGERS.mprManager.generateProfessionalMPRSlice(orientation, validPosition);

        if (sliceData && sliceData.image) {
            // Display the professionally reconstructed image
            cornerstone.displayImage(viewport, sliceData.image);

            // Update slice indicator
            const sliceIndicator = viewport.querySelector('.slice-indicator');
            if (sliceIndicator) {
                const sliceNum = sliceData.sliceIndex + 1;
                const totalSlices = window.DICOM_VIEWER.MANAGERS.mprManager.getSliceCount();
                const quality = sliceData.qualityScore ? `${(sliceData.qualityScore * 100).toFixed(0)}%` : 'N/A';
                sliceIndicator.textContent = `${orientation.toUpperCase()} - ${sliceNum}/${totalSlices} (${Math.round(validPosition * 100)}%) Q:${quality}`;
            }

            // Force viewport update
            cornerstone.updateImage(viewport);

            console.log(`Successfully updated ${orientation} slice using Professional MPR (Quality: ${sliceData.qualityScore ? (sliceData.qualityScore * 100).toFixed(1) + '%' : 'N/A'})`);
        } else {
            console.warn(`Failed to generate professional ${orientation} slice at position ${validPosition}`);

            // Show error in viewport
            viewport.innerHTML = `
                <div style="color: white; text-align: center; padding: 20px; display: flex; flex-direction: column; justify-content: center; height: 100%;">
                    <h6>MPR ${orientation.toUpperCase()} Reconstruction Failed</h6>
                    <p class="small">Unable to generate slice at position ${Math.round(validPosition * 100)}%</p>
                    <button onclick="window.DICOM_VIEWER.setupMPRViews()" class="btn btn-primary btn-sm">Rebuild Volume</button>
                </div>
            `;
        }
    } catch (error) {
        console.error(`Error updating ${orientation} slice:`, error);

        viewport.innerHTML = `
            <div style="color: white; text-align: center; padding: 20px; display: flex; flex-direction: column; justify-content: center; height: 100%;">
                <h6>MPR ${orientation.toUpperCase()} Error</h6>
                <p class="small">${error.message}</p>
                <button onclick="window.DICOM_VIEWER.setupMPRViews()" class="btn btn-primary btn-sm">Rebuild MPR</button>
            </div>
        `;
    }
};

window.DICOM_VIEWER.updateAllMPRViews = async function () {
    if (!window.DICOM_VIEWER.MANAGERS.mprManager.volumeData) {
        console.log('No Professional MPR volume data available for view updates');
        return;
    }

    console.log('Updating all MPR views with Professional reconstruction...');
    const orientations = ['axial', 'sagittal', 'coronal'];

    for (const orientation of orientations) {
        try {
            const position = window.DICOM_VIEWER.STATE.currentSlicePositions[orientation] || 0.5;
            console.log(`Updating ${orientation} view at position ${position} with Professional MPR`);
            window.DICOM_VIEWER.updateMPRSlice(orientation, position);
            await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
            console.error(`Error updating ${orientation} view:`, error);
        }
    }

    console.log('All Professional MPR views updated');
};


// Replace the focusMPRView function in main.js with this fixed version
window.DICOM_VIEWER.focusMPRView = async function (orientation) {
    console.log(`=== FOCUS MPR VIEW: ${orientation.toUpperCase()} (FRESH SESSION CHECK) ===`);

    // Check if we have a fresh session (no MPR volume data)
    const mprManager = window.DICOM_VIEWER.MANAGERS.mprManager;
    if (!mprManager || !mprManager.volumeData) {
        console.log('Fresh session detected - building MPR volume first...');

        // Show loading with clear message
        const orientationName = orientation.charAt(0).toUpperCase() + orientation.slice(1);
        window.DICOM_VIEWER.showAISuggestion(`Building Professional MPR volume for ${orientationName} view... Please wait.`);

        // Build the volume first
        const volumeBuilt = await window.DICOM_VIEWER.setupMPRViews();
        if (!volumeBuilt) {
            window.DICOM_VIEWER.showAISuggestion(`Failed to build MPR volume for ${orientationName}. Please try again.`);
            return;
        }

        // Small delay to ensure volume is fully ready
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Ensure 2x2 layout for MPR
    if (window.DICOM_VIEWER.MANAGERS.viewportManager.currentLayout !== '2x2') {
        console.log('Switching to 2x2 layout for MPR view');
        window.DICOM_VIEWER.MANAGERS.viewportManager.switchLayout('2x2');

        // Wait for layout switch and then retry
        setTimeout(() => {
            window.DICOM_VIEWER.focusMPRView(orientation);
        }, 600);
        return;
    }

    // Setup MPR viewports if not already done or if they're stale
    const state = window.DICOM_VIEWER.STATE;
    if (!state.mprViewports || !state.mprViewports[orientation]) {
        console.log('Setting up fresh MPR viewports...');
        const setupSuccess = await window.DICOM_VIEWER.setupMPRViewports();
        if (!setupSuccess) {
            window.DICOM_VIEWER.showAISuggestion(`Failed to setup MPR viewports for ${orientation}. Please try again.`);
            return;
        }
        await new Promise(resolve => setTimeout(resolve, 200));
    }

    const targetViewport = state.mprViewports[orientation];
    if (!targetViewport) {
        console.error(`MPR viewport for ${orientation} not found after setup`);
        window.DICOM_VIEWER.showAISuggestion(`${orientation} viewport not available. Please refresh and try again.`);
        return;
    }

    // Ensure viewport is enabled
    try {
        cornerstone.getEnabledElement(targetViewport);
    } catch (error) {
        try {
            cornerstone.enable(targetViewport);
            await new Promise(resolve => setTimeout(resolve, 100));
        } catch (enableError) {
            console.error(`Failed to enable ${orientation} viewport:`, enableError);
            return;
        }
    }

    // Generate and display the MPR slice
    console.log(`Generating fresh ${orientation} MPR slice...`);
    const position = state.currentSlicePositions[orientation] || 0.5;

    try {
        // Update the slice immediately
        window.DICOM_VIEWER.updateMPRSlice(orientation, position);

        // Set as active viewport
        window.DICOM_VIEWER.MANAGERS.viewportManager.setActiveViewport(targetViewport);

        // Update UI buttons - CLEAR ALL FIRST
        document.querySelectorAll('#mprAxial, #mprSagittal, #mprCoronal, #mprAll').forEach(btn => {
            btn.classList.remove('btn-success');
            btn.classList.add('btn-outline-success');
        });

        // Set current button as active
        const targetButton = document.getElementById(`mpr${orientation.charAt(0).toUpperCase() + orientation.slice(1)}`);
        if (targetButton) {
            targetButton.classList.remove('btn-outline-success');
            targetButton.classList.add('btn-success');
        }

        // Update slider position
        const slider = document.getElementById(`${orientation}Slider`);
        if (slider) {
            slider.value = position * 100;
        }

        window.DICOM_VIEWER.showAISuggestion(`${orientation.charAt(0).toUpperCase() + orientation.slice(1)} MPR view activated successfully. Use mouse wheel to navigate slices.`);
        console.log(`=== ${orientation.toUpperCase()} MPR VIEW FOCUSED SUCCESSFULLY ===`);

    } catch (error) {
        console.error(`Error focusing ${orientation} MPR view:`, error);
        window.DICOM_VIEWER.showAISuggestion(`Error loading ${orientation} view: ${error.message}`);
    }
};

// FIXED: showAllMPRViews with immediate display
window.DICOM_VIEWER.showAllMPRViews = async function () {
    console.log('=== SHOW ALL MPR VIEWS ===');

    // Build volume if needed
    if (!window.DICOM_VIEWER.MANAGERS.mprManager.volumeData) {
        console.log('No Professional MPR volume, building first...');
        window.DICOM_VIEWER.showAISuggestion('Building Professional MPR volume for all views...');

        const volumeBuilt = await window.DICOM_VIEWER.setupMPRViews();
        if (!volumeBuilt) {
            window.DICOM_VIEWER.showAISuggestion('Failed to build Professional MPR volume. Please try again.');
            return;
        }
    }

    // Ensure 2x2 layout
    if (window.DICOM_VIEWER.MANAGERS.viewportManager.currentLayout !== '2x2') {
        window.DICOM_VIEWER.MANAGERS.viewportManager.switchLayout('2x2');
        await new Promise(resolve => setTimeout(resolve, 400));
    }

    // Setup viewports if not already done
    if (!window.DICOM_VIEWER.STATE.mprViewports || Object.keys(window.DICOM_VIEWER.STATE.mprViewports).length < 4) {
        const setupSuccess = await window.DICOM_VIEWER.setupMPRViewports();
        if (!setupSuccess) {
            window.DICOM_VIEWER.showAISuggestion('Failed to setup MPR viewports. Please try again.');
            return;
        }
        await new Promise(resolve => setTimeout(resolve, 300));
    }

    // Load original image in original viewport first
    const originalViewport = window.DICOM_VIEWER.STATE.mprViewports.original;
    if (originalViewport && window.DICOM_VIEWER.STATE.currentFileId) {
        try {
            console.log('Loading original image in original viewport...');
            await window.DICOM_VIEWER.loadImageInViewport(originalViewport, window.DICOM_VIEWER.STATE.currentFileId);
        } catch (error) {
            console.error('Failed to load original image:', error);
        }
    }

    // Generate all MPR views simultaneously
    const mprGenerationPromises = ['axial', 'sagittal', 'coronal'].map(async (orientation) => {
        const viewport = window.DICOM_VIEWER.STATE.mprViewports[orientation];
        if (!viewport) {
            console.error(`No viewport found for ${orientation}`);
            return;
        }

        try {
            // Ensure viewport is enabled
            try {
                cornerstone.getEnabledElement(viewport);
            } catch (error) {
                cornerstone.enable(viewport);
                await new Promise(resolve => setTimeout(resolve, 50));
            }

            const position = window.DICOM_VIEWER.STATE.currentSlicePositions[orientation] || 0.5;
            console.log(`Generating ${orientation} view at position ${position}...`);

            // Generate and display the MPR slice
            window.DICOM_VIEWER.updateMPRSlice(orientation, position);

            console.log(`✓ ${orientation} view generated successfully`);

        } catch (error) {
            console.error(`Error generating ${orientation} view:`, error);
        }
    });

    // Wait for all MPR views to be generated
    await Promise.all(mprGenerationPromises);

    // Reset button states
    document.querySelectorAll('#mprAxial, #mprSagittal, #mprCoronal').forEach(btn => {
        btn.classList.remove('btn-success');
        btn.classList.add('btn-outline-success');
    });

    document.getElementById('mprAll').classList.remove('btn-outline-success');
    document.getElementById('mprAll').classList.add('btn-success');

    // Set original viewport as active
    if (originalViewport) {
        window.DICOM_VIEWER.MANAGERS.viewportManager.setActiveViewport(originalViewport);
    }

    // Run diagnostics and show results
    const diagnostics = window.DICOM_VIEWER.MANAGERS.mprManager.runDiagnostics();
    const qualityReport = Object.values(diagnostics.sliceTests || {})
        .map(test => test.success ? '✓' : '✗')
        .join(' ');

    window.DICOM_VIEWER.showAISuggestion(`All MPR views displayed: Original (top-left), Sagittal (top-right), Coronal (bottom-left), Axial (bottom-right). Quality: ${qualityReport}. Click any view to focus.`);

    console.log('=== ALL MPR VIEWS DISPLAYED ===');
};

window.DICOM_VIEWER.loadImageInViewport = async function (viewport, fileId) {
    try {
        const state = window.DICOM_VIEWER.STATE;

        // Find the image info from STATE to determine if it's an Orthanc image
        const imageInfo = state.currentSeriesImages.find(img =>
            img.id === fileId || img.orthancInstanceId === fileId || img.instanceId === fileId
        );

        let imageId;

        if (imageInfo && (imageInfo.isOrthancImage || imageInfo.orthancInstanceId)) {
            // This is an Orthanc image - use the Orthanc API endpoint
            const orthancInstanceId = imageInfo.orthancInstanceId || imageInfo.instanceId || imageInfo.id;
            const basePath = window.basePath || '';
            imageId = `wadouri:${window.location.origin}${basePath}/api/get_dicom_from_orthanc.php?instanceId=${orthancInstanceId}`;
            console.log(`Loading Orthanc image: ${orthancInstanceId}`);
        } else if (imageInfo && imageInfo.file_data) {
            // Image has embedded base64 data (PACS pre-loaded)
            imageId = 'wadouri:data:application/dicom;base64,' + imageInfo.file_data;
            console.log(`Loading embedded image data for: ${fileId}`);
        } else {
            // Try to load from local database via get_dicom_fast.php
            console.log(`Loading from database: ${fileId}`);
            const response = await fetch(`get_dicom_fast.php?id=${fileId}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();
            if (!data.success || !data.file_data) {
                throw new Error('Invalid response data from get_dicom_fast.php');
            }

            imageId = 'wadouri:data:application/dicom;base64,' + data.file_data;
        }

        // Load and display the image
        const image = await cornerstone.loadImage(imageId);
        cornerstone.displayImage(viewport, image);

        console.log('Image loaded in viewport successfully:', viewport.id);
        return true;
    } catch (error) {
        console.error('Error loading image in viewport:', error);

        // Show error in viewport
        if (viewport) {
            viewport.innerHTML = `
                <div style="color: white; text-align: center; padding: 20px; display: flex; flex-direction: column; justify-content: center; height: 100%; background: #000;">
                    <i class="bi bi-exclamation-triangle text-warning fs-2 mb-2"></i>
                    <div class="small">Failed to load image</div>
                    <div class="text-muted small">${error.message}</div>
                </div>
            `;
        }
        return false;
    }
};

// ===== AI ASSISTANT FUNCTIONS =====

window.DICOM_VIEWER.autoAdjustWindowLevel = function () {
    const activeViewport = window.DICOM_VIEWER.STATE.activeViewport;
    if (!activeViewport) return;

    try {
        const enabledElement = cornerstone.getEnabledElement(activeViewport);
        if (enabledElement && enabledElement.image) {
            const image = enabledElement.image;
            const autoWindow = (image.maxPixelValue - image.minPixelValue) * 0.8;
            const autoLevel = (image.maxPixelValue + image.minPixelValue) / 2;

            const windowSlider = document.getElementById('windowSlider');
            const levelSlider = document.getElementById('levelSlider');
            const windowValue = document.getElementById('windowValue');
            const levelValue = document.getElementById('levelValue');

            windowSlider.value = Math.round(autoWindow);
            levelSlider.value = Math.round(autoLevel);
            windowValue.textContent = Math.round(autoWindow);
            levelValue.textContent = Math.round(autoLevel);

            window.DICOM_VIEWER.applyWindowLevel(autoWindow, autoLevel);
            window.DICOM_VIEWER.showAISuggestion('Window/Level automatically adjusted based on image statistics.');
        }
    } catch (error) {
        window.DICOM_VIEWER.showAISuggestion('Auto W/L adjustment failed. Please adjust manually.');
    }
};

window.DICOM_VIEWER.detectAbnormalities = function () {
    window.DICOM_VIEWER.showAISuggestion('Scanning for potential abnormalities... This feature requires advanced AI integration.');

    setTimeout(() => {
        window.DICOM_VIEWER.showAISuggestion('Demo: Potential areas of interest detected. Please consult with radiologist for confirmation.');
    }, 2000);
};

window.DICOM_VIEWER.smartMeasure = function () {
    const toolsPanel = document.getElementById('tools-panel');
    const lengthTool = toolsPanel.querySelector('[data-tool="Length"]');
    if (lengthTool) {
        lengthTool.click();
        window.DICOM_VIEWER.showAISuggestion('Length measurement tool activated. Click and drag to measure distances.');
    }
};

window.DICOM_VIEWER.enhanceImageQuality = function () {
    const brightnessSlider = document.getElementById('brightnessSlider');
    const contrastSlider = document.getElementById('contrastSlider');
    const sharpenSlider = document.getElementById('sharpenSlider');

    const brightness = parseInt(brightnessSlider.value);
    const contrast = parseFloat(contrastSlider.value);
    const sharpening = parseFloat(sharpenSlider.value);

    const viewports = window.DICOM_VIEWER.MANAGERS.viewportManager.getAllViewports();

    viewports.forEach(viewport => {
        window.DICOM_VIEWER.MANAGERS.enhancementManager.applyEnhancement(viewport, brightness, contrast, sharpening);
    });

    window.DICOM_VIEWER.updateViewportInfo();
    window.DICOM_VIEWER.showAISuggestion('Image enhancement applied. Adjust sliders for fine-tuning.');
};


// Enhanced export functions
window.DICOM_VIEWER.exportImage = function () {
    const activeViewport = window.DICOM_VIEWER.STATE.activeViewport;
    if (!activeViewport) {
        window.DICOM_VIEWER.showAISuggestion('No active viewport to export');
        return;
    }

    const canvas = activeViewport.querySelector('canvas');
    if (!canvas) {
        window.DICOM_VIEWER.showAISuggestion('No image to export');
        return;
    }

    // Get current image info for filename
    const state = window.DICOM_VIEWER.STATE;
    const currentImage = state.currentSeriesImages[state.currentImageIndex];
    const patientId = currentImage?.patient_id || 'Unknown';
    const studyDate = currentImage?.study_date || new Date().toISOString().split('T')[0];
    const viewportName = activeViewport.dataset.viewportName || 'image';

    const link = document.createElement('a');
    link.download = `${patientId}_${studyDate}_${viewportName}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();

    window.DICOM_VIEWER.showAISuggestion(`Image exported: ${link.download}`);
};

window.DICOM_VIEWER.exportMPRViews = function () {
    if (!window.DICOM_VIEWER.STATE.mprViewports) {
        window.DICOM_VIEWER.showAISuggestion('No MPR views available for export');
        return;
    }

    const state = window.DICOM_VIEWER.STATE;
    const currentImage = state.currentSeriesImages[state.currentImageIndex];
    const patientId = currentImage?.patient_id || 'Unknown';
    const studyDate = currentImage?.study_date || new Date().toISOString().split('T')[0];

    let exportedCount = 0;

    Object.entries(state.mprViewports).forEach(([orientation, viewport]) => {
        if (viewport && orientation !== 'original') {
            const canvas = viewport.querySelector('canvas');
            if (canvas) {
                const link = document.createElement('a');
                link.download = `${patientId}_${studyDate}_MPR_${orientation.toUpperCase()}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
                exportedCount++;

                // Small delay between downloads
                setTimeout(() => { }, 100 * exportedCount);
            }
        }
    });

    if (exportedCount > 0) {
        window.DICOM_VIEWER.showAISuggestion(`Exported ${exportedCount} MPR views`);
    } else {
        window.DICOM_VIEWER.showAISuggestion('No MPR views could be exported');
    }
};

window.DICOM_VIEWER.exportReport = function () {
    if (!window.DICOM_VIEWER.MANAGERS.medicalNotes) {
        window.DICOM_VIEWER.showAISuggestion('Medical notes system not available');
        return;
    }

    window.DICOM_VIEWER.MANAGERS.medicalNotes.exportReport();
};

window.DICOM_VIEWER.exportDICOM = function () {
    const state = window.DICOM_VIEWER.STATE;
    if (!state.currentSeriesImages || state.currentSeriesImages.length === 0) {
        window.DICOM_VIEWER.showAISuggestion('No DICOM files to export');
        return;
    }

    window.DICOM_VIEWER.showLoadingIndicator('Preparing DICOM export...');

    const currentImage = state.currentSeriesImages[state.currentImageIndex];
    const patientId = currentImage?.patient_id || 'Unknown';
    const studyDate = currentImage?.study_date || new Date().toISOString().split('T')[0];

    // Export all files in current series
    const exportPromises = state.currentSeriesImages.map(async (image, index) => {
        try {
            const response = await fetch(`get_dicom_file.php?id=${image.id}&format=raw`);
            if (!response.ok) throw new Error(`Failed to fetch file ${image.id}`);

            const arrayBuffer = await response.arrayBuffer();
            const filename = `${image.file_name || `image_${index + 1}.dcm`}`;

            return {
                filename: filename.endsWith('.dcm') ? filename : filename + '.dcm',
                data: arrayBuffer
            };
        } catch (error) {
            console.error(`Failed to export image ${image.id}:`, error);
            return null;
        }
    });

    Promise.all(exportPromises).then(results => {
        const validFiles = results.filter(file => file !== null);

        if (validFiles.length === 0) {
            window.DICOM_VIEWER.hideLoadingIndicator();
            window.DICOM_VIEWER.showAISuggestion('No files could be exported');
            return;
        }

        // Create ZIP file using JSZip (you'll need to include this library)
        if (typeof JSZip !== 'undefined') {
            const zip = new JSZip();

            validFiles.forEach(file => {
                zip.file(file.filename, file.data);
            });

            zip.generateAsync({ type: "blob" }).then(content => {
                const url = URL.createObjectURL(content);
                const link = document.createElement('a');
                link.href = url;
                link.download = `${patientId}_${studyDate}_DICOM_Series.zip`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);

                window.DICOM_VIEWER.hideLoadingIndicator();
                window.DICOM_VIEWER.showAISuggestion(`DICOM series exported: ${validFiles.length} files`);
            });
        } else {
            // Fallback: export individual files
            validFiles.forEach((file, index) => {
                setTimeout(() => {
                    const blob = new Blob([file.data], { type: 'application/dicom' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = file.filename;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                }, index * 100);
            });

            window.DICOM_VIEWER.hideLoadingIndicator();
            window.DICOM_VIEWER.showAISuggestion(`${validFiles.length} DICOM files exported individually`);
        }
    }).catch(error => {
        window.DICOM_VIEWER.hideLoadingIndicator();
        console.error('DICOM export failed:', error);
        window.DICOM_VIEWER.showAISuggestion('DICOM export failed. Please try again.');
    });
};

// ===== EXPORT FUNCTIONS =====

window.DICOM_VIEWER.exportMPRViews = function () {
    const state = window.DICOM_VIEWER.STATE;

    if (!state.mprViewports || !window.DICOM_VIEWER.MANAGERS.mprManager.volumeData) {
        window.DICOM_VIEWER.showAISuggestion('No MPR views available for export. Please generate MPR views first.');
        return;
    }

    window.DICOM_VIEWER.showLoadingIndicator('Exporting MPR views...');

    const currentImage = state.currentSeriesImages[state.currentImageIndex];
    const patientId = currentImage?.patient_id || 'Unknown';
    const studyDate = currentImage?.study_date || new Date().toISOString().split('T')[0];

    let exportedCount = 0;
    const exportPromises = [];

    Object.entries(state.mprViewports).forEach(([orientation, viewport]) => {
        if (viewport && orientation !== 'original') {
            const canvas = viewport.querySelector('canvas');
            if (canvas) {
                const promise = new Promise((resolve) => {
                    try {
                        canvas.toBlob((blob) => {
                            if (blob) {
                                const url = URL.createObjectURL(blob);
                                const link = document.createElement('a');
                                link.href = url;
                                link.download = `${patientId}_${studyDate}_MPR_${orientation.toUpperCase()}.png`;

                                // Add small delay for better UX
                                setTimeout(() => {
                                    document.body.appendChild(link);
                                    link.click();
                                    document.body.removeChild(link);
                                    URL.revokeObjectURL(url);
                                    resolve();
                                }, exportedCount * 200);

                                exportedCount++;
                            } else {
                                resolve();
                            }
                        }, 'image/png', 0.95);
                    } catch (error) {
                        console.error(`Failed to export ${orientation}:`, error);
                        resolve();
                    }
                });
                exportPromises.push(promise);
            }
        }
    });

    if (exportPromises.length === 0) {
        window.DICOM_VIEWER.hideLoadingIndicator();
        window.DICOM_VIEWER.showAISuggestion('No MPR canvases found to export');
        return;
    }

    Promise.all(exportPromises).then(() => {
        window.DICOM_VIEWER.hideLoadingIndicator();
        if (exportedCount > 0) {
            window.DICOM_VIEWER.showAISuggestion(`Exported ${exportedCount} MPR views successfully`);
        } else {
            window.DICOM_VIEWER.showAISuggestion('No MPR views could be exported');
        }
    });
};

window.DICOM_VIEWER.toggleCrosshairs = function () {
    const showCrosshairsCheckbox = document.getElementById('showCrosshairs');
    const showCrosshairs = showCrosshairsCheckbox.checked;

    if (showCrosshairs) {
        window.DICOM_VIEWER.MANAGERS.crosshairManager.enable();
    } else {
        window.DICOM_VIEWER.MANAGERS.crosshairManager.disable();
    }

    window.DICOM_VIEWER.showAISuggestion(showCrosshairs ? 'Crosshairs enabled - hover over images to see them' : 'Crosshairs disabled');
};




// 3. Set Pan as default tool on initialization
function setDefaultTool() {
    console.log('Setting Pan as default tool...');
    const toolsPanel = document.getElementById('tools-panel');
    const panButton = toolsPanel.querySelector('[data-tool="Pan"]');

    if (panButton) {
        // Use timeout to ensure everything is initialized
        setTimeout(() => {
            window.DICOM_VIEWER.setActiveTool('Pan', panButton);
            console.log('Pan tool set as default');
        }, 500);
    } else {
        console.error('Pan button not found');
    }
}

// 4. Enhanced initialization function - add this to your DOMContentLoaded event
function initializeToolsUI() {
    console.log('Initializing tools UI...');

    // Set up tool panel with enhanced event handling
    const toolsPanel = document.getElementById('tools-panel');
    if (toolsPanel) {
        // Remove old event listener
        toolsPanel.removeEventListener('click', window.DICOM_VIEWER.handleToolSelection);

        // Add enhanced event listener
        toolsPanel.addEventListener('click', window.DICOM_VIEWER.handleToolSelection);

        // Set default tool after a delay
        setTimeout(() => {
            setDefaultTool();
        }, 1000);
    }

    console.log('Tools UI initialized with Pan as default');
}

// 5. Fix floating report button creation with proper visibility
function createEnhancedFloatingReportButton() {
    // Remove existing button
    const existingBtn = document.getElementById('floating-report-btn');
    if (existingBtn) {
        existingBtn.remove();
    }

    const button = document.createElement('button');
    button.id = 'floating-report-btn';
    button.className = 'btn btn-primary floating-btn';
    button.innerHTML = `
        <i class="bi bi-file-medical-fill me-2"></i>
        <span>Medical Report</span>
    `;
    button.title = 'Create Medical Report (Ctrl+R)';

    // Enhanced styling for better visibility
    button.style.cssText = `
        position: fixed !important;
        bottom: 20px !important;
        right: 20px !important;
        width: auto !important;
        height: 56px !important;
        border-radius: 28px !important;
        z-index: 1000 !important;
        padding: 0 20px !important;
        font-weight: 600 !important;
        font-size: 14px !important;
        display: none !important;
        align-items: center !important;
        justify-content: center !important;
        white-space: nowrap !important;
        min-width: 160px !important;
    `;

    button.addEventListener('click', () => {
        if (window.DICOM_VIEWER.MANAGERS.reportingSystem) {
            window.DICOM_VIEWER.MANAGERS.reportingSystem.enterReportingMode();
        }
    });

    // Add hover effects
    button.addEventListener('mouseenter', () => {
        button.style.transform = 'translateY(-2px) scale(1.05)';
    });

    button.addEventListener('mouseleave', () => {
        button.style.transform = 'translateY(0) scale(1)';
    });

    document.body.appendChild(button);
    return button;
}

// 6. Enhanced tool state management
function updateToolButtonStates() {
    const toolsPanel = document.getElementById('tools-panel');
    if (!toolsPanel) return;

    // Get current active tool from Cornerstone
    let activeTool = null;
    const toolButtons = toolsPanel.querySelectorAll('.tool-btn');

    // Find which tool is currently active
    toolButtons.forEach(button => {
        const toolName = button.dataset.tool;
        const cornerstoneToolName = window.DICOM_VIEWER.CONSTANTS.TOOL_NAME_MAP[toolName];

        try {
            // Check if this tool is active (this is a simplified check)
            if (button.classList.contains('btn-primary')) {
                activeTool = button;
            }
        } catch (error) {
            // Ignore errors
        }
    });

    // If no tool is active, set Pan as default
    if (!activeTool) {
        const panButton = toolsPanel.querySelector('[data-tool="Pan"]');
        if (panButton) {
            window.DICOM_VIEWER.setActiveTool('Pan', panButton);
        }
    }
}

// 7. Add this to your main initialization
document.addEventListener('DOMContentLoaded', function () {
    // ... your existing initialization code ...

    // Add these enhanced initializations
    setTimeout(() => {
        initializeToolsUI();
        createEnhancedFloatingReportButton();
        updateToolButtonStates();
    }, 1500);
});

// 8. Update the original loadImageSeries to show floating button
const originalLoadImageSeries = window.DICOM_VIEWER.loadImageSeries;
if (originalLoadImageSeries) {
    window.DICOM_VIEWER.loadImageSeries = async function (uploadedFiles) {
        const result = await originalLoadImageSeries.call(this, uploadedFiles);

        // Show floating button when images are loaded
        if (uploadedFiles && uploadedFiles.length > 0) {
            const floatingBtn = document.getElementById('floating-report-btn');
            if (floatingBtn) {
                floatingBtn.style.display = 'flex';
                console.log('Floating report button made visible');
            }
        }

        return result;
    };
    // Show report buttons when images are loaded (ADD THIS AT THE END OF loadImageSeries function)
    if (window.DICOM_VIEWER.MANAGERS.reportingSystem && uploadedFiles.length > 0) {
        setTimeout(async () => {
            await window.DICOM_VIEWER.MANAGERS.reportingSystem.showReportButtons();
        }, 1000);
    }

    // COMPLETE FIX - Add this at the END of loadImageSeries function in main.js

    // Show report buttons when images are loaded
    if (window.DICOM_VIEWER.MANAGERS.reportingSystem && uploadedFiles.length > 0) {
        console.log('Attempting to show report buttons after loading images...');

        setTimeout(async () => {
            try {
                // Show the button container
                const buttonContainer = document.getElementById('report-buttons-container');
                if (buttonContainer) {
                    buttonContainer.style.display = 'flex';
                    buttonContainer.style.alignItems = 'center';
                    buttonContainer.style.justifyContent = 'center';
                    console.log('✓ Report button container is now visible');

                    // Check for existing reports
                    await window.DICOM_VIEWER.MANAGERS.reportingSystem.checkCurrentImageForReports();
                } else {
                    console.error('❌ Report button container not found in DOM');
                    // Try to recreate it
                    window.DICOM_VIEWER.MANAGERS.reportingSystem.createReportButtonsUI();
                    setTimeout(() => {
                        const newContainer = document.getElementById('report-buttons-container');
                        if (newContainer) {
                            newContainer.style.display = 'flex';
                            console.log('✓ Report button container recreated and shown');
                        }
                    }, 100);
                }
            } catch (error) {
                console.error('Error showing report buttons:', error);
            }
        }, 1500);
    }
}

// 9. Keyboard shortcut to reset tool to Pan
document.addEventListener('keydown', function (event) {
    // Press 'P' to quickly switch to Pan tool
    if (event.key.toLowerCase() === 'p' && !event.target.matches('input, textarea')) {
        event.preventDefault();
        const toolsPanel = document.getElementById('tools-panel');
        const panButton = toolsPanel?.querySelector('[data-tool="Pan"]');
        if (panButton) {
            window.DICOM_VIEWER.setActiveTool('Pan', panButton);
        }
    }
});

console.log('Enhanced tool system loaded with Pan as default tool');
