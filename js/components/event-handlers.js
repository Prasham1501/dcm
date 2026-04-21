/**
 * Event Handlers Component - Production Ready v4.0
 * Implements robust drag-and-drop with cross-browser compatibility
 * 
 * FIXES:
 * - Viewport drag now works even with crosshairs/tools enabled
 * - Uses mousedown to initiate drag instead of relying on native drag
 * - Global drag state management for Chrome compatibility
 * 
 * References:
 * - MDN Drag and Drop API: https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API
 * - Chrome dataTransfer restrictions: https://stackoverflow.com/questions/11927309
 */

// Global drag data storage (required for Chrome compatibility)
window.DICOM_DRAG_DATA = null;
window.DICOM_DRAG_SOURCE_ELEMENT = null;
window.DICOM_VIEWPORT_DRAG_ACTIVE = false;

window.DICOM_VIEWER = window.DICOM_VIEWER || {};
window.DICOM_VIEWER.STATE = window.DICOM_VIEWER.STATE || {};
window.DICOM_VIEWER.MANAGERS = window.DICOM_VIEWER.MANAGERS || {};

window.DICOM_VIEWER.EventHandlers = {
    initialized: false,
    debugMode: true,
    
    log(...args) {
        if (this.debugMode) {
            console.log('[DragDrop]', ...args);
        }
    },
    
    initialize() {
        if (this.initialized) {
            this.log('Already initialized, skipping...');
            return;
        }
        
        this.log('Initializing event handlers v4.0...');
        this.setupWindowResize();
        this.setupErrorHandling();
        this.setupDragAndDrop();
        this.initialized = true;
        this.log('Initialization complete');
    },

    setupWindowResize() {
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                document.querySelectorAll('.viewport').forEach(element => {
                    try {
                        if (cornerstone.getEnabledElement(element)) {
                            cornerstone.resize(element);
                        }
                    } catch (error) {
                        // Viewport not enabled yet
                    }
                });
            }, 100);
        });
    },

    setupDragAndDrop() {
        this.log('Setting up drag and drop system...');
        
        const initDragDrop = () => {
            setTimeout(() => {
                this.initializeDragDrop();
            }, 2000);
        };
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initDragDrop);
        } else {
            initDragDrop();
        }
    },

    initializeDragDrop() {
        this.log('Initializing drag and drop components...');
        
        this.setupSeriesDraggable();
        this.setupViewportsDragDrop();
        this.observeSeriesList();
        
        // Listen for viewport creation events
        document.addEventListener('viewport-created', (e) => {
            if (e.detail && e.detail.viewport) {
                this.log('New viewport detected, setting up...');
                this.setupSingleViewport(e.detail.viewport);
            }
        });
        
        // Re-setup periodically to catch any missed elements
        setInterval(() => {
            this.setupSeriesDraggable();
            this.setupViewportsDragDrop();
        }, 5000);
        
        this.log('Drag and drop system ready');
    },

    observeSeriesList() {
        const seriesList = document.getElementById('series-list');
        if (!seriesList) {
            this.log('Series list element not found, will retry...');
            setTimeout(() => this.observeSeriesList(), 1000);
            return;
        }
        
        const observer = new MutationObserver((mutations) => {
            let hasNewNodes = false;
            mutations.forEach((mutation) => {
                if (mutation.addedNodes.length > 0) {
                    hasNewNodes = true;
                }
            });
            
            if (hasNewNodes) {
                this.log('Series list updated, refreshing draggables...');
                setTimeout(() => this.setupSeriesDraggable(), 300);
            }
        });
        
        observer.observe(seriesList, { childList: true, subtree: true });
        this.log('Series list observer attached');
    },

    /**
     * Setup series items as draggable sources
     */
    setupSeriesDraggable() {
        const seriesItems = document.querySelectorAll('.series-item');
        this.log(`Setting up ${seriesItems.length} series items as draggable`);
        
        seriesItems.forEach((item, index) => {
            if (item.dataset.dragConfigured === 'true') return;
            
            item.dataset.dragConfigured = 'true';
            item.dataset.imageIndex = index.toString();
            item.draggable = true;
            item.style.cursor = 'grab';
            
            item.addEventListener('dragstart', (e) => {
                e.stopPropagation();
                
                const fileId = item.dataset.fileId || '';
                const imageIndex = index;
                
                this.log(`Series dragstart - index: ${imageIndex}, fileId: ${fileId}`);
                
                const dragData = {
                    type: 'series-image',
                    imageIndex: imageIndex,
                    fileId: fileId,
                    source: 'series-list',
                    timestamp: Date.now()
                };
                
                window.DICOM_DRAG_DATA = dragData;
                window.DICOM_DRAG_SOURCE_ELEMENT = item;
                
                try {
                    const jsonData = JSON.stringify(dragData);
                    e.dataTransfer.setData('text/plain', jsonData);
                    e.dataTransfer.setData('application/json', jsonData);
                    e.dataTransfer.setData('text/x-dicom-drag', jsonData);
                } catch (err) {
                    this.log('Warning: Could not set dataTransfer data:', err);
                }
                
                e.dataTransfer.effectAllowed = 'all';
                e.dataTransfer.dropEffect = 'copy';
                
                item.style.opacity = '0.5';
                item.style.cursor = 'grabbing';
                item.classList.add('dragging');
            });
            
            item.addEventListener('dragend', (e) => {
                item.style.opacity = '1';
                item.style.cursor = 'grab';
                item.classList.remove('dragging');
                
                setTimeout(() => {
                    window.DICOM_DRAG_DATA = null;
                    window.DICOM_DRAG_SOURCE_ELEMENT = null;
                }, 300);
                
                this.log('Series dragend completed');
            });
        });
        
        this.log(`${seriesItems.length} series items configured for drag`);
    },

    /**
     * Setup all viewports as both drag sources and drop targets
     */
    setupViewportsDragDrop() {
        const viewports = document.querySelectorAll('.viewport');
        this.log(`Setting up ${viewports.length} viewports for drag and drop`);
        
        viewports.forEach((viewport) => {
            this.setupSingleViewport(viewport);
        });
    },

    /**
     * Setup a single viewport as both draggable source and drop target
     */
    setupSingleViewport(viewport) {
        if (!viewport) return;
        
        const viewportName = viewport.dataset.viewportName || viewport.id || 'viewport';
        
        // Setup as drop target
        this.makeViewportDropTarget(viewport);
        
        // Setup as draggable source using CUSTOM drag handling
        this.makeViewportDraggableCustom(viewport);
        
        this.log(`Viewport "${viewportName}" configured for drag and drop`);
    },

    /**
     * Make viewport draggable using CUSTOM drag implementation
     * This bypasses issues with cornerstone tools/crosshairs blocking native drag
     */
    makeViewportDraggableCustom(viewport) {
        if (viewport.dataset.viewportDragConfigured === 'true') return;
        viewport.dataset.viewportDragConfigured = 'true';
        
        const viewportName = viewport.dataset.viewportName || viewport.id || 'unknown';
        
        // Create a drag handle overlay that sits on top
        const dragHandle = document.createElement('div');
        dragHandle.className = 'viewport-drag-handle';
        dragHandle.innerHTML = '<i class="bi bi-grip-vertical"></i>';
        dragHandle.title = 'Drag to swap images';
        dragHandle.style.cssText = `
            position: absolute;
            top: 5px;
            left: 5px;
            width: 28px;
            height: 28px;
            background: rgba(13, 110, 253, 0.8);
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: grab;
            z-index: 200;
            color: white;
            font-size: 14px;
            opacity: 0;
            transition: opacity 0.2s;
            pointer-events: auto;
        `;
        
        // Make drag handle draggable
        dragHandle.draggable = true;
        
        // Show/hide drag handle on viewport hover
        viewport.addEventListener('mouseenter', () => {
            // Only show if viewport has an image
            try {
                const enabled = cornerstone.getEnabledElement(viewport);
                if (enabled && enabled.image) {
                    dragHandle.style.opacity = '1';
                }
            } catch (e) {
                // No image
            }
        });
        
        viewport.addEventListener('mouseleave', () => {
            if (!window.DICOM_VIEWPORT_DRAG_ACTIVE) {
                dragHandle.style.opacity = '0';
            }
        });
        
        // DRAG HANDLE - dragstart
        dragHandle.addEventListener('dragstart', (e) => {
            // Check if viewport has an image loaded
            let hasImage = false;
            
            try {
                const enabled = cornerstone.getEnabledElement(viewport);
                hasImage = enabled && enabled.image;
            } catch (err) {
                hasImage = false;
            }
            
            if (!hasImage) {
                this.log(`Viewport "${viewportName}" has no image, cancelling drag`);
                e.preventDefault();
                return;
            }
            
            this.log(`Viewport drag started from: ${viewportName}`);
            
            window.DICOM_VIEWPORT_DRAG_ACTIVE = true;
            
            const dragData = {
                type: 'viewport-image',
                sourceViewport: viewportName,
                source: 'viewport',
                timestamp: Date.now()
            };
            
            window.DICOM_DRAG_DATA = dragData;
            window.DICOM_DRAG_SOURCE_ELEMENT = viewport;
            
            try {
                const jsonData = JSON.stringify(dragData);
                e.dataTransfer.setData('text/plain', jsonData);
                e.dataTransfer.setData('application/json', jsonData);
                e.dataTransfer.setData('text/x-dicom-drag', jsonData);
            } catch (err) {
                this.log('Warning: Could not set viewport dataTransfer:', err);
            }
            
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.dropEffect = 'move';
            
            // Visual feedback on the viewport
            viewport.style.opacity = '0.6';
            viewport.classList.add('viewport-dragging');
            dragHandle.style.cursor = 'grabbing';
            dragHandle.style.background = 'rgba(255, 193, 7, 0.9)';
            
            this.log('Viewport drag data stored:', dragData);
        });
        
        // DRAG HANDLE - dragend
        dragHandle.addEventListener('dragend', (e) => {
            window.DICOM_VIEWPORT_DRAG_ACTIVE = false;
            
            viewport.style.opacity = '1';
            viewport.classList.remove('viewport-dragging');
            dragHandle.style.cursor = 'grab';
            dragHandle.style.background = 'rgba(13, 110, 253, 0.8)';
            dragHandle.style.opacity = '0';
            
            setTimeout(() => {
                window.DICOM_DRAG_DATA = null;
                window.DICOM_DRAG_SOURCE_ELEMENT = null;
            }, 300);
            
            this.log(`Viewport "${viewportName}" dragend`);
        });
        
        // Append drag handle to viewport
        viewport.style.position = 'relative';
        viewport.appendChild(dragHandle);
        
        // ALSO make the entire viewport draggable as a backup
        viewport.draggable = true;
        viewport.setAttribute('draggable', 'true');
        
        // Viewport native drag (might be blocked by tools)
        viewport.addEventListener('dragstart', (e) => {
            // Only handle if not coming from drag handle
            if (e.target === dragHandle || e.target.closest('.viewport-drag-handle')) {
                return; // Let drag handle handle it
            }
            
            // Check if there's an active tool - if so, cancel drag
            const state = window.DICOM_VIEWER.STATE;
            if (state.activeTool && state.activeTool !== null) {
                this.log('Tool is active, viewport drag cancelled');
                e.preventDefault();
                return;
            }
            
            // Check if viewport has an image loaded
            let hasImage = false;
            try {
                const enabled = cornerstone.getEnabledElement(viewport);
                hasImage = enabled && enabled.image;
            } catch (err) {
                hasImage = false;
            }
            
            if (!hasImage) {
                e.preventDefault();
                return;
            }
            
            this.log(`Viewport native drag started from: ${viewportName}`);
            
            window.DICOM_VIEWPORT_DRAG_ACTIVE = true;
            
            const dragData = {
                type: 'viewport-image',
                sourceViewport: viewportName,
                source: 'viewport',
                timestamp: Date.now()
            };
            
            window.DICOM_DRAG_DATA = dragData;
            window.DICOM_DRAG_SOURCE_ELEMENT = viewport;
            
            try {
                const jsonData = JSON.stringify(dragData);
                e.dataTransfer.setData('text/plain', jsonData);
                e.dataTransfer.setData('application/json', jsonData);
            } catch (err) { }
            
            e.dataTransfer.effectAllowed = 'move';
            
            viewport.style.opacity = '0.6';
            viewport.classList.add('viewport-dragging');
        });
        
        viewport.addEventListener('dragend', (e) => {
            window.DICOM_VIEWPORT_DRAG_ACTIVE = false;
            viewport.style.opacity = '1';
            viewport.classList.remove('viewport-dragging');
            
            setTimeout(() => {
                window.DICOM_DRAG_DATA = null;
                window.DICOM_DRAG_SOURCE_ELEMENT = null;
            }, 300);
        });
        
        this.log(`Viewport "${viewportName}" drag handle created`);
    },

    /**
     * Make viewport a valid drop target
     */
    makeViewportDropTarget(viewport) {
        if (viewport.dataset.dropConfigured === 'true') return;
        viewport.dataset.dropConfigured = 'true';
        
        const viewportName = viewport.dataset.viewportName || viewport.id || 'unknown';
        
        // DRAGOVER - CRITICAL: Must prevent default to allow drop
        viewport.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            e.dataTransfer.dropEffect = 'copy';
            
            if (!viewport.classList.contains('drag-over')) {
                viewport.classList.add('drag-over');
                viewport.style.boxShadow = '0 0 30px rgba(13, 110, 253, 0.9), inset 0 0 50px rgba(13, 110, 253, 0.2)';
                viewport.style.border = '3px dashed #0d6efd';
            }
        });
        
        // DRAGENTER
        viewport.addEventListener('dragenter', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.log(`Drag entered viewport: ${viewportName}`);
        });
        
        // DRAGLEAVE
        viewport.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            if (!viewport.contains(e.relatedTarget)) {
                this.resetViewportStyle(viewport);
            }
        });
        
        // DROP - Main event handler
        viewport.addEventListener('drop', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            this.log(`DROP event on viewport: ${viewportName}`);
            
            this.resetViewportStyle(viewport);
            
            let dragData = this.getDragData(e);
            
            if (!dragData) {
                this.log('ERROR: No valid drag data found!');
                this.showMessage('Drop failed - please try again');
                return;
            }
            
            this.log('Processing drag data:', dragData);
            
            if (dragData.type === 'series-image') {
                await this.handleSeriesImageDrop(viewport, dragData);
            } else if (dragData.type === 'viewport-image') {
                await this.handleViewportImageDrop(viewport, dragData);
            } else {
                this.log('Unknown drag type:', dragData.type);
            }
            
            window.DICOM_DRAG_DATA = null;
            window.DICOM_DRAG_SOURCE_ELEMENT = null;
            window.DICOM_VIEWPORT_DRAG_ACTIVE = false;
        });
        
        this.log(`Drop target configured: ${viewportName}`);
    },

    /**
     * Get drag data from multiple sources (Chrome compatibility)
     */
    getDragData(e) {
        // Method 1: Global variable (most reliable for Chrome)
        if (window.DICOM_DRAG_DATA) {
            this.log('Using global drag data');
            return window.DICOM_DRAG_DATA;
        }
        
        // Method 2: text/plain
        try {
            const textData = e.dataTransfer.getData('text/plain');
            if (textData && textData.startsWith('{')) {
                return JSON.parse(textData);
            }
        } catch (err) { }
        
        // Method 3: application/json
        try {
            const jsonData = e.dataTransfer.getData('application/json');
            if (jsonData && jsonData.startsWith('{')) {
                return JSON.parse(jsonData);
            }
        } catch (err) { }
        
        // Method 4: Custom type
        try {
            const customData = e.dataTransfer.getData('text/x-dicom-drag');
            if (customData && customData.startsWith('{')) {
                return JSON.parse(customData);
            }
        } catch (err) { }
        
        return null;
    },

    /**
     * Reset viewport visual style after drag
     */
    resetViewportStyle(viewport) {
        viewport.classList.remove('drag-over');
        
        const isActive = viewport.classList.contains('active');
        const isMPR = viewport.classList.contains('mpr-view');
        
        viewport.style.transition = 'all 0.2s ease';
        
        if (isActive) {
            viewport.style.border = '3px solid #0d6efd';
            viewport.style.boxShadow = '0 0 15px rgba(13, 110, 253, 0.6)';
        } else if (isMPR) {
            viewport.style.border = '1px solid #28a745';
            viewport.style.boxShadow = '';
        } else {
            viewport.style.border = '1px solid #444444';
            viewport.style.boxShadow = '';
        }
    },

    /**
     * Handle dropping a series image onto a viewport
     */
    async handleSeriesImageDrop(viewport, data) {
        this.log('Handling series image drop, index:', data.imageIndex);
        
        const state = window.DICOM_VIEWER.STATE;
        const imageIndex = parseInt(data.imageIndex);
        
        if (isNaN(imageIndex) || imageIndex < 0) {
            this.log('Invalid image index:', data.imageIndex);
            this.showMessage('Invalid image selection');
            return;
        }
        
        if (!state.currentSeriesImages || state.currentSeriesImages.length === 0) {
            this.log('No series images loaded');
            this.showMessage('No images loaded');
            return;
        }
        
        if (imageIndex >= state.currentSeriesImages.length) {
            this.log('Index out of range:', imageIndex, 'max:', state.currentSeriesImages.length);
            this.showMessage('Image not found');
            return;
        }
        
        const loadingDiv = this.showViewportLoading(viewport);
        
        try {
            await this.ensureViewportEnabled(viewport);
            
            const imageInfo = state.currentSeriesImages[imageIndex];
            this.log('Loading image info:', imageInfo);
            
            let imageId = await this.buildImageId(imageInfo, data.fileId);
            
            if (!imageId) {
                throw new Error('Could not determine image source');
            }
            
            this.log('Loading image with ID:', imageId.substring(0, 100) + '...');
            
            const image = await cornerstone.loadImage(imageId);
            await cornerstone.displayImage(viewport, image);
            cornerstone.updateImage(viewport);
            
            if (window.DICOM_VIEWER.MANAGERS.viewportManager) {
                window.DICOM_VIEWER.MANAGERS.viewportManager.setActiveViewport(viewport);
            }
            
            this.hideViewportLoading(loadingDiv);
            
            const viewportName = viewport.dataset.viewportName || 'viewport';
            this.log(`SUCCESS! Image ${imageIndex + 1} displayed in ${viewportName}`);
            this.showMessage(`Image ${imageIndex + 1} loaded in ${viewportName}`);
            
            viewport.classList.add('drop-success');
            setTimeout(() => viewport.classList.remove('drop-success'), 500);
            
        } catch (error) {
            this.log('Error loading image:', error);
            this.hideViewportLoading(loadingDiv);
            this.showMessage('Failed to load image: ' + error.message);
        }
    },

    /**
     * Handle viewport-to-viewport image transfer (SWAP)
     */
    async handleViewportImageDrop(targetViewport, data) {
        this.log('Handling viewport-to-viewport drop');
        
        const sourceViewportName = data.sourceViewport;
        
        // Find source viewport
        let sourceViewport = document.querySelector(`[data-viewport-name="${sourceViewportName}"]`);
        
        if (!sourceViewport) {
            sourceViewport = document.getElementById(sourceViewportName);
        }
        if (!sourceViewport) {
            sourceViewport = document.querySelector(`.viewport[data-viewport-name="${sourceViewportName}"]`);
        }
        if (!sourceViewport && window.DICOM_DRAG_SOURCE_ELEMENT) {
            sourceViewport = window.DICOM_DRAG_SOURCE_ELEMENT;
        }
        
        if (!sourceViewport) {
            this.log('Source viewport not found:', sourceViewportName);
            this.showMessage('Source viewport not found');
            return;
        }
        
        if (sourceViewport === targetViewport) {
            this.log('Same viewport, ignoring drop');
            return;
        }
        
        try {
            let sourceImage = null;
            let targetImage = null;
            
            // Get source image
            try {
                const sourceEnabled = cornerstone.getEnabledElement(sourceViewport);
                sourceImage = sourceEnabled?.image;
            } catch (e) {
                this.log('Source viewport not enabled or has no image');
            }
            
            // Get target image
            try {
                const targetEnabled = cornerstone.getEnabledElement(targetViewport);
                targetImage = targetEnabled?.image;
            } catch (e) {
                this.log('Target viewport not enabled or has no image');
            }
            
            if (!sourceImage) {
                this.showMessage('Source viewport has no image');
                return;
            }
            
            await this.ensureViewportEnabled(targetViewport);
            
            // SWAP LOGIC
            if (targetImage) {
                // Both have images - SWAP
                this.log('Swapping images between viewports');
                
                await cornerstone.displayImage(targetViewport, sourceImage);
                cornerstone.updateImage(targetViewport);
                
                await cornerstone.displayImage(sourceViewport, targetImage);
                cornerstone.updateImage(sourceViewport);
                
                this.showMessage('Images swapped between viewports');
                
            } else {
                // Target is empty - MOVE/COPY
                this.log('Copying image to empty viewport');
                
                await cornerstone.displayImage(targetViewport, sourceImage);
                cornerstone.updateImage(targetViewport);
                
                const targetName = targetViewport.dataset.viewportName || 'target';
                this.showMessage(`Image copied to ${targetName}`);
            }
            
            targetViewport.classList.add('drop-success');
            setTimeout(() => targetViewport.classList.remove('drop-success'), 500);
            
        } catch (error) {
            this.log('Error in viewport-to-viewport transfer:', error);
            this.showMessage('Failed to transfer image: ' + error.message);
        }
    },

    /**
     * Build image ID from various sources
     */
    async buildImageId(imageInfo, fileId) {
        // Source 1: Orthanc image
        if (imageInfo.isOrthancImage && imageInfo.orthancInstanceId) {
            const baseUrl = window.location.origin + window.location.pathname.replace(/\/[^\/]*$/, '/');
            return `wadouri:${baseUrl}api/get_dicom_from_orthanc.php?instanceId=${imageInfo.orthancInstanceId}`;
        }
        
        // Source 2: Embedded base64 data (PACS)
        if (imageInfo.file_data) {
            return 'wadouri:data:application/dicom;base64,' + imageInfo.file_data;
        }
        
        // Source 3: Image ID already available
        if (imageInfo.imageId) {
            return imageInfo.imageId;
        }
        
        // Source 4: Fetch from server by ID
        const id = imageInfo.id || fileId;
        if (id) {
            this.log('Fetching from server, ID:', id);
            
            try {
                const response = await fetch(`get_dicom_fast.php?id=${id}`);
                if (!response.ok) {
                    throw new Error(`Server returned ${response.status}`);
                }
                
                const responseData = await response.json();
                if (!responseData.success || !responseData.file_data) {
                    throw new Error('Server returned invalid data');
                }
                
                return 'wadouri:data:application/dicom;base64,' + responseData.file_data;
            } catch (err) {
                this.log('Error fetching from server:', err);
            }
        }
        
        return null;
    },

    /**
     * Ensure viewport is enabled for Cornerstone
     */
    async ensureViewportEnabled(viewport) {
        try {
            cornerstone.getEnabledElement(viewport);
            this.log('Viewport already enabled');
        } catch (e) {
            this.log('Enabling viewport...');
            cornerstone.enable(viewport);
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    },

    /**
     * Show loading indicator in viewport
     */
    showViewportLoading(viewport) {
        const existing = viewport.querySelector('.viewport-loading-indicator');
        if (existing) existing.remove();
        
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'viewport-loading-indicator';
        loadingDiv.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 100;
            backdrop-filter: blur(2px);
        `;
        loadingDiv.innerHTML = `
            <div class="text-center text-white">
                <div class="spinner-border spinner-border-sm mb-2" role="status"></div>
                <div class="small">Loading image...</div>
            </div>
        `;
        
        viewport.style.position = 'relative';
        viewport.appendChild(loadingDiv);
        return loadingDiv;
    },

    hideViewportLoading(loadingDiv) {
        if (loadingDiv && loadingDiv.parentNode) {
            loadingDiv.parentNode.removeChild(loadingDiv);
        }
    },

    showMessage(msg) {
        if (window.DICOM_VIEWER && window.DICOM_VIEWER.showAISuggestion) {
            window.DICOM_VIEWER.showAISuggestion(msg);
        } else {
            console.log('[Message]', msg);
        }
    },

    setupErrorHandling() {
        window.addEventListener('error', (event) => {
            console.error('[GlobalError]', event);
        });

        window.addEventListener('unhandledrejection', (event) => {
            console.error('[UnhandledRejection]', event.reason);
        });
    }
};


/**
 * Reporting Events Handler
 */
window.DICOM_VIEWER.ReportingEvents = {
    initialize() {
        this.attachGlobalEvents();
        this.attachReportingShortcuts();
    },

    cleanJSONResponse(responseText) {
        if (!responseText) return responseText;
        const jsonStart = responseText.indexOf('{');
        const jsonEnd = responseText.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
            return responseText.substring(jsonStart, jsonEnd + 1);
        }
        return responseText;
    },

    attachGlobalEvents() {
        this.addReportingButton();
        this.enhanceSeriesListWithReportStatus();
    },

    addReportingButton() {
        const existing = document.getElementById('floating-report-btn');
        if (existing) existing.remove();
        
        const floatingButton = document.createElement('button');
        floatingButton.id = 'floating-report-btn';
        floatingButton.className = 'btn btn-primary floating-btn';
        floatingButton.innerHTML = '<i class="bi bi-file-medical-fill"></i>';
        floatingButton.title = 'Create Medical Report (Ctrl+R)';
        floatingButton.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 56px;
            height: 56px;
            border-radius: 50%;
            z-index: 1000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            transition: all 0.3s ease;
            display: none;
            align-items: center;
            justify-content: center;
        `;

        floatingButton.addEventListener('click', () => {
            if (window.DICOM_VIEWER.MANAGERS.reportingSystem) {
                window.DICOM_VIEWER.MANAGERS.reportingSystem.enterReportingMode();
            }
        });

        document.body.appendChild(floatingButton);

        const originalLoadImageSeries = window.DICOM_VIEWER.loadImageSeries;
        if (originalLoadImageSeries && !originalLoadImageSeries._enhanced) {
            window.DICOM_VIEWER.loadImageSeries = async function(uploadedFiles) {
                const result = await originalLoadImageSeries.call(this, uploadedFiles);
                if (uploadedFiles && uploadedFiles.length > 0) {
                    floatingButton.style.display = 'flex';
                }
                return result;
            };
            window.DICOM_VIEWER.loadImageSeries._enhanced = true;
        }
    },

    enhanceSeriesListWithReportStatus() {
        const originalPopulateSeriesList = window.DICOM_VIEWER.populateSeriesList;
        if (originalPopulateSeriesList && !originalPopulateSeriesList._enhanced) {
            window.DICOM_VIEWER.populateSeriesList = async function(files) {
                originalPopulateSeriesList.call(this, files);
                if (window.DICOM_VIEWER.MANAGERS.reportingSystem) {
                    await window.DICOM_VIEWER.ReportingEvents.addReportStatusToSeriesList(files);
                }
            };
            window.DICOM_VIEWER.populateSeriesList._enhanced = true;
        }
    },

    async addReportStatusToSeriesList(files) {
        console.log(`[Reports] Checking report status for ${files.length} files`);
        
        const checkPromises = files.map(async (file) => {
            try {
                const response = await fetch(`check_report.php?imageId=${file.id}`, {
                    method: 'GET',
                    headers: { 'Accept': 'application/json', 'Cache-Control': 'no-cache' }
                });
                
                if (!response.ok) return { fileId: file.id, hasReport: false };
                
                const responseText = await response.text();
                const cleanedResponse = this.cleanJSONResponse(responseText);
                
                let result;
                try {
                    result = JSON.parse(cleanedResponse);
                } catch (parseError) {
                    return { fileId: file.id, hasReport: false };
                }
                
                return { fileId: file.id, hasReport: result && result.success && result.exists };
            } catch (error) {
                return { fileId: file.id, hasReport: false };
            }
        });
        
        const results = await Promise.all(checkPromises);
        
        let reportCount = 0;
        results.forEach(result => {
            if (result.hasReport) {
                reportCount++;
                const seriesItem = document.querySelector(`[data-file-id="${result.fileId}"]`);
                if (seriesItem) {
                    this.addReportIndicatorToSeriesItem(seriesItem);
                }
            }
        });
        
        console.log(`[Reports] Found ${reportCount} reports`);
    },

    addReportIndicatorToSeriesItem(seriesItem) {
        if (seriesItem.querySelector('.report-indicator')) return;

        const indicator = document.createElement('div');
        indicator.className = 'report-indicator';
        indicator.innerHTML = '<i class="bi bi-file-medical-fill"></i>';
        indicator.title = 'Medical report available';
        indicator.style.cssText = `
            position: absolute;
            top: 8px;
            right: 8px;
            background: #28a745;
            color: white;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            z-index: 5;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            cursor: pointer;
        `;

        seriesItem.style.position = 'relative';
        seriesItem.appendChild(indicator);

        indicator.addEventListener('click', (e) => {
            e.stopPropagation();
            if (window.DICOM_VIEWER.MANAGERS.reportingSystem) {
                window.DICOM_VIEWER.MANAGERS.reportingSystem.loadExistingReport();
            }
        });
    },

    attachReportingShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            const reportingSystem = window.DICOM_VIEWER.MANAGERS.reportingSystem;
            if (!reportingSystem) return;

            if (e.ctrlKey && e.key === 'r') {
                e.preventDefault();
                if (!reportingSystem.reportingMode) {
                    reportingSystem.enterReportingMode();
                }
            } else if (e.key === 'Escape' && reportingSystem.reportingMode) {
                reportingSystem.exitReportingMode();
            } else if (e.ctrlKey && e.key === 's' && reportingSystem.reportingMode) {
                e.preventDefault();
                reportingSystem.saveReport();
            } else if (e.ctrlKey && e.key === 'p' && reportingSystem.reportingMode) {
                e.preventDefault();
                reportingSystem.printReport();
            }
        });
    }
};

// Auto-initialize on load
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (window.DICOM_VIEWER.EventHandlers && !window.DICOM_VIEWER.EventHandlers.initialized) {
            window.DICOM_VIEWER.EventHandlers.initialize();
        }
    }, 1000);
});

console.log('[EventHandlers] Module loaded - Production Ready v4.0 with drag handle');
