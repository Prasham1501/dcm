/**
 * Enhanced AI Integration for DICOM Viewer
 * Supports full study analysis with all images
 * Specialized for Obstetric USG biometry extraction
 * Version 2.0 - Study Analysis
 */

class AIAssistant {
    constructor() {
        this.modal = null;
        this.isAnalyzing = false;
        this.currentAnalysisId = null;
        this.lastAnalysisResult = null;
        this.init();
    }

    init() {
        this.createModal();
        this.addAIButton();
        this.setupKeyboardShortcuts();
        console.log('AI Assistant initialized (Enhanced Study Analysis v2.0)');
    }

    addAIButton() {
        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn && settingsBtn.parentElement) {
            const container = settingsBtn.parentElement;

            // Remove any existing AI button
            const existingBtn = container.querySelector('.ai-analyze-btn');
            if (existingBtn) existingBtn.remove();

            const btn = document.createElement('button');
            btn.className = 'btn btn-primary ai-analyze-btn';
            btn.innerHTML = '<i class="bi bi-robot me-2"></i>AI Analysis';
            btn.onclick = () => this.startStudyAnalysis();

            container.insertBefore(btn, settingsBtn);
        }
    }

    createModal() {
        // Remove existing modal if present
        const existing = document.getElementById('aiAnalysisModal');
        if (existing) existing.remove();

        const modalHtml = `
            <div class="modal fade" id="aiAnalysisModal" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-xl modal-dialog-scrollable">
                    <div class="modal-content bg-dark text-light">
                        <div class="modal-header border-secondary">
                            <h5 class="modal-title">
                                <i class="bi bi-robot me-2 text-primary"></i>
                                AI Diagnostic Assistant - Study Analysis
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body" id="aiModalBody">
                            <!-- Content will be injected here -->
                        </div>
                        <div class="modal-footer border-secondary">
                            <div class="me-auto text-muted small">
                                Powered by Gemini AI • For investigational use only
                            </div>
                            <button type="button" class="btn btn-outline-info" onclick="aiAssistant.copyReport()">
                                <i class="bi bi-clipboard"></i> Copy Report
                            </button>
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                            <button type="button" class="btn btn-primary" onclick="aiAssistant.printReport()">
                                <i class="bi bi-printer"></i> Print Report
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        this.modal = new bootstrap.Modal(document.getElementById('aiAnalysisModal'));
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'A') {
                e.preventDefault();
                this.startStudyAnalysis();
            }
        });
    }

    /**
     * Get study information from URL parameters
     */
    getStudyInfo() {
        const urlParams = new URLSearchParams(window.location.search);
        return {
            study_id: urlParams.get('study_id'),
            studyUID: urlParams.get('studyUID')
        };
    }

    /**
     * Start comprehensive study analysis
     */
    async startStudyAnalysis() {
        if (this.isAnalyzing) {
            console.log('Analysis already in progress');
            return;
        }

        const studyInfo = this.getStudyInfo();
        
        if (!studyInfo.study_id && !studyInfo.studyUID) {
            this.showError('No study loaded. Please select a study from the dashboard first.');
            this.modal.show();
            return;
        }

        this.isAnalyzing = true;
        this.showLoading('Fetching study images from PACS...');
        this.modal.show();

        try {
            const basePath = document.querySelector('meta[name="base-path"]')?.content || '';
            
            const payload = {
                study_id: studyInfo.study_id,
                study_uid: studyInfo.studyUID,
                analysis_type: 'USG',
                body_region: 'obstetric',
                max_images: 10  // Limit for API cost control
            };

            console.log('Sending study analysis request:', payload);
            this.showLoading('Analyzing images with AI (this may take a moment)...');

            const response = await fetch(`${basePath}/ai/analyze_study.php`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            console.log('AI Analysis response:', data);

            if (!data.success) {
                throw new Error(data.error || 'Analysis failed');
            }

            this.lastAnalysisResult = data.data;
            this.currentAnalysisId = data.data.analysis_id;
            this.displayStudyResults(data.data);

        } catch (error) {
            console.error('AI Analysis error:', error);
            this.showError(error.message);
        } finally {
            this.isAnalyzing = false;
        }
    }

    showLoading(message = 'Analyzing Study...') {
        const modalBody = document.getElementById('aiModalBody');
        modalBody.innerHTML = `
            <div class="text-center py-5">
                <div class="spinner-border text-primary mb-3" role="status" style="width: 3rem; height: 3rem;">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <h5 class="text-light">${message}</h5>
                <p class="text-muted">Extracting measurements and analyzing fetal biometry</p>
                <div class="progress mt-3" style="height: 5px;">
                    <div class="progress-bar progress-bar-striped progress-bar-animated bg-primary" role="progressbar" style="width: 100%"></div>
                </div>
            </div>
        `;
    }

    showError(message) {
        const modalBody = document.getElementById('aiModalBody');
        modalBody.innerHTML = `
            <div class="text-center py-5">
                <div class="text-danger mb-3">
                    <i class="bi bi-exclamation-triangle-fill" style="font-size: 3rem;"></i>
                </div>
                <h5 class="text-light">Analysis Failed</h5>
                <p class="text-danger">${message}</p>
                <button class="btn btn-outline-primary mt-3" onclick="aiAssistant.startStudyAnalysis()">
                    <i class="bi bi-arrow-clockwise me-2"></i>Try Again
                </button>
            </div>
        `;
    }

    /**
     * Display comprehensive study analysis results
     */
    displayStudyResults(data) {
        const modalBody = document.getElementById('aiModalBody');
        
        console.log('Displaying results:', data);
        
        // Build biometry table
        let biometryHtml = this.buildBiometryTable(data);
        
        // Build device info
        let deviceHtml = this.buildDeviceInfo(data);
        
        // Build findings
        let findingsHtml = this.buildFindings(data);
        
        // Build per-image breakdown
        let imagesHtml = this.buildImageBreakdown(data);

        modalBody.innerHTML = `
            <div class="container-fluid px-0">
                <!-- Header Info -->
                <div class="row mb-3">
                    <div class="col-md-6">
                        <span class="badge bg-primary me-1">${data.analysis_type || 'USG'}</span>
                        <span class="badge bg-info me-1">${data.images_analyzed || 0} images analyzed</span>
                        <span class="badge bg-${(data.confidence || 0) >= 0.8 ? 'success' : 'warning'}">
                            Confidence: ${Math.round((data.confidence || 0) * 100)}%
                        </span>
                    </div>
                    <div class="col-md-6 text-end text-muted small">
                        <span class="me-2">Analysis ID: ${data.analysis_id}</span>
                        <span>Time: ${data.processing_time_ms}ms</span>
                    </div>
                </div>

                <!-- Patient Info -->
                ${data.patient_name ? `
                    <div class="alert alert-secondary py-2 mb-3">
                        <i class="bi bi-person-fill me-2"></i>
                        <strong>Patient:</strong> ${data.patient_name}
                    </div>
                ` : ''}

                <!-- Main Content Tabs -->
                <ul class="nav nav-tabs mb-3" id="aiResultTabs" role="tablist">
                    <li class="nav-item" role="presentation">
                        <button class="nav-link active" id="biometry-tab" data-bs-toggle="tab" data-bs-target="#biometry" type="button">
                            <i class="bi bi-rulers me-1"></i>Biometry
                        </button>
                    </li>
                    <li class="nav-item" role="presentation">
                        <button class="nav-link" id="findings-tab" data-bs-toggle="tab" data-bs-target="#findings" type="button">
                            <i class="bi bi-search me-1"></i>Findings
                        </button>
                    </li>
                    <li class="nav-item" role="presentation">
                        <button class="nav-link" id="images-tab" data-bs-toggle="tab" data-bs-target="#images" type="button">
                            <i class="bi bi-images me-1"></i>Per-Image Details
                        </button>
                    </li>
                    <li class="nav-item" role="presentation">
                        <button class="nav-link" id="device-tab" data-bs-toggle="tab" data-bs-target="#device" type="button">
                            <i class="bi bi-gear me-1"></i>Device Info
                        </button>
                    </li>
                </ul>
                
                <div class="tab-content" id="aiResultTabsContent">
                    <!-- Biometry Tab -->
                    <div class="tab-pane fade show active" id="biometry" role="tabpanel">
                        ${biometryHtml}
                    </div>
                    
                    <!-- Findings Tab -->
                    <div class="tab-pane fade" id="findings" role="tabpanel">
                        ${findingsHtml}
                    </div>
                    
                    <!-- Images Tab -->
                    <div class="tab-pane fade" id="images" role="tabpanel">
                        ${imagesHtml}
                    </div>
                    
                    <!-- Device Tab -->
                    <div class="tab-pane fade" id="device" role="tabpanel">
                        ${deviceHtml}
                    </div>
                </div>

                <!-- Impression -->
                ${data.impression ? `
                    <div class="mt-4 p-3 bg-primary bg-opacity-10 rounded border border-primary">
                        <h6 class="text-primary mb-2"><i class="bi bi-clipboard-check me-2"></i>Impression</h6>
                        <p class="mb-0">${data.impression}</p>
                    </div>
                ` : ''}

                <!-- Recommendations -->
                ${data.recommendations && data.recommendations.length > 0 ? `
                    <div class="mt-3 p-3 bg-info bg-opacity-10 rounded border border-info">
                        <h6 class="text-info mb-2"><i class="bi bi-lightbulb me-2"></i>Recommendations</h6>
                        <ul class="mb-0 ps-3">
                            ${data.recommendations.map(r => `<li>${r}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}

                <!-- Feedback -->
                <div class="mt-4 pt-3 border-top border-secondary">
                    <div class="d-flex justify-content-between align-items-center">
                        <span class="text-muted small">Was this analysis helpful?</span>
                        <div class="btn-group" id="feedbackButtons">
                            <button class="btn btn-outline-success btn-sm" onclick="aiAssistant.submitFeedback('thumbs_up')">
                                <i class="bi bi-hand-thumbs-up"></i> Yes
                            </button>
                            <button class="btn btn-outline-danger btn-sm" onclick="aiAssistant.submitFeedback('thumbs_down')">
                                <i class="bi bi-hand-thumbs-down"></i> No
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Disclaimer -->
                <div class="alert alert-warning mt-3 py-2">
                    <small>
                        <i class="bi bi-exclamation-triangle me-1"></i>
                        <strong>Disclaimer:</strong> This is an AI-assisted preliminary analysis. 
                        All findings must be reviewed and confirmed by a qualified physician.
                    </small>
                </div>
            </div>
        `;
    }

    /**
     * Build fetal biometry table
     */
    buildBiometryTable(data) {
        const measurements = data.measurements || [];
        const biometry = data.consolidated_biometry || data.biometry || {};
        
        console.log('Building biometry table with:', { measurements, biometry });
        
        if (measurements.length === 0 && Object.keys(biometry).length === 0) {
            return `
                <div class="alert alert-info">
                    <i class="bi bi-info-circle me-2"></i>
                    No biometry measurements were detected in this study.
                </div>
            `;
        }

        let rows = '';
        
        // Build from consolidated biometry
        const biometryOrder = ['FL', 'AC', 'BPD', 'HC', 'CRL', 'EFW', 'GA', 'EDD'];
        const biometryLabels = {
            'FL': 'Femur Length',
            'AC': 'Abdominal Circumference',
            'BPD': 'Biparietal Diameter',
            'HC': 'Head Circumference',
            'CRL': 'Crown-Rump Length',
            'EFW': 'Estimated Fetal Weight',
            'GA': 'Gestational Age',
            'EDD': 'Estimated Due Date'
        };

        for (const key of biometryOrder) {
            const info = biometry[key];
            if (info && info.value) {
                const label = biometryLabels[key] || key;
                const percentile = info.percentile ? `<span class="badge bg-info">${info.percentile}</span>` : '';
                const ga = info.ga ? `<span class="text-muted small">(GA: ${info.ga})</span>` : '';
                const edd = info.edd ? `<span class="text-success small">${info.edd}</span>` : '';
                const sd = info.sd ? `<span class="text-warning small">${info.sd}</span>` : '';
                
                rows += `
                    <tr>
                        <td><strong>${key}</strong><br><small class="text-muted">${label}</small></td>
                        <td class="text-end fs-5">${info.value}</td>
                        <td class="text-center">${percentile}</td>
                        <td>${ga} ${edd} ${sd}</td>
                    </tr>
                `;
            }
        }

        // Also add from measurements array if not already included
        const addedKeys = new Set(biometryOrder.filter(k => biometry[k]?.value));
        for (const m of measurements) {
            const key = m.structure || m.type;
            if (!addedKeys.has(key)) {
                const ga = m.ga ? `<span class="text-muted small">(GA: ${m.ga})</span>` : '';
                const percentile = m.percentile ? `<span class="badge bg-info">${m.percentile}</span>` : '';
                const edd = m.edd ? `<span class="text-success small">${m.edd}</span>` : '';
                
                rows += `
                    <tr>
                        <td><strong>${key}</strong></td>
                        <td class="text-end fs-5">${m.value} ${m.unit || ''}</td>
                        <td class="text-center">${percentile}</td>
                        <td>${ga} ${edd}</td>
                    </tr>
                `;
                addedKeys.add(key);
            }
        }

        if (!rows) {
            return `
                <div class="alert alert-info">
                    <i class="bi bi-info-circle me-2"></i>
                    No structured measurements could be extracted. Check the Per-Image Details tab for raw OCR data.
                </div>
            `;
        }

        return `
            <div class="table-responsive">
                <table class="table table-dark table-hover">
                    <thead>
                        <tr class="table-primary">
                            <th style="width: 30%">Measurement</th>
                            <th style="width: 20%" class="text-end">Value</th>
                            <th style="width: 15%" class="text-center">Percentile</th>
                            <th style="width: 35%">Details</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
            
            <div class="mt-3 p-2 bg-secondary bg-opacity-25 rounded small">
                <strong>Legend:</strong>
                FL = Femur Length, AC = Abdominal Circumference, BPD = Biparietal Diameter,
                HC = Head Circumference, EFW = Estimated Fetal Weight, GA = Gestational Age,
                EDD = Estimated Due Date
            </div>
        `;
    }

    /**
     * Build device info section
     */
    buildDeviceInfo(data) {
        const device = data.device_metadata || {};
        const extracted = data.extracted_text || [];
        
        return `
            <div class="row">
                <div class="col-md-6">
                    <div class="card bg-dark border-secondary mb-3">
                        <div class="card-header bg-secondary bg-opacity-25">
                            <i class="bi bi-display me-2"></i>Equipment Information
                        </div>
                        <div class="card-body">
                            <dl class="row mb-0">
                                <dt class="col-sm-4">Machine</dt>
                                <dd class="col-sm-8">${device.machine || 'Unknown'}</dd>
                                
                                <dt class="col-sm-4">Facility</dt>
                                <dd class="col-sm-8">${device.hospital || device.facility || 'Unknown'}</dd>
                                
                                ${device.settings && device.settings.length > 0 ? `
                                    <dt class="col-sm-4">Settings</dt>
                                    <dd class="col-sm-8">
                                        <div class="d-flex flex-wrap gap-1">
                                            ${device.settings.map(s => `<span class="badge bg-secondary">${s}</span>`).join('')}
                                        </div>
                                    </dd>
                                ` : ''}
                            </dl>
                        </div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card bg-dark border-secondary mb-3">
                        <div class="card-header bg-secondary bg-opacity-25">
                            <i class="bi bi-card-text me-2"></i>Extracted Text (OCR)
                        </div>
                        <div class="card-body">
                            ${extracted.length > 0 ? `
                                <div class="bg-black p-2 rounded" style="max-height: 200px; overflow-y: auto; font-family: monospace; font-size: 0.8rem;">
                                    ${extracted.join('<br>')}
                                </div>
                            ` : '<p class="text-muted mb-0">No text extracted</p>'}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Build findings section
     */
    buildFindings(data) {
        const findings = data.findings || [];
        
        if (findings.length === 0) {
            return `
                <div class="alert alert-info">
                    <i class="bi bi-info-circle me-2"></i>
                    No specific clinical findings were detected.
                </div>
            `;
        }

        return `
            <div class="list-group list-group-flush">
                ${findings.map(f => {
                    const desc = typeof f === 'string' ? f : (f.description || 'Finding');
                    const conf = typeof f === 'object' && f.confidence ? Math.round(f.confidence * 100) : null;
                    
                    return `
                        <div class="list-group-item bg-dark border-secondary">
                            <div class="d-flex justify-content-between align-items-center">
                                <span>
                                    <i class="bi bi-circle-fill text-info me-2" style="font-size: 0.5rem;"></i>
                                    ${desc}
                                </span>
                                ${conf ? `<span class="badge bg-secondary">${conf}% confidence</span>` : ''}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    /**
     * Build per-image breakdown
     */
    buildImageBreakdown(data) {
        const imageAnalyses = data.image_analyses || [];
        
        if (imageAnalyses.length === 0) {
            return `
                <div class="alert alert-info">
                    <i class="bi bi-info-circle me-2"></i>
                    No per-image analysis data available.
                </div>
            `;
        }

        return `
            <div class="accordion" id="imageAccordion">
                ${imageAnalyses.map((img, idx) => {
                    const imgNum = img.image_number || (idx + 1);
                    const texts = img.extracted_text || [];
                    const biometry = img.biometry || img.patient_metrics || {};
                    const measurementType = biometry.measurement_type || '';
                    
                    return `
                        <div class="accordion-item bg-dark">
                            <h2 class="accordion-header" id="heading${idx}">
                                <button class="accordion-button ${idx > 0 ? 'collapsed' : ''} bg-dark text-light" type="button" 
                                        data-bs-toggle="collapse" data-bs-target="#collapse${idx}">
                                    <i class="bi bi-image me-2"></i>
                                    Image ${imgNum}
                                    ${measurementType ? `<span class="badge bg-primary ms-2">${measurementType}</span>` : ''}
                                </button>
                            </h2>
                            <div id="collapse${idx}" class="accordion-collapse collapse ${idx === 0 ? 'show' : ''}" 
                                 data-bs-parent="#imageAccordion">
                                <div class="accordion-body">
                                    <div class="row">
                                        <div class="col-md-6">
                                            <h6 class="text-primary">Extracted Text</h6>
                                            <div class="bg-black p-2 rounded small" style="max-height: 150px; overflow-y: auto;">
                                                ${texts.length > 0 ? texts.join('<br>') : 'No text extracted'}
                                            </div>
                                        </div>
                                        <div class="col-md-6">
                                            <h6 class="text-primary">Measurements</h6>
                                            ${Object.keys(biometry).length > 0 ? `
                                                <ul class="list-unstyled small">
                                                    ${Object.entries(biometry).map(([k, v]) => {
                                                        if (typeof v === 'object' && v !== null) {
                                                            return `<li><strong>${k}:</strong> ${JSON.stringify(v)}</li>`;
                                                        }
                                                        return `<li><strong>${k}:</strong> ${v}</li>`;
                                                    }).join('')}
                                                </ul>
                                            ` : '<p class="text-muted small">No measurements</p>'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    /**
     * Submit feedback
     */
    async submitFeedback(type) {
        if (!this.currentAnalysisId) return;

        const basePath = document.querySelector('meta[name="base-path"]')?.content || '';

        try {
            const response = await fetch(`${basePath}/ai/feedback.php`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    analysis_id: this.currentAnalysisId,
                    feedback_type: type
                })
            });

            const data = await response.json();

            if (data.success) {
                const btnGroup = document.getElementById('feedbackButtons');
                if (btnGroup) {
                    btnGroup.innerHTML = '<span class="text-success"><i class="bi bi-check-lg me-1"></i>Thank you for your feedback!</span>';
                }
            }
        } catch (e) {
            console.error('Feedback error:', e);
        }
    }

    /**
     * Copy report to clipboard
     */
    copyReport() {
        if (this.lastAnalysisResult && this.lastAnalysisResult.generated_report) {
            navigator.clipboard.writeText(this.lastAnalysisResult.generated_report)
                .then(() => {
                    alert('Report copied to clipboard!');
                })
                .catch(err => {
                    console.error('Copy failed:', err);
                });
        }
    }

    /**
     * Print report
     */
    printReport() {
        window.print();
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Remove any existing instance
    if (window.aiAssistant) {
        console.log('Reinitializing AI Assistant');
    }
    window.aiAssistant = new AIAssistant();
});

// Also initialize on script load if DOM is already ready
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(() => {
        if (!window.aiAssistant) {
            window.aiAssistant = new AIAssistant();
        }
    }, 100);
}

console.log('AI Integration Script v2.0 loaded');
