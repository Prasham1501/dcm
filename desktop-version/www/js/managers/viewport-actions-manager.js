/**
 * Viewport Actions Manager
 * Handles Insert All, Clear All, and Drag-Drop between viewports
 */

window.DICOM_VIEWER.ViewportActionsManager = class {
    constructor() {
        this.initialized = false;
        this.draggedViewportId = null;
        this.draggedImageData = null;
    }

    initialize() {
        if (this.initialized) return;

        console.log('Initializing Viewport Actions Manager');
        this.createActionButtons();
        this.setupDragAndDrop();
        this.initialized = true;
    }

    /**
     * Create Insert All and Clear All buttons
     */
    createActionButtons() {
        const controlsRight = document.querySelector('.mpr-controls .controls-group-right .control-group');

        if (!controlsRight) {
            console.error('Right controls container not found');
            return;
        }

        // Create Insert All button
        const insertAllBtn = document.createElement('button');
        insertAllBtn.id = 'insertAllBtn';
        insertAllBtn.className = 'btn btn-sm btn-success';
        insertAllBtn.title = 'Insert all images into viewports';
        insertAllBtn.innerHTML = '<i class="bi bi-grid-fill"></i> Insert All';
        insertAllBtn.style.marginLeft = '8px';

        // Create Clear All button
        const clearAllBtn = document.createElement('button');
        clearAllBtn.id = 'clearAllBtn';
        clearAllBtn.className = 'btn btn-sm btn-danger';
        clearAllBtn.title = 'Clear all viewports';
        clearAllBtn.innerHTML = '<i class="bi bi-trash"></i> Clear All';
        clearAllBtn.style.marginLeft = '8px';

        // Add to controls
        controlsRight.appendChild(insertAllBtn);
        controlsRight.appendChild(clearAllBtn);

        // Setup event listeners
        insertAllBtn.addEventListener('click', () => this.insertAllImages());
        clearAllBtn.addEventListener('click', () => this.clearAllViewports());
    }

    /**
     * Insert all images into viewports automatically
     */
    insertAllImages() {
        console.log('Insert All triggered');

        // Get current series images
        const uploadHandler = window.DICOM_VIEWER.UploadHandler;
        if (!uploadHandler || !uploadHandler.currentSeries) {
            alert('No images loaded. Please upload DICOM files first.');
            return;
        }

        const images = uploadHandler.currentSeries.images;
        if (!images || images.length === 0) {
            alert('No images available in current series.');
            return;
        }

        const imageCount = images.length;
        console.log(`Inserting ${imageCount} images`);

        // Calculate optimal grid
        const customGridManager = window.DICOM_VIEWER.MANAGERS.customGridManager;
        if (!customGridManager) {
            alert('Grid manager not initialized');
            return;
        }

        const optimalGrid = customGridManager.calculateOptimalGrid(imageCount);
        console.log(`Optimal grid: ${optimalGrid.rows}x${optimalGrid.cols}`);

        // Apply optimal grid layout
        customGridManager.applyCustomGrid(optimalGrid.rows, optimalGrid.cols);

        // Wait for viewports to be created
        setTimeout(() => {
            const viewportManager = window.DICOM_VIEWER.MANAGERS.viewportManager;
            if (!viewportManager) return;

            const viewports = viewportManager.getAllViewports();
            console.log(`Available viewports: ${viewports.length}`);

            // Distribute images across viewports
            viewports.forEach((viewport, index) => {
                if (index < images.length) {
                    const image = images[index];
                    this.loadImageToViewport(viewport, image);
                }
            });

            // Fit images to viewports
            setTimeout(() => {
                this.fitAllImagesToViewports();
            }, 500);

            console.log('Insert All completed');
        }, 300);
    }

    /**
     * Load image to specific viewport
     */
    async loadImageToViewport(viewport, image) {
        try {
            const imageUrl = window.DICOM_VIEWER.getImageUrl(image);
            if (!imageUrl) {
                console.error('Invalid image URL');
                return;
            }

            // Load image
            const loadedImage = await cornerstone.loadImage(imageUrl);

            // Display image
            cornerstone.displayImage(viewport, loadedImage);

            // Reset viewport (no zoom, centered)
            cornerstone.reset(viewport);

            // Fit to window
            cornerstone.fitToWindow(viewport);

            console.log('Image loaded to viewport:', viewport.id);

        } catch (error) {
            console.error('Error loading image to viewport:', error);
        }
    }

    /**
     * Fit all images to their viewports
     */
    fitAllImagesToViewports() {
        const viewportManager = window.DICOM_VIEWER.MANAGERS.viewportManager;
        if (!viewportManager) return;

        const viewports = viewportManager.getAllViewports();

        viewports.forEach(viewport => {
            try {
                const enabledElement = cornerstone.getEnabledElement(viewport);
                if (enabledElement && enabledElement.image) {
                    // Reset zoom and pan
                    cornerstone.reset(viewport);

                    // Fit to window
                    cornerstone.fitToWindow(viewport);

                    // Update viewport
                    cornerstone.updateImage(viewport);
                }
            } catch (error) {
                // Viewport might not have an image
            }
        });

        console.log('Fitted all images to viewports');
    }

    /**
     * Clear all viewports
     */
    clearAllViewports() {
        if (!confirm('Are you sure you want to clear all viewports?')) {
            return;
        }

        const viewportManager = window.DICOM_VIEWER.MANAGERS.viewportManager;
        if (!viewportManager) return;

        const viewports = viewportManager.getAllViewports();

        viewports.forEach(viewport => {
            try {
                // Disable and re-enable to clear
                cornerstone.disable(viewport);
                cornerstone.enable(viewport);
                console.log('Cleared viewport:', viewport.id);
            } catch (error) {
                console.error('Error clearing viewport:', error);
            }
        });

        console.log('All viewports cleared');
    }

    /**
     * Setup drag and drop between viewports
     */
    setupDragAndDrop() {
        // Watch for viewport creation and add drag listeners
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.classList && node.classList.contains('viewport')) {
                        this.makeViewportDraggable(node);
                    }
                });
            });
        });

        const container = document.getElementById('viewport-container');
        if (container) {
            observer.observe(container, {
                childList: true,
                subtree: true
            });
        }

        // Add drag listeners to existing viewports
        setTimeout(() => {
            const viewports = document.querySelectorAll('.viewport');
            viewports.forEach(viewport => this.makeViewportDraggable(viewport));
        }, 1000);
    }

    /**
     * Make viewport draggable
     */
    makeViewportDraggable(viewport) {
        // Make viewport draggable
        viewport.setAttribute('draggable', 'true');

        // Drag start
        viewport.addEventListener('dragstart', (e) => {
            try {
                const enabledElement = cornerstone.getEnabledElement(viewport);
                if (!enabledElement || !enabledElement.image) {
                    e.preventDefault();
                    return;
                }

                this.draggedViewportId = viewport.id;
                this.draggedImageData = {
                    imageId: enabledElement.image.imageId,
                    viewport: enabledElement.viewport
                };

                viewport.style.opacity = '0.5';
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', viewport.id);

                console.log('Drag started from:', viewport.id);

            } catch (error) {
                e.preventDefault();
            }
        });

        // Drag end
        viewport.addEventListener('dragend', (e) => {
            viewport.style.opacity = '1';
            this.draggedViewportId = null;
            this.draggedImageData = null;
        });

        // Drag over
        viewport.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            viewport.style.border = '3px solid #0d6efd';
        });

        // Drag leave
        viewport.addEventListener('dragleave', (e) => {
            viewport.style.border = '';
        });

        // Drop
        viewport.addEventListener('drop', (e) => {
            e.preventDefault();
            viewport.style.border = '';

            const sourceViewportId = this.draggedViewportId;
            const targetViewportId = viewport.id;

            if (sourceViewportId && sourceViewportId !== targetViewportId) {
                this.swapViewportImages(sourceViewportId, targetViewportId);
            }
        });

        // Touch support for mobile
        this.addTouchDragSupport(viewport);
    }

    /**
     * Swap images between two viewports
     */
    async swapViewportImages(sourceId, targetId) {
        const sourceViewport = document.getElementById(sourceId);
        const targetViewport = document.getElementById(targetId);

        if (!sourceViewport || !targetViewport) {
            console.error('Viewports not found for swap');
            return;
        }

        try {
            // Get source image data
            const sourceEnabled = cornerstone.getEnabledElement(sourceViewport);
            const sourceImage = sourceEnabled ? sourceEnabled.image : null;
            const sourceViewportData = sourceEnabled ? { ...sourceEnabled.viewport } : null;

            // Get target image data
            let targetEnabled = null;
            let targetImage = null;
            let targetViewportData = null;

            try {
                targetEnabled = cornerstone.getEnabledElement(targetViewport);
                targetImage = targetEnabled ? targetEnabled.image : null;
                targetViewportData = targetEnabled ? { ...targetEnabled.viewport } : null;
            } catch (error) {
                // Target might be empty
            }

            // Swap images
            if (sourceImage) {
                // Display source image in target
                await cornerstone.displayImage(targetViewport, sourceImage);
                if (sourceViewportData) {
                    cornerstone.setViewport(targetViewport, sourceViewportData);
                }
            } else {
                // Clear target if source was empty
                cornerstone.disable(targetViewport);
                cornerstone.enable(targetViewport);
            }

            if (targetImage) {
                // Display target image in source
                await cornerstone.displayImage(sourceViewport, targetImage);
                if (targetViewportData) {
                    cornerstone.setViewport(sourceViewport, targetViewportData);
                }
            } else {
                // Clear source if target was empty
                cornerstone.disable(sourceViewport);
                cornerstone.enable(sourceViewport);
            }

            console.log(`Swapped images between ${sourceId} and ${targetId}`);

        } catch (error) {
            console.error('Error swapping viewport images:', error);
        }
    }

    /**
     * Add touch drag support for mobile
     */
    addTouchDragSupport(viewport) {
        let touchStartViewport = null;
        let touchStartImageData = null;

        viewport.addEventListener('touchstart', (e) => {
            try {
                const enabledElement = cornerstone.getEnabledElement(viewport);
                if (!enabledElement || !enabledElement.image) {
                    return;
                }

                touchStartViewport = viewport;
                touchStartImageData = {
                    imageId: enabledElement.image.imageId,
                    viewport: { ...enabledElement.viewport }
                };

                viewport.style.opacity = '0.7';

            } catch (error) {
                // Ignore
            }
        });

        viewport.addEventListener('touchend', (e) => {
            viewport.style.opacity = '1';

            if (!touchStartViewport) return;

            // Find viewport under touch point
            const touch = e.changedTouches[0];
            const targetElement = document.elementFromPoint(touch.clientX, touch.clientY);

            if (targetElement && targetElement.classList.contains('viewport') &&
                targetElement !== touchStartViewport) {
                this.swapViewportImages(touchStartViewport.id, targetElement.id);
            }

            touchStartViewport = null;
            touchStartImageData = null;
        });
    }
};

// Auto-initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (!window.DICOM_VIEWER.MANAGERS.viewportActionsManager) {
            window.DICOM_VIEWER.MANAGERS.viewportActionsManager = new window.DICOM_VIEWER.ViewportActionsManager();
            window.DICOM_VIEWER.MANAGERS.viewportActionsManager.initialize();
        }
    });
} else {
    if (!window.DICOM_VIEWER.MANAGERS) {
        window.DICOM_VIEWER.MANAGERS = {};
    }
    window.DICOM_VIEWER.MANAGERS.viewportActionsManager = new window.DICOM_VIEWER.ViewportActionsManager();
}
