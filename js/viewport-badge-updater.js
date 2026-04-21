/**
 * Viewport Badge Updater v2.0
 * Updates series list items to show which viewport contains each image
 * FIXED: Now properly extracts file IDs from various imageId formats
 */

(function() {
    'use strict';

    console.log('🔧 Initializing Viewport Badge Updater v2.0...');

    // Track which file is in which viewport
    const viewportFileMap = new Map();

    // Function to extract file ID from imageId - IMPROVED to handle multiple formats
    function extractFileId(imageId) {
        if (!imageId) return null;
        
        // Format 1: wadouri:http://localhost/.../dicom/{fileId}
        let match = imageId.match(/\/dicom\/([^?\/]+)/);
        if (match) return match[1];
        
        // Format 2: wadouri:.../get_dicom_fast.php?id={fileId}
        match = imageId.match(/get_dicom_fast\.php\?id=([^&]+)/);
        if (match) return match[1];
        
        // Format 3: wadouri:.../get_dicom_from_orthanc.php?instanceId={orthancId}
        match = imageId.match(/instanceId=([^&]+)/);
        if (match) return match[1];
        
        // Format 4: mpr-{orientation}-{position} (MPR generated slices)
        match = imageId.match(/^mpr-(axial|sagittal|coronal)-/);
        if (match) return null; // MPR slices don't have file IDs
        
        // Format 5: wadouri:data:application/dicom;base64,... (inline data)
        // For these, we need to match against the current series images
        if (imageId.includes('base64,')) {
            // Can't extract ID from base64, return null
            return null;
        }
        
        return null;
    }

    // Function to find file ID by matching loaded image against series
    function findFileIdForViewport(viewport) {
        try {
            if (!window.cornerstone) return null;
            
            const enabledElement = cornerstone.getEnabledElement(viewport);
            if (!enabledElement || !enabledElement.image || !enabledElement.image.imageId) {
                return null;
            }
            
            const imageId = enabledElement.image.imageId;
            
            // First try direct extraction
            const directId = extractFileId(imageId);
            if (directId) return directId;
            
            // For base64 images, try to match by current state
            const state = window.DICOM_VIEWER?.STATE;
            if (!state || !state.currentSeriesImages) return null;
            
            // Check if this viewport is the active/original viewport showing current image
            const viewportName = viewport.dataset.viewportName || viewport.id;
            if (viewportName === 'original' && state.currentFileId) {
                return state.currentFileId;
            }
            
            // Try to match by checking if this is an Orthanc image
            for (const img of state.currentSeriesImages) {
                if (img.orthancInstanceId && imageId.includes(img.orthancInstanceId)) {
                    return img.id;
                }
                if (img.instanceId && imageId.includes(img.instanceId)) {
                    return img.id;
                }
            }
            
            return null;
        } catch (e) {
            return null;
        }
    }

    // Function to update viewport badges for a specific file/image
    window.DICOM_VIEWER = window.DICOM_VIEWER || {};
    
    window.DICOM_VIEWER.updateViewportBadges = function(fileId, viewportName, action = 'add') {
        if (!fileId) return;
        
        const badgeContainer = document.querySelector(`.viewport-badges[data-file-id="${fileId}"]`);

        if (!badgeContainer) {
            // Container not rendered yet - this is normal during initial load
            return;
        }

        const viewportDisplayNames = {
            'viewport-1': 'VP1',
            'viewport-2': 'VP2',
            'viewport-3': 'VP3',
            'viewport-4': 'VP4',
            'original': 'Main',
            'axial': 'Axial',
            'sagittal': 'Sag',
            'coronal': 'Cor'
        };

        const viewportColors = {
            'original': 'bg-primary',
            'axial': 'bg-info',
            'sagittal': 'bg-success',
            'coronal': 'bg-warning'
        };

        const displayName = viewportDisplayNames[viewportName] || viewportName.substring(0, 4).toUpperCase();
        const colorClass = viewportColors[viewportName] || 'bg-secondary';

        if (action === 'add') {
            const existingBadge = badgeContainer.querySelector(`[data-viewport="${viewportName}"]`);
            if (existingBadge) return;

            const badge = document.createElement('span');
            badge.className = `badge ${colorClass}`;
            badge.dataset.viewport = viewportName;
            badge.style.cssText = 'font-size: 0.6em; padding: 2px 6px; margin-right: 2px; border-radius: 3px;';
            badge.textContent = displayName;
            badge.title = `Displayed in ${viewportName} viewport`;
            badgeContainer.appendChild(badge);

            console.log(`✓ Badge added: ${displayName} for file ${fileId}`);
        } else if (action === 'remove') {
            const badge = badgeContainer.querySelector(`[data-viewport="${viewportName}"]`);
            if (badge) {
                badge.remove();
                console.log(`✓ Badge removed: ${displayName} from file ${fileId}`);
            }
        } else if (action === 'clear') {
            badgeContainer.innerHTML = '';
        }
    };

    // Function to scan all viewports and update badges
    window.DICOM_VIEWER.refreshAllViewportBadges = function() {
        // Clear all existing badges first
        document.querySelectorAll('.viewport-badges').forEach(container => {
            container.innerHTML = '';
        });

        // Clear tracking map
        viewportFileMap.clear();

        // Scan all viewports
        const viewports = document.querySelectorAll('.viewport');
        let badgesAdded = 0;

        viewports.forEach(viewport => {
            try {
                if (!window.cornerstone) return;

                const fileId = findFileIdForViewport(viewport);
                
                if (fileId) {
                    const viewportName = viewport.dataset.viewportName || viewport.id || 'viewport';

                    // Track this mapping
                    viewportFileMap.set(viewportName, fileId);

                    // Update badge
                    window.DICOM_VIEWER.updateViewportBadges(fileId, viewportName, 'add');
                    badgesAdded++;
                }
            } catch (e) {
                // Viewport not enabled or no image loaded - this is normal
            }
        });

        if (badgesAdded > 0) {
            console.log(`✓ ${badgesAdded} viewport badge(s) updated`);
        }

        return badgesAdded;
    };

    // Setup event listeners on viewports
    function setupViewportListeners() {
        if (!window.cornerstone) {
            console.warn('Cornerstone not available yet, retrying in 1s...');
            setTimeout(setupViewportListeners, 1000);
            return;
        }

        const viewports = document.querySelectorAll('.viewport');
        if (viewports.length === 0) {
            console.warn('No viewports found yet, retrying in 1s...');
            setTimeout(setupViewportListeners, 1000);
            return;
        }

        console.log(`✓ Found ${viewports.length} viewports, attaching badge update listeners...`);

        viewports.forEach(viewport => {
            // Skip if already setup
            if (viewport.dataset.badgeListenerAttached === 'true') return;
            viewport.dataset.badgeListenerAttached = 'true';
            
            // Image rendered event - most reliable for badge updates
            viewport.addEventListener('cornerstoneimagerendered', function() {
                // Small delay to ensure image is fully loaded
                setTimeout(() => window.DICOM_VIEWER.refreshAllViewportBadges(), 100);
            });

            // New image event
            viewport.addEventListener('cornerstonenewimage', function() {
                setTimeout(() => window.DICOM_VIEWER.refreshAllViewportBadges(), 150);
            });
        });

        console.log('✓ Viewport badge event listeners attached');

        // Initial badge refresh after a delay
        setTimeout(() => {
            window.DICOM_VIEWER.refreshAllViewportBadges();
        }, 1000);
    }

    // Watch for new viewports being created (layout changes)
    function watchForNewViewports() {
        const observer = new MutationObserver(function(mutations) {
            let hasNewViewports = false;
            
            mutations.forEach(function(mutation) {
                mutation.addedNodes.forEach(function(node) {
                    if (node.nodeType === 1) {
                        if (node.classList && node.classList.contains('viewport')) {
                            hasNewViewports = true;
                        }
                        // Also check children
                        if (node.querySelectorAll) {
                            const childViewports = node.querySelectorAll('.viewport');
                            if (childViewports.length > 0) {
                                hasNewViewports = true;
                            }
                        }
                    }
                });
            });
            
            if (hasNewViewports) {
                console.log('✓ New viewport(s) detected, setting up badge listeners...');
                setTimeout(setupViewportListeners, 500);
            }
        });

        const viewportContainer = document.getElementById('viewport-container');
        const mainContent = document.getElementById('main-content');
        
        if (viewportContainer) {
            observer.observe(viewportContainer, { childList: true, subtree: true });
            console.log('✓ MutationObserver watching viewport-container for new viewports');
        }
        
        if (mainContent && mainContent !== viewportContainer) {
            observer.observe(mainContent, { childList: true, subtree: true });
            console.log('✓ MutationObserver watching main-content for new viewports');
        }
    }

    // Watch for series list updates to ensure badges are available
    function watchForSeriesListUpdates() {
        const seriesList = document.getElementById('series-list');
        if (!seriesList) {
            setTimeout(watchForSeriesListUpdates, 1000);
            return;
        }
        
        const observer = new MutationObserver(function(mutations) {
            // When series list changes, refresh badges after DOM settles
            setTimeout(() => {
                window.DICOM_VIEWER.refreshAllViewportBadges();
            }, 500);
        });
        
        observer.observe(seriesList, { childList: true, subtree: true });
        console.log('✓ MutationObserver watching series-list for updates');
    }

    // Initialize everything
    function initialize() {
        console.log('✓ Viewport Badge Updater v2.0: Starting initialization...');

        // Setup viewport listeners after a delay to ensure DOM is ready
        setTimeout(setupViewportListeners, 2000);

        // Watch for new viewports (layout changes)
        watchForNewViewports();
        
        // Watch for series list updates
        watchForSeriesListUpdates();

        // Periodic refresh as backup (less frequent)
        setInterval(function() {
            if (window.DICOM_VIEWER && window.DICOM_VIEWER.refreshAllViewportBadges) {
                window.DICOM_VIEWER.refreshAllViewportBadges();
            }
        }, 8000); // Every 8 seconds

        console.log('✓ Viewport Badge Updater v2.0 fully initialized');
    }

    // Start initialization
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

})();
