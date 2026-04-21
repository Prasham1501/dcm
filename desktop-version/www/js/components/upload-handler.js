// Upload Handler Component
window.DICOM_VIEWER.UploadHandler = {
    initialized: false,
    
    initialize() {
        // Prevent double initialization
        if (this.initialized) {
            console.log('Upload handler already initialized, skipping');
            return true;
        }
        
        console.log('Upload handler initialization starting...');
        
        // Use a completely defensive approach - never throw errors
        const safeAddEventListener = (element, event, handler, description) => {
            if (element && typeof element.addEventListener === 'function') {
                try {
                    element.addEventListener(event, handler);
                    console.log(`✓ ${description}`);
                    return true;
                } catch (e) {
                    console.warn(`✗ Failed to attach ${description}:`, e.message);
                    return false;
                }
            } else {
                console.log(`○ Element not found for ${description} - this is OK for Orthanc-only mode`);
                return false;
            }
        };
        
        try {
            // Safely get elements - these may not exist in all UI configurations
            const fileInput = document.getElementById('dicomFileInput');
            const folderInput = document.getElementById('dicomFolderInput');
            const uploadSingleBtn = document.getElementById('uploadSingle');
            const uploadSeriesBtn = document.getElementById('uploadSeries');
            const uploadFolderBtn = document.getElementById('uploadFolder');

            // Add event listeners with safe helper function
            safeAddEventListener(
                fileInput, 
                'change', 
                this.handleFileUpload.bind(this),
                'File input change listener'
            );
            
            safeAddEventListener(
                folderInput, 
                'change', 
                this.handleFolderUpload.bind(this),
                'Folder input change listener'
            );

            // Optional upload buttons - these may not exist in all UI configurations
            if (uploadSingleBtn && fileInput) {
                safeAddEventListener(
                    uploadSingleBtn,
                    'click',
                    (e) => {
                        e.preventDefault();
                        fileInput.removeAttribute('multiple');
                        fileInput.removeAttribute('webkitdirectory');
                        fileInput.click();
                    },
                    'Upload single button click listener'
                );
            }

            if (uploadSeriesBtn && fileInput) {
                safeAddEventListener(
                    uploadSeriesBtn,
                    'click',
                    (e) => {
                        e.preventDefault();
                        fileInput.setAttribute('multiple', 'multiple');
                        fileInput.removeAttribute('webkitdirectory');
                        fileInput.click();
                    },
                    'Upload series button click listener'
                );
            }

            if (uploadFolderBtn && folderInput) {
                safeAddEventListener(
                    uploadFolderBtn,
                    'click',
                    (e) => {
                        e.preventDefault();
                        folderInput.click();
                    },
                    'Upload folder button click listener'
                );
            }

            const mainUploadLabel = document.querySelector('label[for="dicomFolderInput"]');
            if (mainUploadLabel) {
                safeAddEventListener(
                    mainUploadLabel,
                    'click',
                    () => {
                        console.log('Main upload label clicked - triggering folder input');
                    },
                    'Main upload label click listener'
                );
            }
            
            this.initialized = true;
            console.log('Upload handler initialization complete');
            return true;
            
        } catch (error) {
            console.warn('Upload handler initialization warning (non-critical):', error.message);
            console.log('Upload handler partially initialized - Orthanc mode will still work');
            this.initialized = true; // Mark as initialized even with errors to prevent retry loops
            return true; // Return true to prevent main.js from failing
        }
    },

    handleFileUpload(event) {
        const files = event.target.files;
        if (files && files.length > 0) {
            console.log(`Selected ${files.length} file(s) for upload`);
            window.DICOM_VIEWER.STATE.uploadQueue = Array.from(files);
            window.DICOM_VIEWER.showLoadingIndicator(`Uploading ${files.length} file(s)...`);
            this.processUploadQueue();
        } else {
            console.log('No files selected');
        }
    },
    
    // Updated method to handle patient groups
    uploadPatientGroups(patientGroups) {
        console.log('Processing patient groups:', Object.keys(patientGroups));
        
        Object.keys(patientGroups).forEach(groupKey => {
            const group = patientGroups[groupKey];
            const files = group.files;
            
            console.log(`Processing patient group: ${groupKey} with ${files.length} files`);
            
            // Add group context to upload queue
            window.DICOM_VIEWER.STATE.uploadQueue = [
                ...window.DICOM_VIEWER.STATE.uploadQueue, 
                ...files
            ];
        });
        
        if (window.DICOM_VIEWER.STATE.uploadQueue.length > 0) {
            window.DICOM_VIEWER.showLoadingIndicator(`Uploading ${window.DICOM_VIEWER.STATE.uploadQueue.length} file(s) from patient folders...`);
            this.processUploadQueue();
        }
    },

    // Replace the handleFolderUpload method in upload-handler.js
    handleFolderUpload(event) {
        console.log('=== FOLDER UPLOAD HANDLER TRIGGERED ===');
        console.log('Files selected:', event.target.files.length);
        
        if (!event.target.files || event.target.files.length === 0) {
            console.log('No files selected, aborting');
            return;
        }
        
        const files = Array.from(event.target.files);
        console.log('Processing', files.length, 'files from folder');
        
        // Group files by patient/study folder structure
        const patientGroups = this.groupFilesByPatientFolder(files);
        console.log('Grouped into', Object.keys(patientGroups).length, 'patient groups');
        
        this.uploadPatientGroups(patientGroups);
    },

    // New method to group by patient folder structure
    groupFilesByPatientFolder(files) {
        const groups = {};
        
        files.forEach(file => {
            const pathParts = file.webkitRelativePath.split('/');
            
            // Extract folder hierarchy for better identification
            // Expected structure: PatientFolder/StudyFolder/SeriesFolder/files
            // or: PatientName/StudyDate/files
            let patientFolder = pathParts[0] || 'UnknownPatient';
            let studyFolder = pathParts[1] || 'UnknownStudy';
            let seriesFolder = pathParts[2] || 'Series1';
            
            // Create unique group key based on folder structure
            const groupKey = `${patientFolder}/${studyFolder}/${seriesFolder}`;
            
            if (!groups[groupKey]) {
                groups[groupKey] = {
                    patientFolder: patientFolder,
                    studyFolder: studyFolder,
                    seriesFolder: seriesFolder,
                    files: []
                };
            }
            
            // Add folder context to file object
            file.folderContext = {
                patientFolder: patientFolder,
                studyFolder: studyFolder,
                seriesFolder: seriesFolder,
                fullPath: file.webkitRelativePath,
                relativePath: pathParts.slice(1).join('/') // Path without patient folder
            };
            
            groups[groupKey].files.push(file);
        });
        
        return groups;
    },

    groupFilesBySeries(files) {
        const groups = {};
        files.forEach(file => {
            const pathParts = file.webkitRelativePath.split('/');
            const seriesFolder = pathParts[pathParts.length - 2] || 'default';
            if (!groups[seriesFolder]) {
                groups[seriesFolder] = [];
            }
            groups[seriesFolder].push(file);
        });
        return groups;
    },

    uploadSeriesGroups(seriesGroups) {
        console.log('Processing series groups:', Object.keys(seriesGroups));
        Object.keys(seriesGroups).forEach(seriesName => {
            const files = seriesGroups[seriesName];
            console.log(`Processing series: ${seriesName} with ${files.length} files`);
            window.DICOM_VIEWER.STATE.uploadQueue = [...window.DICOM_VIEWER.STATE.uploadQueue, ...files];
        });
        if (window.DICOM_VIEWER.STATE.uploadQueue.length > 0) {
            window.DICOM_VIEWER.showLoadingIndicator(`Uploading ${window.DICOM_VIEWER.STATE.uploadQueue.length} file(s) from folders...`);
            this.processUploadQueue();
        }
    },

    async processUploadQueue() {
        const state = window.DICOM_VIEWER.STATE;
        
        if (state.uploadInProgress || state.uploadQueue.length === 0) return;

        state.uploadInProgress = true;
        window.DICOM_VIEWER.showLoadingIndicator(`Processing ${state.uploadQueue.length} files...`);

        try {
            let allUploadedFiles = [];
            let processedCount = 0;

            for (const file of state.uploadQueue) {
                try {
                    processedCount++;
                    window.DICOM_VIEWER.showLoadingIndicator(`Processing files... ${processedCount}/${state.uploadQueue.length}`);

                    const result = await this.uploadSingleFile(file);
                    if (result) {
                        allUploadedFiles.push(result);
                    }
                } catch (error) {
                    console.error(`Error uploading ${file.name}:`, error);
                }
            }

            if (allUploadedFiles.length > 0) {
                await window.DICOM_VIEWER.loadImageSeries(allUploadedFiles);
            } else {
                window.DICOM_VIEWER.showErrorMessage('No files were uploaded successfully');
            }

        } finally {
            state.uploadInProgress = false;
            state.uploadQueue = [];
            const fileInput = document.getElementById('dicomFileInput');
            if (fileInput) fileInput.value = '';
            window.DICOM_VIEWER.hideLoadingIndicator();
        }
    },

    // Upload single file with DICOM parsing
    async uploadSingleFile(file) {
        try {
            // Step 1: Read the file into a byte array in the browser
            const fileBuffer = await file.arrayBuffer();
            const byteArray = new Uint8Array(fileBuffer);

            // Step 2: Use the library to parse the DICOM data from the byte array
            const dataSet = dicomParser.parseDicom(byteArray);

            // --- VALIDATION STEP ---
            // Check if the DICOM file contains pixel data. If not, it's not an image.
            if (!dataSet.elements.x7fe00010) {
                console.warn(`Skipping file: ${file.name} (Reason: No pixel data found). This is likely a DICOM report or metadata file.`);
                // Return null to indicate this file should be skipped.
                return null; 
            }

            // Step 3: Extract the specific metadata tags we need, ADDING sopInstanceUID
            const tags = {
                patientName: dataSet.string('x00100010'),
                studyDescription: dataSet.string('x00081030'),
                seriesDescription: dataSet.string('x0008103e'),
                studyInstanceUID: dataSet.string('x0020000d'),
                seriesInstanceUID: dataSet.string('x0020000e'),
                sopInstanceUID: dataSet.string('x00080018')
            };

            // Step 4: Prepare the upload data, including the parsed tags as a JSON string
            const formData = new FormData();
            formData.append('dicomFile', file);
            formData.append('dicomTagsJson', JSON.stringify(tags)); // Send tags to PHP

            // Step 5: Send the file and the clean metadata to the server
            const response = await fetch('upload.php', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP ${response.status}`);
            }

            return await response.json();

        } catch (error) {
            console.error(`Failed to parse or upload ${file.name}:`, error);
            // We throw the error so the main queue processor can catch it
            throw error;
        }
    }
};
