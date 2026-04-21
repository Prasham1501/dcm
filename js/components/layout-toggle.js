// Add this to your viewport-manager.js or create a new layout-toggle.js file

// Double-click layout toggle functionality
window.DICOM_VIEWER.LayoutToggle = {
    previousLayout: '2x2',
    isToggled: false,
    doubleClickDelay: 300, // milliseconds
    clickTimeout: null,
    
    initialize() {
        console.log('Initializing double-click layout toggle...');
        this.setupDoubleClickHandlers();
    },

    setupDoubleClickHandlers() {
        // We'll add double-click handlers when viewports are created
        // This will be called from the viewport creation process
        this.observeViewportCreation();
    },

    observeViewportCreation() {
        // Watch for new viewports being added to the DOM
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.classList && node.classList.contains('viewport')) {
                            this.addDoubleClickHandler(node);
                        }
                        // Also check children
                        const viewports = node.querySelectorAll && node.querySelectorAll('.viewport');
                        if (viewports) {
                            viewports.forEach(vp => this.addDoubleClickHandler(vp));
                        }
                    }
                });
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Also add handlers to existing viewports
        document.querySelectorAll('.viewport').forEach(viewport => {
            this.addDoubleClickHandler(viewport);
        });
    },

    addDoubleClickHandler(viewport) {
        // Remove existing handler if present
        if (viewport._doubleClickHandler) {
            viewport.removeEventListener('dblclick', viewport._doubleClickHandler);
        }

        // Create new double-click handler
        viewport._doubleClickHandler = (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.handleDoubleClick(viewport);
        };

        // Add the handler
        viewport.addEventListener('dblclick', viewport._doubleClickHandler);
        
        console.log(`Added double-click handler to viewport: ${viewport.dataset.viewportName}`);
    },

    handleDoubleClick(viewport) {
        console.log(`Double-click detected on viewport: ${viewport.dataset.viewportName}`);
        
        const currentLayout = window.DICOM_VIEWER.MANAGERS.viewportManager.currentLayout;
        console.log(`Current layout: ${currentLayout}`);

        // Determine target layout based on current layout
        let targetLayout;
        
        if (currentLayout === '2x2') {
            // From 2x2 to 1x1 (single image)
            targetLayout = '1x1';
            this.previousLayout = '2x2';
            this.isToggled = true;
            console.log('Switching to single image view (1x1)');
        } else if (currentLayout === '1x1') {
            // From 1x1 back to 2x2 (quad view)
            targetLayout = '2x2';
            this.isToggled = false;
            console.log('Switching back to quad view (2x2)');
        } else {
            // From any other layout to 1x1
            targetLayout = '1x1';
            this.previousLayout = currentLayout;
            this.isToggled = true;
            console.log(`Switching from ${currentLayout} to single image view (1x1)`);
        }

        // Perform the layout switch
        this.switchLayoutWithImagePreservation(viewport, targetLayout);
        
        // Show user feedback
        this.showLayoutChangeNotification(targetLayout);
    },

    switchLayoutWithImagePreservation(sourceViewport, targetLayout) {
        const viewportManager = window.DICOM_VIEWER.MANAGERS.viewportManager;
        
        // Store the image from the double-clicked viewport
        let imageToPreserve = null;
        let viewportState = null;
        
        try {
            const enabledElement = cornerstone.getEnabledElement(sourceViewport);
            if (enabledElement && enabledElement.image) {
                imageToPreserve = enabledElement.image;
                viewportState = cornerstone.getViewport(sourceViewport);
                console.log('Preserved image from source viewport');
            }
        } catch (error) {
            console.log('No image to preserve from source viewport');
        }

        // Perform the layout switch
        const success = viewportManager.switchLayout(targetLayout);
        
        if (!success) {
            console.error('Layout switch failed');
            return;
        }

        // If we have an image to preserve, load it in the primary viewport
        if (imageToPreserve && targetLayout === '1x1') {
            setTimeout(() => {
                const mainViewport = viewportManager.getViewport('main');
                if (mainViewport) {
                    try {
                        cornerstone.displayImage(mainViewport, imageToPreserve);
                        if (viewportState) {
                            cornerstone.setViewport(mainViewport, viewportState);
                        }
                        viewportManager.setActiveViewport(mainViewport);
                        console.log('Successfully restored image in single view');
                    } catch (error) {
                        console.error('Failed to restore image in single view:', error);
                    }
                }
            }, 300);
        }
        
        // Update layout buttons
        this.updateLayoutButtons(targetLayout);
    },

    updateLayoutButtons(layout) {
        // Update the layout button states
        document.querySelectorAll('[data-layout]').forEach(btn => {
            btn.classList.remove('btn-primary');
            btn.classList.add('btn-secondary');
        });

        const activeButton = document.querySelector(`[data-layout="${layout}"]`);
        if (activeButton) {
            activeButton.classList.remove('btn-secondary');
            activeButton.classList.add('btn-primary');
        }
    },

    showLayoutChangeNotification(layout) {
        const messages = {
            '1x1': 'Switched to single image view (double-click again for quad view)',
            '2x2': 'Switched to quad view layout',
            '2x1': 'Switched to dual view layout'
        };

        const message = messages[layout] || `Switched to ${layout} layout`;
        
        if (window.DICOM_VIEWER && window.DICOM_VIEWER.showAISuggestion) {
            window.DICOM_VIEWER.showAISuggestion(message);
        }
    },

    // Method to manually toggle layout (can be called from keyboard shortcuts)
    toggleLayout() {
        const currentLayout = window.DICOM_VIEWER.MANAGERS.viewportManager.currentLayout;
        const activeViewport = window.DICOM_VIEWER.MANAGERS.viewportManager.activeViewport;
        
        if (activeViewport) {
            this.handleDoubleClick(activeViewport);
        } else {
            // Fallback: just switch layout without image preservation
            const targetLayout = currentLayout === '1x1' ? '2x2' : '1x1';
            window.DICOM_VIEWER.MANAGERS.viewportManager.switchLayout(targetLayout);
            this.updateLayoutButtons(targetLayout);
            this.showLayoutChangeNotification(targetLayout);
        }
    },

    // Keyboard shortcut support
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (event) => {
            // Don't trigger if user is typing
            if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
                return;
            }

            // 'T' key for toggle layout
            if (event.key.toLowerCase() === 't') {
                event.preventDefault();
                this.toggleLayout();
            }
            
            // 'F' key for fullscreen single view
            if (event.key.toLowerCase() === 'f' && event.ctrlKey) {
                event.preventDefault();
                const currentLayout = window.DICOM_VIEWER.MANAGERS.viewportManager.currentLayout;
                if (currentLayout !== '1x1') {
                    const activeViewport = window.DICOM_VIEWER.MANAGERS.viewportManager.activeViewport;
                    if (activeViewport) {
                        this.handleDoubleClick(activeViewport);
                    }
                }
            }
        });
    }
};

// Enhanced viewport creation to include double-click handlers
// Add this to your viewport-manager.js createViewportElement method
function enhanceViewportWithDoubleClick(viewport) {
    // Add visual feedback for double-click capability
    viewport.style.cursor = 'pointer';
    viewport.title = 'Double-click to toggle layout';
    
    // Add subtle visual indicator
    const doubleClickHint = document.createElement('div');
    doubleClickHint.className = 'double-click-hint';
    doubleClickHint.innerHTML = '<i class="bi bi-arrows-fullscreen"></i>';
    doubleClickHint.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.7);
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        opacity: 0;
        transition: opacity 0.3s ease;
        pointer-events: none;
        z-index: 5;
    `;
    
    viewport.appendChild(doubleClickHint);
    
    // Show hint on hover
    viewport.addEventListener('mouseenter', () => {
        doubleClickHint.style.opacity = '0.8';
    });
    
    viewport.addEventListener('mouseleave', () => {
        doubleClickHint.style.opacity = '0';
    });
}

// Initialize the layout toggle system
document.addEventListener('DOMContentLoaded', function() {
    // Initialize after other systems are ready
    setTimeout(() => {
        window.DICOM_VIEWER.LayoutToggle.initialize();
        window.DICOM_VIEWER.LayoutToggle.setupKeyboardShortcuts();
        console.log('Double-click layout toggle system initialized');
    }, 1000);
});

// Add this to your existing viewport creation code
// Modify the createViewportElement function in viewport-manager.js to include this:
/*
// Add to the end of createViewportElement function:
enhanceViewportWithDoubleClick(element);
window.DICOM_VIEWER.LayoutToggle.addDoubleClickHandler(element);
*/

console.log('Double-click layout toggle module loaded');