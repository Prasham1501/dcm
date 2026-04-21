// Medical Notes Manager - DICOM Reporting System
window.DICOM_VIEWER.MedicalNotesManager = class {
    constructor() {
        this.notes = new Map();
        this.currentImageId = null;
        this.isInitialized = false;
        this.init();
    }

    init() {
        this.createNotesUI();
        this.setupEventListeners();
        this.isInitialized = true;
        console.log('Medical Notes Manager initialized');
    }

createNotesUI() {
    // Add notes panel to the right sidebar
    const sidebar = document.querySelector('aside.sidebar.border-start');
    if (!sidebar) return;

    const notesPanel = document.createElement('div');
    notesPanel.className = 'medical-notes-panel p-3 border-bottom';
    notesPanel.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-2">
            <h6 class="text-light mb-0">
                <i class="bi bi-journal-medical me-2"></i>Medical Notes
            </h6>
            <button class="btn btn-sm btn-outline-info" id="toggleNotesPanel">
                <i class="bi bi-chevron-down"></i>
            </button>
        </div>
        
        <div id="notesContent" class="notes-content" style="display: none;">
            <!-- Patient Information -->
            <div class="mb-3">
                <label class="form-label small text-light">Patient ID</label>
                <input type="text" class="form-control form-control-sm" id="notePatientId" readonly>
            </div>

            <!-- Study Information -->
            <div class="mb-3">
                <label class="form-label small text-light">Study Date</label>
                <input type="text" class="form-control form-control-sm" id="noteStudyDate" readonly>
            </div>

            <!-- Doctor Information -->
            <div class="mb-3">
                <label class="form-label small text-light">Reporting Physician</label>
                <input type="text" class="form-control form-control-sm" id="reportingPhysician" 
                       placeholder="Dr. [Your Name]">
            </div>

            <!-- Clinical History -->
            <div class="mb-3">
                <label class="form-label small text-light">Clinical History</label>
                <textarea class="form-control form-control-sm" id="clinicalHistory" rows="2" 
                          placeholder="Patient history, symptoms, clinical presentation..."></textarea>
            </div>

            <!-- Technique -->
            <div class="mb-3">
                <label class="form-label small text-light">Technique</label>
                <textarea class="form-control form-control-sm" id="technique" rows="2" 
                          placeholder="Imaging technique, contrast, protocol used..."></textarea>
            </div>

            <!-- Findings -->
            <div class="mb-3">
                <label class="form-label small text-light">Findings</label>
                <textarea class="form-control form-control-sm" id="findings" rows="4" 
                          placeholder="Detailed imaging findings, abnormalities, measurements..."></textarea>
            </div>

            <!-- Impression -->
            <div class="mb-3">
                <label class="form-label small text-light">Impression/Diagnosis</label>
                <textarea class="form-control form-control-sm" id="impression" rows="3" 
                          placeholder="Clinical impression, differential diagnosis..."></textarea>
            </div>

            <!-- Recommendations -->
            <div class="mb-3">
                <label class="form-label small text-light">Recommendations</label>
                <textarea class="form-control form-control-sm" id="recommendations" rows="2" 
                          placeholder="Follow-up recommendations, additional studies..."></textarea>
            </div>

            <!-- Notes History -->
            <div class="mb-3">
                <label class="form-label small text-light">Notes History</label>
                <div id="notesHistory" class="small text-muted" style="max-height: 100px; overflow-y: auto; border: 1px solid #444; border-radius: 4px; padding: 8px;">
                    No previous notes
                </div>
            </div>

            <!-- Action Buttons -->
            <div class="d-flex gap-1">
                <button class="btn btn-success btn-sm flex-fill" id="saveNotes">
                    <i class="bi bi-floppy me-1"></i>Save
                </button>
                <button class="btn btn-info btn-sm flex-fill" id="exportReport">
                    <i class="bi bi-file-text me-1"></i>Report
                </button>
                <button class="btn btn-warning btn-sm flex-fill" id="clearNotes">
                    <i class="bi bi-trash me-1"></i>Clear
                </button>
            </div>
        </div>
    `;

    // Insert after tools panel but ensure sidebar scrolling works
    const toolsPanel = sidebar.querySelector('.p-3.border-bottom');
    if (toolsPanel) {
        toolsPanel.parentNode.insertBefore(notesPanel, toolsPanel.nextSibling);
    } else {
        sidebar.insertBefore(notesPanel, sidebar.firstChild);
    }
}

setupEventListeners() {
    // Toggle panel visibility - FIXED VERSION
    const toggleBtn = document.getElementById('toggleNotesPanel');
    const notesContent = document.getElementById('notesContent');
    
    if (toggleBtn && notesContent) {
        toggleBtn.addEventListener('click', () => {
            const isVisible = notesContent.style.display !== 'none';
            notesContent.style.display = isVisible ? 'none' : 'block';
            
            // Update chevron icon
            const icon = toggleBtn.querySelector('i');
            if (isVisible) {
                icon.className = 'bi bi-chevron-down';
            } else {
                icon.className = 'bi bi-chevron-up';
            }
            
            console.log(`Notes panel ${isVisible ? 'collapsed' : 'expanded'}`);
        });
    }

    // Save notes
    const saveBtn = document.getElementById('saveNotes');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => this.saveNotes());
    }

    // Export report
    const exportBtn = document.getElementById('exportReport');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => this.exportReport());
    }

    // Clear notes
    const clearBtn = document.getElementById('clearNotes');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => this.clearNotes());
    }

    // Auto-save on field changes (debounced)
    const fields = ['reportingPhysician', 'clinicalHistory', 'technique', 'findings', 'impression', 'recommendations'];
    let saveTimeout;
    
    fields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.addEventListener('input', () => {
                clearTimeout(saveTimeout);
                saveTimeout = setTimeout(() => this.autoSave(), 2000);
            });
        }
    });
}

loadNotesForImage(imageId, patientInfo = {}) {
    this.currentImageId = imageId;
    
    // Auto-populate patient info fields from DICOM data
    const patientIdField = document.getElementById('notePatientId');
    const studyDateField = document.getElementById('noteStudyDate');
    
    if (patientIdField) {
        patientIdField.value = patientInfo.patient_id || patientInfo.patientId || '';
    }
    if (studyDateField) {
        studyDateField.value = patientInfo.study_date || patientInfo.studyDate || '';
    }

    // Load notes from server with enhanced identification
    this.loadNotesFromServer(imageId);

    console.log(`Loading notes for image: ${imageId}`);
}

// Replace the saveNotes method in medical-notes.js
saveNotes() {
    if (!this.currentImageId) {
        window.DICOM_VIEWER.showAISuggestion('No image selected for notes');
        return;
    }

    const noteData = {
        imageId: this.currentImageId, // We only need to send the imageId
        reportingPhysician: document.getElementById('reportingPhysician').value,
        clinicalHistory: document.getElementById('clinicalHistory').value,
        technique: document.getElementById('technique').value,
        findings: document.getElementById('findings').value,
        impression: document.getElementById('impression').value,
        recommendations: document.getElementById('recommendations').value,
        patientId: document.getElementById('notePatientId').value,
        studyDate: document.getElementById('noteStudyDate').value,
    };

    // Save to server (the server now handles finding the Series UID)
    this.saveNotesToServer(noteData);

    window.DICOM_VIEWER.showAISuggestion('Medical notes saved successfully');
    
    // Visual feedback
    const saveBtn = document.getElementById('saveNotes');
    if (saveBtn) {
        const originalText = saveBtn.innerHTML;
        saveBtn.innerHTML = '<i class="bi bi-check me-1"></i>Saved';
        saveBtn.classList.replace('btn-success', 'btn-outline-success');
        setTimeout(() => {
            saveBtn.innerHTML = originalText;
            saveBtn.classList.replace('btn-outline-success', 'btn-success');
        }, 2000);
    }
}

// Clean version - replace the loadNotesFromServer method
async loadNotesFromServer(imageId) {
    const state = window.DICOM_VIEWER.STATE;
    const currentImage = state.currentSeriesImages[state.currentImageIndex];
    const originalFilename = currentImage?.file_name || '';

    try {
        // Build parameters for note retrieval
        const params = new URLSearchParams({
            imageId: imageId,
            ...(originalFilename && { filename: originalFilename })
        });
        
        const response = await fetch(`get_notes.php?${params}`);
        const data = await response.json();
        
        if (data.success && data.notes) {
            this.notes.set(imageId, data.notes);
            this.populateNotesFields(data.notes);
            
            // Show collaboration information if available
            if (data.collaboration && data.collaboration.hasHistory) {
                this.showCollaborationInfo(data.collaboration);
                window.DICOM_VIEWER.showAISuggestion(
                    `Loaded notes with collaboration history: ${data.collaboration.versionCount} versions from ${data.collaboration.contributors.length} contributor(s)`
                );
            } else {
                window.DICOM_VIEWER.showAISuggestion('Notes loaded successfully');
            }
            
            return;
        }
    } catch (error) {
        console.log('Server notes load failed, trying localStorage:', error);
    }

    // Clear fields if no notes found
    this.clearNotesFields();
}


// Add this new method to medical-notes.js
showCollaborationInfo(collaborationInfo) {
    // Create or update collaboration status indicator
    let collabIndicator = document.getElementById('collaborationIndicator');
    if (!collabIndicator) {
        collabIndicator = document.createElement('div');
        collabIndicator.id = 'collaborationIndicator';
        collabIndicator.className = 'alert alert-info alert-sm mt-2';
        
        const notesPanel = document.querySelector('.medical-notes-panel');
        const notesContent = document.getElementById('notesContent');
        if (notesContent) {
            notesContent.appendChild(collabIndicator);
        }
    }
    
    const contributors = collaborationInfo.contributors.join(', ');
    const lastUpdate = new Date(collaborationInfo.lastUpdate).toLocaleString();
    
    collabIndicator.innerHTML = `
        <div class="d-flex align-items-center">
            <i class="bi bi-people-fill me-2"></i>
            <div>
                <div class="small"><strong>Collaborative Report</strong></div>
                <div class="small">Contributors: ${contributors}</div>
                <div class="small">Last updated: ${lastUpdate}</div>
            </div>
        </div>
    `;
}

// Updated saveNotesToServer method
async saveNotesToServer(noteData) {
    try {
        const response = await fetch('save_notes.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(noteData)
        });
        
        const result = await response.json();
        if (result.success) {
            console.log('Notes saved to server file:', result.filename);
        } else {
            console.log('Server save failed:', result.message);
        }
    } catch (error) {
        console.log('Server save failed, using local storage only:', error);
    }
}

    autoSave() {
        if (this.currentImageId) {
            this.saveNotes();
            console.log('Auto-saved medical notes');
        }
    }

    clearNotes() {
        if (confirm('Are you sure you want to clear all notes for this image?')) {
            const fields = ['reportingPhysician', 'clinicalHistory', 'technique', 'findings', 'impression', 'recommendations'];
            fields.forEach(fieldId => {
                const field = document.getElementById(fieldId);
                if (field) field.value = '';
            });
            
            if (this.currentImageId) {
                this.notes.delete(this.currentImageId);
                localStorage.removeItem(`dicom_notes_${this.currentImageId}`);
                this.updateNotesHistory(this.currentImageId);
            }
            
            window.DICOM_VIEWER.showAISuggestion('Notes cleared');
        }
    }

    updateNotesHistory(imageId) {
        const historyDiv = document.getElementById('notesHistory');
        if (!historyDiv) return;

        const notes = this.notes.get(imageId);
        if (!notes || !notes.timestamp) {
            historyDiv.innerHTML = '<div class="text-muted small">No previous notes</div>';
            return;
        }

        const date = new Date(notes.timestamp);
        historyDiv.innerHTML = `
            <div class="border rounded p-2 mb-2 bg-dark">
                <div class="text-info small mb-1">
                    <strong>Last Updated:</strong> ${date.toLocaleDateString()} ${date.toLocaleTimeString()}
                </div>
                <div class="small">
                    <strong>By:</strong> ${notes.reportingPhysician || 'Unknown'}
                </div>
            </div>
        `;
    }

    exportReport() {
        if (!this.currentImageId) {
            window.DICOM_VIEWER.showAISuggestion('No image selected for report export');
            return;
        }

        const notes = this.notes.get(this.currentImageId) || {};
        const date = new Date();
        
        const reportContent = `
RADIOLOGY REPORT

Patient ID: ${notes.patientId || 'N/A'}
Study Date: ${notes.studyDate || 'N/A'}
Report Date: ${date.toLocaleDateString()}
Reporting Physician: ${notes.reportingPhysician || 'N/A'}

CLINICAL HISTORY:
${notes.clinicalHistory || 'No clinical history provided'}

TECHNIQUE:
${notes.technique || 'No technique details provided'}

FINDINGS:
${notes.findings || 'No findings documented'}

IMPRESSION:
${notes.impression || 'No impression provided'}

RECOMMENDATIONS:
${notes.recommendations || 'No recommendations provided'}

---
Report generated by DICOM Viewer Pro
Generated on: ${date.toLocaleString()}
        `.trim();

        // Create and download report
        const blob = new Blob([reportContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `RadiologyReport_${notes.patientId || 'Unknown'}_${date.toISOString().split('T')[0]}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        window.DICOM_VIEWER.showAISuggestion('Radiology report exported successfully');
    }

    async saveNotesToServer(noteData) {
        try {
            const response = await fetch('save_notes.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(noteData)
            });
            
            if (response.ok) {
                console.log('Notes saved to server');
            }
        } catch (error) {
            console.log('Server save failed, using local storage only:', error);
        }
    }

// Enhanced debugging version of loadNotesFromServer
async loadNotesFromServer(imageId) {
    const state = window.DICOM_VIEWER.STATE;
    const currentImage = state.currentSeriesImages[state.currentImageIndex];
    const originalFilename = currentImage?.file_name || '';

    console.log('=== LOADING NOTES DEBUG ===');
    console.log('ImageId:', imageId);
    console.log('Original filename:', originalFilename);
    console.log('Current image object:', currentImage);

    try {
        // Build parameters for enhanced note retrieval
        const params = new URLSearchParams({
            imageId: imageId,
            ...(originalFilename && { filename: originalFilename })
        });
        
        console.log('Request params:', params.toString());
        
        const response = await fetch(`get_notes.php?${params}`);
        console.log('Response status:', response.status);
        
        const responseText = await response.text();
        console.log('Raw response:', responseText);
        
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            console.error('JSON parse error:', parseError);
            console.error('Response was:', responseText);
            throw new Error('Invalid JSON response from server');
        }
        
        console.log('Parsed response data:', data);
        
        if (data.success && data.notes) {
            this.notes.set(imageId, data.notes);
            this.populateNotesFields(data.notes);
            
            console.log('Notes loaded successfully:', data.notes);
            
            // Show collaboration information if available
            if (data.collaboration && data.collaboration.hasHistory) {
                this.showCollaborationInfo(data.collaboration);
                window.DICOM_VIEWER.showAISuggestion(
                    `Loaded notes with collaboration history: ${data.collaboration.versionCount} versions from ${data.collaboration.contributors.length} contributor(s)`
                );
            } else {
                window.DICOM_VIEWER.showAISuggestion('Notes loaded successfully');
            }
            
            return;
        } else {
            console.log('No notes found or request failed:', data.message);
        }
    } catch (error) {
        console.error('Server notes load failed:', error);
    }

    // Clear fields if no notes found
    this.clearNotesFields();
    console.log('=== NO NOTES FOUND - FIELDS CLEARED ===');
}
// Replace the populateNotesFields function in medical-notes.js
populateNotesFields(noteData) {
    const fields = ['reportingPhysician', 'clinicalHistory', 'technique', 'findings', 'impression', 'recommendations'];
    
    fields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        // Use the most current data for the main fields
        if (field) {
            field.value = noteData[fieldId] || '';
        }
    });

    // This now calls the dedicated function to render the version history UI
    this.renderVersionHistory(noteData);
}

// Replace the updateNotesHistoryWithCollaboration function with this new one
renderVersionHistory(noteData) {
    const historyDiv = document.getElementById('notesHistory');
    if (!historyDiv) return;

    // The 'previousVersions' array holds the history. The most recent save is the main `noteData` object.
    const history = noteData.previousVersions || [];
    
    if (!noteData.currentTimestamp && history.length === 0) {
        historyDiv.innerHTML = '<div class="text-muted small p-2">No notes saved for this series yet.</div>';
        return;
    }

    let historyHtml = '';

    // 1. Display the current, active version at the top
    if (noteData.currentTimestamp) {
        const currentDate = new Date(noteData.currentTimestamp);
        historyHtml += `
            <div class="list-group-item list-group-item-action active" aria-current="true">
                <div class="d-flex w-100 justify-content-between">
                    <h6 class="mb-1">Current Version</h6>
                    <small>${currentDate.toLocaleDateString()}</small>
                </div>
                <p class="mb-1 small"><strong>By:</strong> ${noteData.reportingPhysician || 'N/A'}</p>
                <small>${currentDate.toLocaleTimeString()}</small>
            </div>
        `;
    }

    // 2. Display previous versions in reverse chronological order (newest first)
    [...history].reverse().forEach((version, index) => {
        const versionDate = new Date(version.timestamp || version.currentTimestamp);
        // Use a preview of the 'findings' to give context to the version
        const findingsPreview = version.findings ? version.findings.substring(0, 75) + '...' : 'No findings recorded.';

        historyHtml += `
            <div class="list-group-item list-group-item-action">
                <div class="d-flex w-100 justify-content-between">
                    <h6 class="mb-1 text-muted">Version ${history.length - index}</h6>
                    <small class="text-muted">${versionDate.toLocaleDateString()}</small>
                </div>
                <p class="mb-1 small"><strong>By:</strong> ${version.reportingPhysician || 'N/A'}</p>
                <small class="text-muted fst-italic">"${findingsPreview}"</small>
            </div>
        `;
    });
    
    // Wrap the items in a Bootstrap list group for styling
    historyDiv.innerHTML = `<div class="list-group list-group-flush border rounded">${historyHtml}</div>`;
}


clearNotesFields() {
    const fields = ['reportingPhysician', 'clinicalHistory', 'technique', 'findings', 'impression', 'recommendations'];
    
    fields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.value = '';
        }
    });

    const historyDiv = document.getElementById('notesHistory');
    if (historyDiv) {
        historyDiv.innerHTML = '<div class="text-muted small">No previous notes</div>';
    }
}
};