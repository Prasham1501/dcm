const state = {
    openReports: [],
    currentReportIndex: 0,
    patient: null,
    studies: [],
    currentStudyUID: null,
    remarkModal: null
};

document.addEventListener('DOMContentLoaded', function() {
    // Initialize remark modal
    const remarkModalElement = document.getElementById('remarkModal');
    if (remarkModalElement) {
        state.remarkModal = new bootstrap.Modal(remarkModalElement);
    }

    const urlParams = new URLSearchParams(window.location.search);
    const patientId = urlParams.get('patient_id');
    if (!patientId) {
        alert('No patient selected');
        window.history.back();
        return;
    }
    loadStudies(patientId);
});

async function loadStudies(patientId) {
    try {
        const response = await fetch('../api/study_list_api.php?patient_id=' + encodeURIComponent(patientId));
        const data = await response.json();
        if (!data.success) throw new Error(data.error || 'Failed to load studies');
        state.patient = data.patient;
        state.studies = data.studies;
        displayPatientInfo(data.patient);
        displayStudies(data.studies);
    } catch (error) {
        console.error('Error loading studies:', error);
        document.getElementById('studiesList').innerHTML = '<div class="alert alert-danger"><i class="bi bi-exclamation-triangle"></i> Error: ' + error.message + '</div>';
    }
}

function displayPatientInfo(patient) {
    document.getElementById('patientName').textContent = patient.patient_name || 'Unknown Patient';
    
    // Calculate age
    const age = calculateAge(patient.patient_birth_date);
    const ageDisplay = age !== null ? age + ' yrs' : 'N/A';
    
    // Format sex display
    const sex = patient.patient_sex || '';
    const sexDisplay = sex === 'M' ? 'Male' : sex === 'F' ? 'Female' : sex || 'N/A';
    
    // Format DOB in dd/mm/yyyy
    const dobDisplay = formatDate(patient.patient_birth_date);
    
    document.getElementById('patientInfo').textContent = 
        'ID: ' + (patient.patient_id || 'N/A') + 
        ' | Sex: ' + sexDisplay + 
        ' | Age: ' + ageDisplay + 
        ' | DOB: ' + dobDisplay;
}

function displayStudies(studies) {
    const container = document.getElementById('studiesList');
    if (studies.length === 0) {
        container.innerHTML = '<div class="alert alert-info"><i class="bi bi-info-circle"></i> No studies found for this patient.</div>';
        return;
    }

    // Log studies for debugging
    console.log('=== STUDIES LOADED ===');
    console.log('Total studies:', studies.length);
    studies.forEach((study, index) => {
        console.log(`Study ${index + 1}:`, {
            study_instance_uid: study.study_instance_uid,
            orthanc_id: study.orthanc_id,
            study_description: study.study_description
        });
    });

    // Create table layout
    container.innerHTML = `
        <div class="table-responsive">
            <table class="studies-table">
                <thead>
                    <tr>
                        <th>Study Description</th>
                        <th>Study Date</th>
                        <th>Modality</th>
                        <th>Referred By</th>
                        <th>Images</th>
                        <th style="text-align: center;">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${studies.map(study => createStudyTableRow(study)).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function createStudyTableRow(study) {
    const hasReport = !!study.orthanc_id;
    
    // Build a meaningful study description
    let studyDesc = '';
    if (study.study_description && study.study_description.trim() && study.study_description.trim().toLowerCase() !== 'unnamed study') {
        studyDesc = study.study_description.trim();
    } else if (study.study_name && study.study_name.trim()) {
        studyDesc = study.study_name.trim();
    } else if (study.modality) {
        // Use modality as fallback
        studyDesc = study.modality + ' Study';
    } else {
        studyDesc = 'Medical Study';
    }
    
    // Add study ID if available and different from description
    const studyIdDisplay = study.study_id && study.study_id !== 'N/A' && study.study_id.trim() 
        ? study.study_id 
        : (study.accession_number || '');
    
    studyDesc = escapeHtml(studyDesc);
    const studyDate = formatDate(study.study_date);
    const studyTime = formatTime(study.study_time);
    const modality = study.modality || study.modalities || 'N/A';
    const imageCount = study.instance_count || study.image_count || '0';
    const studyUID = study.study_instance_uid;
    const orthancId = study.orthanc_id;

    const referredBy = escapeHtml(study.referred_by || '');
    
    return `
        <tr id="study-${studyUID}">
            <td>
                <strong>${studyDesc}</strong>
                ${studyIdDisplay ? `<br><small style="color: var(--text-secondary);">ID: ${escapeHtml(studyIdDisplay)}</small>` : ''}
            </td>
            <td>
                ${studyDate}
                ${studyTime ? `<br><small style="color: var(--text-secondary);">${studyTime}</small>` : ''}
            </td>
            <td>
                <span class="badge badge-info">${modality}</span>
            </td>
            <td>
                ${referredBy ? `
                    <span class="text-light">${referredBy}</span>
                ` : `
                    <button class="btn-sm btn-outline-secondary" onclick="showReferredByModal('${studyUID}')" title="Add Referring Doctor">
                        <i class="bi bi-plus"></i> Add
                    </button>
                `}
            </td>
            <td>${imageCount} images</td>
            <td style="text-align: center;">
                <div class="btn-group">
                    <button class="btn-sm btn-primary" onclick="openStudy('${studyUID}', '${orthancId}')" title="Open Study">
                        <i class="bi bi-box-arrow-up-right"></i> View
                    </button>
                    <button class="btn-sm btn-success" onclick="exportToJPG('${studyUID}', '${studyDesc}')" title="Export all images as JPG">
                        <i class="bi bi-download"></i> Export
                    </button>
                    <button class="btn-sm btn-warning" onclick="showRemarkModal('${studyUID}', '${studyDesc}')" title="Add/View Remarks">
                        <i class="bi bi-chat-square-text"></i> Remark
                    </button>
                    <button class="btn-sm btn-info" onclick="showPrescriptionModal('${studyUID}', '${studyDesc}')" title="Add/View Prescription">
                        <i class="bi bi-prescription2"></i> Rx
                    </button>
                    <button class="btn-sm" onclick="viewReport('${studyUID}', '${orthancId}')" ${!hasReport ? 'disabled' : ''} title="View Report">
                        <i class="bi bi-file-earmark-text"></i> Report
                    </button>
                </div>
            </td>
        </tr>
    `;
}

// Export study images as JPG
async function exportToJPG(studyUID, studyDescription) {
    const btn = event.target.closest('button');
    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Exporting...';

    try {
        const response = await fetch(`../api/studies/export-images.php?study_uid=${encodeURIComponent(studyUID)}`);

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to export images');
        }

        // Create a blob from the response
        const blob = await response.blob();

        // Create a download link
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;

        // Get filename from Content-Disposition header or use default
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = `Study_${studyDescription.replace(/[^a-zA-Z0-9]/g, '_')}_images.zip`;
        if (contentDisposition) {
            const matches = /filename="(.+)"/.exec(contentDisposition);
            if (matches) filename = matches[1];
        }

        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        alert('Images exported successfully!');
    } catch (error) {
        console.error('Export error:', error);
        alert('Error exporting images: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalHTML;
    }
}

// Show remark modal
async function showRemarkModal(studyUID, studyDescription) {
    state.currentStudyUID = studyUID;
    document.getElementById('remarkStudyName').textContent = studyDescription;
    document.getElementById('newRemarkText').value = '';

    if (state.remarkModal) {
        state.remarkModal.show();
        await loadRemarks();
    }
}

// Load remarks for a study
async function loadRemarks() {
    const remarksList = document.getElementById('remarksList');
    remarksList.innerHTML = '<div class="text-center text-muted py-3"><i class="bi bi-hourglass-split"></i> Loading remarks...</div>';

    try {
        const response = await fetch(`../api/studies/remarks.php?study_uid=${encodeURIComponent(state.currentStudyUID)}`);
        const data = await response.json();

        if (data.success) {
            if (data.remarks.length === 0) {
                remarksList.innerHTML = '<div class="text-center text-muted py-3"><i class="bi bi-inbox"></i> No remarks yet</div>';
            } else {
                remarksList.innerHTML = data.remarks.map(remark => `
                    <div class="card mb-2" style="background: var(--bg-tertiary); border: 1px solid #444;">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-start">
                                <div class="flex-grow-1">
                                    <p class="mb-2" style="color: var(--text-primary);">${escapeHtml(remark.remark)}</p>
                                    <small style="color: var(--text-secondary);">
                                        <i class="bi bi-person"></i> ${escapeHtml(remark.created_by_name || 'Unknown')}
                                        (${escapeHtml(remark.created_by_role || 'N/A')})
                                        <i class="bi bi-clock ms-2"></i> ${new Date(remark.created_at).toLocaleString()}
                                        ${remark.created_at !== remark.updated_at ? '<i class="bi bi-pencil ms-2"></i> Updated: ' + new Date(remark.updated_at).toLocaleString() : ''}
                                    </small>
                                </div>
                                <button class="btn btn-sm btn-danger ms-2" onclick="deleteRemark(${remark.id})" title="Delete">
                                    <i class="bi bi-trash"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                `).join('');
            }
        }
    } catch (error) {
        console.error('Error loading remarks:', error);
        remarksList.innerHTML = '<div class="alert alert-danger">Failed to load remarks</div>';
    }
}

// Save new remark
async function saveRemark() {
    const remarkText = document.getElementById('newRemarkText').value.trim();

    if (!remarkText) {
        alert('Please enter a remark');
        return;
    }

    try {
        const response = await fetch('../api/studies/remarks.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                study_uid: state.currentStudyUID,
                remark: remarkText
            })
        });

        const data = await response.json();

        if (data.success) {
            document.getElementById('newRemarkText').value = '';
            await loadRemarks();
            alert('Remark added successfully!');
        } else {
            throw new Error(data.error || 'Failed to save remark');
        }
    } catch (error) {
        console.error('Error saving remark:', error);
        alert('Error saving remark: ' + error.message);
    }
}

// Delete remark
async function deleteRemark(remarkId) {
    if (!confirm('Are you sure you want to delete this remark?')) {
        return;
    }

    try {
        const response = await fetch(`../api/studies/remarks.php?id=${remarkId}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (data.success) {
            await loadRemarks();
            alert('Remark deleted successfully!');
        } else {
            throw new Error(data.error || 'Failed to delete remark');
        }
    } catch (error) {
        console.error('Error deleting remark:', error);
        alert('Error deleting remark: ' + error.message);
    }
}

// Helper Functions
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    // Format DICOM date YYYYMMDD to DD/MM/YYYY
    if (dateStr.length === 8) {
        return `${dateStr.substr(6, 2)}/${dateStr.substr(4, 2)}/${dateStr.substr(0, 4)}`;
    }
    // Handle YYYY-MM-DD format
    if (dateStr.includes('-')) {
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
    }
    return dateStr;
}

function formatTime(timeStr) {
    if (!timeStr) return '';
    // Clean up time string - remove any non-numeric characters except decimals
    const cleanTime = timeStr.replace(/[^0-9.]/g, '');
    
    // Format DICOM time HHMMSS or HHMMSS.fraction to HH:MM:SS
    if (cleanTime.length >= 6) {
        const hours = cleanTime.substr(0, 2);
        const minutes = cleanTime.substr(2, 2);
        const seconds = cleanTime.substr(4, 2);
        return `${hours}:${minutes}:${seconds}`;
    } else if (cleanTime.length >= 4) {
        const hours = cleanTime.substr(0, 2);
        const minutes = cleanTime.substr(2, 2);
        return `${hours}:${minutes}`;
    }
    return timeStr;
}

function calculateAge(birthDateStr) {
    if (!birthDateStr) return null;
    
    let birthDate;
    // Handle DICOM format YYYYMMDD
    if (birthDateStr.length === 8 && !birthDateStr.includes('-')) {
        birthDate = new Date(
            parseInt(birthDateStr.substr(0, 4)),
            parseInt(birthDateStr.substr(4, 2)) - 1,
            parseInt(birthDateStr.substr(6, 2))
        );
    } else {
        birthDate = new Date(birthDateStr);
    }
    
    if (isNaN(birthDate.getTime())) return null;
    
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    
    return age;
}

// Open study in viewer
function openStudy(studyUID, orthancId) {
    window.open(`../index.php?study_id=${encodeURIComponent(orthancId)}&studyUID=${encodeURIComponent(studyUID)}`, '_blank');
}

// View report function (existing functionality)
async function viewReport(studyUID, orthancId) {
    try {
        const response = await fetch(`../api/reports/by-study.php?studyUID=${encodeURIComponent(studyUID)}`);
        const data = await response.json();

        if (data.success && data.data && data.data.reports && data.data.reports.length > 0) {
            const report = data.data.reports[0];
            openReportTab(report, studyUID);
        } else {
            alert('No report found for this study.');
        }
    } catch (error) {
        console.error('Error loading report:', error);
        alert('Error loading report: ' + error.message);
    }
}

// Prescription function (existing functionality)
function addPrescription(studyUID, orthancId) {
    alert('Prescription feature - Coming soon!');
}

// Doctor info function (existing functionality)
function viewDoctorInfo(studyUID) {
    alert('Doctor info feature - Coming soon!');
}

// Report panel functions
function openReportTab(report, studyUID) {
    const existingIndex = state.openReports.findIndex(r => r.id === report.id);

    if (existingIndex !== -1) {
        state.currentReportIndex = existingIndex;
        switchToReport(existingIndex);
        return;
    }

    state.openReports.push(report);
    state.currentReportIndex = state.openReports.length - 1;

    const reportsPanel = document.getElementById('reportsPanel');
    const studiesPanel = document.getElementById('studiesPanel');

    if (!reportsPanel.classList.contains('active')) {
        reportsPanel.classList.add('active');
        studiesPanel.style.flex = '1';
    }

    updateReportTabs();
    displayReport(report);
    updateOpenReportsCount();

    const studyCard = document.getElementById('study-' + studyUID);
    if (studyCard) {
        studyCard.classList.add('report-opened');
    }
}

function updateReportTabs() {
    const tabsContainer = document.getElementById('reportTabs');
    tabsContainer.innerHTML = state.openReports.map((report, index) => {
        const title = report.title || 'Report ' + (index + 1);
        const isActive = index === state.currentReportIndex;
        return `
            <div class="report-tab ${isActive ? 'active' : ''}" onclick="switchToReport(${index})">
                <span>${escapeHtml(title)}</span>
                <span class="close-tab" onclick="closeReport(${index}, event)">&times;</span>
            </div>
        `;
    }).join('');
}

function switchToReport(index) {
    if (index < 0 || index >= state.openReports.length) return;
    state.currentReportIndex = index;
    updateReportTabs();
    displayReport(state.openReports[index]);
}

function displayReport(report) {
    const contentDiv = document.getElementById('reportContent');

    // Parse findings if it's a string with subsections
    let findingsHtml = '';
    const findings = report.findings || '';

    if (findings) {
        // Split by double newlines to get sections
        const findingsParts = findings.split(/\n\s*\n/);
        findingsParts.forEach(part => {
            const separatorIndex = part.indexOf(':');
            // Check if this part has a key:value format
            if (separatorIndex > 0 && separatorIndex < 50) {
                const key = part.substring(0, separatorIndex);
                const value = part.substring(separatorIndex + 1).trim();
                findingsHtml += `
                    <div style="margin-bottom: 15px;">
                        <strong>${escapeHtml(key)}:</strong>
                        <p style="margin: 5px 0 0 0; color: var(--text-secondary);">${escapeHtml(value).replace(/\n/g, '<br>')}</p>
                    </div>
                `;
            } else {
                findingsHtml += `<p>${escapeHtml(part).replace(/\n/g, '<br>')}</p>`;
            }
        });
    } else {
        findingsHtml = '<p style="color: var(--text-secondary);">No findings reported</p>';
    }

    // Determine which doctor name to display - check multiple possible fields
    const doctorName = report.reporting_physician_name ||
                      report.reporting_physician ||
                      report.created_by_name ||
                      'Not specified';

    contentDiv.innerHTML = `
        <div class="report-card">
            <div class="report-header">
                <h4>${escapeHtml(report.title || 'Medical Report')}</h4>
                <div class="report-actions">
                    <button class="btn-sm btn-primary" onclick="printReport()">
                        <i class="bi bi-printer"></i> Print
                    </button>
                </div>
            </div>

            <div class="report-section">
                <h6><i class="bi bi-card-text"></i> Indication</h6>
                <p>${escapeHtml(report.indication || 'Not specified')}</p>
            </div>

            <div class="report-section">
                <h6><i class="bi bi-shield-check"></i> Technique</h6>
                <p>${escapeHtml(report.technique || 'Not specified')}</p>
            </div>

            <div class="report-section">
                <h6><i class="bi bi-search"></i> Findings</h6>
                ${findingsHtml}
            </div>

            <div class="report-section">
                <h6><i class="bi bi-clipboard-check"></i> Impression</h6>
                <p style="white-space: pre-wrap;">${escapeHtml(report.impression || 'No impression provided')}</p>
            </div>

            <div class="report-footer" style="margin-top: 30px; padding-top: 20px; border-top: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <span style="color: var(--text-secondary); font-size: 0.9em;">Reporting Physician:</span>
                    <span style="font-weight: 500; margin-left: 10px;">${escapeHtml(doctorName)}</span>
                </div>
                <div>
                    <span style="color: var(--text-secondary); font-size: 0.9em;">Status:</span>
                    <span class="badge ${report.status === 'final' ? 'badge-success' : 'badge-warning'}" style="margin-left: 10px;">${report.status || 'draft'}</span>
                </div>
            </div>
        </div>
    `;
}

function closeReport(index, event) {
    if (event) event.stopPropagation();

    state.openReports.splice(index, 1);

    if (state.openReports.length === 0) {
        closeAllReports();
        return;
    }

    if (state.currentReportIndex >= state.openReports.length) {
        state.currentReportIndex = state.openReports.length - 1;
    }

    updateReportTabs();
    displayReport(state.openReports[state.currentReportIndex]);
    updateOpenReportsCount();
}

function closeAllReports() {
    state.openReports = [];
    state.currentReportIndex = 0;

    const reportsPanel = document.getElementById('reportsPanel');
    const studiesPanel = document.getElementById('studiesPanel');

    reportsPanel.classList.remove('active', 'full');
    studiesPanel.classList.remove('hidden');
    studiesPanel.style.flex = '1';

    document.getElementById('reportTabs').innerHTML = '';
    document.getElementById('reportContent').innerHTML = `
        <div class="no-report-message">
            <i class="bi bi-file-earmark-text"></i>
            <h5>No Report Selected</h5>
            <p>Click "View Report" button on any study</p>
        </div>
    `;

    updateOpenReportsCount();

    document.querySelectorAll('.study-card').forEach(card => {
        card.classList.remove('report-opened');
    });
}

function toggleFullScreen() {
    const reportsPanel = document.getElementById('reportsPanel');
    const studiesPanel = document.getElementById('studiesPanel');
    const toggleIcon = document.getElementById('toggleIcon');

    if (reportsPanel.classList.contains('full')) {
        reportsPanel.classList.remove('full');
        reportsPanel.classList.add('active');
        studiesPanel.classList.remove('hidden');
        studiesPanel.style.flex = '1';
        toggleIcon.className = 'bi bi-arrows-angle-expand';
    } else {
        reportsPanel.classList.add('full');
        reportsPanel.classList.remove('active');
        studiesPanel.classList.add('hidden');
        studiesPanel.style.flex = '0';
        toggleIcon.className = 'bi bi-arrows-angle-contract';
    }
}

function updateOpenReportsCount() {
    const countElement = document.getElementById('openReportsCount');
    const countText = document.getElementById('reportCountText');

    if (state.openReports.length > 0) {
        countElement.style.display = 'inline-flex';
        countText.textContent = state.openReports.length;
    } else {
        countElement.style.display = 'none';
    }
}

function printReport() {
    window.print();
}

// ========== REFERRED BY FUNCTIONS ==========

function showReferredByModal(studyUID) {
    // Create modal if not exists
    let modal = document.getElementById('referredByModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'referredByModal';
        modal.className = 'modal fade';
        modal.tabIndex = -1;
        modal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content" style="background: var(--bg-secondary); border: 1px solid #444;">
                    <div class="modal-header" style="border-bottom: 1px solid #444;">
                        <h5 class="modal-title" style="color: var(--accent);">
                            <i class="bi bi-person-badge me-2"></i>Add Referring Doctor
                        </h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <label class="form-label" style="color: var(--text-primary);">Doctor Name</label>
                            <input type="text" class="form-control" id="referredByInput" placeholder="Dr. John Smith" 
                                   style="background: var(--bg-tertiary); border-color: #444; color: var(--text-primary);">
                        </div>
                    </div>
                    <div class="modal-footer" style="border-top: 1px solid #444;">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-primary" onclick="saveReferredBy()">Save</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    state.currentStudyUID = studyUID;
    document.getElementById('referredByInput').value = '';
    
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
}

async function saveReferredBy() {
    const referredBy = document.getElementById('referredByInput').value.trim();
    if (!referredBy) {
        alert('Please enter a doctor name');
        return;
    }
    
    try {
        const response = await fetch('../api/studies/update-referred-by.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                study_uid: state.currentStudyUID,
                referred_by: referredBy
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('referredByModal'));
            modal.hide();
            
            // Reload studies to show updated data
            const urlParams = new URLSearchParams(window.location.search);
            loadStudies(urlParams.get('patient_id'));
        } else {
            throw new Error(result.error || 'Failed to save');
        }
    } catch (error) {
        alert('Error saving: ' + error.message);
    }
}

// ========== PRESCRIPTION FUNCTIONS ==========

function showPrescriptionModal(studyUID, studyDesc) {
    // Create modal if not exists
    let modal = document.getElementById('prescriptionModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'prescriptionModal';
        modal.className = 'modal fade';
        modal.tabIndex = -1;
        modal.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content" style="background: var(--bg-secondary); border: 1px solid #444;">
                    <div class="modal-header" style="border-bottom: 1px solid #444;">
                        <h5 class="modal-title" style="color: var(--accent);">
                            <i class="bi bi-prescription2 me-2"></i>Prescription: <span id="prescriptionStudyName"></span>
                        </h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <!-- Existing Prescription -->
                        <div id="existingPrescription" style="display: none;" class="mb-4">
                            <h6 style="color: var(--text-primary);"><i class="bi bi-check-circle text-success"></i> Current Prescription</h6>
                            <div id="prescriptionDetails" class="p-3 rounded" style="background: var(--bg-tertiary); border: 1px solid #444;"></div>
                        </div>
                        
                        <!-- Add/Update Prescription Form -->
                        <div id="prescriptionForm">
                            <h6 style="color: var(--text-primary);" class="mb-3">Add/Update Prescription</h6>
                            
                            <div class="mb-3">
                                <label class="form-label" style="color: var(--text-primary);">Prescription Notes</label>
                                <textarea class="form-control" id="prescriptionNotes" rows="4" 
                                          placeholder="Enter prescription details, medications, dosage, etc."
                                          style="background: var(--bg-tertiary); border-color: #444; color: var(--text-primary);"></textarea>
                            </div>
                            
                            <div class="mb-3">
                                <label class="form-label" style="color: var(--text-primary);">Attach File (optional)</label>
                                <input type="file" class="form-control" id="prescriptionFile" accept=".pdf,.jpg,.jpeg,.png"
                                       style="background: var(--bg-tertiary); border-color: #444; color: var(--text-primary);">
                                <small class="text-muted">Supported: PDF, JPG, PNG. Max 5MB</small>
                            </div>
                            
                            <div id="currentAttachment" style="display: none;" class="mb-3">
                                <label class="form-label" style="color: var(--text-primary);">Current Attachment</label>
                                <div class="d-flex align-items-center gap-2">
                                    <a href="#" id="attachmentLink" target="_blank" class="btn btn-sm btn-outline-info">
                                        <i class="bi bi-file-earmark"></i> View Attachment
                                    </a>
                                    <button type="button" class="btn btn-sm btn-outline-danger" onclick="removePrescriptionAttachment()">
                                        <i class="bi bi-trash"></i> Remove
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer" style="border-top: 1px solid #444;">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        <button type="button" class="btn btn-primary" onclick="savePrescription()">
                            <i class="bi bi-save"></i> Save Prescription
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    state.currentStudyUID = studyUID;
    document.getElementById('prescriptionStudyName').textContent = studyDesc;
    document.getElementById('prescriptionNotes').value = '';
    document.getElementById('prescriptionFile').value = '';
    document.getElementById('existingPrescription').style.display = 'none';
    document.getElementById('currentAttachment').style.display = 'none';
    
    // Load existing prescription
    loadPrescription(studyUID);
    
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
}

async function loadPrescription(studyUID) {
    try {
        const response = await fetch(`../api/studies/prescription.php?study_uid=${encodeURIComponent(studyUID)}`);
        const result = await response.json();
        
        if (result.success && result.prescription) {
            const rx = result.prescription;
            
            // Show existing prescription
            document.getElementById('existingPrescription').style.display = 'block';
            document.getElementById('prescriptionDetails').innerHTML = `
                <p style="color: var(--text-primary); white-space: pre-wrap;">${escapeHtml(rx.notes || 'No notes')}</p>
                <small class="text-muted">
                    <i class="bi bi-person"></i> ${escapeHtml(rx.created_by_name || 'Unknown')} | 
                    <i class="bi bi-clock"></i> ${new Date(rx.created_at).toLocaleString()}
                </small>
            `;
            
            // Pre-fill form
            document.getElementById('prescriptionNotes').value = rx.notes || '';
            
            // Show attachment if exists
            if (rx.attachment_path) {
                document.getElementById('currentAttachment').style.display = 'block';
                document.getElementById('attachmentLink').href = '../' + rx.attachment_path;
            }
        }
    } catch (error) {
        console.error('Error loading prescription:', error);
    }
}

async function savePrescription() {
    const notes = document.getElementById('prescriptionNotes').value.trim();
    const fileInput = document.getElementById('prescriptionFile');
    
    if (!notes && !fileInput.files[0]) {
        alert('Please enter prescription notes or attach a file');
        return;
    }
    
    const formData = new FormData();
    formData.append('study_uid', state.currentStudyUID);
    formData.append('notes', notes);
    
    if (fileInput.files[0]) {
        // Validate file size (5MB)
        if (fileInput.files[0].size > 5 * 1024 * 1024) {
            alert('File too large. Maximum size is 5MB');
            return;
        }
        formData.append('attachment', fileInput.files[0]);
    }
    
    try {
        const response = await fetch('../api/studies/prescription.php', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert('Prescription saved successfully!');
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('prescriptionModal'));
            modal.hide();
        } else {
            throw new Error(result.error || 'Failed to save');
        }
    } catch (error) {
        alert('Error saving prescription: ' + error.message);
    }
}

async function removePrescriptionAttachment() {
    if (!confirm('Are you sure you want to remove the attachment?')) return;
    
    try {
        const response = await fetch('../api/studies/prescription.php', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                study_uid: state.currentStudyUID,
                remove_attachment_only: true
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            document.getElementById('currentAttachment').style.display = 'none';
            alert('Attachment removed');
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}
