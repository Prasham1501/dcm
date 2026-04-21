/**
 * DICOM Print Manager v3.0
 * Professional medical imaging printing with EXACT viewport capture
 * - Captures current viewport state (layout, W/L, shapes, annotations)
 * - Printer selection from saved printers
 * - Medical report printing with professional templates
 * - Print settings stored in admin configuration
 */

window.DICOM_VIEWER = window.DICOM_VIEWER || {};

window.DICOM_VIEWER.PrintManager = class {
    constructor() {
        this.printSettings = null; // Will be loaded from server
        this.availablePrinters = [];
        this.selectedPrinter = null;
        this.init();
    }

    async init() {
        // Load print settings from server
        await this.loadPrintSettings();
        await this.loadPrinters();
        this.setupPrintButton();
        this.setupKeyboardShortcuts();
    }

    setupKeyboardShortcuts() {
        // Ctrl+P to open print dialog
        document.addEventListener('keydown', (e) => {
            // Check if Ctrl+P (or Cmd+P on Mac)
            if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
                e.preventDefault(); // Prevent browser's default print dialog
                this.showPrintDialog();
            }
        });
    }

    async loadPrintSettings() {
        try {
            const basePath = document.querySelector('meta[name="base-path"]')?.content || '';
            const response = await fetch(`${basePath}/api/settings/print-settings.php`);
            const data = await response.json();

            if (data.success && data.settings) {
                this.printSettings = data.settings;
            } else {
                // Default settings
                this.printSettings = {
                    includePatientInfo: true,
                    includeStudyInfo: true,
                    includeInstitutionInfo: true,
                    includeAnnotations: true,
                    includeWindowLevel: true,
                    includeMeasurements: true,
                    includeTimestamp: true,
                    paperSize: 'A4',
                    orientation: 'landscape',
                    quality: 'high',
                    colorMode: 'grayscale'
                };
            }
        } catch (error) {
            console.error('Error loading print settings:', error);
            this.printSettings = this.getDefaultSettings();
        }
    }

    async loadPrinters() {
        try {
            const basePath = document.querySelector('meta[name="base-path"]')?.content || '';
            const response = await fetch(`${basePath}/api/settings/printers.php`);
            const data = await response.json();

            if (data.success && data.printers) {
                this.availablePrinters = data.printers.filter(p => p.is_active);
            }
        } catch (error) {
            console.error('Error loading printers:', error);
            this.availablePrinters = [];
        }
    }

    getDefaultSettings() {
        return {
            includePatientInfo: true,
            includeStudyInfo: true,
            includeInstitutionInfo: true,
            includeAnnotations: true,
            includeWindowLevel: true,
            includeMeasurements: true,
            includeTimestamp: true,
            paperSize: 'A4',
            orientation: 'landscape',
            quality: 'high',
            colorMode: 'grayscale'
        };
    }

    setupPrintButton() {
        const printBtn = document.getElementById('printBtn');
        if (printBtn) {
            printBtn.addEventListener('click', () => this.showPrintDialog());
        }
    }

    /**
     * Capture EXACT viewport state including layout, images, W/L, shapes
     */
    async captureCurrentViewportState() {
        const viewportContainer = document.getElementById('viewport-container');
        const viewports = document.querySelectorAll('.viewport');

        if (!viewports || viewports.length === 0) {
            throw new Error('No viewports found to print');
        }

        // Detect current layout
        const containerStyles = window.getComputedStyle(viewportContainer);
        const gridColumns = containerStyles.gridTemplateColumns.split(' ').length;
        const gridRows = containerStyles.gridTemplateRows.split(' ').length;

        const capturedViewports = [];

        for (const viewport of viewports) {
            try {
                const canvas = viewport.querySelector('canvas');
                if (!canvas) continue;

                // Check if viewport has an image loaded
                let hasImage = false;
                try {
                    const enabledElement = cornerstone.getEnabledElement(viewport);
                    hasImage = !!enabledElement.image;
                } catch (e) {
                    // Viewport not enabled or no image
                    continue;
                }

                if (!hasImage) continue;

                // Capture viewport data
                const dataUrl = canvas.toDataURL('image/png', this.printSettings.quality === 'high' ? 1.0 : 0.8);

                // Get viewport state
                const viewportState = cornerstone.getViewport(viewport);
                const viewportName = viewport.getAttribute('data-viewport-name') || 'View';

                // Get image metadata
                const enabledElement = cornerstone.getEnabledElement(viewport);
                const imageId = enabledElement.image?.imageId || '';

                capturedViewports.push({
                    dataUrl,
                    name: viewportName,
                    windowWidth: viewportState?.voi?.windowWidth || 0,
                    windowCenter: viewportState?.voi?.windowCenter || 0,
                    zoom: viewportState?.scale || 1,
                    pan: viewportState?.translation || { x: 0, y: 0 },
                    rotation: viewportState?.rotation || 0,
                    invert: viewportState?.invert || false,
                    hflip: viewportState?.hflip || false,
                    vflip: viewportState?.vflip || false
                });
            } catch (error) {
                console.error('Error capturing viewport:', error);
            }
        }

        if (capturedViewports.length === 0) {
            throw new Error('No images loaded in viewports');
        }

        return {
            layout: `${gridRows}x${gridColumns}`,
            viewports: capturedViewports,
            totalViewports: viewports.length
        };
    }

    async showPrintDialog() {
        const state = window.DICOM_VIEWER.STATE;

        if (!state.currentSeriesImages || state.currentSeriesImages.length === 0) {
            this.showToast('No images loaded to print', 'warning');
            return;
        }

        // Remove existing modal if present
        const existingModal = document.getElementById('printDialogV3');
        if (existingModal) existingModal.remove();

        // Get current patient/study info
        const currentImage = state.currentSeriesImages?.[state.currentImageIndex] || {};
        const patientName = currentImage.patient_name || currentImage.patientName || 'Unknown Patient';
        const patientId = currentImage.patient_id || currentImage.patientId || '';
        const studyDate = currentImage.study_date || currentImage.studyDate || new Date().toLocaleDateString();

        // Create modal HTML
        const modalHTML = `
            <div class="modal fade" id="printDialogV3" tabindex="-1" data-bs-backdrop="static">
                <div class="modal-dialog modal-lg modal-dialog-centered">
                    <div class="modal-content bg-dark text-light border-secondary">
                        <div class="modal-header border-secondary bg-gradient" style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);">
                            <div class="d-flex align-items-center">
                                <div class="print-icon-container me-3">
                                    <i class="bi bi-printer-fill fs-3 text-primary"></i>
                                </div>
                                <div>
                                    <h5 class="modal-title mb-0">Print Current View</h5>
                                    <small class="text-muted">Print exactly what you see on screen</small>
                                </div>
                            </div>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>

                        <div class="modal-body p-4">
                            <!-- Patient Info -->
                            <div class="alert alert-info d-flex align-items-center mb-4">
                                <i class="bi bi-person-fill fs-4 me-3"></i>
                                <div>
                                    <strong>${patientName}</strong><br>
                                    <small>ID: ${patientId} | Study Date: ${studyDate}</small>
                                </div>
                            </div>

                            <!-- Print Type Selection -->
                            <h6 class="text-primary mb-3">
                                <i class="bi bi-file-earmark me-2"></i>What would you like to print?
                            </h6>
                            <div class="row g-3 mb-4">
                                <div class="col-md-6">
                                    <div class="print-type-card active" data-type="viewport">
                                        <input type="radio" name="printType" value="viewport" checked hidden>
                                        <i class="bi bi-grid-3x3 fs-3 text-primary mb-2"></i>
                                        <h6 class="mb-1">Current Viewport</h6>
                                        <small class="text-muted">Print exactly what you see<br>with all adjustments and annotations</small>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="print-type-card" data-type="report">
                                        <input type="radio" name="printType" value="report" hidden>
                                        <i class="bi bi-file-medical fs-3 text-success mb-2"></i>
                                        <h6 class="mb-1">Medical Report</h6>
                                        <small class="text-muted" id="reportStatus">Checking for report...</small>
                                    </div>
                                </div>
                            </div>

                            <!-- Printer Selection -->
                            <h6 class="text-primary mb-3">
                                <i class="bi bi-printer me-2"></i>Select Printer
                            </h6>
                            <div id="printerSelection">
                                ${this.availablePrinters.length > 0 ? this.renderPrintersList() : `
                                    <div class="alert alert-warning">
                                        <i class="bi bi-exclamation-triangle me-2"></i>
                                        No printers configured. Using system default printer.
                                    </div>
                                `}
                            </div>

                            <!-- Print Preview Info -->
                            <div class="mt-4 p-3 bg-secondary bg-opacity-10 rounded">
                                <h6 class="text-info mb-2"><i class="bi bi-info-circle me-2"></i>Print Settings</h6>
                                <small class="text-muted">
                                    Paper: <strong>${this.printSettings.paperSize}</strong> |
                                    Orientation: <strong>${this.printSettings.orientation}</strong> |
                                    Quality: <strong>${this.printSettings.quality}</strong>
                                </small>
                                <br>
                                <small class="text-muted">
                                    <a href="../admin/settings.php#print-settings" target="_blank" class="text-primary">
                                        <i class="bi bi-gear me-1"></i>Change print settings
                                    </a>
                                </small>
                            </div>
                        </div>

                        <div class="modal-footer border-secondary bg-gradient" style="background: linear-gradient(135deg, #16213e 0%, #1a1a2e 100%);">
                            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">
                                <i class="bi bi-x-lg me-2"></i>Cancel
                            </button>
                            <button type="button" class="btn btn-outline-info" id="printPreviewBtnV3">
                                <i class="bi bi-eye me-2"></i>Preview
                            </button>
                            <button type="button" class="btn btn-primary" id="confirmPrintV3">
                                <i class="bi bi-printer me-2"></i>Print
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <style>
                .print-type-card {
                    background: rgba(255, 255, 255, 0.05);
                    border: 2px solid rgba(255, 255, 255, 0.1);
                    border-radius: 12px;
                    padding: 20px;
                    text-align: center;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    height: 100%;
                }

                .print-type-card:hover {
                    background: rgba(13, 110, 253, 0.1);
                    border-color: rgba(13, 110, 253, 0.3);
                    transform: translateY(-2px);
                }

                .print-type-card.active {
                    background: rgba(13, 110, 253, 0.15);
                    border-color: #0d6efd;
                    box-shadow: 0 0 15px rgba(13, 110, 253, 0.3);
                }

                .print-type-card.disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .printer-option {
                    background: rgba(255, 255, 255, 0.05);
                    border: 2px solid rgba(255, 255, 255, 0.1);
                    border-radius: 8px;
                    padding: 12px 15px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    margin-bottom: 10px;
                }

                .printer-option:hover {
                    background: rgba(13, 110, 253, 0.1);
                    border-color: rgba(13, 110, 253, 0.3);
                }

                .printer-option.selected {
                    background: rgba(13, 110, 253, 0.15);
                    border-color: #0d6efd;
                }

                .print-icon-container {
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

        const modal = new bootstrap.Modal(document.getElementById('printDialogV3'));
        modal.show();

        // Setup event listeners
        this.setupDialogEventListeners();

        // Check for report
        this.checkForReport();

        // Add Enter key listener for quick print
        const modalElement = document.getElementById('printDialogV3');
        const enterKeyHandler = (e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
                e.preventDefault();
                const printBtn = document.getElementById('confirmPrintV3');
                if (printBtn && !printBtn.disabled) {
                    printBtn.click();
                }
            }
        };

        modalElement.addEventListener('keydown', enterKeyHandler);

        // Clean up listener when modal is hidden
        modalElement.addEventListener('hidden.bs.modal', () => {
            modalElement.removeEventListener('keydown', enterKeyHandler);
        }, { once: true });
    }

    renderPrintersList() {
        if (this.availablePrinters.length === 0) return '';

        let html = '<div class="printers-list">';

        // Add default system printer option
        html += `
            <div class="printer-option selected" data-printer="default">
                <div class="d-flex align-items-center">
                    <i class="bi bi-printer fs-4 me-3 text-primary"></i>
                    <div class="flex-grow-1">
                        <strong>System Default Printer</strong><br>
                        <small class="text-muted">Use default printer configured in your system</small>
                    </div>
                    <i class="bi bi-check-circle-fill text-primary fs-5"></i>
                </div>
            </div>
        `;

        // Add configured printers
        for (const printer of this.availablePrinters) {
            html += `
                <div class="printer-option" data-printer="${printer.id}">
                    <div class="d-flex align-items-center">
                        <i class="bi bi-hdd-network fs-4 me-3 text-info"></i>
                        <div class="flex-grow-1">
                            <strong>${printer.name}</strong><br>
                            <small class="text-muted">${printer.ae_title} @ ${printer.host_name}:${printer.port}</small>
                            ${printer.description ? `<br><small class="text-muted">${printer.description}</small>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }

        html += '</div>';
        return html;
    }

    setupDialogEventListeners() {
        // Print type selection
        document.querySelectorAll('.print-type-card').forEach(card => {
            card.addEventListener('click', function() {
                if (this.classList.contains('disabled')) return;

                document.querySelectorAll('.print-type-card').forEach(c => c.classList.remove('active'));
                this.classList.add('active');
                this.querySelector('input[type="radio"]').checked = true;
            });
        });

        // Printer selection
        document.querySelectorAll('.printer-option').forEach(option => {
            option.addEventListener('click', function() {
                document.querySelectorAll('.printer-option').forEach(o => {
                    o.classList.remove('selected');
                    const checkIcon = o.querySelector('.bi-check-circle-fill');
                    if (checkIcon) checkIcon.remove();
                });

                this.classList.add('selected');
                this.querySelector('div').insertAdjacentHTML('beforeend',
                    '<i class="bi bi-check-circle-fill text-primary fs-5"></i>');
            });
        });

        // Preview button
        document.getElementById('printPreviewBtnV3')?.addEventListener('click', () => {
            this.executePrint(true);
        });

        // Print button
        document.getElementById('confirmPrintV3')?.addEventListener('click', () => {
            const modal = bootstrap.Modal.getInstance(document.getElementById('printDialogV3'));
            modal.hide();
            this.executePrint(false);
        });
    }

    async checkForReport() {
        const urlParams = new URLSearchParams(window.location.search);
        const studyUID = urlParams.get('studyUID');
        const reportStatus = document.getElementById('reportStatus');
        const reportCard = document.querySelector('[data-type="report"]');

        if (!studyUID || !reportStatus) return;

        try {
            const basePath = document.querySelector('meta[name="base-path"]')?.content || '';
            const response = await fetch(`${basePath}/api/reports/by-study.php?studyUID=${encodeURIComponent(studyUID)}`);
            const data = await response.json();

            if (data.success && data.data && data.data.count > 0) {
                const report = data.data.reports[0];
                reportStatus.innerHTML = `<span class="text-success"><i class="bi bi-check-circle-fill me-1"></i>Report available</span>`;
                reportCard.classList.remove('disabled');
                reportCard.dataset.reportId = report.id;
            } else {
                reportStatus.innerHTML = '<span class="text-warning">No report available</span>';
                reportCard.classList.add('disabled');
            }
        } catch (error) {
            console.error('Error checking report:', error);
            reportStatus.innerHTML = '<span class="text-muted">Unable to check</span>';
            reportCard.classList.add('disabled');
        }
    }

    async executePrint(previewOnly = false) {
        const printType = document.querySelector('input[name="printType"]:checked')?.value || 'viewport';
        const selectedPrinterEl = document.querySelector('.printer-option.selected');
        const selectedPrinter = selectedPrinterEl?.dataset.printer || 'default';

        this.selectedPrinter = selectedPrinter;

        try {
            if (printType === 'viewport') {
                await this.printViewport(previewOnly);
            } else if (printType === 'report') {
                const reportId = document.querySelector('[data-type="report"]')?.dataset.reportId;
                if (reportId) {
                    await this.printReport(reportId, previewOnly);
                } else {
                    this.showToast('No report available to print', 'warning');
                }
            }
        } catch (error) {
            console.error('Print error:', error);
            this.showToast('Print failed: ' + error.message, 'error');
        }
    }

    async printViewport(previewOnly = false) {
        this.showLoadingModal('Capturing viewport state...', 0);

        try {
            // Capture EXACT viewport state
            const viewportState = await this.captureCurrentViewportState();

            this.updateLoadingProgress('Generating print preview...', 50);

            // Get patient/study info
            const state = window.DICOM_VIEWER.STATE;
            const currentImage = state.currentSeriesImages?.[state.currentImageIndex] || {};

            const patientInfo = {
                name: currentImage.patient_name || currentImage.patientName || 'Unknown Patient',
                id: currentImage.patient_id || currentImage.patientId || '',
                age: currentImage.patient_age || currentImage.patientAge || '',
                sex: currentImage.patient_sex || currentImage.patientSex || '',
                studyDate: currentImage.study_date || currentImage.studyDate || new Date().toLocaleDateString(),
                studyDescription: currentImage.study_description || currentImage.studyDescription || '',
                institution: currentImage.institution_name || 'Medical Imaging Center'
            };

            this.updateLoadingProgress('Preparing print document...', 80);

            // Generate print HTML
            const printHTML = this.generateViewportPrintHTML(viewportState, patientInfo, previewOnly);

            // Open print window
            const printWindow = window.open('', '_blank', 'width=1200,height=900');
            if (!printWindow) {
                throw new Error('Please allow popups to print');
            }

            printWindow.document.write(printHTML);
            printWindow.document.close();

            this.updateLoadingProgress('Complete!', 100);

            // Auto-print if not preview
            if (!previewOnly) {
                setTimeout(() => {
                    printWindow.print();
                }, 500);
            }

        } catch (error) {
            console.error('Viewport print error:', error);
            throw error;
        } finally {
            this.hideLoadingModal();
        }
    }

    generateViewportPrintHTML(viewportState, patientInfo, previewOnly) {
        const settings = this.printSettings;
        const [rows, cols] = viewportState.layout.split('x').map(Number);

        const marginValues = { none: 0, narrow: 5, normal: 10, wide: 20 };
        const margin = marginValues[settings.margins] || 10;

        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>DICOM Print - ${patientInfo.name} - ${new Date().toLocaleDateString()}</title>
    <style>
        @page {
            size: ${settings.paperSize} ${settings.orientation};
            margin: ${margin}mm;
        }

        @media print {
            body { margin: 0; padding: 0; }
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
            padding: 15px 30px;
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

        .print-toolbar button {
            padding: 12px 28px;
            font-size: 15px;
            font-weight: 600;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .btn-print {
            background: linear-gradient(135deg, #0d6efd 0%, #0a58ca 100%);
            color: #fff;
            margin-right: 10px;
        }

        .btn-print:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(13, 110, 253, 0.4);
        }

        .btn-close {
            background: #6c757d;
            color: #fff;
        }

        .print-content {
            padding-top: ${previewOnly ? '80px' : '0'};
            padding: ${previewOnly ? '80px 20px 20px' : '0'};
        }

        .print-page {
            background: #fff;
            color: #000;
            max-width: ${settings.orientation === 'landscape' ? '297mm' : '210mm'};
            min-height: ${settings.orientation === 'landscape' ? '210mm' : '297mm'};
            margin: ${previewOnly ? '0 auto 20px' : '0'};
            padding: 20px;
            box-shadow: ${previewOnly ? '0 4px 20px rgba(0, 0, 0, 0.3)' : 'none'};
        }

        .page-header {
            display: ${settings.includeInstitutionInfo ? 'block' : 'none'};
            border-bottom: 3px solid #0d6efd;
            padding-bottom: 15px;
            margin-bottom: 15px;
        }

        .header-content {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
        }

        .hospital-info h2 {
            color: #0d6efd;
            font-size: 22px;
            margin-bottom: 5px;
        }

        .hospital-info p {
            font-size: 12px;
            color: #666;
        }

        .patient-info {
            text-align: right;
            font-size: 12px;
        }

        .patient-info strong {
            font-size: 14px;
            color: #333;
        }

        .viewport-grid {
            display: grid;
            grid-template-columns: repeat(${cols}, 1fr);
            grid-template-rows: repeat(${rows}, 1fr);
            gap: 10px;
            min-height: ${settings.orientation === 'landscape' ? '160mm' : '240mm'};
        }

        .viewport-cell {
            position: relative;
            background: #000;
            border: 2px solid #ddd;
            border-radius: 6px;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .viewport-cell img {
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
        }

        .viewport-overlay {
            position: absolute;
            color: #00ff00;
            font-size: 10px;
            font-family: 'Consolas', monospace;
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.9);
            padding: 4px 8px;
            background: rgba(0, 0, 0, 0.7);
            border-radius: 3px;
        }

        .overlay-top-left { top: 8px; left: 8px; }
        .overlay-top-right { top: 8px; right: 8px; text-align: right; }
        .overlay-bottom-left { bottom: 8px; left: 8px; }
        .overlay-bottom-right { bottom: 8px; right: 8px; text-align: right; }

        .page-footer {
            border-top: 2px solid #ddd;
            padding-top: 10px;
            margin-top: 15px;
            display: flex;
            justify-content: space-between;
            font-size: 10px;
            color: #666;
        }
    </style>
</head>
<body>
    ${previewOnly ? `
    <div class="print-toolbar no-print">
        <h4>Print Preview - ${viewportState.viewports.length} viewports (${viewportState.layout} layout)</h4>
        <div>
            <button class="btn-print" onclick="window.print()">Print Now</button>
            <button class="btn-close" onclick="window.close()">Close</button>
        </div>
    </div>
    ` : ''}

    <div class="print-content">
        <div class="print-page">
            ${settings.includeInstitutionInfo ? `
            <div class="page-header">
                <div class="header-content">
                    <div class="hospital-info">
                        <h2>${patientInfo.institution}</h2>
                        <p>Medical Imaging Department</p>
                    </div>
                    ${settings.includePatientInfo ? `
                    <div class="patient-info">
                        <strong>${patientInfo.name}</strong><br>
                        ${patientInfo.id ? `ID: ${patientInfo.id}<br>` : ''}
                        ${patientInfo.age ? `Age: ${patientInfo.age}${patientInfo.sex ? ` | Sex: ${patientInfo.sex}` : ''}<br>` : ''}
                        ${patientInfo.studyDescription ? `Study: ${patientInfo.studyDescription}<br>` : ''}
                        Date: ${patientInfo.studyDate}
                    </div>
                    ` : ''}
                </div>
            </div>
            ` : ''}

            <div class="viewport-grid">
                ${viewportState.viewports.map(vp => `
                    <div class="viewport-cell">
                        <img src="${vp.dataUrl}" alt="${vp.name}">
                        ${settings.includePatientInfo ? `
                        <div class="viewport-overlay overlay-top-left">
                            ${vp.name}
                        </div>
                        ` : ''}
                        ${settings.includeWindowLevel && vp.windowWidth && vp.windowCenter ? `
                        <div class="viewport-overlay overlay-bottom-right">
                            W: ${Math.round(vp.windowWidth)} L: ${Math.round(vp.windowCenter)}
                        </div>
                        ` : ''}
                    </div>
                `).join('')}
            </div>

            <div class="page-footer">
                <span>${settings.includeTimestamp ? `Generated: ${new Date().toLocaleString()}` : ''}</span>
                <span>DICOM Viewer - Accurate Diagnostics</span>
                <span>For Medical Use Only</span>
            </div>
        </div>
    </div>
</body>
</html>
        `;
    }

    async printReport(reportId, previewOnly = false) {
        try {
            const basePath = document.querySelector('meta[name="base-path"]')?.content || '';
            const response = await fetch(`${basePath}/api/reports/by-id.php?id=${reportId}`);
            const data = await response.json();

            if (!data.success || !data.data) {
                throw new Error('Report not found');
            }

            const report = data.data;
            const printHTML = this.generateReportPrintHTML(report, previewOnly);

            const printWindow = window.open('', '_blank', 'width=900,height=1100');
            if (!printWindow) {
                throw new Error('Please allow popups to print');
            }

            printWindow.document.write(printHTML);
            printWindow.document.close();

            if (!previewOnly) {
                setTimeout(() => printWindow.print(), 500);
            }

        } catch (error) {
            console.error('Report print error:', error);
            throw error;
        }
    }

    generateReportPrintHTML(report, previewOnly) {
        const settings = this.printSettings;

        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Medical Report - ${report.patient_name}</title>
    <style>
        @page {
            size: A4 portrait;
            margin: 15mm;
        }

        @media print {
            body { margin: 0; padding: 0; }
            .no-print { display: none !important; }
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: 'Segoe UI', Arial, sans-serif;
            background: ${previewOnly ? '#f5f5f5' : '#fff'};
            color: #000;
            line-height: 1.6;
        }

        .print-toolbar {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: #1a1a2e;
            padding: 15px 30px;
            display: flex;
            justify-content: space-between;
            z-index: 1000;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        }

        .print-toolbar h4 {
            color: #fff;
            margin: 0;
        }

        .print-toolbar button {
            padding: 10px 24px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 600;
        }

        .btn-print {
            background: #0d6efd;
            color: #fff;
            margin-right: 10px;
        }

        .btn-close {
            background: #6c757d;
            color: #fff;
        }

        .report-content {
            padding-top: ${previewOnly ? '80px' : '0'};
            max-width: 210mm;
            margin: 0 auto;
            background: #fff;
            padding: ${previewOnly ? '80px 40px 40px' : '40px'};
        }

        .report-header {
            text-align: center;
            border-bottom: 3px solid #0d6efd;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }

        .report-header h1 {
            color: #0d6efd;
            font-size: 28px;
            margin-bottom: 10px;
        }

        .report-header p {
            color: #666;
            font-size: 14px;
        }

        .patient-section {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
        }

        .patient-section h3 {
            color: #333;
            font-size: 18px;
            margin-bottom: 15px;
            border-bottom: 2px solid #0d6efd;
            padding-bottom: 8px;
        }

        .patient-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
        }

        .patient-field {
            font-size: 13px;
        }

        .patient-field strong {
            color: #555;
            display: block;
            margin-bottom: 2px;
        }

        .report-section {
            margin-bottom: 25px;
        }

        .report-section h4 {
            color: #0d6efd;
            font-size: 16px;
            margin-bottom: 12px;
            padding-bottom: 6px;
            border-bottom: 1px solid #dee2e6;
        }

        .report-section p {
            font-size: 13px;
            color: #333;
            white-space: pre-wrap;
            line-height: 1.8;
        }

        .report-footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid #dee2e6;
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 30px;
        }

        .signature-box {
            text-align: center;
        }

        .signature-line {
            border-top: 2px solid #333;
            margin: 60px auto 10px;
            width: 200px;
        }

        .signature-box p {
            font-size: 12px;
            color: #666;
        }

        .report-meta {
            margin-top: 30px;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 6px;
            font-size: 11px;
            color: #666;
            text-align: center;
        }
    </style>
</head>
<body>
    ${previewOnly ? `
    <div class="print-toolbar no-print">
        <h4>Medical Report Preview</h4>
        <div>
            <button class="btn-print" onclick="window.print()">Print Report</button>
            <button class="btn-close" onclick="window.close()">Close</button>
        </div>
    </div>
    ` : ''}

    <div class="report-content">
        <div class="report-header">
            <h1>${report.institution_name || 'Medical Imaging Center'}</h1>
            <p>Department of Radiology & Medical Imaging</p>
            <p>Diagnostic Imaging Report</p>
        </div>

        <div class="patient-section">
            <h3>Patient Information</h3>
            <div class="patient-grid">
                <div class="patient-field">
                    <strong>Patient Name:</strong>
                    ${report.patient_name || 'N/A'}
                </div>
                <div class="patient-field">
                    <strong>Patient ID:</strong>
                    ${report.patient_id || 'N/A'}
                </div>
                <div class="patient-field">
                    <strong>Age:</strong>
                    ${report.patient_age || 'N/A'}
                </div>
                <div class="patient-field">
                    <strong>Sex:</strong>
                    ${report.patient_sex || 'N/A'}
                </div>
                <div class="patient-field">
                    <strong>Study Date:</strong>
                    ${report.study_date || 'N/A'}
                </div>
                <div class="patient-field">
                    <strong>Accession Number:</strong>
                    ${report.accession_number || 'N/A'}
                </div>
            </div>
        </div>

        <div class="report-section">
            <h4>Clinical Information</h4>
            <p>${report.clinical_info || 'No clinical information provided.'}</p>
        </div>

        <div class="report-section">
            <h4>Imaging Findings</h4>
            <p>${report.findings || 'No findings recorded.'}</p>
        </div>

        <div class="report-section">
            <h4>Impression</h4>
            <p>${report.impression || 'No impression recorded.'}</p>
        </div>

        ${report.recommendations ? `
        <div class="report-section">
            <h4>Recommendations</h4>
            <p>${report.recommendations}</p>
        </div>
        ` : ''}

        <div class="report-footer">
            <div class="signature-box">
                <div class="signature-line"></div>
                <p><strong>${report.radiologist_name || 'Radiologist'}</strong></p>
                <p>${report.radiologist_license || ''}</p>
            </div>
            <div class="signature-box">
                <div class="signature-line"></div>
                <p><strong>Verified By</strong></p>
                <p>Date: ${new Date(report.updated_at || report.created_at).toLocaleDateString()}</p>
            </div>
        </div>

        <div class="report-meta">
            <p>Report ID: ${report.id} | Status: ${(report.status || 'draft').toUpperCase()}</p>
            <p>Generated: ${new Date().toLocaleString()} | This is an electronically generated report</p>
            <p><strong>FOR MEDICAL USE ONLY - CONFIDENTIAL</strong></p>
        </div>
    </div>
</body>
</html>
        `;
    }

    // Loading modal helpers
    showLoadingModal(message, progress) {
        let modal = document.getElementById('printLoadingModalV3');
        if (!modal) {
            const html = `
                <div id="printLoadingModalV3" class="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style="background: rgba(0,0,0,0.8); z-index: 9999;">
                    <div class="bg-dark text-light p-4 rounded-3 text-center border border-primary" style="min-width: 350px;">
                        <div class="spinner-border text-primary mb-3" role="status" style="width: 3rem; height: 3rem;"></div>
                        <div id="printLoadingMessageV3" class="mb-3 fs-5">${message}</div>
                        <div class="progress" style="height: 8px;">
                            <div id="printLoadingProgressV3" class="progress-bar progress-bar-striped progress-bar-animated bg-primary" style="width: ${progress}%"></div>
                        </div>
                        <small class="text-muted mt-2 d-block" id="printLoadingPercentV3">${progress}%</small>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', html);
        } else {
            this.updateLoadingProgress(message, progress);
        }
    }

    updateLoadingProgress(message, progress) {
        const messageEl = document.getElementById('printLoadingMessageV3');
        const progressEl = document.getElementById('printLoadingProgressV3');
        const percentEl = document.getElementById('printLoadingPercentV3');

        if (messageEl) messageEl.textContent = message;
        if (progressEl) progressEl.style.width = `${progress}%`;
        if (percentEl) percentEl.textContent = `${progress}%`;
    }

    hideLoadingModal() {
        const modal = document.getElementById('printLoadingModalV3');
        if (modal) modal.remove();
    }

    showToast(message, type = 'info') {
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
    console.log('✓ Print Manager v3.0 initialized (Exact viewport capture + Report printing)');
});
