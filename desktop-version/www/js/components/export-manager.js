// Export Functions Component
window.DICOM_VIEWER.ExportManager = {
    initialize() {
        console.log('Initializing Export Manager...');
        this.setupExportButtons();
    },

    setupExportButtons() {
        // Export as Image
        const exportImageBtn = document.getElementById('exportImage');
        if (exportImageBtn) {
            exportImageBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.exportCurrentViewAsImage();
            });
        }

        // Export Report
        const exportReportBtn = document.getElementById('exportReport');
        if (exportReportBtn) {
            exportReportBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.exportReport();
            });
        }

        // Export DICOM
        const exportDicomBtn = document.getElementById('exportDicom');
        if (exportDicomBtn) {
            exportDicomBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.exportDicomFile();
            });
        }

        // Export MPR Views
        const exportMPRBtn = document.getElementById('exportMPR');
        if (exportMPRBtn) {
            exportMPRBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.exportMPRViews();
            });
        }

        // Export as PDF
        const exportPDFBtn = document.getElementById('exportPDF');
        if (exportPDFBtn) {
            exportPDFBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.exportViewportAsPDF();
            });
        }

        console.log('Export buttons initialized');
    },

    // Export current viewport as PDF
    async exportViewportAsPDF() {
        console.log('Exporting viewport as PDF...');

        const state = window.DICOM_VIEWER.STATE;
        const activeViewport = state.activeViewport;

        if (!activeViewport) {
            window.DICOM_VIEWER.showAISuggestion('No active viewport to export');
            return;
        }

        try {
            const enabledElement = cornerstone.getEnabledElement(activeViewport);
            if (!enabledElement || !enabledElement.image) {
                window.DICOM_VIEWER.showAISuggestion('No image loaded in active viewport');
                return;
            }

            // Show loading message
            window.DICOM_VIEWER.showAISuggestion('Generating PDF, please wait...');

            // Get the canvas from the viewport
            const canvas = activeViewport.querySelector('canvas');
            if (!canvas) {
                throw new Error('Canvas not found');
            }

            // Get image metadata
            const image = enabledElement.image;
            const imageData = state.currentSeriesImages[state.currentImageIndex] || {};
            const patientName = imageData.patient_name || 'Unknown Patient';
            const studyDescription = imageData.study_description || 'Unknown Study';
            const seriesDescription = imageData.series_description || 'Unknown Series';
            const imageNumber = state.currentImageIndex + 1;
            const totalImages = state.currentSeriesImages.length;
            const studyDate = imageData.study_date || '';

            // Use html2canvas to capture the viewport
            const capturedCanvas = await html2canvas(activeViewport, {
                backgroundColor: '#000000',
                scale: 2, // Higher quality
                logging: false
            });

            // Create jsPDF instance
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'a4'
            });

            // Calculate image dimensions to fit page
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const canvasWidth = capturedCanvas.width;
            const canvasHeight = capturedCanvas.height;

            // Calculate scaling to fit page while maintaining aspect ratio
            const ratio = Math.min(
                (pdfWidth - 20) / canvasWidth,
                (pdfHeight - 40) / canvasHeight
            );

            const imgWidth = canvasWidth * ratio;
            const imgHeight = canvasHeight * ratio;
            const x = (pdfWidth - imgWidth) / 2;
            const y = 30;

            // Add header
            pdf.setFontSize(16);
            pdf.setTextColor(0, 0, 0);
            pdf.text('DICOM Viewer Export', pdfWidth / 2, 15, { align: 'center' });

            // Add patient info
            pdf.setFontSize(10);
            pdf.text(`Patient: ${patientName}`, 10, 25);
            pdf.text(`Study: ${studyDescription}`, pdfWidth / 2, 25);
            pdf.text(`Date: ${studyDate}`, pdfWidth - 10, 25, { align: 'right' });

            // Add image
            const imgData = capturedCanvas.toDataURL('image/jpeg', 0.95);
            pdf.addImage(imgData, 'JPEG', x, y, imgWidth, imgHeight);

            // Add footer
            const footerY = pdfHeight - 10;
            pdf.setFontSize(8);
            pdf.setTextColor(100, 100, 100);
            pdf.text(`Series: ${seriesDescription}`, 10, footerY);
            pdf.text(`Image ${imageNumber} of ${totalImages}`, pdfWidth / 2, footerY, { align: 'center' });
            pdf.text(`Generated: ${new Date().toLocaleString()}`, pdfWidth - 10, footerY, { align: 'right' });

            // Generate filename
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            const safeName = patientName.replace(/[^a-z0-9]/gi, '_');
            const filename = `DICOM_${safeName}_${timestamp}.pdf`;

            // Save PDF
            pdf.save(filename);

            window.DICOM_VIEWER.showAISuggestion('PDF exported successfully');

        } catch (error) {
            console.error('Error exporting PDF:', error);
            window.DICOM_VIEWER.showAISuggestion('Failed to export PDF: ' + error.message);
        }
    },

    // Export current viewport as image
    exportCurrentViewAsImage() {
        console.log('Exporting current view as image...');
        
        const state = window.DICOM_VIEWER.STATE;
        const activeViewport = state.activeViewport;

        if (!activeViewport) {
            window.DICOM_VIEWER.showAISuggestion('No active viewport to export');
            return;
        }

        try {
            const enabledElement = cornerstone.getEnabledElement(activeViewport);
            if (!enabledElement || !enabledElement.image) {
                window.DICOM_VIEWER.showAISuggestion('No image loaded in active viewport');
                return;
            }

            // Get the canvas from the viewport
            const canvas = activeViewport.querySelector('canvas');
            if (!canvas) {
                throw new Error('Canvas not found');
            }

            // Convert canvas to blob and download
            canvas.toBlob((blob) => {
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                
                // Generate filename with timestamp and patient info
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
                const patientName = state.currentSeriesImages[state.currentImageIndex]?.patient_name || 'Unknown';
                const safeName = patientName.replace(/[^a-z0-9]/gi, '_');
                
                link.download = `DICOM_${safeName}_${timestamp}.png`;
                link.href = url;
                link.click();
                
                // Clean up
                setTimeout(() => URL.revokeObjectURL(url), 100);
                
                window.DICOM_VIEWER.showAISuggestion('Image exported successfully');
            }, 'image/png');

        } catch (error) {
            console.error('Error exporting image:', error);
            window.DICOM_VIEWER.showAISuggestion('Failed to export image: ' + error.message);
        }
    },

    // Export DICOM file (original file)
    exportDicomFile() {
        console.log('Exporting DICOM file...');
        
        const state = window.DICOM_VIEWER.STATE;
        
        if (!state.currentFileId) {
            window.DICOM_VIEWER.showAISuggestion('No DICOM file loaded');
            return;
        }

        try {
            // Create download link
            const link = document.createElement('a');
            link.href = `get_dicom_fast.php?id=${state.currentFileId}&download=1`;
            
            // Get filename from current image
            const currentImage = state.currentSeriesImages[state.currentImageIndex];
            link.download = currentImage?.file_name || 'dicom_file.dcm';
            
            link.click();
            
            window.DICOM_VIEWER.showAISuggestion('DICOM file download started');
            
        } catch (error) {
            console.error('Error exporting DICOM file:', error);
            window.DICOM_VIEWER.showAISuggestion('Failed to export DICOM file: ' + error.message);
        }
    },

    // Export report
    exportReport() {
        console.log('Exporting report...');
        
        const state = window.DICOM_VIEWER.STATE;
        
        if (!state.currentFileId) {
            window.DICOM_VIEWER.showAISuggestion('No study loaded');
            return;
        }

        // Check if report exists
        if (!window.DICOM_VIEWER.MANAGERS.reportingSystem) {
            window.DICOM_VIEWER.showAISuggestion('Reporting system not available');
            return;
        }

        try {
            const reportingSystem = window.DICOM_VIEWER.MANAGERS.reportingSystem;
            
            // Try to get existing report
            this.fetchAndExportReport(state.currentFileId);
            
        } catch (error) {
            console.error('Error exporting report:', error);
            window.DICOM_VIEWER.showAISuggestion('Failed to export report: ' + error.message);
        }
    },

    async fetchAndExportReport(fileId) {
        try {
            const response = await fetch(`api/get_study_report.php?imageId=${fileId}`);
            const data = await response.json();
            
            if (data.success && data.report) {
                // Export as PDF or HTML
                this.exportReportAsPDF(data.report);
            } else {
                window.DICOM_VIEWER.showAISuggestion('No report found for this study. Create one first.');
            }
            
        } catch (error) {
            console.error('Error fetching report:', error);
            window.DICOM_VIEWER.showAISuggestion('Error: ' + error.message);
        }
    },

    exportReportAsPDF(report) {
        // For now, export as HTML (can be printed to PDF)
        const htmlContent = this.generateReportHTML(report);
        
        // Create blob and download
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        link.download = `Medical_Report_${timestamp}.html`;
        link.href = url;
        link.click();
        
        setTimeout(() => URL.revokeObjectURL(url), 100);
        
        window.DICOM_VIEWER.showAISuggestion('Report exported. Open in browser and print to PDF.');
    },

    generateReportHTML(report) {
        const data = typeof report === 'string' ? JSON.parse(report) : report;
        
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Medical Report</title>
    <style>
        body {
            font-family: 'Arial', sans-serif;
            max-width: 800px;
            margin: 40px auto;
            padding: 20px;
            line-height: 1.6;
            color: #333;
        }
        .header {
            text-align: center;
            border-bottom: 3px solid #2c3e50;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .header h1 {
            color: #2c3e50;
            margin: 0;
        }
        .section {
            margin-bottom: 25px;
            padding: 15px;
            background: #f8f9fa;
            border-left: 4px solid #007bff;
        }
        .section h2 {
            color: #007bff;
            margin-top: 0;
            font-size: 18px;
        }
        .info-grid {
            display: grid;
            grid-template-columns: 150px 1fr;
            gap: 10px;
            margin: 10px 0;
        }
        .label {
            font-weight: bold;
            color: #555;
        }
        .findings {
            white-space: pre-wrap;
            background: white;
            padding: 15px;
            border: 1px solid #ddd;
            border-radius: 4px;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid #ddd;
            text-align: center;
            color: #777;
            font-size: 12px;
        }
        @media print {
            body { margin: 0; }
            .no-print { display: none; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>📋 Medical Imaging Report</h1>
        <p>Generated: ${new Date().toLocaleString()}</p>
    </div>

    <div class="section">
        <h2>Patient Information</h2>
        <div class="info-grid">
            <div class="label">Patient Name:</div>
            <div>${data.patientInfo?.name || 'N/A'}</div>
            <div class="label">Patient ID:</div>
            <div>${data.patientInfo?.id || 'N/A'}</div>
            <div class="label">Date of Birth:</div>
            <div>${data.patientInfo?.dob || 'N/A'}</div>
            <div class="label">Sex:</div>
            <div>${data.patientInfo?.sex || 'N/A'}</div>
        </div>
    </div>

    <div class="section">
        <h2>Study Information</h2>
        <div class="info-grid">
            <div class="label">Study Date:</div>
            <div>${data.studyInfo?.date || 'N/A'}</div>
            <div class="label">Modality:</div>
            <div>${data.studyInfo?.modality || 'N/A'}</div>
            <div class="label">Body Part:</div>
            <div>${data.studyInfo?.bodyPart || 'N/A'}</div>
            <div class="label">Study Description:</div>
            <div>${data.studyInfo?.description || 'N/A'}</div>
        </div>
    </div>

    <div class="section">
        <h2>Clinical History</h2>
        <div class="findings">${data.clinicalHistory || 'Not provided'}</div>
    </div>

    <div class="section">
        <h2>Findings</h2>
        <div class="findings">${data.findings || 'No findings reported'}</div>
    </div>

    <div class="section">
        <h2>Impression</h2>
        <div class="findings">${data.impression || 'No impression provided'}</div>
    </div>

    <div class="section">
        <h2>Recommendations</h2>
        <div class="findings">${data.recommendations || 'No recommendations'}</div>
    </div>

    <div class="footer">
        <p>This report was generated by DICOM Viewer Pro</p>
        <p class="no-print">To save as PDF: Print this page and choose "Save as PDF"</p>
    </div>
</body>
</html>`;
    },

    // Export all MPR views
    async exportMPRViews() {
        console.log('Exporting MPR views...');
        
        const state = window.DICOM_VIEWER.STATE;
        
        if (!state.mprEnabled || !state.mprViewports) {
            window.DICOM_VIEWER.showAISuggestion('MPR views not available. Load a multi-slice series first.');
            return;
        }

        try {
            const zip = await this.createMPRZip();
            if (zip) {
                window.DICOM_VIEWER.showAISuggestion('MPR views exported successfully');
            }
        } catch (error) {
            console.error('Error exporting MPR views:', error);
            window.DICOM_VIEWER.showAISuggestion('Failed to export MPR views: ' + error.message);
        }
    },

    async createMPRZip() {
        const state = window.DICOM_VIEWER.STATE;
        const viewportNames = ['original', 'axial', 'sagittal', 'coronal'];
        const images = [];

        // Collect all viewport images
        for (const name of viewportNames) {
            const viewport = state.mprViewports[name];
            if (!viewport) continue;

            try {
                const enabledElement = cornerstone.getEnabledElement(viewport);
                if (enabledElement && enabledElement.image) {
                    const canvas = viewport.querySelector('canvas');
                    if (canvas) {
                        const blob = await new Promise(resolve => 
                            canvas.toBlob(resolve, 'image/png')
                        );
                        images.push({ name, blob });
                    }
                }
            } catch (error) {
                console.warn(`Could not export ${name} view:`, error);
            }
        }

        if (images.length === 0) {
            throw new Error('No MPR views available to export');
        }

        // Since we can't use JSZip in browser without library, download individually
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const patientName = state.currentSeriesImages[0]?.patient_name || 'Unknown';
        const safeName = patientName.replace(/[^a-z0-9]/gi, '_');

        for (const img of images) {
            const url = URL.createObjectURL(img.blob);
            const link = document.createElement('a');
            link.download = `MPR_${safeName}_${img.name}_${timestamp}.png`;
            link.href = url;
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 100);
            
            // Small delay between downloads
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        return true;
    }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    if (window.DICOM_VIEWER && window.DICOM_VIEWER.ExportManager) {
        // Wait a bit for other managers to initialize
        setTimeout(() => {
            window.DICOM_VIEWER.ExportManager.initialize();
        }, 1000);
    }
});

console.log('Export Manager module loaded');
