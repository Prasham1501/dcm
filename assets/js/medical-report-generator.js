/**
 * Medical Report Generator - Obstetric USG Report Module
 * Integrates AI analysis with professional medical report templates
 * Version 1.0 - Production Ready
 */

class MedicalReportGenerator {
    constructor() {
        this.modal = null;
        this.currentAIAnalysis = null;
        this.hospitalConfig = null;
        this.selectedImage = null;
        this.allImages = [];
        this.reportData = {};
        this.init();
    }

    init() {
        this.createModal();
        this.loadHospitalConfig();
        this.setupEventListeners();
        console.log('Medical Report Generator initialized');
    }

    async loadHospitalConfig() {
        try {
            const basePath = document.querySelector('meta[name="base-path"]')?.content || '';
            const response = await fetch(`${basePath}/api/reports/hospital-config.php`);
            const data = await response.json();
            if (data.success) {
                this.hospitalConfig = data.data;
            }
        } catch (e) {
            console.error('Failed to load hospital config:', e);
            this.hospitalConfig = {
                hospital_name: 'Medical Imaging Center',
                hospital_address: '',
                hospital_phone: '',
                doctor_name: '',
                doctor_qualification: 'MBBS, MD (Radiology)'
            };
        }
    }

    createModal() {
        const existingModal = document.getElementById('medicalReportModal');
        if (existingModal) existingModal.remove();

        const modalHtml = `
            <div class="modal fade" id="medicalReportModal" tabindex="-1" aria-hidden="true" data-bs-backdrop="static">
                <div class="modal-dialog modal-fullscreen">
                    <div class="modal-content bg-dark text-light">
                        <div class="modal-header border-secondary py-2">
                            <h5 class="modal-title">
                                <i class="bi bi-file-medical me-2 text-primary"></i>
                                Medical Report Generator
                            </h5>
                            <div class="d-flex gap-2">
                                <button type="button" class="btn btn-outline-info btn-sm" id="previewReportBtn">
                                    <i class="bi bi-eye me-1"></i>Preview
                                </button>
                                <button type="button" class="btn btn-success btn-sm" id="saveReportBtn">
                                    <i class="bi bi-save me-1"></i>Save Draft
                                </button>
                                <button type="button" class="btn btn-primary btn-sm" id="printReportBtn">
                                    <i class="bi bi-printer me-1"></i>Print
                                </button>
                                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                            </div>
                        </div>
                        <div class="modal-body p-0" id="medicalReportBody">
                            <!-- Content will be injected here -->
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        this.modal = new bootstrap.Modal(document.getElementById('medicalReportModal'));
    }

    setupEventListeners() {
        // Preview button
        document.addEventListener('click', (e) => {
            if (e.target.closest('#previewReportBtn')) {
                this.previewReport();
            }
            if (e.target.closest('#saveReportBtn')) {
                this.saveReport('draft');
            }
            if (e.target.closest('#printReportBtn')) {
                this.printReport();
            }
        });
    }

    /**
     * Open report generator with AI analysis data
     */
    async openWithAIAnalysis(aiAnalysisData, studyInfo = {}) {
        this.currentAIAnalysis = aiAnalysisData;
        this.reportData = {
            study_uid: studyInfo.studyUID || '',
            patient_name: aiAnalysisData.patient_name || studyInfo.patientName || '',
            patient_id: studyInfo.patientId || '',
            exam_date: new Date().toISOString().split('T')[0],
            analysis_id: aiAnalysisData.analysis_id
        };

        // Extract biometry from AI analysis
        const biometry = aiAnalysisData.consolidated_biometry || {};
        
        // Store all images for selection
        this.allImages = aiAnalysisData.image_analyses || [];

        this.showReportForm(biometry, aiAnalysisData);
        this.modal.show();
    }

    /**
     * Show the report editing form
     */
    showReportForm(biometry, aiData) {
        const body = document.getElementById('medicalReportBody');
        
        // Extract values from biometry
        const fl = biometry.FL || {};
        const ac = biometry.AC || {};
        const bpd = biometry.BPD || {};
        const hc = biometry.HC || {};
        const efw = biometry.EFW || {};
        const ga = biometry.GA || {};
        const edd = biometry.EDD || {};
        
        // Get device info
        const device = aiData.device_metadata || {};
        const extractedText = aiData.extracted_text || [];

        body.innerHTML = `
            <div class="container-fluid h-100">
                <div class="row h-100">
                    <!-- Left Panel - Image Selection -->
                    <div class="col-md-3 border-end border-secondary p-3 overflow-auto" style="max-height: calc(100vh - 60px);">
                        <h6 class="text-primary mb-3">
                            <i class="bi bi-images me-2"></i>Select Primary Image
                        </h6>
                        <p class="small text-muted mb-3">
                            Click on an image to use its measurements as the primary source
                        </p>
                        
                        <div class="image-selection-grid" id="imageSelectionGrid">
                            ${this.renderImageSelection()}
                        </div>
                        
                        <hr class="border-secondary my-3">
                        
                        <h6 class="text-info mb-2">
                            <i class="bi bi-cpu me-2"></i>AI Extracted Data
                        </h6>
                        <div class="ai-extracted-data bg-black p-2 rounded small" 
                             style="max-height: 200px; overflow-y: auto; font-family: monospace;">
                            ${extractedText.length > 0 ? extractedText.join('<br>') : 'No OCR data available'}
                        </div>
                        
                        <hr class="border-secondary my-3">
                        
                        <div class="device-info">
                            <h6 class="text-info mb-2">
                                <i class="bi bi-display me-2"></i>Equipment
                            </h6>
                            <p class="small mb-1"><strong>Machine:</strong> ${device.machine || 'Unknown'}</p>
                            <p class="small mb-0"><strong>Facility:</strong> ${device.hospital || 'Unknown'}</p>
                        </div>
                    </div>
                    
                    <!-- Center Panel - Report Form -->
                    <div class="col-md-6 p-3 overflow-auto" style="max-height: calc(100vh - 60px);">
                        <form id="reportForm">
                            <!-- Patient Information -->
                            <div class="card bg-dark border-secondary mb-3">
                                <div class="card-header bg-primary bg-opacity-25 py-2">
                                    <h6 class="mb-0"><i class="bi bi-person me-2"></i>Patient Information</h6>
                                </div>
                                <div class="card-body">
                                    <div class="row g-3">
                                        <div class="col-md-6">
                                            <label class="form-label small">Patient Name *</label>
                                            <input type="text" class="form-control form-control-sm bg-dark text-light border-secondary" 
                                                   id="patientName" value="${this.reportData.patient_name}" required>
                                        </div>
                                        <div class="col-md-3">
                                            <label class="form-label small">Age</label>
                                            <input type="text" class="form-control form-control-sm bg-dark text-light border-secondary" 
                                                   id="patientAge" placeholder="e.g., 28 Years">
                                        </div>
                                        <div class="col-md-3">
                                            <label class="form-label small">Patient ID</label>
                                            <input type="text" class="form-control form-control-sm bg-dark text-light border-secondary" 
                                                   id="patientId" value="${this.reportData.patient_id}">
                                        </div>
                                        <div class="col-md-4">
                                            <label class="form-label small">Exam Date</label>
                                            <input type="date" class="form-control form-control-sm bg-dark text-light border-secondary" 
                                                   id="examDate" value="${this.reportData.exam_date}">
                                        </div>
                                        <div class="col-md-4">
                                            <label class="form-label small">LMP</label>
                                            <input type="date" class="form-control form-control-sm bg-dark text-light border-secondary" 
                                                   id="lmp">
                                        </div>
                                        <div class="col-md-4">
                                            <label class="form-label small">Referring Physician</label>
                                            <input type="text" class="form-control form-control-sm bg-dark text-light border-secondary" 
                                                   id="referringPhysician">
                                        </div>
                                        <div class="col-12">
                                            <label class="form-label small">Clinical History</label>
                                            <input type="text" class="form-control form-control-sm bg-dark text-light border-secondary" 
                                                   id="clinicalHistory" value="Routine antenatal scan">
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Fetal Biometry - AI Extracted -->
                            <div class="card bg-dark border-success mb-3">
                                <div class="card-header bg-success bg-opacity-25 py-2 d-flex justify-content-between align-items-center">
                                    <h6 class="mb-0"><i class="bi bi-rulers me-2"></i>Fetal Biometry (AI Extracted)</h6>
                                    <span class="badge bg-success">Auto-filled from AI</span>
                                </div>
                                <div class="card-body">
                                    <div class="row g-3">
                                        <div class="col-md-3">
                                            <label class="form-label small">BPD</label>
                                            <input type="text" class="form-control form-control-sm bg-dark text-light border-secondary biometry-input" 
                                                   id="bpdValue" value="${bpd.value || ''}" data-param="BPD">
                                            <small class="text-success">${bpd.ga ? 'GA: ' + bpd.ga : ''}</small>
                                        </div>
                                        <div class="col-md-3">
                                            <label class="form-label small">HC</label>
                                            <input type="text" class="form-control form-control-sm bg-dark text-light border-secondary biometry-input" 
                                                   id="hcValue" value="${hc.value || ''}" data-param="HC">
                                            <small class="text-success">${hc.ga ? 'GA: ' + hc.ga : ''}</small>
                                        </div>
                                        <div class="col-md-3">
                                            <label class="form-label small">AC</label>
                                            <input type="text" class="form-control form-control-sm bg-dark text-light border-secondary biometry-input" 
                                                   id="acValue" value="${ac.value || ''}" data-param="AC">
                                            <small class="text-success">${ac.ga ? 'GA: ' + ac.ga : ''}</small>
                                        </div>
                                        <div class="col-md-3">
                                            <label class="form-label small">FL</label>
                                            <input type="text" class="form-control form-control-sm bg-dark text-light border-secondary biometry-input" 
                                                   id="flValue" value="${fl.value || ''}" data-param="FL">
                                            <small class="text-success">${fl.ga ? 'GA: ' + fl.ga : ''}</small>
                                        </div>
                                        <div class="col-md-4">
                                            <label class="form-label small">EFW (Estimated Fetal Weight)</label>
                                            <input type="text" class="form-control form-control-sm bg-dark text-light border-secondary" 
                                                   id="efwValue" value="${efw.value || ''}">
                                            <small class="text-warning">${efw.sd || ''}</small>
                                        </div>
                                        <div class="col-md-4">
                                            <label class="form-label small">Average GA</label>
                                            <input type="text" class="form-control form-control-sm bg-dark text-light border-secondary" 
                                                   id="averageGa" value="${ga.value || ''}" readonly>
                                        </div>
                                        <div class="col-md-4">
                                            <label class="form-label small">EDD</label>
                                            <input type="text" class="form-control form-control-sm bg-dark text-light border-secondary" 
                                                   id="eddValue" value="${edd.value || ''}">
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Fetal Parameters -->
                            <div class="card bg-dark border-secondary mb-3">
                                <div class="card-header bg-secondary bg-opacity-25 py-2">
                                    <h6 class="mb-0"><i class="bi bi-heart-pulse me-2"></i>Fetal Parameters</h6>
                                </div>
                                <div class="card-body">
                                    <div class="row g-3">
                                        <div class="col-md-4">
                                            <label class="form-label small">Fetal Number</label>
                                            <select class="form-select form-select-sm bg-dark text-light border-secondary" id="fetalNumber">
                                                <option value="Single" selected>Single</option>
                                                <option value="Twin">Twin</option>
                                                <option value="Triplet">Triplet</option>
                                            </select>
                                        </div>
                                        <div class="col-md-4">
                                            <label class="form-label small">Presentation</label>
                                            <select class="form-select form-select-sm bg-dark text-light border-secondary" id="fetalPresentation">
                                                <option value="Cephalic" selected>Cephalic</option>
                                                <option value="Breech">Breech</option>
                                                <option value="Transverse">Transverse</option>
                                                <option value="Oblique">Oblique</option>
                                            </select>
                                        </div>
                                        <div class="col-md-4">
                                            <label class="form-label small">Fetal Heart</label>
                                            <select class="form-select form-select-sm bg-dark text-light border-secondary" id="fetalHeart">
                                                <option value="Present, regular" selected>Present, regular</option>
                                                <option value="Present, irregular">Present, irregular</option>
                                                <option value="Bradycardia">Bradycardia</option>
                                                <option value="Tachycardia">Tachycardia</option>
                                            </select>
                                        </div>
                                        <div class="col-md-4">
                                            <label class="form-label small">FHR (bpm)</label>
                                            <input type="text" class="form-control form-control-sm bg-dark text-light border-secondary" 
                                                   id="fhr" placeholder="e.g., 140">
                                        </div>
                                        <div class="col-md-4">
                                            <label class="form-label small">Fetal Movements</label>
                                            <select class="form-select form-select-sm bg-dark text-light border-secondary" id="fetalMovements">
                                                <option value="Present" selected>Present</option>
                                                <option value="Reduced">Reduced</option>
                                                <option value="Absent">Absent</option>
                                            </select>
                                        </div>
                                        <div class="col-md-4">
                                            <label class="form-label small">Position/Lie</label>
                                            <select class="form-select form-select-sm bg-dark text-light border-secondary" id="fetalPosition">
                                                <option value="Longitudinal" selected>Longitudinal</option>
                                                <option value="Transverse">Transverse</option>
                                                <option value="Oblique">Oblique</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Placenta & Liquor -->
                            <div class="card bg-dark border-secondary mb-3">
                                <div class="card-header bg-secondary bg-opacity-25 py-2">
                                    <h6 class="mb-0"><i class="bi bi-droplet me-2"></i>Placenta & Amniotic Fluid</h6>
                                </div>
                                <div class="card-body">
                                    <div class="row g-3">
                                        <div class="col-md-4">
                                            <label class="form-label small">Placenta Location</label>
                                            <select class="form-select form-select-sm bg-dark text-light border-secondary" id="placentaLocation">
                                                <option value="Fundal">Fundal</option>
                                                <option value="Anterior" selected>Anterior</option>
                                                <option value="Posterior">Posterior</option>
                                                <option value="Lateral">Lateral</option>
                                                <option value="Low lying">Low lying</option>
                                            </select>
                                        </div>
                                        <div class="col-md-4">
                                            <label class="form-label small">Grade</label>
                                            <select class="form-select form-select-sm bg-dark text-light border-secondary" id="placentaGrade">
                                                <option value="Grade 0">Grade 0</option>
                                                <option value="Grade I" selected>Grade I</option>
                                                <option value="Grade II">Grade II</option>
                                                <option value="Grade III">Grade III</option>
                                            </select>
                                        </div>
                                        <div class="col-md-4">
                                            <label class="form-label small">Previa</label>
                                            <select class="form-select form-select-sm bg-dark text-light border-secondary" id="placentaPrevia">
                                                <option value="Excluded" selected>Excluded</option>
                                                <option value="Marginal">Marginal</option>
                                                <option value="Complete">Complete</option>
                                            </select>
                                        </div>
                                        <div class="col-md-4">
                                            <label class="form-label small">Amniotic Fluid</label>
                                            <select class="form-select form-select-sm bg-dark text-light border-secondary" id="amnioticFluid">
                                                <option value="Adequate" selected>Adequate</option>
                                                <option value="Reduced">Reduced (Oligohydramnios)</option>
                                                <option value="Increased">Increased (Polyhydramnios)</option>
                                            </select>
                                        </div>
                                        <div class="col-md-4">
                                            <label class="form-label small">AFI (cm)</label>
                                            <input type="text" class="form-control form-control-sm bg-dark text-light border-secondary" 
                                                   id="afi" placeholder="e.g., 12">
                                        </div>
                                        <div class="col-md-4">
                                            <label class="form-label small">Cord Vessels</label>
                                            <select class="form-select form-select-sm bg-dark text-light border-secondary" id="cordVessels">
                                                <option value="Three vessel cord" selected>Three vessel cord</option>
                                                <option value="Two vessel cord">Two vessel cord (SUA)</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Impression -->
                            <div class="card bg-dark border-warning mb-3">
                                <div class="card-header bg-warning bg-opacity-25 py-2">
                                    <h6 class="mb-0"><i class="bi bi-clipboard-check me-2"></i>Impression</h6>
                                </div>
                                <div class="card-body">
                                    <textarea class="form-control bg-dark text-light border-secondary" id="impression" rows="5"
                                    >${this.generateDefaultImpression(biometry)}</textarea>
                                    <button type="button" class="btn btn-outline-info btn-sm mt-2" onclick="medicalReportGenerator.regenerateImpression()">
                                        <i class="bi bi-arrow-repeat me-1"></i>Regenerate from Data
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                    
                    <!-- Right Panel - Preview -->
                    <div class="col-md-3 border-start border-secondary p-0 d-flex flex-column" style="max-height: calc(100vh - 60px);">
                        <div class="p-2 bg-secondary bg-opacity-25 border-bottom border-secondary">
                            <h6 class="mb-0 text-center">
                                <i class="bi bi-file-earmark-text me-2"></i>Report Preview
                            </h6>
                        </div>
                        <div class="flex-grow-1 overflow-auto bg-white" id="reportPreviewPane">
                            <div class="p-3 text-dark text-center">
                                <i class="bi bi-arrow-left-circle text-muted" style="font-size: 2rem;"></i>
                                <p class="text-muted mt-2">Fill the form and click "Preview" to see the report</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Setup image selection click handlers
        this.setupImageSelectionHandlers();
    }

    /**
     * Render image selection grid
     */
    renderImageSelection() {
        if (this.allImages.length === 0) {
            return '<p class="text-muted small">No images available</p>';
        }

        return this.allImages.map((img, idx) => {
            const imgNum = img.image_number || (idx + 1);
            const measurementType = img.biometry?.measurement_type || '';
            const isSelected = this.selectedImage === idx;
            
            return `
                <div class="image-selection-item ${isSelected ? 'selected' : ''}" 
                     data-image-index="${idx}"
                     style="border: 2px solid ${isSelected ? '#0d6efd' : '#444'}; 
                            border-radius: 8px; 
                            padding: 8px; 
                            margin-bottom: 8px; 
                            cursor: pointer;
                            background: ${isSelected ? 'rgba(13, 110, 253, 0.1)' : 'transparent'};">
                    <div class="d-flex justify-content-between align-items-center">
                        <span class="badge bg-secondary">Image ${imgNum}</span>
                        ${measurementType ? `<span class="badge bg-primary">${measurementType}</span>` : ''}
                    </div>
                    <div class="small text-muted mt-1">
                        ${(img.extracted_text || []).slice(0, 3).join(', ').substring(0, 50)}...
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Setup click handlers for image selection
     */
    setupImageSelectionHandlers() {
        const grid = document.getElementById('imageSelectionGrid');
        if (!grid) return;

        grid.addEventListener('click', (e) => {
            const item = e.target.closest('.image-selection-item');
            if (item) {
                const idx = parseInt(item.dataset.imageIndex);
                this.selectImage(idx);
            }
        });
    }

    /**
     * Select an image and update biometry
     */
    selectImage(index) {
        this.selectedImage = index;
        const image = this.allImages[index];
        
        if (image && image.biometry) {
            // Update form fields with this image's biometry
            const biometry = image.biometry;
            
            if (biometry.measurement_type === 'FL' || biometry.fl) {
                document.getElementById('flValue').value = biometry.value_cm || biometry.fl?.value || '';
            }
            if (biometry.measurement_type === 'AC' || biometry.ac) {
                document.getElementById('acValue').value = biometry.value_cm || biometry.ac?.value || '';
            }
            if (biometry.measurement_type === 'BPD' || biometry.bpd) {
                document.getElementById('bpdValue').value = biometry.value_cm || biometry.bpd?.value || '';
            }
            if (biometry.measurement_type === 'HC' || biometry.hc) {
                document.getElementById('hcValue').value = biometry.value_cm || biometry.hc?.value || '';
            }
        }

        // Update visual selection
        document.querySelectorAll('.image-selection-item').forEach((el, i) => {
            el.style.borderColor = i === index ? '#0d6efd' : '#444';
            el.style.background = i === index ? 'rgba(13, 110, 253, 0.1)' : 'transparent';
            el.classList.toggle('selected', i === index);
        });
    }

    /**
     * Generate default impression from biometry
     */
    generateDefaultImpression(biometry) {
        const lines = [];
        
        lines.push('Single live intrauterine pregnancy.');
        
        if (biometry.GA?.value) {
            lines.push(`Gestational age by biometry: ${biometry.GA.value}.`);
        }
        
        if (biometry.EFW?.value) {
            lines.push(`Estimated fetal weight: ${biometry.EFW.value}${biometry.EFW.sd ? ' ' + biometry.EFW.sd : ''}.`);
        }
        
        if (biometry.EDD?.value) {
            lines.push(`Expected date of delivery: ${biometry.EDD.value}.`);
        }
        
        lines.push('No gross fetal anomaly detected.');
        lines.push('Adequate liquor.');
        lines.push('Normal placentation.');
        
        return lines.join('\n');
    }

    /**
     * Regenerate impression from current form data
     */
    regenerateImpression() {
        const impression = [];
        
        const fetalNumber = document.getElementById('fetalNumber')?.value || 'Single';
        impression.push(`${fetalNumber} live intrauterine pregnancy.`);
        
        const avgGa = document.getElementById('averageGa')?.value;
        if (avgGa) {
            impression.push(`Gestational age by biometry: ${avgGa}.`);
        }
        
        const efw = document.getElementById('efwValue')?.value;
        if (efw) {
            impression.push(`Estimated fetal weight: ${efw}.`);
        }
        
        const edd = document.getElementById('eddValue')?.value;
        if (edd) {
            impression.push(`Expected date of delivery: ${edd}.`);
        }
        
        const presentation = document.getElementById('fetalPresentation')?.value;
        if (presentation) {
            impression.push(`Fetal presentation: ${presentation}.`);
        }
        
        const amnioticFluid = document.getElementById('amnioticFluid')?.value;
        if (amnioticFluid === 'Adequate') {
            impression.push('Adequate liquor.');
        } else {
            impression.push(`Amniotic fluid: ${amnioticFluid}.`);
        }
        
        const placentaPrevia = document.getElementById('placentaPrevia')?.value;
        if (placentaPrevia === 'Excluded') {
            impression.push('Normal placentation.');
        } else {
            impression.push(`Placenta previa: ${placentaPrevia}.`);
        }
        
        impression.push('No gross fetal anomaly detected on present scan.');
        
        document.getElementById('impression').value = impression.join('\n');
    }

    /**
     * Collect form data
     */
    collectFormData() {
        return {
            study_uid: this.reportData.study_uid,
            ai_analysis_id: this.reportData.analysis_id,
            patient_name: document.getElementById('patientName')?.value || '',
            patient_age: document.getElementById('patientAge')?.value || '',
            patient_id: document.getElementById('patientId')?.value || '',
            exam_date: document.getElementById('examDate')?.value || '',
            lmp: document.getElementById('lmp')?.value || '',
            referring_physician: document.getElementById('referringPhysician')?.value || '',
            clinical_history: document.getElementById('clinicalHistory')?.value || '',
            
            biometry: {
                BPD: { value: document.getElementById('bpdValue')?.value || '' },
                HC: { value: document.getElementById('hcValue')?.value || '' },
                AC: { value: document.getElementById('acValue')?.value || '' },
                FL: { value: document.getElementById('flValue')?.value || '' },
                EFW: { value: document.getElementById('efwValue')?.value || '' },
                GA: { value: document.getElementById('averageGa')?.value || '' },
                EDD: { value: document.getElementById('eddValue')?.value || '' }
            },
            
            fetal_number: document.getElementById('fetalNumber')?.value || '',
            fetal_presentation: document.getElementById('fetalPresentation')?.value || '',
            fetal_heart: document.getElementById('fetalHeart')?.value || '',
            fhr: document.getElementById('fhr')?.value || '',
            fetal_movements: document.getElementById('fetalMovements')?.value || '',
            fetal_position: document.getElementById('fetalPosition')?.value || '',
            
            placenta_location: document.getElementById('placentaLocation')?.value || '',
            placenta_grade: document.getElementById('placentaGrade')?.value || '',
            placenta_previa: document.getElementById('placentaPrevia')?.value || '',
            amniotic_fluid: document.getElementById('amnioticFluid')?.value || '',
            afi: document.getElementById('afi')?.value || '',
            cord_vessels: document.getElementById('cordVessels')?.value || '',
            
            impression: document.getElementById('impression')?.value || '',
            
            selected_image_id: this.selectedImage
        };
    }

    /**
     * Preview the report
     */
    async previewReport() {
        const formData = this.collectFormData();
        const basePath = document.querySelector('meta[name="base-path"]')?.content || '';
        
        try {
            const response = await fetch(`${basePath}/api/reports/generate-obstetric-report.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            
            const data = await response.json();
            
            if (data.success) {
                const previewPane = document.getElementById('reportPreviewPane');
                previewPane.innerHTML = data.data.report_html;
                previewPane.querySelector('.report-container')?.classList.add('p-3');
            } else {
                throw new Error(data.error);
            }
        } catch (e) {
            console.error('Preview error:', e);
            alert('Failed to generate preview: ' + e.message);
        }
    }

    /**
     * Save report to database
     */
    async saveReport(status = 'draft') {
        const formData = this.collectFormData();
        formData.status = status;
        
        const basePath = document.querySelector('meta[name="base-path"]')?.content || '';
        
        try {
            // First generate the report
            const genResponse = await fetch(`${basePath}/api/reports/generate-obstetric-report.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            
            const genData = await genResponse.json();
            
            if (!genData.success) {
                throw new Error(genData.error);
            }
            
            // Then save to database
            const savePayload = {
                study_uid: formData.study_uid,
                patient_id: formData.patient_id,
                patient_name: formData.patient_name,
                template_name: 'Obstetric USG',
                title: 'Obstetric Ultrasound Report',
                indication: formData.clinical_history,
                technique: 'Real-time transabdominal obstetric ultrasound',
                findings: JSON.stringify({
                    biometry: formData.biometry,
                    fetal_parameters: {
                        number: formData.fetal_number,
                        presentation: formData.fetal_presentation,
                        heart: formData.fetal_heart,
                        fhr: formData.fhr,
                        movements: formData.fetal_movements
                    },
                    placenta: {
                        location: formData.placenta_location,
                        grade: formData.placenta_grade,
                        previa: formData.placenta_previa
                    },
                    amniotic_fluid: {
                        status: formData.amniotic_fluid,
                        afi: formData.afi
                    }
                }),
                impression: formData.impression,
                status: status
            };
            
            const saveResponse = await fetch(`${basePath}/api/reports/create.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(savePayload)
            });
            
            const saveData = await saveResponse.json();
            
            if (saveData.success) {
                alert(`Report saved successfully as ${status}!`);
                if (window.checkReportExistence) {
                    window.checkReportExistence();
                }
            } else {
                throw new Error(saveData.error);
            }
        } catch (e) {
            console.error('Save error:', e);
            alert('Failed to save report: ' + e.message);
        }
    }

    /**
     * Print the report
     */
    async printReport() {
        const formData = this.collectFormData();
        const basePath = document.querySelector('meta[name="base-path"]')?.content || '';
        
        try {
            const response = await fetch(`${basePath}/api/reports/generate-obstetric-report.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Open print window
                const printWindow = window.open('', '_blank');
                printWindow.document.write(data.data.report_html);
                printWindow.document.close();
                
                printWindow.onload = function() {
                    printWindow.print();
                };
            } else {
                throw new Error(data.error);
            }
        } catch (e) {
            console.error('Print error:', e);
            alert('Failed to print report: ' + e.message);
        }
    }
}

// Initialize global instance
window.medicalReportGenerator = new MedicalReportGenerator();

// Integration with AI Assistant
document.addEventListener('DOMContentLoaded', () => {
    // Override AI analysis completion to offer report generation
    const originalDisplayResults = window.aiAssistant?.displayStudyResults;
    if (window.aiAssistant && originalDisplayResults) {
        window.aiAssistant.displayStudyResults = function(data) {
            originalDisplayResults.call(this, data);
            
            // Add "Generate Report" button
            const modalBody = document.getElementById('aiModalBody');
            if (modalBody) {
                const generateBtn = document.createElement('div');
                generateBtn.className = 'mt-3 text-center';
                generateBtn.innerHTML = `
                    <button class="btn btn-lg btn-success" id="generateReportFromAI">
                        <i class="bi bi-file-medical me-2"></i>
                        Generate Medical Report from This Analysis
                    </button>
                `;
                modalBody.appendChild(generateBtn);
                
                document.getElementById('generateReportFromAI')?.addEventListener('click', () => {
                    // Close AI modal
                    const aiModal = bootstrap.Modal.getInstance(document.getElementById('aiAnalysisModal'));
                    if (aiModal) aiModal.hide();
                    
                    // Open report generator with AI data
                    setTimeout(() => {
                        window.medicalReportGenerator.openWithAIAnalysis(data, {
                            studyUID: new URLSearchParams(window.location.search).get('studyUID'),
                            patientName: data.patient_name
                        });
                    }, 300);
                });
            }
        };
    }
});

console.log('Medical Report Generator module loaded');
