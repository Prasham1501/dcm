// Enhanced MPR Viewport Manager with Fixed Element Enabling
window.DICOM_VIEWER.MPRViewportManager = class {
    // UPDATED: Layout definitions with consistent viewport naming in viewport-manager.js constructor
    // Update the constructor in viewport-manager.js - remove 1x2 layout
    constructor() {
        this.viewports = new Map();
        this.layouts = {
            '1x1': { rows: 1, cols: 1, viewports: ['main'] },
            '2x1': { rows: 1, cols: 2, viewports: ['left', 'right'] },
            '2x2': { rows: 2, cols: 2, viewports: ['original', 'sagittal', 'coronal', 'axial'] }
        };
        this.currentLayout = '2x2';
        this.activeViewport = null;
        this.resizeObserver = null;
        this.setupResizeObserver();
    }

    // Add this method to your MPRViewportManager class
    enableCustomMouseControls() {
        // Ensure mouse controls are set up for new viewports
        if (window.DICOM_VIEWER.MANAGERS.mouseControls) {
            setTimeout(() => {
                this.getAllViewports().forEach(viewport => {
                    window.DICOM_VIEWER.MANAGERS.mouseControls.setupViewportListeners(viewport);
                });
            }, 200);
        }
    }

    setupResizeObserver() {
        if ('ResizeObserver' in window) {
            this.resizeObserver = new ResizeObserver(entries => {
                entries.forEach(entry => {
                    const viewport = entry.target;
                    if (viewport.classList.contains('viewport')) {
                        try {
                            if (cornerstone.getEnabledElement(viewport)) {
                                cornerstone.resize(viewport, true);
                            }
                        } catch (error) {
                            // Element might not be enabled yet
                        }
                    }
                });
            });
        }
    }

    createViewports(layout) {
        const container = document.getElementById('viewport-container');
        const layoutConfig = this.layouts[layout];

        if (!layoutConfig) {
            console.error('Unknown layout:', layout);
            return false;
        }

        // Clear existing viewports and observers
        container.innerHTML = '';
        this.cleanupViewports();

        // Update container CSS classes
        container.className = `viewport-container layout-${layout}`;

        // Create viewports in the correct order
        layoutConfig.viewports.forEach((name, index) => {
            const viewportElement = this.createViewportElement(name, index);
            container.appendChild(viewportElement);

            // FIXED: Better viewport enabling with retry logic
            this.enableViewportWithRetry(viewportElement, name, index);
        });

        this.currentLayout = layout;

        // Enable custom mouse controls for new viewports - ADD THIS LINE
        this.enableCustomMouseControls();

        console.log(`Created ${layoutConfig.viewports.length} viewports for layout ${layout}`);
        return true;
    }

    // ENHANCED: enableViewportWithRetry with better error handling
    enableViewportWithRetry(viewportElement, name, index, retryCount = 0) {
        const maxRetries = 5;

        try {
            // Ensure element is in DOM before enabling
            if (!document.body.contains(viewportElement)) {
                if (retryCount < maxRetries) {
                    setTimeout(() => {
                        this.enableViewportWithRetry(viewportElement, name, index, retryCount + 1);
                    }, 100 * (retryCount + 1)); // Exponential backoff
                }
                return;
            }

            // Check if already enabled
            try {
                const enabledElement = cornerstone.getEnabledElement(viewportElement);
                console.log(`Viewport ${name} already enabled`);

                // Store in viewports map
                this.viewports.set(name, viewportElement);

                // Add to resize observer
                if (this.resizeObserver) {
                    this.resizeObserver.observe(viewportElement);
                }

                // Set original viewport as active, or first viewport if no original
                if (name === 'original' || (index === 0 && !this.getViewport('original'))) {
                    setTimeout(() => {
                        this.setActiveViewport(viewportElement);
                        console.log(`Auto-activated viewport: ${name}`);
                    }, 50);
                }

                return;

            } catch (e) {
                // Not enabled, so enable it
                console.log(`Enabling viewport: ${name}...`);

                // Add slight delay to ensure DOM is ready
                setTimeout(() => {
                    try {
                        cornerstone.enable(viewportElement);
                        console.log(`✓ Enabled viewport: ${name} at position ${index + 1}`);

                        // Store in viewports map
                        this.viewports.set(name, viewportElement);

                        // Add to resize observer
                        if (this.resizeObserver) {
                            this.resizeObserver.observe(viewportElement);
                        }

                        // Set appropriate viewport as active
                        if (index === 0 || (name === 'original' && !this.activeViewport)) {
                            setTimeout(() => {
                                this.setActiveViewport(viewportElement);
                            }, 150);
                        }

                    } catch (enableError) {
                        console.error(`Failed to enable viewport ${name}:`, enableError);

                        if (retryCount < maxRetries) {
                            console.log(`Retrying viewport ${name} (attempt ${retryCount + 1}/${maxRetries})`);
                            setTimeout(() => {
                                this.enableViewportWithRetry(viewportElement, name, index, retryCount + 1);
                            }, 200 * (retryCount + 1));
                        } else {
                            console.error(`Failed to enable viewport ${name} after ${maxRetries} attempts`);
                        }
                    }
                }, 50 * (retryCount + 1));
            }

        } catch (error) {
            console.error(`Error enabling viewport ${name}:`, error);

            if (retryCount < maxRetries) {
                setTimeout(() => {
                    this.enableViewportWithRetry(viewportElement, name, index, retryCount + 1);
                }, 200 * (retryCount + 1));
            }
        }
    }

    // js/managers/viewport-manager.js

    createViewportElement(name, index) {
        const element = document.createElement('div');
        element.className = 'viewport';
        element.id = `viewport-${name}-${index}`;
        element.dataset.viewportName = name;
        element.style.position = 'relative';
        element.style.backgroundColor = '#000000';
        element.style.cursor = 'pointer';
        element.style.transition = 'all 0.2s ease'; // Smooth transitions

        // Set default border based on viewport type
        if (['axial', 'sagittal', 'coronal'].includes(name)) {
            element.classList.add('mpr-view');
            element.style.border = '1px solid #28a745'; // Green for MPR views
        } else {
            element.style.border = '1px solid #444444'; // Gray for normal views
        }

        // ENHANCED: Click handler with visual feedback and blue border activation
        element.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            // Quick scale animation for click feedback
            element.style.transform = 'scale(0.98)';
            setTimeout(() => {
                element.style.transform = '';
            }, 150);

            // Set this viewport as active (will apply blue border)
            this.setActiveViewport(element);

            // Show feedback message
            const viewportDisplayName = {
                'original': 'Original',
                'axial': 'Axial MPR',
                'sagittal': 'Sagittal MPR',
                'coronal': 'Coronal MPR',
                'main': 'Main'
            }[name] || name;

            if (window.DICOM_VIEWER && window.DICOM_VIEWER.showAISuggestion) {
                window.DICOM_VIEWER.showAISuggestion(`${viewportDisplayName} viewport activated (blue border indicates active)`);
            }
        });

        // Enhanced hover effects
        element.addEventListener('mouseenter', () => {
            if (!element.classList.contains('active')) {
                element.style.opacity = '0.9';
                element.style.transform = 'scale(1.02)';
                // Add subtle glow on hover for non-active viewports
                if (element.classList.contains('mpr-view')) {
                    element.style.boxShadow = '0 0 8px rgba(40, 167, 69, 0.3)';
                } else {
                    element.style.boxShadow = '0 0 8px rgba(255, 255, 255, 0.2)';
                }
            }
        });

        element.addEventListener('mouseleave', () => {
            if (!element.classList.contains('active')) {
                element.style.opacity = '';
                element.style.transform = '';
                element.style.boxShadow = '';
            }
        });

        // Create viewport overlay with proper positioning
        const overlay = document.createElement('div');
        overlay.className = 'viewport-overlay';

        const displayNames = {
            'original': 'Original',
            'axial': 'Axial',
            'sagittal': 'Sagittal',
            'coronal': 'Coronal',
            'main': 'Main',
            '3d': '3D View'
        };

        overlay.textContent = displayNames[name] || name.charAt(0).toUpperCase() + name.slice(1);
        overlay.style.cssText = `
        position: absolute;
        top: 5px;
        left: 5px;
        background: rgba(0,0,0,0.8);
        color: white;
        padding: 3px 8px;
        border-radius: 3px;
        font-size: 11px;
        font-weight: 500;
        z-index: 10;
        pointer-events: none;
        border: 1px solid rgba(255,255,255,0.2);
    `;
        element.appendChild(overlay);

        // Create viewport info panel
        const info = document.createElement('div');
        info.className = 'viewport-info';
        info.style.cssText = `
        position: absolute;
        bottom: 5px;
        left: 5px;
        background: rgba(0,0,0,0.8);
        color: white;
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 9px;
        z-index: 10;
        pointer-events: none;
        text-align: left;
        border: 1px solid rgba(255,255,255,0.1);
    `;
        element.appendChild(info);

        // Add MPR-specific elements
        if (['axial', 'sagittal', 'coronal'].includes(name)) {
            const sliceIndicator = document.createElement('div');
            sliceIndicator.className = 'slice-indicator';
            sliceIndicator.textContent = 'Slice: 50%';
            sliceIndicator.style.cssText = `
            position: absolute;
            top: 5px;
            right: 5px;
            background: rgba(40,167,69,0.8);
            color: white;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 9px;
            font-weight: 500;
            z-index: 10;
            pointer-events: none;
            border: 1px solid rgba(40,167,69,0.3);
        `;
            element.appendChild(sliceIndicator);
        }

        // Add active status indicator for debugging
        const activeIndicator = document.createElement('div');
        activeIndicator.className = 'active-status-indicator';
        activeIndicator.style.cssText = `
        position: absolute;
        top: 5px;
        right: 50%;
        transform: translateX(50%);
        background: rgba(13, 110, 253, 0.9);
        color: white;
        padding: 1px 6px;
        border-radius: 10px;
        font-size: 8px;
        font-weight: bold;
        z-index: 15;
        pointer-events: none;
        display: none;
    `;
        activeIndicator.textContent = 'ACTIVE';
        element.appendChild(activeIndicator);

        this.addMouseWheelNavigation(element, name);
        this.addTouchSupport(element, name);
        this.addDoubleClickSupport(element, name);

        // ⬇️ THIS IS THE NEW LINE TO ADD ⬇️
        // Announce that a new viewport has been created so other managers can listen.
        document.dispatchEvent(new CustomEvent('viewport-created', { detail: { viewport: element } }));

        return element;
    }
    setupMPRViewports() {
        console.log('Setting up MPR viewports...');

        if (window.DICOM_VIEWER.MANAGERS.viewportManager.currentLayout !== '2x2') {
            console.log('MPR requires 2x2 layout, switching...');
            window.DICOM_VIEWER.MANAGERS.viewportManager.switchLayout('2x2');

            // Wait for layout switch to complete
            return new Promise(resolve => {
                setTimeout(() => {
                    this.setupMPRViewports().then(resolve);
                }, 600);
            });
        }

        // Wait a bit for viewports to be fully created and enabled
        return new Promise((resolve) => {
            setTimeout(() => {
                window.DICOM_VIEWER.STATE.mprViewports = {
                    axial: window.DICOM_VIEWER.MANAGERS.viewportManager.getViewport('axial'),
                    sagittal: window.DICOM_VIEWER.MANAGERS.viewportManager.getViewport('sagittal'),
                    coronal: window.DICOM_VIEWER.MANAGERS.viewportManager.getViewport('coronal'),
                    original: window.DICOM_VIEWER.MANAGERS.viewportManager.getViewport('original')
                };

                console.log('MPR viewports configured:', Object.keys(window.DICOM_VIEWER.STATE.mprViewports));

                // Verify and enable all viewports
                let allEnabled = true;
                Object.entries(window.DICOM_VIEWER.STATE.mprViewports).forEach(([name, viewport]) => {
                    if (!viewport) {
                        console.error(`Missing MPR viewport: ${name}`);
                        allEnabled = false;
                        return;
                    }

                    try {
                        cornerstone.getEnabledElement(viewport);
                        console.log(`✓ Viewport ${name} is already enabled`);
                    } catch (error) {
                        try {
                            cornerstone.enable(viewport);
                            console.log(`✓ Enabled viewport ${name}`);
                        } catch (enableError) {
                            console.error(`✗ Failed to enable viewport ${name}:`, enableError);
                            allEnabled = false;
                        }
                    }
                });

                if (!allEnabled) {
                    console.error('Not all MPR viewports are properly enabled');
                    resolve(false);
                    return;
                }

                console.log('All MPR viewports are enabled and ready');
                resolve(true);
            }, 500); // Increased delay for proper initialization
        });
    }

    // FIXED: Safer viewport methods with proper click handling
    // FIXED: setActiveViewport with consistent blue border for active viewport
    setActiveViewport(viewport) {
        if (!viewport) {
            console.warn('Cannot set null viewport as active');
            return;
        }

        // Verify viewport is enabled before setting as active
        try {
            cornerstone.getEnabledElement(viewport);
        } catch (error) {
            console.warn('Cannot set inactive viewport as active:', error);
            // Try to enable it
            try {
                cornerstone.enable(viewport);
                console.log('Re-enabled viewport for activation');
            } catch (enableError) {
                console.error('Failed to enable viewport for activation:', enableError);
                return;
            }
        }

        // Remove active class and styling from all viewports
        this.viewports.forEach(vp => {
            vp.classList.remove('active');
            vp.style.boxShadow = '';
            // Reset to default border based on viewport type
            if (vp.classList.contains('mpr-view')) {
                vp.style.border = '1px solid #28a745'; // Green for MPR
            } else {
                vp.style.border = '1px solid #444444'; // Gray for normal
            }
        });

        // Set active viewport with BLUE border and glow
        viewport.classList.add('active');
        viewport.style.border = '3px solid #0d6efd'; // Blue border for active
        viewport.style.boxShadow = '0 0 15px rgba(13, 110, 253, 0.6)'; // Blue glow

        // Update all references to active viewport
        this.activeViewport = viewport;
        window.activeViewport = viewport;
        window.DICOM_VIEWER.STATE.activeViewport = viewport;

        console.log(`Active viewport set with blue border: ${viewport.dataset.viewportName}`);

        // Update UI to show which viewport is active
        this.updateActiveViewportUI(viewport);
    }

    // In viewport-manager.js - REMOVE ONE of these duplicate methods:

    // Keep only this version:
    updateActiveViewportUI(viewport) {
        const viewportName = viewport.dataset.viewportName;
        const displayName = {
            'original': 'Original',
            'axial': 'Axial MPR',
            'sagittal': 'Sagittal MPR',
            'coronal': 'Coronal MPR'
        }[viewportName] || viewportName;

        // Update any active viewport indicator in the UI if it exists
        const activeIndicator = document.querySelector('.active-viewport-indicator');
        if (activeIndicator) {
            activeIndicator.textContent = `Active: ${displayName}`;
        }
    }

    // DELETE the second identical method that appears later in the file

    // REST OF THE CLASS METHODS REMAIN THE SAME...
    addMouseWheelNavigation(element, viewportName) {
        let wheelTimeout = null;

        element.addEventListener('wheel', (e) => {
            e.preventDefault();

            clearTimeout(wheelTimeout);
            wheelTimeout = setTimeout(() => {
                if (['axial', 'sagittal', 'coronal'].includes(viewportName)) {
                    if (window.DICOM_VIEWER.MANAGERS.mprManager && window.DICOM_VIEWER.MANAGERS.mprManager.volumeData) {
                        const delta = e.deltaY > 0 ? 0.02 : -0.02;
                        const state = window.DICOM_VIEWER.STATE;
                        const currentPos = state.currentSlicePositions[viewportName] || 0.5;
                        const newPos = Math.max(0, Math.min(1, currentPos + delta));

                        state.currentSlicePositions[viewportName] = newPos;
                        window.DICOM_VIEWER.updateMPRSlice(viewportName, newPos);

                        const slider = document.getElementById(`${viewportName}Slider`);
                        if (slider) slider.value = newPos * 100;
                    }
                } else {
                    if (window.DICOM_VIEWER.STATE.totalImages > 1) {
                        const delta = e.deltaY > 0 ? 1 : -1;
                        window.DICOM_VIEWER.navigateImage(delta);
                    }
                }
            }, 10);
        }, { passive: false });
    }

    addTouchSupport(element, viewportName) {
        let touchStartY = 0;

        element.addEventListener('touchstart', (e) => {
            touchStartY = e.touches[0].clientY;
        }, { passive: true });

        element.addEventListener('touchmove', (e) => {
            if (e.touches.length === 1) {
                const deltaY = touchStartY - e.touches[0].clientY;

                if (Math.abs(deltaY) > 15) {
                    if (['axial', 'sagittal', 'coronal'].includes(viewportName)) {
                        const delta = deltaY > 0 ? 0.05 : -0.05;
                        const state = window.DICOM_VIEWER.STATE;
                        const currentPos = state.currentSlicePositions[viewportName] || 0.5;
                        const newPos = Math.max(0, Math.min(1, currentPos + delta));

                        state.currentSlicePositions[viewportName] = newPos;
                        window.DICOM_VIEWER.updateMPRSlice(viewportName, newPos);
                    } else {
                        if (window.DICOM_VIEWER.STATE.totalImages > 1) {
                            const delta = deltaY > 0 ? 1 : -1;
                            window.DICOM_VIEWER.navigateImage(delta);
                        }
                    }
                    touchStartY = e.touches[0].clientY;
                }
            }
        }, { passive: true });
    }

    getViewport(name) {
        return this.viewports.get(name);
    }

    getAllViewports() {
        return Array.from(this.viewports.values());
    }

    // Replace the switchLayout function in viewport-manager.js with this fixed version
    switchLayout(newLayout) {
        console.log(`=== LAYOUT SWITCH: ${this.currentLayout} → ${newLayout} ===`);

        if (this.currentLayout === newLayout) {
            console.log('Already in target layout, skipping switch');
            return true;
        }

        const state = window.DICOM_VIEWER.STATE;

        // 1. PRESERVE CURRENT VIEWPORT STATES
        const preservedStates = new Map();
        const preservedMPRStates = new Map();

        console.log('Step 1: Preserving current viewport states...');
        this.viewports.forEach((viewport, name) => {
            try {
                const enabledElement = cornerstone.getEnabledElement(viewport);
                if (enabledElement && enabledElement.image) {
                    const viewportState = cornerstone.getViewport(viewport);
                    const imageData = {
                        image: enabledElement.image,
                        viewport: viewportState,
                        imageId: enabledElement.image.imageId,
                        windowWidth: viewportState.voi.windowWidth,
                        windowCenter: viewportState.voi.windowCenter,
                        scale: viewportState.scale,
                        translation: { ...viewportState.translation },
                        rotation: viewportState.rotation,
                        hflip: viewportState.hflip,
                        vflip: viewportState.vflip,
                        invert: viewportState.invert,
                        originalName: name
                    };

                    // Store with both original name and cross-layout mappings
                    preservedStates.set(name, imageData);

                    // Create cross-layout mappings for image preservation
                    if (name === 'original') {
                        preservedStates.set('main', { ...imageData, originalName: 'original' });
                        preservedStates.set('left', { ...imageData, originalName: 'original' });
                    } else if (name === 'axial') {
                        preservedStates.set('right', { ...imageData, originalName: 'axial' });
                    } else if (name === 'main') {
                        preservedStates.set('original', { ...imageData, originalName: 'main' });
                    } else if (name === 'left') {
                        preservedStates.set('original', { ...imageData, originalName: 'left' });
                    }

                    console.log(`✓ Preserved ${name}: ${enabledElement.image.imageId}`);
                }
            } catch (error) {
                console.log(`○ No image to preserve in ${name}`);
            }
        });

        // 2. PRESERVE MPR-SPECIFIC STATES
        if (state.mprViewports) {
            ['axial', 'sagittal', 'coronal'].forEach(orientation => {
                if (state.currentSlicePositions[orientation]) {
                    preservedMPRStates.set(orientation, {
                        position: state.currentSlicePositions[orientation],
                        sliderValue: document.getElementById(`${orientation}Slider`)?.value
                    });
                    console.log(`✓ Preserved MPR ${orientation} position: ${state.currentSlicePositions[orientation]}`);
                }
            });
        }

        // 3. PRESERVE ACTIVE VIEWPORT INFO
        const previousActiveViewportName = this.activeViewport ? this.activeViewport.dataset.viewportName : 'original';

        // 4. PAUSE CINE IF PLAYING
        const wasPlaying = state.isPlaying;
        if (wasPlaying) {
            window.DICOM_VIEWER.stopCine();
        }

        // 5. CREATE NEW LAYOUT
        console.log('Step 2: Creating new layout...');
        const success = this.createViewports(newLayout);

        if (!success) {
            console.error('✗ Failed to create new layout');
            return false;
        }

        // 6. RESTORE IMAGES AFTER SHORT DELAY
        setTimeout(async () => {
            console.log('Step 3: Restoring images to new viewports...');
            const newLayoutConfig = this.layouts[newLayout];
            let primaryImageRestored = false;

            // Restore images with priority order
            const restorationPriority = this.getRestorationPriority(newLayout);

            for (const { viewportName, sourceNames } of restorationPriority) {
                const viewport = this.getViewport(viewportName);
                if (!viewport) continue;

                // Try to find preserved state from any of the source names
                let preservedState = null;
                for (const sourceName of sourceNames) {
                    if (preservedStates.has(sourceName)) {
                        preservedState = preservedStates.get(sourceName);
                        break;
                    }
                }

                if (preservedState) {
                    try {
                        console.log(`→ Restoring ${viewportName} from ${preservedState.originalName}...`);

                        // Ensure viewport is enabled
                        try {
                            cornerstone.getEnabledElement(viewport);
                        } catch (e) {
                            cornerstone.enable(viewport);
                            await new Promise(resolve => setTimeout(resolve, 100));
                        }

                        // Display the image
                        await cornerstone.displayImage(viewport, preservedState.image);

                        // Restore viewport settings
                        const currentViewport = cornerstone.getViewport(viewport);
                        currentViewport.voi.windowWidth = preservedState.windowWidth;
                        currentViewport.voi.windowCenter = preservedState.windowCenter;
                        currentViewport.scale = preservedState.scale;
                        currentViewport.translation = { ...preservedState.translation };
                        currentViewport.rotation = preservedState.rotation;
                        currentViewport.hflip = preservedState.hflip;
                        currentViewport.vflip = preservedState.vflip;
                        currentViewport.invert = preservedState.invert;

                        cornerstone.setViewport(viewport, currentViewport);

                        console.log(`✓ Restored ${viewportName} successfully`);

                        if (preservedState.originalName === 'original' || viewportName === 'original') {
                            primaryImageRestored = true;
                        }

                    } catch (error) {
                        console.error(`✗ Failed to restore ${viewportName}:`, error);
                    }
                }
            }

            // If no primary image was restored, load current image
            if (!primaryImageRestored && state.currentSeriesImages && state.currentSeriesImages.length > 0) {
                console.log('Loading current image to primary viewport...');
                const primaryViewport = this.getViewport(newLayoutConfig.viewports[0]);
                if (primaryViewport) {
                    this.setActiveViewport(primaryViewport);
                    await window.DICOM_VIEWER.loadCurrentImage();
                }
            }

            // CRITICAL: Handle MPR restoration for 2x2 layout
            if (newLayout === '2x2' && state.mprEnabled &&
                window.DICOM_VIEWER.MANAGERS.mprManager &&
                window.DICOM_VIEWER.MANAGERS.mprManager.volumeData) {

                console.log('Step 4: Restoring MPR views...');

                // Wait a bit more for viewports to settle
                setTimeout(async () => {
                    try {
                        // Setup MPR viewports
                        await window.DICOM_VIEWER.setupMPRViewports();

                        // Restore MPR slice positions
                        preservedMPRStates.forEach((mprState, orientation) => {
                            window.DICOM_VIEWER.STATE.currentSlicePositions[orientation] = mprState.position;
                            const slider = document.getElementById(`${orientation}Slider`);
                            if (slider && mprState.sliderValue) {
                                slider.value = mprState.sliderValue;
                            }
                        });

                        // Update all MPR views
                        await window.DICOM_VIEWER.updateAllMPRViews();
                        console.log('✓ MPR views restored successfully');

                    } catch (error) {
                        console.error('✗ MPR restoration failed:', error);
                    }
                }, 500); // Longer delay for MPR restoration
            }

            // Restore active viewport with smart mapping
            this.restoreActiveViewportSimple(newLayoutConfig, previousActiveViewportName);

            // Resume cine if it was playing
            if (wasPlaying && state.totalImages > 1) {
                setTimeout(() => {
                    window.DICOM_VIEWER.startCine();
                }, 800);
            }

            // Final UI updates
            window.DICOM_VIEWER.updateViewportInfo();
            console.log(`=== LAYOUT SWITCH COMPLETED: ${newLayout} ===`);

        }, 200);

        return true;
    }

    // Updated restoration priority method (remove 1x2 references)
    getRestorationPriority(newLayout) {
        const priorities = {
            '1x1': [
                { viewportName: 'main', sourceNames: ['original', 'main', 'axial', 'sagittal', 'coronal'] }
            ],
            '2x1': [
                { viewportName: 'left', sourceNames: ['original', 'main'] },
                { viewportName: 'right', sourceNames: ['axial', 'sagittal', 'coronal'] }
            ],
            '2x2': [
                { viewportName: 'original', sourceNames: ['original', 'main', 'left'] },
                { viewportName: 'axial', sourceNames: ['axial', 'right'] },
                { viewportName: 'sagittal', sourceNames: ['sagittal'] },
                { viewportName: 'coronal', sourceNames: ['coronal'] }
            ]
        };

        return priorities[newLayout] || [];
    }

    // Updated active viewport restoration (remove 1x2 references)
    restoreActiveViewportSimple(newLayoutConfig, previousActiveViewportName) {
        const activeMapping = {
            'original': ['original', 'main', 'left'],
            'axial': ['axial', 'right'],
            'sagittal': ['sagittal', 'right'],
            'coronal': ['coronal', 'right'],
            'main': ['main', 'original'],
            'left': ['left', 'original', 'main'],
            'right': ['right', 'axial']
        };

        const possibleNames = activeMapping[previousActiveViewportName] || [previousActiveViewportName];
        let newActiveViewport = null;

        // Try to find a matching viewport in the new layout
        for (const name of possibleNames) {
            if (newLayoutConfig.viewports.includes(name)) {
                newActiveViewport = this.getViewport(name);
                if (newActiveViewport) break;
            }
        }

        // Fallback to first viewport if no match found
        if (!newActiveViewport) {
            newActiveViewport = this.getViewport(newLayoutConfig.viewports[0]);
        }

        if (newActiveViewport) {
            this.setActiveViewport(newActiveViewport);
            console.log(`✓ Restored active viewport: ${newActiveViewport.dataset.viewportName}`);
        }
    }


    // Add this method to viewport-manager.js if it's missing
    getRestorationPriority(newLayout) {
        const priorities = {
            '1x1': [
                { viewportName: 'main', sourceNames: ['original', 'main', 'axial', 'sagittal', 'coronal'] }
            ],
            '2x1': [
                { viewportName: 'left', sourceNames: ['original', 'main'] },
                { viewportName: 'right', sourceNames: ['axial', 'sagittal', 'coronal'] }
            ],
            '2x2': [
                { viewportName: 'original', sourceNames: ['original', 'main', 'left'] },
                { viewportName: 'axial', sourceNames: ['axial', 'right'] },
                { viewportName: 'sagittal', sourceNames: ['sagittal'] },
                { viewportName: 'coronal', sourceNames: ['coronal'] }
            ]
        };

        return priorities[newLayout] || [];
    }



    // Helper method for simple active viewport restoration
    restoreActiveViewportSimple(newLayoutConfig, previousActiveViewportName) {
        const activeMapping = {
            'original': ['original', 'main', 'left', 'top'],
            'axial': ['axial', 'right', 'bottom'],
            'sagittal': ['sagittal', 'right', 'bottom'],
            'coronal': ['coronal', 'right', 'bottom'],
            'main': ['main', 'original'],
            'left': ['left', 'original', 'main'],
            'right': ['right', 'axial'],
            'top': ['top', 'original', 'main'],
            'bottom': ['bottom', 'axial']
        };

        const possibleNames = activeMapping[previousActiveViewportName] || [previousActiveViewportName];
        let newActiveViewport = null;

        // Try to find a matching viewport in the new layout
        for (const name of possibleNames) {
            if (newLayoutConfig.viewports.includes(name)) {
                newActiveViewport = this.getViewport(name);
                if (newActiveViewport) break;
            }
        }

        // Fallback to first viewport if no match found
        if (!newActiveViewport) {
            newActiveViewport = this.getViewport(newLayoutConfig.viewports[0]);
        }

        if (newActiveViewport) {
            this.setActiveViewport(newActiveViewport);
            console.log(`✓ Restored active viewport: ${newActiveViewport.dataset.viewportName}`);
        }
    }

    // NEW: Smart restoration method with layout-specific logic
    async performSmartRestoration(newLayoutConfig, preservedStates, preservedMPRStates, previousActiveViewportName, oldLayout, newLayout, wasPlaying) {
        console.log(`Performing smart restoration: ${oldLayout} → ${newLayout}`);

        const restorationPromises = [];
        let primaryImageRestored = false;

        // Define restoration priority for each layout
        const restorationPriority = this.getRestorationPriority(newLayout, preservedStates);

        for (const { viewportName, sourceNames } of restorationPriority) {
            const viewport = this.getViewport(viewportName);
            if (!viewport) continue;

            // Try to find preserved state from any of the source names
            let preservedState = null;
            for (const sourceName of sourceNames) {
                if (preservedStates.has(sourceName)) {
                    preservedState = preservedStates.get(sourceName);
                    break;
                }
            }

            if (preservedState) {
                console.log(`→ Restoring ${viewportName} from ${preservedState.originalName}...`);

                const restorePromise = this.restoreViewportState(viewport, preservedState, viewportName)
                    .then(() => {
                        console.log(`✓ Restored ${viewportName} successfully`);
                        if (sourceNames.includes('original') || preservedState.originalName === 'original') {
                            primaryImageRestored = true;
                        }
                    })
                    .catch((error) => {
                        console.error(`✗ Failed to restore ${viewportName}:`, error);
                    });

                restorationPromises.push(restorePromise);
            }
        }

        // Wait for all restorations to complete
        await Promise.allSettled(restorationPromises);

        // If no primary image was restored, load current image
        if (!primaryImageRestored && window.DICOM_VIEWER.STATE.currentSeriesImages && window.DICOM_VIEWER.STATE.currentSeriesImages.length > 0) {
            console.log('No primary image restored, loading current image to first viewport...');
            const firstViewport = this.getAllViewports()[0];
            if (firstViewport) {
                this.setActiveViewport(firstViewport);
                await window.DICOM_VIEWER.loadCurrentImage();
            }
        }

        // Restore active viewport with smart mapping
        this.restoreActiveViewportSmart(newLayoutConfig, previousActiveViewportName);

        // Handle MPR restoration
        this.handleMPRRestoration(newLayout, oldLayout, preservedMPRStates);

        // Resume cine if needed
        if (wasPlaying && window.DICOM_VIEWER.STATE.totalImages > 1) {
            setTimeout(() => {
                window.DICOM_VIEWER.startCine();
                console.log('✓ Resumed cine playback');
            }, 300);
        }

        // Final UI updates
        window.DICOM_VIEWER.updateViewportInfo();
        console.log(`=== LAYOUT SWITCH COMPLETED: ${newLayout} ===`);
    }

    // NEW: Get restoration priority based on layout
    getRestorationPriority(newLayout, preservedStates) {
        const priorities = {
            '1x1': [
                { viewportName: 'main', sourceNames: ['original', 'main', 'axial', 'sagittal', 'coronal'] }
            ],
            '2x1': [
                { viewportName: 'left', sourceNames: ['original', 'main'] },
                { viewportName: 'right', sourceNames: ['axial', 'sagittal', 'coronal'] }
            ],
            '1x2': [
                { viewportName: 'top', sourceNames: ['original', 'main'] },
                { viewportName: 'bottom', sourceNames: ['axial', 'sagittal', 'coronal'] }
            ],
            '2x2': [
                { viewportName: 'original', sourceNames: ['original', 'main', 'left', 'top'] },
                { viewportName: 'axial', sourceNames: ['axial', 'right', 'bottom'] },
                { viewportName: 'sagittal', sourceNames: ['sagittal'] },
                { viewportName: 'coronal', sourceNames: ['coronal'] }
            ]
        };

        return priorities[newLayout] || [];
    }

    // ENHANCED: Smart active viewport restoration
    restoreActiveViewportSmart(newLayoutConfig, previousActiveViewportName) {
        const activeMapping = {
            'original': ['original', 'main', 'left', 'top'],
            'axial': ['axial', 'right', 'bottom'],
            'sagittal': ['sagittal', 'right', 'bottom'],
            'coronal': ['coronal', 'right', 'bottom'],
            'main': ['main', 'original'],
            'left': ['left', 'original', 'main'],
            'right': ['right', 'axial'],
            'top': ['top', 'original', 'main'],
            'bottom': ['bottom', 'axial']
        };

        const possibleNames = activeMapping[previousActiveViewportName] || [previousActiveViewportName];
        let newActiveViewport = null;

        // Try to find a matching viewport in the new layout
        for (const name of possibleNames) {
            if (newLayoutConfig.viewports.includes(name)) {
                newActiveViewport = this.getViewport(name);
                if (newActiveViewport) break;
            }
        }

        // Fallback to first viewport if no match found
        if (!newActiveViewport) {
            newActiveViewport = this.getViewport(newLayoutConfig.viewports[0]);
        }

        if (newActiveViewport) {
            this.setActiveViewport(newActiveViewport);
            console.log(`✓ Smart active viewport restoration: ${newActiveViewport.dataset.viewportName}`);
        }
    }

    // Helper method to restore individual viewport state
    async restoreViewportState(viewport, state, viewportName) {
        try {
            // Ensure viewport is enabled
            let retryCount = 0;
            while (retryCount < 3) {
                try {
                    cornerstone.getEnabledElement(viewport);
                    break;
                } catch (e) {
                    cornerstone.enable(viewport);
                    await new Promise(resolve => setTimeout(resolve, 100));
                    retryCount++;
                }
            }

            // Display the image first
            await cornerstone.displayImage(viewport, state.image);

            // Small delay to ensure image is displayed
            await new Promise(resolve => setTimeout(resolve, 50));

            // Restore viewport settings
            const currentViewport = cornerstone.getViewport(viewport);
            currentViewport.voi.windowWidth = state.windowWidth;
            currentViewport.voi.windowCenter = state.windowCenter;
            currentViewport.scale = state.scale;
            currentViewport.translation = { ...state.translation };
            currentViewport.rotation = state.rotation;
            currentViewport.hflip = state.hflip;
            currentViewport.vflip = state.vflip;
            currentViewport.invert = state.invert;

            cornerstone.setViewport(viewport, currentViewport);

            return true;
        } catch (error) {
            console.error(`Failed to restore viewport ${viewportName}:`, error);
            throw error;
        }
    }

    // Helper method to restore active viewport
    restoreActiveViewport(newLayoutConfig, previousActiveViewportName) {
        let newActiveViewport = this.getViewport(previousActiveViewportName);

        // If previous active viewport doesn't exist in new layout, use first available
        if (!newActiveViewport || !newLayoutConfig.viewports.includes(previousActiveViewportName)) {
            newActiveViewport = this.getViewport(newLayoutConfig.viewports[0]);
        }

        if (newActiveViewport) {
            this.setActiveViewport(newActiveViewport);
            console.log(`✓ Restored active viewport: ${newActiveViewport.dataset.viewportName}`);
        }
    }

    // Helper method to handle MPR restoration
    handleMPRRestoration(newLayout, oldLayout, preservedMPRStates) {
        const state = window.DICOM_VIEWER.STATE;

        if (newLayout === '2x2' && state.mprEnabled &&
            window.DICOM_VIEWER.MANAGERS.mprManager &&
            window.DICOM_VIEWER.MANAGERS.mprManager.volumeData) {

            console.log('Step 5: Restoring MPR views for 2x2 layout...');

            setTimeout(async () => {
                try {
                    await window.DICOM_VIEWER.setupMPRViewports();

                    // Restore MPR slice positions
                    preservedMPRStates.forEach((state, orientation) => {
                        window.DICOM_VIEWER.STATE.currentSlicePositions[orientation] = state.position;
                        const slider = document.getElementById(`${orientation}Slider`);
                        if (slider && state.sliderValue) {
                            slider.value = state.sliderValue;
                        }
                    });

                    await window.DICOM_VIEWER.updateAllMPRViews();
                    console.log('✓ MPR views restored successfully');

                } catch (error) {
                    console.error('✗ MPR restoration failed:', error);
                }
            }, 200);
        }
    }


    //
    // ➡️ PASTE THIS IN: viewport-manager.js
    //

    // ENHANCED: Replace the cleanupViewports function in MPRViewportManager with this version.
    cleanupViewports() {
        console.log(`Cleaning up ${this.viewports.size} previous viewports.`);
        this.viewports.forEach((viewport, name) => {
            try {
                // FIX: Unsubscribe from the resize observer to prevent leaks.
                if (this.resizeObserver) {
                    this.resizeObserver.unobserve(viewport);
                }

                // FIX: Remove all event listeners associated with the viewport.
                // (Your click/hover listeners are okay as the element is destroyed, but this is best practice for more complex listeners).

                // FIX: Disable the element in Cornerstone to release its resources.
                if (cornerstone.getEnabledElement(viewport)) {
                    cornerstone.disable(viewport);
                }
            } catch (error) {
                // This is expected if the element was never enabled.
            }
        });

        // FIX: Clear the internal map to release references to the DOM elements.
        this.viewports.clear();
        this.activeViewport = null;
        window.DICOM_VIEWER.STATE.activeViewport = null;

        const container = document.getElementById('viewport-container');
        if (container) {
            container.innerHTML = ''; // Ensure the DOM is physically cleared.
        }

        console.log("Viewport cleanup complete.");
    }

    destroy() {
        this.cleanupViewports();
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
    }

    getViewportStats() {
        const stats = {
            total: this.viewports.size,
            enabled: 0,
            withImages: 0,
            active: this.activeViewport ? this.activeViewport.dataset.viewportName : null,
            layout: this.currentLayout
        };

        this.viewports.forEach(viewport => {
            try {
                const enabledElement = cornerstone.getEnabledElement(viewport);
                stats.enabled++;
                if (enabledElement.image) {
                    stats.withImages++;
                }
            } catch (error) {
                // Not enabled
            }
        });

        return stats;
    }

    // 2. Add this new method to your MPRViewportManager class:
    addDoubleClickSupport(element, viewportName) {
        // Add visual feedback for double-click capability
        element.style.cursor = 'pointer';
        element.title = `${viewportName.charAt(0).toUpperCase() + viewportName.slice(1)} - Double-click to toggle layout`;

        // Add double-click event listener
        element.addEventListener('dblclick', (event) => {
            event.preventDefault();
            event.stopPropagation();

            // Add visual feedback for the double-click
            element.style.transform = 'scale(0.95)';
            setTimeout(() => {
                element.style.transform = '';
            }, 150);

            this.handleViewportDoubleClick(element, viewportName);
        });


        // Add hover effect to indicate interactivity
        let hoverTimeout;
        element.addEventListener('mouseenter', () => {
            clearTimeout(hoverTimeout);
            hoverTimeout = setTimeout(() => {
                if (element.querySelector('.layout-hint')) return;

                const hint = document.createElement('div');
                hint.className = 'layout-hint';
                hint.innerHTML = '<i class="bi bi-arrows-fullscreen me-1"></i>Double-click to toggle';
                hint.style.cssText = `
                position: absolute;
                bottom: 10px;
                right: 10px;
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 10px;
                opacity: 0;
                transition: opacity 0.3s ease;
                pointer-events: none;
                z-index: 25;
                white-space: nowrap;
            `;

                element.appendChild(hint);

                setTimeout(() => {
                    hint.style.opacity = '0.9';
                }, 50);
            }, 800); // Show hint after 800ms hover
        });

        element.addEventListener('mouseleave', () => {
            clearTimeout(hoverTimeout);
            const hint = element.querySelector('.layout-hint');
            if (hint) {
                hint.style.opacity = '0';
                setTimeout(() => {
                    if (hint.parentNode) {
                        hint.parentNode.removeChild(hint);
                    }
                }, 300);
            }
        });
    }

    // 3. Add this new method to handle the double-click logic:
    handleViewportDoubleClick(viewport, viewportName) {
        console.log(`Double-click on viewport: ${viewportName}, current layout: ${this.currentLayout}`);

        const currentLayout = this.currentLayout;
        let targetLayout;

        // Store the current image and viewport state
        let preservedImage = null;
        let preservedViewportState = null;

        try {
            const enabledElement = cornerstone.getEnabledElement(viewport);
            if (enabledElement && enabledElement.image) {
                preservedImage = enabledElement.image;
                preservedViewportState = cornerstone.getViewport(viewport);
                console.log('Preserved image and viewport state for layout toggle');
            }
        } catch (error) {
            console.log('No image to preserve');
        }

        // Determine target layout
        if (currentLayout === '2x2') {
            targetLayout = '1x1';
            console.log('Switching from quad view to single view');
        } else if (currentLayout === '1x1') {
            targetLayout = '2x2';
            console.log('Switching from single view to quad view');
        } else {
            // From any other layout to single view
            targetLayout = '1x1';
            console.log(`Switching from ${currentLayout} to single view`);
        }

        // Perform the layout switch
        const success = this.switchLayout(targetLayout);

        if (success && preservedImage) {
            // Wait for layout to settle, then restore image
            setTimeout(async () => {
                await this.restoreImageInNewLayout(targetLayout, preservedImage, preservedViewportState);
            }, 400);
        }

        // Show notification
        this.showLayoutToggleNotification(targetLayout, viewportName);
    }

    // 4. Add method to restore image in new layout:
    async restoreImageInNewLayout(layout, image, viewportState) {
        let targetViewport;

        if (layout === '1x1') {
            targetViewport = this.getViewport('main');
        } else if (layout === '2x2') {
            targetViewport = this.getViewport('original');
        }

        if (targetViewport && image) {
            try {
                // Ensure viewport is enabled
                try {
                    cornerstone.getEnabledElement(targetViewport);
                } catch (e) {
                    cornerstone.enable(targetViewport);
                    await new Promise(resolve => setTimeout(resolve, 100));
                }

                // Display the image
                await cornerstone.displayImage(targetViewport, image);

                // Restore viewport state if available
                if (viewportState) {
                    cornerstone.setViewport(targetViewport, viewportState);
                }

                // Set as active viewport
                this.setActiveViewport(targetViewport);

                console.log(`Successfully restored image in ${layout} layout`);

            } catch (error) {
                console.error('Failed to restore image in new layout:', error);
            }
        }
    }

    // 5. Add notification method:
    showLayoutToggleNotification(layout, sourceViewport) {
        const messages = {
            '1x1': `Expanded ${sourceViewport} to single view (double-click again for quad view)`,
            '2x2': 'Returned to quad view layout',
            '2x1': 'Switched to dual view layout'
        };

        const message = messages[layout] || `Switched to ${layout} layout`;

        if (window.DICOM_VIEWER && window.DICOM_VIEWER.showAISuggestion) {
            window.DICOM_VIEWER.showAISuggestion(message);
        }
    }



    // 7. Update the existing createViewports method to automatically add double-click support:
    // Add this at the end of your createViewports method, after viewport creation:

    /*
    // Add this code at the end of createViewports method:
    
        // Add double-click support to all created viewports
        layoutConfig.viewports.forEach((name, index) => {
            const viewport = this.viewports.get(name);
            if (viewport) {
                this.addDoubleClickSupport(viewport, name);
            }
        });
    */

};