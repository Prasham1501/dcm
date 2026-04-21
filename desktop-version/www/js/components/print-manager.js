/**
 * Modern DICOM Print Manager v2.1
 * Professional medical imaging printing with proper multi-image support
 * FIXED: Now properly loads and captures each individual study image
 */

window.DICOM_VIEWER = window.DICOM_VIEWER || {};

window.DICOM_VIEWER.PrintManager = class {
    constructor() {
        this.settings = {
            printRange: 'current',
            layout: '2x2',
            orientation: 'landscape',
            paperSize: 'A4',
            includePatientInfo: true,
            includeAnnotations: true,
            includeWindowLevel: true,
            includeScalebar: false,
            quality: 'high',
            colorMode: 'grayscale',
            margins: 'normal',
            headerStyle: 'full'
        };
        this.setupPrintButton();
    }

    setupPrintButton() {
        const printBtn = document.getElementById('printBtn');
        if (printBtn) {
            printBtn.addEventListener('click', () => this.showPrintDialog());
        }
    }

    showPrintDialog() {
        const state = window.DICOM_VIEWER.STATE;

        if (!state.currentSeriesImages || state.currentSeriesImages.length === 0) {
            this.showToast('No images loaded to print', 'warning');
            return;
        }

        // Remove existing modal if present
        const existingModal = document.getElementById('printDialog');
        if (existingModal) existingModal.remove();

        const totalImages = state.currentSeriesImages.length;
        const currentImage = (state.currentImageIndex || 0) + 1;

        // Create enhanced print dialog modal
        const modalHTML = `
            <div class="modal fade" id="printDialog" tabindex="-1" data-bs-backdrop="static">
                <div class="modal-dialog modal-lg modal-dialog-centered">
                    <div class="modal-content bg-dark text-light border-secondary">
                        <div class="modal-header border-secondary bg-gradient" style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);">
                            <div class="d-flex align-items-center">
                                <div class="print-icon-container me-3">
                                    <i class="bi bi-printer-fill fs-3 text-primary"></i>
                                </div>
                                <div>
                                    <h5 class="modal-title mb-0">Print DICOM Images</h5>
                                    <small class="text-muted">Configure print settings for medical imaging output</small>
                                </div>
                            </div>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        
                        <div class="modal-body p-0">
                            <div class="row g-0">
                                <!-- Left Panel - Settings -->
                                <div class="col-md-7 p-4 border-end border-secondary">
                                    <!-- Print Range Section -->
                                    <div class="settings-section mb-4">
                                        <h6 class="settings-title text-primary mb-3">
                                            <i class="bi bi-images me-2"></i>Print Range
                                        </h6>
                                        <div class="row g-2">
                                            <div class="col-6">
                                                <div class="form-check print-option-card ${this.settings.printRange === 'current' ? 'active' : ''}">
                                                    <input class="form-check-input" type="radio" name="printRange" id="printCurrent" value="current" ${this.settings.printRange === 'current' ? 'checked' : ''}>
                                                    <label class="form-check-label w-100" for="printCurrent">
                                                        <i class="bi bi-file-image fs-4 d-block mb-1 text-info"></i>
                                                        <span class="fw-semibold">Current Image</span>
                                                        <small class="d-block text-muted">Image ${currentImage} of ${totalImages}</small>
                                                    </label>
                                                </div>
                                            </div>
                                            <div class="col-6">
                                                <div class="form-check print-option-card ${this.settings.printRange === 'all' ? 'active' : ''}">
                                                    <input class="form-check-input" type="radio" name="printRange" id="printAll" value="all" ${this.settings.printRange === 'all' ? 'checked' : ''}>
                                                    <label class="form-check-label w-100" for="printAll">
                                                        <i class="bi bi-collection fs-4 d-block mb-1 text-success"></i>
                                                        <span class="fw-semibold">All Images</span>
                                                        <small class="d-block text-muted">${totalImages} images in study</small>
                                                    </label>
                                                </div>
                                            </div>
                                            <div class="col-6">
                                                <div class="form-check print-option-card ${this.settings.printRange === 'range' ? 'active' : ''}">
                                                    <input class="form-check-input" type="radio" name="printRange" id="printRange" value="range" ${this.settings.printRange === 'range' ? 'checked' : ''}>
                                                    <label class="form-check-label w-100" for="printRange">
                                                        <i class="bi bi-ui-checks fs-4 d-block mb-1 text-warning"></i>
                                                        <span class="fw-semibold">Custom Range</span>
                                                        <small class="d-block text-muted">Select specific images</small>
                                                    </label>
                                                </div>
                                            </div>
                                            <div class="col-6">
                                                <div class="form-check print-option-card ${this.settings.printRange === 'viewport' ? 'active' : ''}">
                                                    <input class="form-check-input" type="radio" name="printRange" id="printViewport" value="viewport" ${this.settings.printRange === 'viewport' ? 'checked' : ''}>
                                                    <label class="form-check-label w-100" for="printViewport">
                                                        <i class="bi bi-grid-3x3-gap fs-4 d-block mb-1 text-danger"></i>
                                                        <span class="fw-semibold">All Viewports</span>
                                                        <small class="d-block text-muted">Include MPR views</small>
                                                    </label>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <!-- Custom Range Input (hidden by default) -->
                                        <div id="customRangeInput" class="mt-3" style="display: none;">
                                            <div class="input-group input-group-sm">
                                                <span class="input-group-text bg-secondary border-secondary text-light">From</span>
                                                <input type="number" class="form-control bg-dark text-light border-secondary" id="rangeFrom" min="1" max="${totalImages}" value="1">
                                                <span class="input-group-text bg-secondary border-secondary text-light">To</span>
                                                <input type="number" class="form-control bg-dark text-light border-secondary" id="rangeTo" min="1" max="${totalImages}" value="${totalImages}">
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Layout Section -->
                                    <div class="settings-section mb-4">
                                        <h6 class="settings-title text-primary mb-3">
                                            <i class="bi bi-grid me-2"></i>Page Layout
                                        </h6>
                                        <div class="row g-2">
                                            <div class="col-6">
                                                <label class="form-label small text-light">Images per Page</label>
                                                <select class="form-select form-select-sm bg-dark text-light border-secondary" id="printLayout">
                                                    <option value="1x1" ${this.settings.layout === '1x1' ? 'selected' : ''}>1 × 1 (Full Page)</option>
                                                    <option value="1x2" ${this.settings.layout === '1x2' ? 'selected' : ''}>1 × 2 (2 images)</option>
                                                    <option value="2x2" ${this.settings.layout === '2x2' ? 'selected' : ''}>2 × 2 (4 images)</option>
                                                    <option value="3x3" ${this.settings.layout === '3x3' ? 'selected' : ''}>3 × 3 (9 images)</option>
                                                    <option value="4x4" ${this.settings.layout === '4x4' ? 'selected' : ''}>4 × 4 (16 images)</option>
                                                    <option value="3x4" ${this.settings.layout === '3x4' ? 'selected' : ''}>3 × 4 (12 images)</option>
                                                </select>
                                            </div>
                                            <div class="col-6">
                                                <label class="form-label small text-light">Orientation</label>
                                                <select class="form-select form-select-sm bg-dark text-light border-secondary" id="printOrientation">
                                                    <option value="landscape" ${this.settings.orientation === 'landscape' ? 'selected' : ''}>Landscape</option>
                                                    <option value="portrait" ${this.settings.orientation === 'portrait' ? 'selected' : ''}>Portrait</option>
                                                </select>
                                            </div>
                                            <div class="col-6">
                                                <label class="form-label small text-light">Paper Size</label>
                                                <select class="form-select form-select-sm bg-dark text-light border-secondary" id="printPaperSize">
                                                    <option value="A4" ${this.settings.paperSize === 'A4' ? 'selected' : ''}>A4 (210 × 297 mm)</option>
                                                    <option value="A3" ${this.settings.paperSize === 'A3' ? 'selected' : ''}>A3 (297 × 420 mm)</option>
                                                    <option value="Letter" ${this.settings.paperSize === 'Letter' ? 'selected' : ''}>Letter (8.5 × 11 in)</option>
                                                    <option value="Legal" ${this.settings.paperSize === 'Legal' ? 'selected' : ''}>Legal (8.5 × 14 in)</option>
                                                </select>
                                            </div>
                                            <div class="col-6">
                                                <label class="form-label small text-light">Margins</label>
                                                <select class="form-select form-select-sm bg-dark text-light border-secondary" id="printMargins">
                                                    <option value="none" ${this.settings.margins === 'none' ? 'selected' : ''}>None</option>
                                                    <option value="narrow" ${this.settings.margins === 'narrow' ? 'selected' : ''}>Narrow (5mm)</option>
                                                    <option value="normal" ${this.settings.margins === 'normal' ? 'selected' : ''}>Normal (10mm)</option>
                                                    <option value="wide" ${this.settings.margins === 'wide' ? 'selected' : ''}>Wide (20mm)</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Output Options Section -->
                                    <div class="settings-section">
                                        <h6 class="settings-title text-primary mb-3">
                                            <i class="bi bi-sliders me-2"></i>Output Options
                                        </h6>
                                        <div class="row g-2">
                                            <div class="col-6">
                                                <label class="form-label small text-light">Print Quality</label>
                                                <select class="form-select form-select-sm bg-dark text-light border-secondary" id="printQuality">
                                                    <option value="draft">Draft (Fast)</option>
                                                    <option value="normal">Normal</option>
                                                    <option value="high" ${this.settings.quality === 'high' ? 'selected' : ''}>High Quality</option>
                                                    <option value="maximum">Maximum</option>
                                                </select>
                                            </div>
                                            <div class="col-6">
                                                <label class="form-label small text-light">Color Mode</label>
                                                <select class="form-select form-select-sm bg-dark text-light border-secondary" id="printColorMode">
                                                    <option value="grayscale" ${this.settings.colorMode === 'grayscale' ? 'selected' : ''}>Grayscale</option>
                                                    <option value="color">Color</option>
                                                    <option value="inverted">Inverted</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- Right Panel - Information & Preview -->
                                <div class="col-md-5 p-4 bg-dark">
                                    <!-- Include Information Section -->
                                    <div class="settings-section mb-4">
                                        <h6 class="settings-title text-primary mb-3">
                                            <i class="bi bi-card-text me-2"></i>Include Information
                                        </h6>
                                        <div class="info-options">
                                            <div class="form-check form-switch mb-2">
                                                <input class="form-check-input" type="checkbox" id="printPatientInfo" ${this.settings.includePatientInfo ? 'checked' : ''}>
                                                <label class="form-check-label text-light" for="printPatientInfo">
                                                    <i class="bi bi-person-badge me-2 text-info"></i>Patient Information
                                                </label>
                                            </div>
                                            <div class="form-check form-switch mb-2">
                                                <input class="form-check-input" type="checkbox" id="printAnnotations" ${this.settings.includeAnnotations ? 'checked' : ''}>
                                                <label class="form-check-label text-light" for="printAnnotations">
                                                    <i class="bi bi-pencil-square me-2 text-warning"></i>Measurements & Annotations
                                                </label>
                                            </div>
                                            <div class="form-check form-switch mb-2">
                                                <input class="form-check-input" type="checkbox" id="printWindowLevel" ${this.settings.includeWindowLevel ? 'checked' : ''}>
                                                <label class="form-check-label text-light" for="printWindowLevel">
                                                    <i class="bi bi-sliders me-2 text-success"></i>Window/Level Values
                                                </label>
                                            </div>
                                            <div class="form-check form-switch mb-2">
                                                <input class="form-check-input" type="checkbox" id="printScalebar" ${this.settings.includeScalebar ? 'checked' : ''}>
                                                <label class="form-check-label text-light" for="printScalebar">
                                                    <i class="bi bi-rulers me-2 text-danger"></i>Scale Bar
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <!-- Header Style Section -->
                                    <div class="settings-section mb-4">
                                        <h6 class="settings-title text-primary mb-3">
                                            <i class="bi bi-card-heading me-2"></i>Header Style
                                        </h6>
                                        <select class="form-select form-select-sm bg-dark text-light border-secondary" id="printHeaderStyle">
                                            <option value="full" ${this.settings.headerStyle === 'full' ? 'selected' : ''}>Full Header (Hospital + Patient)</option>
                                            <option value="minimal" ${this.settings.headerStyle === 'minimal' ? 'selected' : ''}>Minimal (Patient Only)</option>
                                            <option value="none" ${this.settings.headerStyle === 'none' ? 'selected' : ''}>No Header</option>
                                        </select>
                                    </div>

                                    <!-- Print Preview Thumbnail -->
                                    <div class="settings-section">
                                        <h6 class="settings-title text-primary mb-3">
                                            <i class="bi bi-eye me-2"></i>Preview
                                        </h6>
                                        <div class="print-preview-container">
                                            <div class="print-preview-paper" id="printPreviewPaper">
                                                <div class="preview-header">Hospital Name</div>
                                                <div class="preview-grid" id="previewGrid">
                                                    <!-- Grid will be generated dynamically -->
                                                </div>
                                                <div class="preview-footer">Page 1</div>
                                            </div>
                                        </div>
                                        <div class="text-center mt-2">
                                            <small class="text-muted" id="printEstimate">Estimated: 1 page</small>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="modal-footer border-secondary bg-gradient" style="background: linear-gradient(135deg, #16213e 0%, #1a1a2e 100%);">
                            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">
                                <i class="bi bi-x-lg me-2"></i>Cancel
                            </button>
                            <button type="button" class="btn btn-outline-info" id="printPreviewBtn">
                                <i class="bi bi-eye me-2"></i>Preview
                            </button>
                            <button type="button" class="btn btn-primary" id="confirmPrint">
                                <i class="bi bi-printer me-2"></i>Print
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            
            <style>
                /* Print Dialog Enhanced Styles */
                #printDialog .modal-content {
                    border-radius: 12px;
                    overflow: hidden;
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
                }
                
                #printDialog .settings-section {
                    background: rgba(255, 255, 255, 0.03);
                    border-radius: 8px;
                    padding: 16px;
                    border: 1px solid rgba(255, 255, 255, 0.08);
                }
                
                #printDialog .settings-title {
                    font-size: 0.9rem;
                    font-weight: 600;
                    margin-bottom: 12px;
                    padding-bottom: 8px;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                }
                
                #printDialog .print-option-card {
                    background: rgba(255, 255, 255, 0.05);
                    border: 2px solid rgba(255, 255, 255, 0.1);
                    border-radius: 8px;
                    padding: 12px;
                    text-align: center;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    margin: 0;
                }
                
                #printDialog .print-option-card:hover {
                    background: rgba(13, 110, 253, 0.1);
                    border-color: rgba(13, 110, 253, 0.3);
                    transform: translateY(-2px);
                }
                
                #printDialog .print-option-card.active {
                    background: rgba(13, 110, 253, 0.15);
                    border-color: #0d6efd;
                    box-shadow: 0 0 15px rgba(13, 110, 253, 0.3);
                }
                
                #printDialog .print-option-card .form-check-input {
                    position: absolute;
                    opacity: 0;
                }
                
                #printDialog .print-option-card label {
                    cursor: pointer;
                    margin: 0;
                }
                
                #printDialog .form-switch .form-check-input {
                    width: 40px;
                    height: 20px;
                    margin-top: 0.1rem;
                }
                
                #printDialog .form-switch .form-check-input:checked {
                    background-color: #0d6efd;
                    border-color: #0d6efd;
                }
                
                #printDialog .form-select {
                    background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3e%3cpath fill='none' stroke='%23ffffff' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M2 5l6 6 6-6'/%3e%3c/svg%3e");
                }
                
                /* Print Preview Styles */
                #printDialog .print-preview-container {
                    background: #333;
                    border-radius: 8px;
                    padding: 12px;
                    display: flex;
                    justify-content: center;
                }
                
                #printDialog .print-preview-paper {
                    background: #fff;
                    width: 140px;
                    height: 100px;
                    border-radius: 2px;
                    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
                    display: flex;
                    flex-direction: column;
                    padding: 6px;
                    transition: all 0.3s ease;
                }
                
                #printDialog .print-preview-paper.portrait {
                    width: 80px;
                    height: 110px;
                }
                
                #printDialog .preview-header {
                    font-size: 6px;
                    color: #333;
                    text-align: center;
                    padding-bottom: 3px;
                    border-bottom: 1px solid #ddd;
                    margin-bottom: 4px;
                }
                
                #printDialog .preview-grid {
                    flex: 1;
                    display: grid;
                    gap: 2px;
                }
                
                #printDialog .preview-grid .preview-cell {
                    background: #1a1a2e;
                    border-radius: 1px;
                }
                
                #printDialog .preview-footer {
                    font-size: 5px;
                    color: #666;
                    text-align: center;
                    padding-top: 3px;
                    border-top: 1px solid #ddd;
                    margin-top: 4px;
                }
                
                #printDialog .info-options .form-check-label {
                    display: flex;
                    align-items: center;
                    padding: 6px 10px;
                    border-radius: 6px;
                    transition: background 0.2s ease;
                }
                
                #printDialog .info-options .form-check-label:hover {
                    background: rgba(255, 255, 255, 0.05);
                }
                
                /* Button Enhancements */
                #printDialog .btn-primary {
                    background: linear-gradient(135deg, #0d6efd 0%, #0a58ca 100%);
                    border: none;
                    padding: 10px 24px;
                    font-weight: 600;
                    box-shadow: 0 4px 15px rgba(13, 110, 253, 0.3);
                }
                
                #printDialog .btn-primary:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 20px rgba(13, 110, 253, 0.4);
                }
                
                #printDialog .btn-outline-info {
                    border-width: 2px;
                }
                
                /* Print icon animation */
                #printDialog .print-icon-container {
                    width: 50px;
                    height: 50px;
                    background: linear-gradient(135deg, rgba(13, 110, 253, 0.2) 0%, rgba(13, 110, 253, 0.1) 100%);
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
            </style>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);

        const modal = new bootstrap.Modal(document.getElementById('printDialog'));
        modal.show();

        // Setup event listeners
        this.setupDialogEventListeners();
        
        // Initial preview update
        this.updatePreview();
    }

    setupDialogEventListeners() {
        // Print range radio buttons
        document.querySelectorAll('input[name="printRange"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                // Update card active states
                document.querySelectorAll('.print-option-card').forEach(card => card.classList.remove('active'));
                e.target.closest('.print-option-card').classList.add('active');
                
                // Show/hide custom range input
                const customRangeInput = document.getElementById('customRangeInput');
                customRangeInput.style.display = e.target.value === 'range' ? 'block' : 'none';
                
                this.settings.printRange = e.target.value;
                this.updatePreview();
            });
        });

        // Layout change
        document.getElementById('printLayout')?.addEventListener('change', (e) => {
            this.settings.layout = e.target.value;
            this.updatePreview();
        });

        // Orientation change
        document.getElementById('printOrientation')?.addEventListener('change', (e) => {
            this.settings.orientation = e.target.value;
            this.updatePreview();
        });

        // Other settings
        ['printPaperSize', 'printMargins', 'printQuality', 'printColorMode', 'printHeaderStyle'].forEach(id => {
            document.getElementById(id)?.addEventListener('change', (e) => {
                const settingName = id.replace('print', '').toLowerCase();
                this.settings[settingName] = e.target.value;
                this.updatePreview();
            });
        });

        // Checkbox toggles
        ['printPatientInfo', 'printAnnotations', 'printWindowLevel', 'printScalebar'].forEach(id => {
            document.getElementById(id)?.addEventListener('change', (e) => {
                const settingName = 'include' + id.replace('print', '');
                this.settings[settingName] = e.target.checked;
            });
        });

        // Preview button
        document.getElementById('printPreviewBtn')?.addEventListener('click', () => {
            this.executePrint(true);
        });

        // Print button
        document.getElementById('confirmPrint')?.addEventListener('click', () => {
            const modal = bootstrap.Modal.getInstance(document.getElementById('printDialog'));
            modal.hide();
            this.executePrint(false);
        });
    }

    updatePreview() {
        const previewGrid = document.getElementById('previewGrid');
        const previewPaper = document.getElementById('printPreviewPaper');
        const previewHeader = previewPaper?.querySelector('.preview-header');
        const printEstimate = document.getElementById('printEstimate');
        
        if (!previewGrid || !previewPaper) return;

        // Update paper orientation
        if (this.settings.orientation === 'portrait') {
            previewPaper.classList.add('portrait');
        } else {
            previewPaper.classList.remove('portrait');
        }

        // Update header visibility
        if (previewHeader) {
            previewHeader.style.display = this.settings.headerStyle === 'none' ? 'none' : 'block';
            previewHeader.textContent = this.settings.headerStyle === 'full' ? 'Hospital Name' : 'Patient Info';
        }

        // Parse layout
        const [cols, rows] = this.settings.layout.split('x').map(Number);
        const imagesPerPage = cols * rows;

        // Update grid
        previewGrid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
        previewGrid.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
        
        // Clear and add cells
        previewGrid.innerHTML = '';
        for (let i = 0; i < imagesPerPage; i++) {
            const cell = document.createElement('div');
            cell.className = 'preview-cell';
            previewGrid.appendChild(cell);
        }

        // Calculate page estimate
        const state = window.DICOM_VIEWER.STATE;
        let imageCount = 1;
        
        if (this.settings.printRange === 'all') {
            imageCount = state.currentSeriesImages?.length || 1;
        } else if (this.settings.printRange === 'range') {
            const from = parseInt(document.getElementById('rangeFrom')?.value) || 1;
            const to = parseInt(document.getElementById('rangeTo')?.value) || 1;
            imageCount = Math.max(1, to - from + 1);
        } else if (this.settings.printRange === 'viewport') {
            const viewports = document.querySelectorAll('.viewport canvas');
            imageCount = viewports.length || 1;
        }

        const totalPages = Math.ceil(imageCount / imagesPerPage);
        if (printEstimate) {
            printEstimate.textContent = `Estimated: ${totalPages} page${totalPages > 1 ? 's' : ''} (${imageCount} image${imageCount > 1 ? 's' : ''})`;
        }
    }

    async executePrint(previewOnly = false) {
        const state = window.DICOM_VIEWER.STATE;
        
        // Collect settings from dialog
        this.settings.printRange = document.querySelector('input[name="printRange"]:checked')?.value || 'current';
        this.settings.layout = document.getElementById('printLayout')?.value || '2x2';
        this.settings.orientation = document.getElementById('printOrientation')?.value || 'landscape';
        this.settings.paperSize = document.getElementById('printPaperSize')?.value || 'A4';
        this.settings.margins = document.getElementById('printMargins')?.value || 'normal';
        this.settings.quality = document.getElementById('printQuality')?.value || 'high';
        this.settings.colorMode = document.getElementById('printColorMode')?.value || 'grayscale';
        this.settings.headerStyle = document.getElementById('printHeaderStyle')?.value || 'full';
        this.settings.includePatientInfo = document.getElementById('printPatientInfo')?.checked ?? true;
        this.settings.includeAnnotations = document.getElementById('printAnnotations')?.checked ?? true;
        this.settings.includeWindowLevel = document.getElementById('printWindowLevel')?.checked ?? true;
        this.settings.includeScalebar = document.getElementById('printScalebar')?.checked ?? false;

        // Show loading indicator
        this.showLoadingModal('Preparing images for printing...', 0);

        try {
            let imageIndices = [];

            if (this.settings.printRange === 'current') {
                imageIndices = [state.currentImageIndex || 0];
            } else if (this.settings.printRange === 'all') {
                // Get ALL image indices from the series
                const totalImages = state.currentSeriesImages?.length || 1;
                imageIndices = Array.from({ length: totalImages }, (_, i) => i);
            } else if (this.settings.printRange === 'range') {
                const from = parseInt(document.getElementById('rangeFrom')?.value) || 1;
                const to = parseInt(document.getElementById('rangeTo')?.value) || 1;
                for (let i = from - 1; i < to; i++) {
                    imageIndices.push(i);
                }
            } else if (this.settings.printRange === 'viewport') {
                // Special handling for viewport capture
                imageIndices = ['viewport'];
            }

            await this.generatePrintPreview(imageIndices, previewOnly);

        } catch (error) {
            console.error('Print error:', error);
            this.showToast('Failed to generate print preview: ' + error.message, 'error');
        } finally {
            this.hideLoadingModal();
        }
    }

    /**
     * Load a specific image by index and capture it
     * This is the KEY FIX - properly loads each individual image
     */
    async loadAndCaptureImage(imageIndex) {
        const state = window.DICOM_VIEWER.STATE;
        const images = state.currentSeriesImages;
        
        if (!images || imageIndex >= images.length) {
            console.warn(`Image index ${imageIndex} out of range`);
            return null;
        }

        const imageData = images[imageIndex];
        const viewport = document.querySelector('[data-viewport-name="original"]') || 
                        document.querySelector('.viewport');
        
        if (!viewport) {
            console.error('No viewport found');
            return null;
        }

        try {
            // Get the image URL using the helper function
            const imageUrl = window.DICOM_VIEWER.getImageUrl(imageData);
            
            if (!imageUrl) {
                console.error(`Could not get URL for image ${imageIndex}`);
                return null;
            }

            // Load the image into cornerstone
            const image = await cornerstone.loadAndCacheImage(imageUrl);
            
            // Display the image
            cornerstone.displayImage(viewport, image);
            
            // Apply current viewport settings (window/level)
            const currentViewport = cornerstone.getViewport(viewport);
            if (currentViewport) {
                cornerstone.setViewport(viewport, currentViewport);
            }
            
            // Wait for render to complete
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Capture the canvas
            const canvas = viewport.querySelector('canvas');
            if (!canvas) {
                console.error('No canvas found in viewport');
                return null;
            }

            const dataUrl = canvas.toDataURL('image/png', this.settings.quality === 'high' ? 1.0 : 0.8);
            
            // Get window/level info
            let windowInfo = null;
            try {
                const vp = cornerstone.getViewport(viewport);
                if (vp && vp.voi) {
                    windowInfo = {
                        width: Math.round(vp.voi.windowWidth || 0),
                        center: Math.round(vp.voi.windowCenter || 0)
                    };
                }
            } catch (e) {
                // Ignore
            }

            return {
                dataUrl,
                name: `Image ${imageIndex + 1}`,
                index: imageIndex,
                windowInfo,
                seriesDescription: imageData.series_description || imageData.seriesDescription || '',
                instanceNumber: imageData.instance_number || imageData.instanceNumber || imageIndex + 1
            };

        } catch (error) {
            console.error(`Error loading image ${imageIndex}:`, error);
            return null;
        }
    }

    async generatePrintPreview(imageIndices, previewOnly) {
        const [cols, rows] = this.settings.layout.split('x').map(Number);
        const imagesPerPage = cols * rows;
        const state = window.DICOM_VIEWER.STATE;

        // Get margin value
        const marginValues = { none: 0, narrow: 5, normal: 10, wide: 20 };
        const margin = marginValues[this.settings.margins] || 10;

        // Get patient info from current image
        const currentImage = state.currentSeriesImages?.[state.currentImageIndex] || {};
        const patientName = currentImage.patient_name || currentImage.patientName || 'Unknown Patient';
        const patientId = currentImage.patient_id || currentImage.patientId || '';
        const studyDate = currentImage.study_date || currentImage.studyDate || new Date().toLocaleDateString();
        const studyDescription = currentImage.study_description || currentImage.studyDescription || 'Medical Imaging Study';
        const institutionName = currentImage.institution_name || 'Medical Imaging Center';

        // Store original image index to restore later
        const originalImageIndex = state.currentImageIndex;

        // Collect all captured images
        let capturedImages = [];
        
        if (imageIndices[0] === 'viewport') {
            // Capture all viewports (MPR views)
            const viewports = document.querySelectorAll('.viewport');
            for (const viewport of viewports) {
                const canvas = viewport.querySelector('canvas');
                if (canvas) {
                    const dataUrl = canvas.toDataURL('image/png', this.settings.quality === 'high' ? 1.0 : 0.8);
                    const viewportName = viewport.getAttribute('data-viewport-name') || 'View';
                    capturedImages.push({ 
                        dataUrl, 
                        name: viewportName.charAt(0).toUpperCase() + viewportName.slice(1), 
                        index: capturedImages.length,
                        windowInfo: null
                    });
                }
            }
        } else {
            // FIXED: Load and capture each individual image
            const totalImages = imageIndices.length;
            
            for (let i = 0; i < totalImages; i++) {
                const imageIndex = imageIndices[i];
                
                // Update loading progress
                this.updateLoadingProgress(
                    `Loading image ${i + 1} of ${totalImages}...`,
                    Math.round((i / totalImages) * 100)
                );

                // Load and capture this specific image
                const capturedImage = await this.loadAndCaptureImage(imageIndex);
                
                if (capturedImage) {
                    capturedImages.push(capturedImage);
                }
                
                // Small delay between images to prevent overwhelming the system
                await new Promise(resolve => setTimeout(resolve, 50));
            }

            // Restore original image
            if (originalImageIndex !== undefined && state.currentSeriesImages?.[originalImageIndex]) {
                state.currentImageIndex = originalImageIndex;
                if (typeof window.DICOM_VIEWER.loadCurrentImage === 'function') {
                    await window.DICOM_VIEWER.loadCurrentImage(true);
                }
            }
        }

        if (capturedImages.length === 0) {
            this.showToast('No images could be captured', 'error');
            return;
        }

        const totalPages = Math.ceil(capturedImages.length / imagesPerPage);

        // Create print window
        const printWindow = window.open('', '_blank', 'width=1100,height=800');

        if (!printWindow) {
            this.showToast('Please allow popups to print', 'warning');
            return;
        }

        // Build print HTML
        let printHTML = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>DICOM Print - ${patientName} - ${new Date().toLocaleDateString()}</title>
    <style>
        @page {
            size: ${this.settings.paperSize} ${this.settings.orientation};
            margin: ${margin}mm;
        }
        
        @media print {
            body { margin: 0; padding: 0; }
            .page-break { page-break-after: always; }
            .no-print { display: none !important; }
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
        
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: 'Segoe UI', Arial, sans-serif;
            background: ${previewOnly ? '#2d2d2d' : '#fff'};
            color: ${previewOnly ? '#fff' : '#000'};
        }
        
        .print-toolbar {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            padding: 12px 20px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            z-index: 1000;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        }
        
        .print-toolbar h4 {
            color: #fff;
            font-weight: 600;
            margin: 0;
        }
        
        .print-toolbar .btn-group {
            display: flex;
            gap: 10px;
        }
        
        .print-toolbar button {
            padding: 10px 24px;
            font-size: 14px;
            font-weight: 600;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
            transition: all 0.3s ease;
        }
        
        .print-toolbar .btn-print {
            background: linear-gradient(135deg, #0d6efd 0%, #0a58ca 100%);
            color: #fff;
            box-shadow: 0 4px 15px rgba(13, 110, 253, 0.3);
        }
        
        .print-toolbar .btn-print:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(13, 110, 253, 0.4);
        }
        
        .print-toolbar .btn-close {
            background: #6c757d;
            color: #fff;
        }
        
        .print-toolbar .btn-close:hover {
            background: #5a6268;
        }
        
        .print-content {
            padding-top: ${previewOnly ? '80px' : '0'};
        }
        
        .print-page {
            background: #fff;
            color: #000;
            width: 100%;
            min-height: ${this.settings.orientation === 'landscape' ? '210mm' : '297mm'};
            display: flex;
            flex-direction: column;
            padding: 15px;
            margin-bottom: ${previewOnly ? '20px' : '0'};
            box-shadow: ${previewOnly ? '0 4px 20px rgba(0, 0, 0, 0.3)' : 'none'};
        }
        
        .page-header {
            display: ${this.settings.headerStyle === 'none' ? 'none' : 'block'};
            border-bottom: 2px solid #0d6efd;
            padding-bottom: 12px;
            margin-bottom: 12px;
        }
        
        .page-header-full {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
        }
        
        .hospital-info h2 {
            color: #0d6efd;
            font-size: 18px;
            margin-bottom: 4px;
        }
        
        .hospital-info p {
            font-size: 11px;
            color: #666;
        }
        
        .patient-info {
            text-align: right;
            font-size: 11px;
        }
        
        .patient-info strong {
            color: #333;
        }
        
        .images-grid {
            display: grid;
            grid-template-columns: repeat(${cols}, 1fr);
            grid-template-rows: repeat(${rows}, 1fr);
            gap: 8px;
            flex: 1;
            min-height: 0;
        }
        
        .image-container {
            position: relative;
            background: #000;
            border: 1px solid #ddd;
            border-radius: 4px;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .image-container img {
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
            ${this.settings.colorMode === 'inverted' ? 'filter: invert(1);' : ''}
            ${this.settings.colorMode === 'grayscale' ? 'filter: grayscale(1);' : ''}
        }
        
        .image-overlay {
            position: absolute;
            color: #00ff00;
            font-size: 9px;
            font-family: 'Consolas', 'Courier New', monospace;
            text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.9);
            pointer-events: none;
            padding: 3px 6px;
            background: rgba(0, 0, 0, 0.6);
            border-radius: 2px;
        }
        
        .overlay-top-left { top: 4px; left: 4px; }
        .overlay-top-right { top: 4px; right: 4px; text-align: right; }
        .overlay-bottom-left { bottom: 4px; left: 4px; }
        .overlay-bottom-right { bottom: 4px; right: 4px; text-align: right; }
        
        .page-footer {
            border-top: 1px solid #ddd;
            padding-top: 8px;
            margin-top: 12px;
            display: flex;
            justify-content: space-between;
            font-size: 9px;
            color: #666;
        }
        
        .empty-cell {
            background: #f5f5f5;
            border: 1px dashed #ddd;
        }
    </style>
</head>
<body>
    <div class="print-toolbar no-print">
        <h4><span style="color: #0d6efd;">●</span> Print Preview - ${capturedImages.length} images</h4>
        <div class="btn-group">
            <button class="btn-print" onclick="window.print()">
                <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M2.5 8a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1z"/>
                    <path d="M5 1a2 2 0 0 0-2 2v2H2a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h1v1a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-1h1a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-1V3a2 2 0 0 0-2-2H5zM4 3a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2H4V3zm1 5a2 2 0 0 0-2 2v1H2a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v-1a2 2 0 0 0-2-2H5zm7 2v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1z"/>
                </svg>
                Print
            </button>
            <button class="btn-close" onclick="window.close()">
                <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z"/>
                </svg>
                Close
            </button>
        </div>
    </div>
    
    <div class="print-content">
`;

        // Generate pages
        for (let page = 0; page < totalPages; page++) {
            const pageImages = capturedImages.slice(page * imagesPerPage, (page + 1) * imagesPerPage);
            
            printHTML += `
        <div class="print-page${page < totalPages - 1 ? ' page-break' : ''}">
            <div class="page-header">
                ${this.settings.headerStyle === 'full' ? `
                <div class="page-header-full">
                    <div class="hospital-info">
                        <h2>${institutionName}</h2>
                        <p>Medical Imaging Department</p>
                    </div>
                    <div class="patient-info">
                        <strong>${patientName}</strong><br>
                        ID: ${patientId}<br>
                        Study: ${studyDescription}<br>
                        Date: ${studyDate}
                    </div>
                </div>
                ` : `
                <div class="patient-info" style="text-align: left;">
                    <strong>${patientName}</strong> | ID: ${patientId} | ${studyDate}
                </div>
                `}
            </div>
            
            <div class="images-grid">
`;

            // Add images
            for (const img of pageImages) {
                printHTML += `
                <div class="image-container">
                    <img src="${img.dataUrl}" alt="DICOM Image ${img.index + 1}">
                    ${this.settings.includePatientInfo ? `
                    <div class="image-overlay overlay-top-left">
                        ${img.name || `Image ${img.index + 1}`}
                        ${img.seriesDescription ? `<br>${img.seriesDescription}` : ''}
                    </div>
                    ` : ''}
                    ${this.settings.includeWindowLevel && img.windowInfo ? `
                    <div class="image-overlay overlay-bottom-right">
                        W: ${img.windowInfo.width} L: ${img.windowInfo.center}
                    </div>
                    ` : ''}
                </div>
`;
            }

            // Fill empty cells
            for (let i = pageImages.length; i < imagesPerPage; i++) {
                printHTML += '<div class="image-container empty-cell"></div>';
            }

            printHTML += `
            </div>
            
            <div class="page-footer">
                <span>Generated: ${new Date().toLocaleString()}</span>
                <span>Page ${page + 1} of ${totalPages}</span>
                <span>DICOM Viewer Pro | For Medical Use Only</span>
            </div>
        </div>
`;
        }

        printHTML += `
    </div>
</body>
</html>
`;

        printWindow.document.write(printHTML);
        printWindow.document.close();
        
        // Auto-print if not preview only
        if (!previewOnly) {
            setTimeout(() => printWindow.print(), 500);
        }
    }

    // Loading modal helpers
    showLoadingModal(message, progress) {
        let modal = document.getElementById('printLoadingModal');
        if (!modal) {
            const html = `
                <div id="printLoadingModal" class="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style="background: rgba(0,0,0,0.7); z-index: 9999;">
                    <div class="bg-dark text-light p-4 rounded-3 text-center" style="min-width: 300px;">
                        <div class="spinner-border text-primary mb-3" role="status"></div>
                        <div id="printLoadingMessage" class="mb-2">${message}</div>
                        <div class="progress" style="height: 6px;">
                            <div id="printLoadingProgress" class="progress-bar progress-bar-striped progress-bar-animated" style="width: ${progress}%"></div>
                        </div>
                        <small class="text-muted mt-2 d-block" id="printLoadingPercent">${progress}%</small>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', html);
        } else {
            this.updateLoadingProgress(message, progress);
        }
    }

    updateLoadingProgress(message, progress) {
        const messageEl = document.getElementById('printLoadingMessage');
        const progressEl = document.getElementById('printLoadingProgress');
        const percentEl = document.getElementById('printLoadingPercent');
        
        if (messageEl) messageEl.textContent = message;
        if (progressEl) progressEl.style.width = `${progress}%`;
        if (percentEl) percentEl.textContent = `${progress}%`;
    }

    hideLoadingModal() {
        const modal = document.getElementById('printLoadingModal');
        if (modal) modal.remove();
    }

    showToast(message, type = 'info') {
        // Create toast if function doesn't exist
        if (typeof window.DICOM_VIEWER.showToast === 'function') {
            window.DICOM_VIEWER.showToast(message, type);
        } else {
            alert(message);
        }
    }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    if (!window.DICOM_VIEWER.MANAGERS) {
        window.DICOM_VIEWER.MANAGERS = {};
    }
    window.DICOM_VIEWER.MANAGERS.printManager = new window.DICOM_VIEWER.PrintManager();
    console.log('✓ Print Manager v2.1 initialized (with proper multi-image support)');
});