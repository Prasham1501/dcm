/**
 * Mobile Controls Handler
 * Handles mobile-specific touch controls, fullscreen, and image selection
 */

(function() {
    'use strict';

    const MobileControls = {
        isFullscreen: false,
        thumbnailsVisible: false,
        currentImages: [],
        currentImageIndex: 0,

        init() {
            console.log('Initializing mobile controls...');
            try {
                this.setupMobileToolbar();
                // setupImageThumbnails is defined later in this object - call it safely
                this.setupImageThumbnails();
                this.setupTouchGestures();
                console.log('Mobile controls initialized successfully');
            } catch (error) {
                console.warn('Mobile controls initialization warning:', error.message);
            }
        },

        // Image thumbnails setup method
        setupImageThumbnails() {
            // This method handles mobile image thumbnail display
            // Implementation can be expanded based on needs
            const thumbnailsDiv = document.getElementById('imageThumbnails');
            if (thumbnailsDiv) {
                console.log('Mobile thumbnails container found');
            }
        },

        setupMobileToolbar() {
            // Pan tool
            document.getElementById('mobilePanTool')?.addEventListener('click', (e) => {
                this.setActiveTool(e.currentTarget, 'Pan');
            });

            // Zoom tool
            document.getElementById('mobileZoomTool')?.addEventListener('click', (e) => {
                this.setActiveTool(e.currentTarget, 'Zoom');
            });

            // Window/Level tool
            document.getElementById('mobileWLTool')?.addEventListener('click', (e) => {
                this.setActiveTool(e.currentTarget, 'Wwwc');
            });

            // Images list toggle
            document.getElementById('mobileImagesList')?.addEventListener('click', () => {
                this.toggleImageThumbnails();
            });

            // Fullscreen toggle
            document.getElementById('mobileFullscreen')?.addEventListener('click', () => {
                this.toggleFullscreen();
            });

            // Desktop fullscreen button
            document.getElementById('fullscreenBtn')?.addEventListener('click', () => {
                this.toggleFullscreen();
            });
        },

        setActiveTool(button, toolName) {
            console.log('Setting active tool:', toolName);

            // Remove active class from all mobile tool buttons
            document.querySelectorAll('.mobile-tools-bar button').forEach(btn => {
                btn.classList.remove('active');
            });

            // Add active class to clicked button
            if (button) {
                button.classList.add('active');
            }

            try {
                // Check if cornerstoneTools is available
                if (typeof cornerstoneTools === 'undefined') {
                    console.warn('CornerstoneTools not loaded yet');
                    return;
                }

                // Deactivate all tools globally first
                cornerstoneTools.setToolPassive('Pan');
                cornerstoneTools.setToolPassive('Zoom');
                cornerstoneTools.setToolPassive('Wwwc');
                cornerstoneTools.setToolPassive('Length');
                cornerstoneTools.setToolPassive('Angle');
                cornerstoneTools.setToolPassive('FreehandRoi');
                cornerstoneTools.setToolPassive('EllipticalRoi');
                cornerstoneTools.setToolPassive('RectangleRoi');
                cornerstoneTools.setToolPassive('Probe');

                // Activate selected tool with left mouse button
                cornerstoneTools.setToolActive(toolName, { mouseButtonMask: 1 });

                console.log(`✓ Activated ${toolName} tool globally`);

                // Also update desktop tool buttons if they exist
                document.querySelectorAll('.tool-btn').forEach(btn => {
                    if (btn.getAttribute('data-tool') === toolName) {
                        btn.classList.add('btn-primary');
                        btn.classList.remove('btn-secondary');
                    } else {
                        btn.classList.add('btn-secondary');
                        btn.classList.remove('btn-primary');
                    }
                });

            } catch (error) {
                console.error('Tool activation error:', error);
            }
        },

        toggleFullscreen() {
            const mainContent = document.getElementById('main-content');
            const body = document.body;

            if (!this.isFullscreen) {
                // Enter fullscreen
                if (body.requestFullscreen) {
                    body.requestFullscreen();
                } else if (body.webkitRequestFullscreen) {
                    body.webkitRequestFullscreen();
                } else if (body.mozRequestFullScreen) {
                    body.mozRequestFullScreen();
                } else if (body.msRequestFullscreen) {
                    body.msRequestFullscreen();
                }

                // Add fullscreen class
                body.classList.add('fullscreen-mode');

                // Hide header and sidebars
                document.querySelector('header')?.style.setProperty('display', 'none');
                document.querySelector('.sidebar')?.style.setProperty('display', 'none');

                // Update fullscreen button icon
                const fsBtn = document.getElementById('mobileFullscreen');
                if (fsBtn) {
                    fsBtn.querySelector('i').className = 'bi bi-fullscreen-exit';
                    fsBtn.querySelector('span').textContent = 'Exit';
                }

                this.isFullscreen = true;
                console.log('Entered fullscreen mode');
            } else {
                // Exit fullscreen
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                } else if (document.webkitExitFullscreen) {
                    document.webkitExitFullscreen();
                } else if (document.mozCancelFullScreen) {
                    document.mozCancelFullScreen();
                } else if (document.msExitFullscreen) {
                    document.msExitFullscreen();
                }

                // Remove fullscreen class
                body.classList.remove('fullscreen-mode');

                // Show header and sidebars
                document.querySelector('header')?.style.removeProperty('display');
                document.querySelector('.sidebar')?.style.removeProperty('display');

                // Update fullscreen button icon
                const fsBtn = document.getElementById('mobileFullscreen');
                if (fsBtn) {
                    fsBtn.querySelector('i').className = 'bi bi-arrows-fullscreen';
                    fsBtn.querySelector('span').textContent = 'Full';
                }

                this.isFullscreen = false;
                console.log('Exited fullscreen mode');
            }

            // Resize cornerstone viewports
            setTimeout(() => {
                this.resizeAllViewports();
            }, 300);
        },

        resizeAllViewports() {
            const viewports = document.querySelectorAll('.viewport');
            viewports.forEach(viewport => {
                try {
                    if (cornerstone.getEnabledElement(viewport)) {
                        cornerstone.resize(viewport);
                    }
                } catch (error) {
                    console.warn('Viewport resize error:', error);
                }
            });
        },

        toggleImageThumbnails() {
            const thumbnailsDiv = document.getElementById('imageThumbnails');

            if (!thumbnailsDiv) return;

            this.thumbnailsVisible = !this.thumbnailsVisible;

            if (this.thumbnailsVisible) {
                thumbnailsDiv.classList.add('show');
                this.updateThumbnails();
            } else {
                thumbnailsDiv.classList.remove('show');
            }
        },

        updateThumbnails() {
            const thumbnailsDiv = document.getElementById('imageThumbnails');
            if (!thumbnailsDiv) return;

            // Get current image stack from window.APP_STATE or similar
            const images = window.APP_STATE?.currentStack?.imageIds || [];

            if (images.length === 0) {
                thumbnailsDiv.innerHTML = '<div style="color: white; text-align: center; padding: 20px;">No images loaded</div>';
                return;
            }

            // Clear existing thumbnails
            thumbnailsDiv.innerHTML = '';

            // Create thumbnail for each image
            images.forEach((imageId, index) => {
                const thumbDiv = document.createElement('div');
                thumbDiv.className = 'thumbnail-item';
                if (index === this.currentImageIndex) {
                    thumbDiv.classList.add('active');
                }

                // Add thumbnail number
                const numberSpan = document.createElement('span');
                numberSpan.className = 'thumbnail-number';
                numberSpan.textContent = index + 1;
                thumbDiv.appendChild(numberSpan);

                // Create canvas for thumbnail
                const canvas = document.createElement('canvas');
                canvas.width = 80;
                canvas.height = 80;
                thumbDiv.appendChild(canvas);

                // Load image thumbnail
                this.loadThumbnail(imageId, canvas);

                // Click handler
                thumbDiv.addEventListener('click', () => {
                    this.selectImage(index);

                    // Update active thumbnail
                    document.querySelectorAll('.thumbnail-item').forEach(item => {
                        item.classList.remove('active');
                    });
                    thumbDiv.classList.add('active');
                });

                thumbnailsDiv.appendChild(thumbDiv);
            });
        },

        async loadThumbnail(imageId, canvas) {
            try {
                const image = await cornerstone.loadImage(imageId);
                const viewport = cornerstone.getDefaultViewportForImage(canvas, image);
                cornerstone.renderToCanvas(canvas, image, viewport);
            } catch (error) {
                console.warn('Thumbnail load error:', error);
                // Draw placeholder
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#333';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#999';
                ctx.font = '12px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('DICOM', canvas.width/2, canvas.height/2);
            }
        },

        selectImage(index) {
            this.currentImageIndex = index;

            // Trigger image change in main viewer
            const slider = document.getElementById('imageSlider');
            if (slider) {
                slider.value = index;
                slider.dispatchEvent(new Event('input'));
            }

            // Update navigation buttons
            const prevBtn = document.getElementById('prevImage');
            const nextBtn = document.getElementById('nextImage');

            if (prevBtn) prevBtn.disabled = (index === 0);
            if (nextBtn) nextBtn.disabled = (index === window.APP_STATE?.currentStack?.imageIds.length - 1);

            console.log(`Selected image ${index + 1}`);
        },

        setupTouchGestures() {
            // Add pinch-to-zoom gesture handling
            const viewportContainer = document.getElementById('viewport-container');
            if (!viewportContainer) return;

            let initialDistance = 0;
            let currentDistance = 0;

            viewportContainer.addEventListener('touchstart', (e) => {
                if (e.touches.length === 2) {
                    initialDistance = this.getTouchDistance(e.touches);
                }
            });

            viewportContainer.addEventListener('touchmove', (e) => {
                if (e.touches.length === 2) {
                    e.preventDefault();
                    currentDistance = this.getTouchDistance(e.touches);

                    const scale = currentDistance / initialDistance;

                    // Apply zoom to active viewport
                    const activeViewport = document.querySelector('.viewport');
                    if (activeViewport && cornerstone.getEnabledElement(activeViewport)) {
                        const viewport = cornerstone.getViewport(activeViewport);
                        viewport.scale *= scale;
                        cornerstone.setViewport(activeViewport, viewport);
                        initialDistance = currentDistance;
                    }
                }
            }, { passive: false });
        },

        getTouchDistance(touches) {
            const dx = touches[0].pageX - touches[1].pageX;
            const dy = touches[0].pageY - touches[1].pageY;
            return Math.sqrt(dx * dx + dy * dy);
        },

        // Listen for fullscreen changes
        handleFullscreenChange() {
            const isCurrentlyFullscreen = !!(document.fullscreenElement ||
                                            document.webkitFullscreenElement ||
                                            document.mozFullScreenElement ||
                                            document.msFullscreenElement);

            if (!isCurrentlyFullscreen && this.isFullscreen) {
                // User exited fullscreen using ESC or browser button
                this.isFullscreen = false;
                document.body.classList.remove('fullscreen-mode');
                document.querySelector('header')?.style.removeProperty('display');
                document.querySelector('.sidebar')?.style.removeProperty('display');

                const fsBtn = document.getElementById('mobileFullscreen');
                if (fsBtn) {
                    fsBtn.querySelector('i').className = 'bi bi-arrows-fullscreen';
                    fsBtn.querySelector('span').textContent = 'Full';
                }

                this.resizeAllViewports();
            }
        }
    };

    // Listen for fullscreen changes
    document.addEventListener('fullscreenchange', () => MobileControls.handleFullscreenChange());
    document.addEventListener('webkitfullscreenchange', () => MobileControls.handleFullscreenChange());
    document.addEventListener('mozfullscreenchange', () => MobileControls.handleFullscreenChange());
    document.addEventListener('MSFullscreenChange', () => MobileControls.handleFullscreenChange());

    // Initialize on DOM ready with delay to ensure cornerstoneTools is loaded
    function initMobileControls() {
        if (typeof cornerstoneTools !== 'undefined') {
            MobileControls.init();
        } else {
            console.log('Waiting for cornerstoneTools to load...');
            setTimeout(initMobileControls, 100);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(initMobileControls, 500); // Give time for all scripts to load
        });
    } else {
        setTimeout(initMobileControls, 500);
    }

    // Expose globally
    window.MobileControls = MobileControls;

})();
