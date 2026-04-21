/**
 * Auto-load studies from Orthanc via URL parameters
 * Enhanced with better error handling and debugging
 */

(function () {
    'use strict';

    console.log('Orthanc auto-load script initializing...');

    // Expose autoloader function globally for debugging
    window.DICOM_VIEWER = window.DICOM_VIEWER || {};

    // Main autoload function - exposed globally
    window.DICOM_VIEWER.autoLoadFromOrthanc = async function (studyIdentifier) {
        console.log('autoLoadFromOrthanc called with:', studyIdentifier);
        await autoLoadStudyFromOrthanc(studyIdentifier);
    };

    // Check if viewer is ready by looking for key components
    function isViewerReady() {
        return window.DICOM_VIEWER &&
            window.DICOM_VIEWER.loadImageSeries &&
            window.DICOM_VIEWER.MANAGERS &&
            window.DICOM_VIEWER.MANAGERS.viewportManager;
    }

    // Wait for viewer to be ready with retries
    async function waitForViewer(maxRetries = 20, interval = 250) {
        for (let i = 0; i < maxRetries; i++) {
            if (isViewerReady()) {
                console.log('✓ DICOM Viewer is ready after', i * interval, 'ms');
                return true;
            }
            await new Promise(resolve => setTimeout(resolve, interval));
        }
        console.error('✗ DICOM Viewer not ready after', maxRetries * interval, 'ms');
        return false;
    }

    // Main check and load function
    async function checkAndLoad() {
        console.log('checkAndLoad: Starting...');

        // Wait for viewer to be fully initialized
        const viewerReady = await waitForViewer();
        if (!viewerReady) {
            console.error('checkAndLoad: Viewer not ready, aborting autoload');
            return;
        }

        const urlParams = new URLSearchParams(window.location.search);

        // Support multiple parameter types
        const studyUID = urlParams.get('studyUID');
        const orthancId = urlParams.get('orthancId');
        const studyId = urlParams.get('study_id');

        // Determine which ID to use (priority: studyUID > orthancId > study_id)
        const studyIdentifier = studyUID || orthancId || studyId;

        if (studyIdentifier) {
            console.log('checkAndLoad: Found study identifier:', studyIdentifier);
            await autoLoadStudyFromOrthanc(studyIdentifier);
        } else {
            console.log('checkAndLoad: No study identifier found in URL parameters');
        }
    }

    async function autoLoadStudyFromOrthanc(studyUID) {
        try {
            showLoadingIndicator('Connecting to PACS server...');

            const basePath = window.basePath || '';
            const url = `${basePath}/api/load_study_fast.php?studyUID=${encodeURIComponent(studyUID)}`;
            console.log('Fetching from:', url);

            const response = await fetch(url);
            const text = await response.text();

            console.log('Response status:', response.status);
            console.log('Response text:', text.substring(0, 500));

            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                console.error('JSON parse error:', e);
                throw new Error('Invalid response from server. Check PHP errors.');
            }

            if (!response.ok || !data.success) {
                console.error('API Error:', data);
                throw new Error(data.error || 'Failed to load study');
            }

            showLoadingIndicator(`Loading ${data.imageCount} images...`);
            console.log('Study loaded:', data.imageCount, 'images');

            if (!data.images || data.images.length === 0) {
                throw new Error('No images found in study');
            }

            // Convert images to format expected by main viewer
            const formattedImages = data.images.map((img, index) => ({
                id: img.instanceId,
                patient_name: img.patientName || data.patientName || 'Anonymous',
                series_description: img.seriesDescription,
                study_description: data.studyDescription || 'PACS Study',
                file_name: img.fileName || `image-${String(img.instanceNumber || index + 1).padStart(6, '0')}.dcm`,
                orthancInstanceId: img.instanceId,
                isOrthancImage: true,
                sopInstanceUID: img.sopInstanceUID,
                seriesInstanceUID: img.seriesInstanceUID,
                study_instance_uid: data.studyUID,
                originalIndex: index
            }));

            console.log('Formatted', formattedImages.length, 'images');

            showLoadingIndicator('Initializing viewer...');

            if (window.DICOM_VIEWER && window.DICOM_VIEWER.loadImageSeries) {
                window.DICOM_VIEWER.populateSeriesList(formattedImages);
                await window.DICOM_VIEWER.loadImageSeries(formattedImages);
            } else {
                throw new Error('DICOM Viewer not initialized. Please refresh the page.');
            }

            hideLoadingIndicator();
            console.log('✅ Study loaded successfully');

        } catch (error) {
            console.error('❌ Error loading study:', error);
            hideLoadingIndicator();

            // Enhanced error message
            let errorMessage = error.message;

            if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
                errorMessage = 'Authentication failed. Please login again.';
                setTimeout(() => {
                    const basePath = document.querySelector('meta[name="base-path"]')?.content || '';
                    window.location.href = basePath + '/login.php';
                }, 2000);
            } else if (errorMessage.includes('Failed to load instances')) {
                errorMessage = 'Cannot connect to PACS server. Please check:\n\n' +
                    '1. Orthanc is running (run START_ORTHANC.bat)\n' +
                    '2. Connection settings in config.php\n' +
                    '3. Run diagnose_orthanc.php for detailed diagnostics';
            } else if (errorMessage.includes('Study not found')) {
                errorMessage = 'Study not found in PACS.\n\n' +
                    'The study may have been deleted or the UID is incorrect.';
            }

            showError(errorMessage);
        }
    }

    function showLoadingIndicator(message) {
        let indicator = document.getElementById('autoLoadIndicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'autoLoadIndicator';
            indicator.style.cssText = `
                position: fixed; 
                top: 50%; 
                left: 50%; 
                transform: translate(-50%, -50%);
                background: rgba(0,0,0,0.95); 
                color: white; 
                padding: 30px 50px;
                border-radius: 10px; 
                z-index: 10000; 
                text-align: center;
                box-shadow: 0 10px 40px rgba(0,0,0,0.5);
                min-width: 300px;
            `;
            document.body.appendChild(indicator);
        }
        indicator.innerHTML = `
            <div class="spinner-border text-primary mb-3" role="status"></div>
            <div style="font-size: 16px; font-weight: 500;">${message}</div>
        `;
        indicator.style.display = 'block';
    }

    function hideLoadingIndicator() {
        const indicator = document.getElementById('autoLoadIndicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
    }

    function showError(message) {
        hideLoadingIndicator();

        // Create a better error modal
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #2d2d2d;
            color: white;
            padding: 30px;
            border-radius: 10px;
            z-index: 10001;
            max-width: 500px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.5);
        `;

        modal.innerHTML = `
            <div style="display: flex; align-items: center; margin-bottom: 20px;">
                <i class="bi bi-exclamation-triangle-fill" style="color: #f48771; font-size: 32px; margin-right: 15px;"></i>
                <h3 style="margin: 0; color: #f48771;">Failed to Load Study</h3>
            </div>
            <div style="white-space: pre-wrap; margin-bottom: 20px; line-height: 1.6;">${message}</div>
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button onclick="window.location.href='diagnose_orthanc.php'" 
                        class="btn btn-primary">
                    Run Diagnostics
                </button>
                <button onclick="this.closest('div').parentElement.remove()" 
                        class="btn btn-secondary">
                    Close
                </button>
            </div>
        `;

        // Add backdrop
        const backdrop = document.createElement('div');
        backdrop.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.7);
            z-index: 10000;
        `;
        backdrop.onclick = () => {
            backdrop.remove();
            modal.remove();
        };

        document.body.appendChild(backdrop);
        document.body.appendChild(modal);
    }

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            console.log('Orthanc autoload: DOMContentLoaded fired');
            checkAndLoad();
        });
    } else {
        // DOM is already ready
        console.log('Orthanc autoload: DOM already ready, starting checkAndLoad');
        checkAndLoad();
    }
})();

console.log('Orthanc auto-load script loaded (Enhanced Version with Orthanc ID support)');

