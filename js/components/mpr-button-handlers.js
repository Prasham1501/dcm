/**
 * MPR Button Event Handlers
 * Connects MPR buttons to their respective functions
 * 
 * This file ensures MPR buttons work correctly by:
 * 1. Attaching click handlers to mprAxial, mprSagittal, mprCoronal, mprAll buttons
 * 2. Checking if volume needs to be built first
 * 3. Providing visual feedback during MPR operations
 */

(function() {
    'use strict';
    
    console.log('🔧 Initializing MPR Button Handlers...');
    
    // Wait for DOM and DICOM_VIEWER to be ready
    function initializeMPRButtons() {
        // Check if DICOM_VIEWER is ready
        if (!window.DICOM_VIEWER || !window.DICOM_VIEWER.MANAGERS) {
            console.log('DICOM_VIEWER not ready, retrying in 500ms...');
            setTimeout(initializeMPRButtons, 500);
            return;
        }
        
        // Get button elements
        const mprAxialBtn = document.getElementById('mprAxial');
        const mprSagittalBtn = document.getElementById('mprSagittal');
        const mprCoronalBtn = document.getElementById('mprCoronal');
        const mprAllBtn = document.getElementById('mprAll');
        
        if (!mprAxialBtn || !mprSagittalBtn || !mprCoronalBtn || !mprAllBtn) {
            console.log('MPR buttons not found, retrying in 500ms...');
            setTimeout(initializeMPRButtons, 500);
            return;
        }
        
        console.log('✓ Found all MPR buttons, attaching event handlers...');
        
        // Helper function to handle button click
        async function handleMPRButtonClick(orientation, button) {
            const state = window.DICOM_VIEWER.STATE;
            
            // Check if we have images loaded
            if (!state.currentSeriesImages || state.currentSeriesImages.length === 0) {
                window.DICOM_VIEWER.showAISuggestion('Please load DICOM images first before using MPR views.');
                return;
            }
            
            // Check minimum image count
            if (state.currentSeriesImages.length < 2) {
                window.DICOM_VIEWER.showAISuggestion(`MPR requires at least 2 images. Current series has only ${state.currentSeriesImages.length} image(s).`);
                return;
            }
            
            // Disable button during operation
            button.disabled = true;
            const originalHTML = button.innerHTML;
            button.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span>';
            
            try {
                // Call the appropriate function
                if (orientation === 'all') {
                    await window.DICOM_VIEWER.showAllMPRViews();
                } else {
                    await window.DICOM_VIEWER.focusMPRView(orientation);
                }
            } catch (error) {
                console.error(`MPR ${orientation} error:`, error);
                window.DICOM_VIEWER.showAISuggestion(`MPR ${orientation} view failed: ${error.message}`);
            } finally {
                // Re-enable button
                button.disabled = false;
                button.innerHTML = originalHTML;
            }
        }
        
        // Attach click handlers
        mprAxialBtn.addEventListener('click', async function(e) {
            e.preventDefault();
            console.log('MPR Axial button clicked');
            await handleMPRButtonClick('axial', mprAxialBtn);
        });
        
        mprSagittalBtn.addEventListener('click', async function(e) {
            e.preventDefault();
            console.log('MPR Sagittal button clicked');
            await handleMPRButtonClick('sagittal', mprSagittalBtn);
        });
        
        mprCoronalBtn.addEventListener('click', async function(e) {
            e.preventDefault();
            console.log('MPR Coronal button clicked');
            await handleMPRButtonClick('coronal', mprCoronalBtn);
        });
        
        mprAllBtn.addEventListener('click', async function(e) {
            e.preventDefault();
            console.log('MPR All button clicked');
            await handleMPRButtonClick('all', mprAllBtn);
        });
        
        // Add keyboard shortcuts for MPR views
        document.addEventListener('keydown', function(e) {
            // Don't trigger if user is typing in input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            
            const state = window.DICOM_VIEWER.STATE;
            
            // Only handle shortcuts if MPR is enabled and we have images
            if (!state.mprEnabled || !state.currentSeriesImages || state.currentSeriesImages.length < 2) return;
            
            // Alt+A for Axial
            if (e.altKey && e.key === 'a') {
                e.preventDefault();
                mprAxialBtn.click();
            }
            // Alt+S for Sagittal
            else if (e.altKey && e.key === 's') {
                e.preventDefault();
                mprSagittalBtn.click();
            }
            // Alt+C for Coronal
            else if (e.altKey && e.key === 'c') {
                e.preventDefault();
                mprCoronalBtn.click();
            }
            // Alt+M for All MPR views
            else if (e.altKey && e.key === 'm') {
                e.preventDefault();
                mprAllBtn.click();
            }
        });
        
        console.log('✓ MPR Button Handlers initialized successfully');
        console.log('  Keyboard shortcuts: Alt+A (Axial), Alt+S (Sagittal), Alt+C (Coronal), Alt+M (All)');
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(initializeMPRButtons, 1000);
        });
    } else {
        setTimeout(initializeMPRButtons, 1000);
    }
})();
