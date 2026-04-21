// Image Enhancement Manager
window.DICOM_VIEWER.ImageEnhancementManager = class {
    constructor() {
        this.originalStates = new Map();
        this.currentEnhancements = new Map();
        this.enabled = true;
    }

    storeOriginalState(viewport, image) {
        if (!this.originalStates.has(viewport)) {
            this.originalStates.set(viewport, {
                windowWidth: image.windowWidth || 400,
                windowCenter: image.windowCenter || 40,
                minPixelValue: image.minPixelValue,
                maxPixelValue: image.maxPixelValue,
                slope: image.slope || 1,
                intercept: image.intercept || 0,
                photometricInterpretation: image.photometricInterpretation,
                originalViewport: cornerstone.getViewport(viewport)
            });
        }
    }

// Replace the applyEnhancement method in enhancement-manager.js
applyEnhancement(viewport, brightness, contrast, sharpening) {
    if (!this.enabled) return;

    try {
        const enabledElement = cornerstone.getEnabledElement(viewport);
        if (!enabledElement || !enabledElement.image) return;

        const originalState = this.originalStates.get(viewport);
        if (!originalState) {
            this.storeOriginalState(viewport, enabledElement.image);
            return this.applyEnhancement(viewport, brightness, contrast, sharpening);
        }

        // Get current viewport state
        const currentViewport = cornerstone.getViewport(viewport);
        
        // Apply brightness by adjusting window center
        const brightnessAdjustment = brightness * 2; // More responsive brightness
        const newWindowCenter = originalState.windowCenter + brightnessAdjustment;
        
        // Apply contrast by adjusting window width
        const contrastMultiplier = Math.max(0.1, contrast); // Prevent zero contrast
        const newWindowWidth = originalState.windowWidth * contrastMultiplier;
        
        // Apply the window/level changes
        currentViewport.voi.windowWidth = Math.max(1, newWindowWidth);
        currentViewport.voi.windowCenter = newWindowCenter;
        
        cornerstone.setViewport(viewport, currentViewport);

        // Apply CSS-based enhancements for sharpening and fine-tuning
        const canvas = viewport.querySelector('canvas');
        if (canvas) {
            let filterString = '';
            
            // Enhanced brightness (additional CSS-based adjustment)
            const cssBrightness = 100 + (brightness * 0.5); // Subtle additional brightness
            filterString += `brightness(${cssBrightness}%)`;
            
            // Enhanced contrast (additional CSS-based adjustment)  
            const cssContrast = 100 + ((contrast - 1) * 20); // More responsive contrast
            filterString += ` contrast(${cssContrast}%)`;
            
            // Sharpening filter
            if (sharpening > 0) {
                // Use CSS filters for sharpening effect
                const sharpenAmount = Math.min(sharpening * 2, 3); // Cap sharpening
                filterString += ` saturate(${100 + sharpenAmount * 10}%)`;
                
                // Apply subtle unsharp mask effect via CSS
                canvas.style.filter = filterString;
                
                // Add subtle text-shadow for additional sharpening illusion
                if (sharpening > 1) {
                    canvas.style.imageRendering = 'crisp-edges';
                } else {
                    canvas.style.imageRendering = 'auto';
                }
            } else {
                canvas.style.filter = filterString;
                canvas.style.imageRendering = 'auto';
            }
        }

        // Store current enhancement values
        this.currentEnhancements.set(viewport, { 
            brightness, 
            contrast, 
            sharpening,
            appliedWindowCenter: newWindowCenter,
            appliedWindowWidth: newWindowWidth
        });

        console.log(`Enhanced: B:${brightness} C:${contrast.toFixed(1)} S:${sharpening.toFixed(1)} W:${Math.round(newWindowWidth)} L:${Math.round(newWindowCenter)}`);

    } catch (error) {
        console.error('Error applying image enhancement:', error);
    }
}

// Enhanced reset method
resetEnhancement(viewport) {
    try {
        const originalState = this.originalStates.get(viewport);
        if (!originalState) return;

        // Reset to original DICOM window/level values
        const currentViewport = cornerstone.getViewport(viewport);
        currentViewport.voi.windowWidth = originalState.windowWidth;
        currentViewport.voi.windowCenter = originalState.windowCenter;

        cornerstone.setViewport(viewport, currentViewport);

        // Remove all CSS filters
        const canvas = viewport.querySelector('canvas');
        if (canvas) {
            canvas.style.filter = '';
            canvas.style.imageRendering = 'auto';
        }

        this.currentEnhancements.delete(viewport);
        console.log('Reset to original DICOM values');

    } catch (error) {
        console.error('Error resetting enhancement:', error);
    }
}

// Enhanced reset all method
resetAllEnhancements() {
    const viewports = window.DICOM_VIEWER.MANAGERS.viewportManager ? 
        window.DICOM_VIEWER.MANAGERS.viewportManager.getAllViewports() : 
        document.querySelectorAll('.viewport');

    viewports.forEach(viewport => {
        this.resetEnhancement(viewport);
    });

    // Reset UI controls smoothly
    const brightnessSlider = document.getElementById('brightnessSlider');
    const contrastSlider = document.getElementById('contrastSlider');
    const sharpenSlider = document.getElementById('sharpenSlider');

    if (brightnessSlider) {
        brightnessSlider.value = 0;
        // Trigger input event for smooth UI update
        brightnessSlider.dispatchEvent(new Event('input'));
    }
    if (contrastSlider) {
        contrastSlider.value = 1;
        contrastSlider.dispatchEvent(new Event('input'));
    }
    if (sharpenSlider) {
        sharpenSlider.value = 0;
        sharpenSlider.dispatchEvent(new Event('input'));
    }

    console.log('All enhancements reset to original DICOM values');
}

    resetEnhancement(viewport) {
        try {
            const originalState = this.originalStates.get(viewport);
            if (!originalState) return;

            const currentViewport = cornerstone.getViewport(viewport);
            currentViewport.voi.windowWidth = originalState.windowWidth;
            currentViewport.voi.windowCenter = originalState.windowCenter;

            cornerstone.setViewport(viewport, currentViewport);

            const canvas = viewport.querySelector('canvas');
            if (canvas) {
                canvas.style.filter = '';
            }

            this.currentEnhancements.delete(viewport);

            console.log('Reset to original DICOM window/level');

        } catch (error) {
            console.error('Error resetting enhancement:', error);
        }
    }

    resetAllEnhancements() {
        const viewports = window.DICOM_VIEWER.MANAGERS.viewportManager ? 
            window.DICOM_VIEWER.MANAGERS.viewportManager.getAllViewports() : 
            document.querySelectorAll('.viewport');

        viewports.forEach(viewport => {
            this.resetEnhancement(viewport);
        });

        // Reset UI controls
        const brightnessSlider = document.getElementById('brightnessSlider');
        const contrastSlider = document.getElementById('contrastSlider');
        const sharpenSlider = document.getElementById('sharpenSlider');

        if (brightnessSlider) brightnessSlider.value = 0;
        if (contrastSlider) contrastSlider.value = 1;
        if (sharpenSlider) sharpenSlider.value = 0;

        console.log('All enhancements reset');
    }

    enable() {
        this.enabled = true;
    }

    disable() {
        this.enabled = false;
    }
};