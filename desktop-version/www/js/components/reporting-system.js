// Medical Reporting System - COMPLETE FIXED VERSION
window.DICOM_VIEWER.ReportingSystem = class {
    constructor() {
        this.currentReport = null;
        this.reportingMode = false;
        this.currentTemplate = null;
        this.reportData = {};
        this.autosaveInterval = null;
        
        this.rightSidebar = document.querySelector('.sidebar:last-child');
        this.originalSidebarContent = null;
        this.reportingTemplateSelector = null;
        this.reportingToolsPanel = null;
        
        this.originalMainContentStyle = null;
        this.originalViewportStyle = null;
        
        this.templates = this.getReportTemplates();
    }

    initialize() {
        console.log('Initializing Medical Reporting System...');
        this.createReportButtonsUI();
        this.setupComprehensiveReportChecking();
        console.log('✓ Medical Reporting System initialized');
    }

    getReportTemplates() {
        return {
            'ct_head': {
                name: 'CT Head/Brain',
                category: 'CT',
                sections: {
                    indication: 'Clinical indication for the study',
                    technique: 'Non-contrast CT head performed in axial plane with 5mm slice thickness',
                    findings: {
                        brain_parenchyma: 'The brain parenchyma demonstrates...',
                        ventricles: 'The ventricular system is...',
                        csf_spaces: 'The CSF spaces are...',
                        skull: 'The calvarium and skull base are...',
                        soft_tissues: 'The soft tissues are...'
                    },
                    impression: 'IMPRESSION:\n1. '
                }
            },
            'ct_chest': {
                name: 'CT Chest',
                category: 'CT',
                sections: {
                    indication: 'Clinical indication for the study',
                    technique: 'CT chest performed with/without contrast',
                    findings: {
                        lungs: 'The lungs are clear bilaterally...',
                        pleura: 'No pleural effusion or pneumothorax...',
                        heart: 'The heart size is normal...',
                        mediastinum: 'The mediastinum is unremarkable...',
                        bones: 'Visualized osseous structures...'
                    },
                    impression: 'IMPRESSION:\n1. '
                }
            },
            'ct_abdomen': {
                name: 'CT Abdomen/Pelvis',
                category: 'CT',
                sections: {
                    indication: 'Clinical indication for the study',
                    technique: 'CT abdomen and pelvis with oral and IV contrast',
                    findings: {
                        liver: 'The liver is normal in size and attenuation...',
                        gallbladder: 'The gallbladder is unremarkable...',
                        pancreas: 'The pancreas appears normal...',
                        kidneys: 'Both kidneys are normal in size...',
                        bowel: 'The bowel loops are unremarkable...',
                        pelvis: 'The pelvis is unremarkable...'
                    },
                    impression: 'IMPRESSION:\n1. '
                }
            },
            'mri_brain': {
                name: 'MRI Brain',
                category: 'MRI',
                sections: {
                    indication: 'Clinical indication for the study',
                    technique: 'MRI brain with T1, T2, FLAIR, and DWI sequences',
                    findings: {
                        brain_parenchyma: 'The brain parenchyma is normal...',
                        white_matter: 'The white matter is unremarkable...',
                        ventricles: 'The ventricular system is normal...',
                        cerebellum: 'The cerebellum and brainstem are normal...',
                        vessels: 'No evidence of acute infarction...'
                    },
                    impression: 'IMPRESSION:\n1. '
                }
            },
            'xray_chest': {
                name: 'X-Ray Chest',
                category: 'X-Ray',
                sections: {
                    indication: 'Clinical indication for the study',
                    technique: 'Frontal and lateral chest radiographs',
                    findings: {
                        lungs: 'The lungs are clear without consolidation...',
                        heart: 'The cardiac silhouette is normal...',
                        bones: 'The osseous structures are intact...',
                        soft_tissues: 'The soft tissues are unremarkable...'
                    },
                    impression: 'IMPRESSION:\n1. '
                }
            },
            'ultrasound_abdomen': {
                name: 'Ultrasound Abdomen',
                category: 'Ultrasound',
                sections: {
                    indication: 'Clinical indication for the study',
                    technique: 'Real-time ultrasound examination',
                    findings: {
                        liver: 'The liver is normal in size and echogenicity...',
                        gallbladder: 'The gallbladder is unremarkable...',
                        kidneys: 'Both kidneys are normal...',
                        pancreas: 'Visualized portions of pancreas...',
                        vessels: 'The aorta and IVC are normal...'
                    },
                    impression: 'IMPRESSION:\n1. '
                }
            },
            'mammo': {
                name: 'Mammography',
                category: 'Mammography',
                sections: {
                    indication: 'Clinical indication for the study',
                    technique: 'Digital mammography with MLO and CC views',
                    findings: {
                        composition: 'Breast composition: ACR Category...',
                        masses: 'No suspicious masses identified...',
                        calcifications: 'No suspicious calcifications...',
                        asymmetries: 'No focal asymmetries...',
                        skin: 'The skin and nipples are unremarkable...'
                    },
                    impression: 'IMPRESSION:\nBI-RADS Category: \n1. '
                }
            }
        };
    }
// Add this debugging method to check button visibility
debugButtonVisibility() {
    const container = document.getElementById('report-buttons-container');
    const newReportBtn = document.getElementById('new-report-btn');
    const viewReportBtn = document.getElementById('view-report-btn');
    
    console.log('=== REPORT BUTTONS DEBUG ===');
    console.log('Container exists:', !!container);
    console.log('Container display:', container?.style.display);
    console.log('Container computed display:', container ? window.getComputedStyle(container).display : 'N/A');
    console.log('New Report Button exists:', !!newReportBtn);
    console.log('View Report Button exists:', !!viewReportBtn);
    console.log('View Report Button display:', viewReportBtn?.style.display);
    
    if (container) {
        console.log('Container position:', {
            bottom: container.style.bottom,
            left: container.style.left,
            zIndex: container.style.zIndex,
            transform: container.style.transform
        });
    }
    console.log('=== END DEBUG ===');
}
    getTemplateIcon(category) {
        const icons = {
            'CT': '<i class="bi bi-diagram-3"></i>',
            'MRI': '<i class="bi bi-magnet"></i>',
            'X-Ray': '<i class="bi bi-radioactive"></i>',
            'Ultrasound': '<i class="bi bi-soundwave"></i>',
            'Mammography': '<i class="bi bi-gender-female"></i>'
        };
        return icons[category] || '<i class="bi bi-file-medical"></i>';
    }

createReportButtonsUI() {
    const existingContainer = document.getElementById('report-buttons-container');
    if (existingContainer) existingContainer.remove();
    
    const buttonContainer = document.createElement('div');
    buttonContainer.id = 'report-buttons-container';
    buttonContainer.style.cssText = `
        position: fixed;
        left: auto;
        right: 20px;
        transform: none;
        bottom: 80px;
        z-index: 1050;
        display: flex;
        gap: 10px;
        align-items: center;
        visibility: hidden;
        opacity: 0;
        transition: opacity 0.3s ease;
    `;
    
    const viewReportBtn = document.createElement('button');
    viewReportBtn.id = 'view-report-btn';
    viewReportBtn.className = 'btn btn-success';
    viewReportBtn.style.cssText = `
        padding: 12px 24px;
        border-radius: 25px;
        font-size: 16px;
        font-weight: 500;
        border: 2px solid #28a745;
        background-color: #28a745;
        color: white;
        display: none;
        transition: all 0.3s ease;
        box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3);
    `;
    viewReportBtn.innerHTML = `<i class="bi bi-eye me-2"></i>View Report`;
    viewReportBtn.title = 'View existing medical report';
    
    // Hover effect
    viewReportBtn.addEventListener('mouseenter', () => {
        viewReportBtn.style.backgroundColor = '#218838';
        viewReportBtn.style.borderColor = '#218838';
        viewReportBtn.style.transform = 'scale(1.05)';
        viewReportBtn.style.boxShadow = '0 6px 16px rgba(40, 167, 69, 0.4)';
    });
    
    viewReportBtn.addEventListener('mouseleave', () => {
        viewReportBtn.style.backgroundColor = '#28a745';
        viewReportBtn.style.borderColor = '#28a745';
        viewReportBtn.style.transform = 'scale(1)';
        viewReportBtn.style.boxShadow = '0 4px 12px rgba(40, 167, 69, 0.3)';
    });
    
    viewReportBtn.addEventListener('click', () => this.loadReportForImage());
    
    buttonContainer.appendChild(viewReportBtn);
    document.body.appendChild(buttonContainer);
    
    setTimeout(() => {
        buttonContainer.style.visibility = 'visible';
        buttonContainer.style.opacity = '1';
    }, 500);
    
    console.log('✓ View Report button UI created with Medical Report styling');
    return buttonContainer;
}

// Method to show the button container
showButtonContainer() {
    const buttonContainer = document.getElementById('report-buttons-container');
    if (buttonContainer) {
        buttonContainer.style.visibility = 'visible';
        buttonContainer.style.opacity = '1';
        console.log('✓ Button container shown');
    }
}

    createFloatingToolsPanel() {
        const existingPanel = document.getElementById('floating-tools-panel');
        if (existingPanel) existingPanel.remove();

        const toolsPanel = document.createElement('div');
        toolsPanel.id = 'floating-tools-panel';
        toolsPanel.className = 'floating-tools-panel';
        
        const tools = [
            { tool: 'Pan', icon: 'bi-arrows-move', label: 'Pan' },
            { tool: 'Zoom', icon: 'bi-zoom-in', label: 'Zoom' },
            { tool: 'Wwwc', icon: 'bi-sliders', label: 'W/L' },
            { tool: 'Length', icon: 'bi-rulers', label: 'Length' },
            { tool: 'Angle', icon: 'bi-triangle', label: 'Angle' },
            { tool: 'FreehandRoi', icon: 'bi-pencil', label: 'Draw' },
            { tool: 'EllipticalRoi', icon: 'bi-circle', label: 'Circle' },
            { tool: 'RectangleRoi', icon: 'bi-square', label: 'Rectangle' },
            { tool: 'Probe', icon: 'bi-eyedropper', label: 'Probe' }
        ];

        tools.forEach(toolConfig => {
            const toolBtn = document.createElement('button');
            toolBtn.className = `btn btn-secondary tool-btn d-flex flex-column justify-content-center align-items-center`;
            toolBtn.dataset.tool = toolConfig.tool;
            toolBtn.title = toolConfig.label;
            
            if (toolConfig.tool === 'Wwwc') {
                toolBtn.classList.remove('btn-secondary');
                toolBtn.classList.add('btn-primary');
            }
            
            toolBtn.innerHTML = `
                <i class="bi ${toolConfig.icon} tool-icon"></i>
                <span class="tool-label">${toolConfig.label}</span>
            `;
            
            toolBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                toolsPanel.querySelectorAll('.tool-btn').forEach(btn => {
                    btn.classList.remove('btn-primary');
                    btn.classList.add('btn-secondary');
                });
                
                toolBtn.classList.remove('btn-secondary');
                toolBtn.classList.add('btn-primary');
                
                const cornerstoneToolName = window.DICOM_VIEWER.CONSTANTS.TOOL_NAME_MAP[toolConfig.tool];
                if (cornerstoneToolName) {
                    window.DICOM_VIEWER.setActiveTool(cornerstoneToolName, toolBtn);
                }
            });
            
            toolsPanel.appendChild(toolBtn);
        });

        const separator = document.createElement('div');
        separator.style.cssText = 'width: 1px; height: 30px; background: #444; margin: 0 8px;';
        toolsPanel.appendChild(separator);

        const manipTools = [
            { icon: 'bi-arrow-counterclockwise', label: 'Reset', handler: () => window.DICOM_VIEWER.resetActiveViewport() },
            { icon: 'bi-circle-half', label: 'Invert', handler: () => window.DICOM_VIEWER.invertImage() }
        ];

        manipTools.forEach(tool => {
            const toolBtn = document.createElement('button');
            toolBtn.className = 'btn btn-outline-light tool-btn d-flex flex-column justify-content-center align-items-center';
            toolBtn.title = tool.label;
            toolBtn.innerHTML = `
                <i class="bi ${tool.icon} tool-icon"></i>
                <span class="tool-label">${tool.label}</span>
            `;
            toolBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (tool.handler) tool.handler();
            });
            toolsPanel.appendChild(toolBtn);
        });

        return toolsPanel;
    }

    enterReportingMode() {
        // DISABLED: The old reporting system modal is replaced by advanced-reporting-system.js
        // which provides auto-detection of modality and structured RSNA-based templates
        console.log('Old reporting mode disabled - using Advanced Reporting System instead');

        // Trigger the advanced reporting system if available
        if (window.DICOM_VIEWER.MANAGERS.advancedReporting) {
            window.DICOM_VIEWER.MANAGERS.advancedReporting.openReportingInterface();
            return;
        }

        // Fallback to old behavior only if advanced system not available
        if (this.reportingMode) return;

        console.log('Entering reporting mode...');
        this.reportingMode = true;
        document.body.classList.add('reporting-mode');

        // Show template selection modal instead of sidebar
        this.showTemplateSelectionModal();

        console.log('Reporting mode entered - select a template');
    }

    exitReportingMode() {
        if (!this.reportingMode) return;

        console.log('Exiting reporting mode...');
        this.reportingMode = false;
        this.stopAutosave();
        document.body.classList.remove('reporting-mode');

        const reportEditorContainer = document.getElementById('report-editor-container');
        if (reportEditorContainer) reportEditorContainer.remove();

        const floatingToolsPanel = document.getElementById('floating-tools-panel');
        if (floatingToolsPanel) floatingToolsPanel.remove();

        // Close template selection modal if open
        const templateModal = document.getElementById('templateSelectionModal');
        if (templateModal) {
            const modalInstance = bootstrap.Modal.getInstance(templateModal);
            if (modalInstance) modalInstance.hide();
            templateModal.remove();
        }

        document.removeEventListener('keydown', this.handleEscapeKey.bind(this));

        if (window.DICOM_VIEWER && window.DICOM_VIEWER.showAISuggestion) {
            window.DICOM_VIEWER.showAISuggestion('Exited reporting mode');
        }

        console.log('Reporting mode exited successfully');
    }

    showTemplateSelectionModal() {
        // Remove existing modal if present
        const existingModal = document.getElementById('templateSelectionModal');
        if (existingModal) existingModal.remove();

        const templateCategories = {};
        Object.entries(this.templates).forEach(([key, template]) => {
            if (!templateCategories[template.category]) {
                templateCategories[template.category] = [];
            }
            templateCategories[template.category].push({ key, ...template });
        });

        let templateCardsHTML = '';
        Object.entries(templateCategories).forEach(([category, templates]) => {
            templateCardsHTML += `
                <div class="col-12 mb-3">
                    <h6 class="text-primary mb-2">
                        <i class="bi bi-folder me-2"></i>${category}
                    </h6>
                    <div class="row g-2">
            `;
            templates.forEach(template => {
                templateCardsHTML += `
                    <div class="col-md-4 col-sm-6">
                        <div class="template-card p-3 border rounded text-center"
                             data-template="${template.key}"
                             style="cursor: pointer; background: rgba(13, 110, 253, 0.05); transition: all 0.2s ease;">
                            <div class="template-icon fs-1 mb-2">${this.getTemplateIcon(template.category)}</div>
                            <div class="template-name fw-semibold">${template.name}</div>
                        </div>
                    </div>
                `;
            });
            templateCardsHTML += `
                    </div>
                </div>
            `;
        });

        const modalHTML = `
            <div class="modal fade" id="templateSelectionModal" tabindex="-1">
                <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
                    <div class="modal-content bg-dark text-light">
                        <div class="modal-header border-secondary">
                            <h5 class="modal-title">
                                <i class="bi bi-file-medical me-2"></i>Select Report Template
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body" style="max-height: 70vh; overflow-y: auto;">
                            <div class="row">
                                ${templateCardsHTML}
                            </div>
                        </div>
                        <div class="modal-footer border-secondary">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);

        const modal = new bootstrap.Modal(document.getElementById('templateSelectionModal'));
        modal.show();

        // Add click handlers to template cards
        document.querySelectorAll('.template-card').forEach(card => {
            card.addEventListener('mouseenter', () => {
                card.style.background = 'rgba(13, 110, 253, 0.2)';
                card.style.transform = 'scale(1.05)';
            });
            card.addEventListener('mouseleave', () => {
                card.style.background = 'rgba(13, 110, 253, 0.05)';
                card.style.transform = 'scale(1)';
            });
            card.addEventListener('click', () => {
                const templateKey = card.dataset.template;
                this.selectTemplate(templateKey);
            });
        });

        // Clean up on close
        document.getElementById('templateSelectionModal').addEventListener('hidden.bs.modal', function() {
            this.remove();
        });
    }

    handleEscapeKey(event) {
        if (event.key === 'Escape' && this.reportingMode) {
            const templateSelector = document.getElementById('reporting-template-selector');
            if (templateSelector && templateSelector.style.display !== 'none') {
                event.preventDefault();
                this.exitReportingMode();
            }
        }
    }

    prepareSidebarForReporting() {
        if (!this.rightSidebar) {
            console.error('Right sidebar not found');
            return;
        }

        if (!this.originalSidebarContent) {
            this.originalSidebarContent = document.createElement('div');
            this.originalSidebarContent.id = 'original-sidebar-content';
            
            while (this.rightSidebar.firstChild) {
                this.originalSidebarContent.appendChild(this.rightSidebar.firstChild);
            }
            this.rightSidebar.appendChild(this.originalSidebarContent);

            this.reportingTemplateSelector = document.createElement('div');
            this.reportingTemplateSelector.id = 'reporting-template-selector';
            this.reportingTemplateSelector.style.display = 'none';
            this.reportingTemplateSelector.className = 'h-100 d-flex flex-column';
            this.rightSidebar.appendChild(this.reportingTemplateSelector);

            this.reportingToolsPanel = document.createElement('div');
            this.reportingToolsPanel.id = 'reporting-tools-panel';
            this.reportingToolsPanel.style.display = 'none';
            this.reportingToolsPanel.className = 'h-100';
            this.rightSidebar.appendChild(this.reportingToolsPanel);
        }

        this.reportingTemplateSelector.innerHTML = this.generateTemplateSelectionHTML();
        setTimeout(() => this.attachTemplateEvents(), 100);
    }

    generateTemplateSelectionHTML() {
        const templateCategories = {};
        Object.entries(this.templates).forEach(([key, template]) => {
            if (!templateCategories[template.category]) {
                templateCategories[template.category] = [];
            }
            templateCategories[template.category].push({ key, ...template });
        });

        let gridItemsHTML = '';
        Object.entries(templateCategories).forEach(([category, templates]) => {
            gridItemsHTML += `<h6 class="template-category-header text-primary mb-2"><i class="bi bi-folder me-2"></i>${category}</h6>`;
            templates.forEach(template => {
                gridItemsHTML += `
                    <div class="template-card mb-2 p-3 border rounded" data-template="${template.key}" 
                         style="cursor: pointer; background: rgba(255,255,255,0.05); transition: all 0.2s ease;">
                        <div class="template-icon text-center mb-2 fs-4">${this.getTemplateIcon(template.category)}</div>
                        <div class="template-name text-center small text-white">${template.name}</div>
                    </div>
                `;
            });
        });

        return `
            <div class="p-3 border-bottom bg-dark">
                <div class="d-flex justify-content-between align-items-center">
                    <h6 class="text-light mb-0">
                        <i class="bi bi-file-medical me-2"></i>Select Report Template
                    </h6>
                    <button class="btn btn-sm btn-outline-light" id="exit-reporting-btn" type="button">
                        <i class="bi bi-x-lg"></i>
                    </button>
                </div>
            </div>
            <div class="template-selection p-3" style="max-height: 70vh; overflow-y: auto;">
                <div class="alert alert-info alert-sm mb-3">
                    <i class="bi bi-info-circle me-2"></i>
                    Choose a template to start creating your medical report
                </div>
                ${gridItemsHTML}
            </div>
            <div class="p-3 border-top">
                <button class="btn btn-outline-secondary w-100" id="cancel-reporting-btn">
                    <i class="bi bi-arrow-left me-2"></i>Cancel
                </button>
            </div>
        `;
    }

    attachTemplateEvents() {
        const exitBtn = document.getElementById('exit-reporting-btn');
        if (exitBtn) {
            exitBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.exitReportingMode();
            });
        }

        const cancelBtn = document.getElementById('cancel-reporting-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.exitReportingMode();
            });
        }

        const templateCards = document.querySelectorAll('.template-card');
        templateCards.forEach(card => {
            card.addEventListener('mouseenter', () => {
                card.style.background = 'rgba(13, 110, 253, 0.2)';
                card.style.transform = 'translateY(-2px)';
            });
            
            card.addEventListener('mouseleave', () => {
                card.style.background = 'rgba(255,255,255,0.05)';
                card.style.transform = 'translateY(0)';
            });
            
            card.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const templateKey = card.dataset.template;
                card.style.background = 'rgba(40, 167, 69, 0.3)';
                setTimeout(() => this.selectTemplate(templateKey), 200);
            });
        });

        document.addEventListener('keydown', this.handleEscapeKey.bind(this));
    }

    updateSidebarForReporting() {
        if (!this.reportingToolsPanel) return;
        this.reportingToolsPanel.innerHTML = this.generateReportingToolsHTML();
        this.attachSidebarEvents();
    }

    generateReportingToolsHTML() {
        return `
            <div class="p-3 border-bottom">
                <h6 class="text-light mb-2"><i class="bi bi-file-medical-fill me-2"></i>Report Tools</h6>
                <div class="btn-group w-100 mb-3">
                    <button class="btn btn-sm btn-success" id="quick-save"><i class="bi bi-save me-1"></i>Save</button>
                    <button class="btn btn-sm btn-outline-secondary" id="exit-reporting-sidebar"><i class="bi bi-x-lg"></i></button>
                </div>
                <div class="auto-save-status small"><i class="bi bi-clock me-1"></i>Auto-saving...</div>
            </div>
            <div class="p-3 border-bottom">
                <h6 class="text-light mb-3">Quick Inserts</h6>
                <div class="d-grid gap-1">
                    <button class="btn btn-sm btn-outline-info" data-insert="normal">Normal Study</button>
                    <button class="btn btn-sm btn-outline-warning" data-insert="followup">Recommend Follow-up</button>
                </div>
            </div>
            <div class="p-3">
                <h6 class="text-light mb-3">Report Status</h6>
                <div class="status-item d-flex justify-content-between mb-2">
                    <span class="small">Template:</span>
                    <span class="badge bg-primary small">${this.templates[this.currentTemplate]?.name || 'Custom'}</span>
                </div>
                <div class="status-item d-flex justify-content-between mb-2">
                    <span class="small">Last Saved:</span>
                    <span class="badge bg-success small" id="last-saved">Never</span>
                </div>
                <div class="status-item d-flex justify-content-between">
                    <span class="small">Word Count:</span>
                    <span class="badge bg-info small" id="word-count">0</span>
                </div>
            </div>
        `;
    }

    attachSidebarEvents() {
        document.getElementById('quick-save')?.addEventListener('click', () => this.saveReport());
        document.getElementById('exit-reporting-sidebar')?.addEventListener('click', () => this.exitReportingMode());
        
        document.querySelectorAll('[data-insert]').forEach(btn => {
            btn.addEventListener('click', () => this.insertQuickText(btn.dataset.insert));
        });
    }

    selectTemplate(templateKey) {
        const template = this.templates[templateKey];
        if (!template) return;

        this.currentTemplate = templateKey;
        this.reportData = this.initializeReportData(template);

        console.log(`Selected template: ${template.name}`);

        // Close template selection modal
        const templateModal = document.getElementById('templateSelectionModal');
        if (templateModal) {
            const modalInstance = bootstrap.Modal.getInstance(templateModal);
            if (modalInstance) modalInstance.hide();
        }

        // Show report editor modal
        this.showReportEditor(template);
        this.startAutosave();
    }

    initializeReportData(template) {
        const data = {
            templateKey: this.currentTemplate,
            patientInfo: this.getCurrentPatientInfo(),
            studyInfo: this.getCurrentStudyInfo(),
            timestamp: new Date().toISOString(),
            sections: {}
        };

        Object.entries(template.sections).forEach(([key, value]) => {
            if (typeof value === 'object') {
                data.sections[key] = {};
                Object.entries(value).forEach(([subKey, subValue]) => {
                    data.sections[key][subKey] = subValue;
                });
            } else {
                data.sections[key] = value;
            }
        });

        return data;
    }

    getCurrentPatientInfo() {
        const state = window.DICOM_VIEWER.STATE;
        const currentImage = state.currentSeriesImages[state.currentImageIndex];
        
        return {
            name: currentImage?.patient_name || 'Unknown Patient',
            id: currentImage?.patient_id || 'Unknown ID',
            studyDate: currentImage?.study_date || new Date().toISOString().split('T')[0],
            modality: currentImage?.modality || 'Unknown',
            studyDescription: currentImage?.study_description || 'Medical Study'
        };
    }

    getCurrentStudyInfo() {
        const state = window.DICOM_VIEWER.STATE;
        return {
            totalImages: state.totalImages,
            currentImageIndex: state.currentImageIndex,
            seriesCount: state.currentSeriesImages.length,
            fileName: state.currentSeriesImages[state.currentImageIndex]?.file_name || 'Unknown'
        };
    }

    showReportEditor(template) {
        console.log('Creating report editor for template:', template.name);

        const existingEditor = document.getElementById('report-editor-container');
        if (existingEditor) existingEditor.remove();

        const mainContent = document.getElementById('main-content');
        if (!mainContent) {
            console.error('Main content area not found!');
            return;
        }

        const reportEditorContainer = document.createElement('div');
        reportEditorContainer.id = 'report-editor-container';
        reportEditorContainer.innerHTML = this.generateReportEditorHTML(template);
        mainContent.appendChild(reportEditorContainer);

        const viewportContainer = document.getElementById('viewport-container');
        if (viewportContainer) {
            const floatingTools = this.createFloatingToolsPanel();
            viewportContainer.appendChild(floatingTools);
        }

        this.attachEditorEvents();
        this.updateSidebarForReporting();
        console.log('Report editor created successfully');
    }

    generateReportEditorHTML(template) {
        let patientInfo = {};

        if (this.reportData && this.reportData.patientInfo) {
            patientInfo = this.reportData.patientInfo;
        } else {
            const currentPatientInfo = this.getCurrentPatientInfo();
            patientInfo = currentPatientInfo || {
                name: 'Unknown Patient',
                id: 'Unknown ID',
                studyDate: new Date().toISOString().split('T')[0],
                modality: 'Unknown',
                studyDescription: 'Medical Study'
            };
        }

        return `
            <div class="report-editor-content" style="height: 100%; display: flex; flex-direction: column;">
                <div class="report-header" style="flex-shrink: 0; padding: 15px; border-bottom: 1px solid #444; background: #2a2a2a;">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <h6 class="mb-0 text-white">
                            <i class="bi bi-file-medical-fill text-success me-2"></i>
                            ${template.name}
                        </h6>
                        <div class="report-actions">
                            <button class="btn btn-sm btn-success me-1" id="save-report" title="Save Report">
                                <i class="bi bi-save"></i>
                            </button>
                            <button class="btn btn-sm btn-info me-1" id="export-report" title="Export PDF">
                                <i class="bi bi-download"></i>
                            </button>
                            <button class="btn btn-sm btn-danger" id="close-report-editor" title="Close">
                                <i class="bi bi-x-lg"></i>
                            </button>
                        </div>
                    </div>

                    <div class="patient-summary p-2 rounded small" style="background: rgba(40, 167, 69, 0.1); border: 1px solid rgba(40, 167, 69, 0.3);">
                        <div class="row g-1 text-white">
                            <div class="col-6"><strong>Patient:</strong> ${patientInfo.name || 'Unknown'}</div>
                            <div class="col-6"><strong>ID:</strong> ${patientInfo.id || 'Unknown'}</div>
                            <div class="col-6"><strong>Date:</strong> ${patientInfo.studyDate || 'Unknown'}</div>
                            <div class="col-6"><strong>Modality:</strong> ${patientInfo.modality || 'Unknown'}</div>
                        </div>
                    </div>
                </div>

                <div class="report-content" style="flex: 1; overflow-y: auto; padding: 15px;">
                    ${this.generateSectionFields(template.sections)}
                </div>

                <div class="report-footer" style="flex-shrink: 0; padding: 15px; border-top: 1px solid #444; background: #2a2a2a;">
                    <div class="row g-2">
                        <div class="col-6">
                            <label class="form-label small text-white">Physician:</label>
                            <input type="text" class="form-control form-control-sm" id="reporting-physician"
                                   placeholder="Dr. Name" value="${this.reportData?.reportingPhysician || ''}"
                                   style="background: rgba(255,255,255,0.1); border: 1px solid #555; color: white;">
                        </div>
                        <div class="col-6">
                            <label class="form-label small text-white">Date:</label>
                            <input type="datetime-local" class="form-control form-control-sm" id="report-datetime"
                                   value="${this.reportData?.reportDateTime || new Date().toISOString().slice(0, 16)}"
                                   style="background: rgba(255,255,255,0.1); border: 1px solid #555; color: white;">
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    generateSectionFields(sections) {
        return Object.entries(sections).map(([sectionKey, sectionValue]) => {
            if (typeof sectionValue === 'object') {
                return `
                    <div class="section-group">
                        <div class="section-header">
                            <i class="bi bi-chevron-right me-2"></i>
                            ${this.formatSectionName(sectionKey)}
                        </div>
                        <div class="section-content">
                            ${Object.entries(sectionValue).map(([subKey, subValue]) => `
                                <div class="mb-3">
                                    <label class="subsection-label">${this.formatSectionName(subKey)}:</label>
                                    <textarea class="form-control" rows="3" 
                                            data-section="${sectionKey}" 
                                            data-subsection="${subKey}"
                                            placeholder="${subValue}">${subValue}</textarea>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            } else {
                return `
                    <div class="section-group">
                        <div class="section-header">
                            <i class="bi bi-chevron-right me-2"></i>
                            ${this.formatSectionName(sectionKey)}
                        </div>
                        <div class="section-content">
                            <textarea class="form-control" rows="${sectionKey === 'impression' ? '4' : '2'}" 
                                    data-section="${sectionKey}"
                                    placeholder="${sectionValue}">${sectionValue}</textarea>
                        </div>
                    </div>
                `;
            }
        }).join('');
    }

    formatSectionName(name) {
        return name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    attachEditorEvents() {
        document.getElementById('save-report')?.addEventListener('click', () => this.saveReport());
        document.getElementById('export-report')?.addEventListener('click', () => this.exportReport());
        document.getElementById('close-report-editor')?.addEventListener('click', () => this.exitReportingMode());

        document.querySelectorAll('.report-content textarea, .report-content input').forEach(field => {
            field.addEventListener('input', () => {
                this.updateReportData();
                this.updateWordCount();
            });
        });

        document.getElementById('reporting-physician')?.addEventListener('input', () => this.updateReportData());
        document.getElementById('report-datetime')?.addEventListener('change', () => this.updateReportData());
    }

    updateReportData() {
        const textareas = document.querySelectorAll('.report-content textarea');
        
        textareas.forEach(textarea => {
            const section = textarea.dataset.section;
            const subsection = textarea.dataset.subsection;
            
            if (subsection) {
                if (!this.reportData.sections[section]) {
                    this.reportData.sections[section] = {};
                }
                this.reportData.sections[section][subsection] = textarea.value;
            } else {
                this.reportData.sections[section] = textarea.value;
            }
        });

        const physician = document.getElementById('reporting-physician');
        const datetime = document.getElementById('report-datetime');
        if (physician) this.reportData.reportingPhysician = physician.value;
        if (datetime) this.reportData.reportDateTime = datetime.value;

        this.reportData.lastModified = new Date().toISOString();
    }

    updateWordCount() {
        const textareas = document.querySelectorAll('.report-content textarea');
        let totalWords = 0;
        
        textareas.forEach(textarea => {
            const words = textarea.value.trim().split(/\s+/).filter(word => word.length > 0);
            totalWords += words.length;
        });

        const wordCountElement = document.getElementById('word-count');
        if (wordCountElement) {
            wordCountElement.textContent = totalWords;
        }
    }

    insertQuickText(type) {
        const templates = {
            'normal': 'No acute abnormalities identified. Study within normal limits.',
            'followup': 'Recommend clinical correlation and follow-up as clinically indicated.'
        };

        const text = templates[type];
        if (text) {
            const activeElement = document.activeElement;
            if (activeElement && activeElement.tagName === 'TEXTAREA') {
                const start = activeElement.selectionStart;
                const end = activeElement.selectionEnd;
                const value = activeElement.value;
                
                activeElement.value = value.substring(0, start) + text + value.substring(end);
                activeElement.selectionStart = activeElement.selectionEnd = start + text.length;
                activeElement.focus();
                activeElement.dispatchEvent(new Event('input'));
            }
        }
    }

    async showReportButtons() {
    const buttonContainer = document.getElementById('report-buttons-container');
    if (buttonContainer) {
        buttonContainer.style.display = 'flex';
        console.log('✓ Report buttons container shown');
        
        // Check if current image has a report and show/hide View Report button
        await this.checkCurrentImageForReports();
    }
}


// Add this method to your ReportingSystem class
async checkAndShowReportStatus() {
    console.log('Checking and showing report status...');
    
    // First, make sure the button container is visible
    const buttonContainer = document.getElementById('report-buttons-container');
    if (buttonContainer) {
        buttonContainer.style.display = 'flex';
        buttonContainer.style.visibility = 'visible';
        buttonContainer.style.opacity = '1';
        console.log('✓ Report button container shown');
    }
    
    // Then check for reports
    await this.checkCurrentImageForReports();
}

    async saveReport() {
        const saveBtn = document.getElementById('save-report') || document.getElementById('quick-save');
        const originalBtnHTML = saveBtn ? saveBtn.innerHTML : '';

        try {
            this.updateReportData();

            if (saveBtn) {
                saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Saving...';
                saveBtn.disabled = true;
            }

            const result = await this.saveReportToServer(false);
            this.showSaveSuccessAlert(result);

            const lastSavedElement = document.getElementById('last-saved');
            if (lastSavedElement) {
                lastSavedElement.textContent = new Date().toLocaleTimeString();
            }

            // Update report indicator in viewer header
            if (typeof window.checkReportExistence === 'function') {
                window.checkReportExistence();
            }

            await this.checkCurrentImageForReports();

            console.log('Report saved successfully:', result);

        } catch (error) {
            console.error('Save failed:', error);
            this.showSaveErrorAlert(error.message);

        } finally {
            if (saveBtn) {
                saveBtn.innerHTML = originalBtnHTML;
                saveBtn.disabled = false;
            }
        }
    }

    async saveReportToServer(isAutoSave = false) {
        const state = window.DICOM_VIEWER.STATE;
        const currentImage = state.currentSeriesImages[state.currentImageIndex];

        if (!currentImage) {
            throw new Error('No current image to save report for');
        }

        // Get study UID from URL parameters or current image
        const urlParams = new URLSearchParams(window.location.search);
        const studyUID = urlParams.get('studyUID') || urlParams.get('orthancId') || currentImage.study_instance_uid;
        const patientId = currentImage.patient_id || currentImage.patientId || 'UNKNOWN';
        const patientName = currentImage.patientName || currentImage.patient_name || 'Unknown Patient';

        // Get the correct image ID (handle both regular uploads and Orthanc images)
        const imageId = currentImage.orthancInstanceId || currentImage.instanceId || currentImage.id;

        const physicianElement = document.getElementById('reporting-physician');
        const datetimeElement = document.getElementById('report-datetime');

        // Map reportData to API format
        // Data is stored in this.reportData.sections, not directly on this.reportData
        const sections = this.reportData.sections || {};

        // Helper function to convert section data to string
        const sectionToString = (section) => {
            if (!section) return '';
            if (typeof section === 'string') return section;
            if (typeof section === 'object') {
                // If it's an object with subsections, concatenate them
                return Object.entries(section)
                    .map(([key, value]) => `${key}: ${value}`)
                    .join('\n\n');
            }
            return String(section);
        };

        const reportData = {
            study_uid: studyUID,
            patient_id: patientId,
            patient_name: patientName,
            template_name: this.reportData.template || this.currentTemplate || 'General',
            title: this.reportData.title || 'Medical Report',
            indication: sectionToString(sections.indication || sections.clinicalHistory),
            technique: sectionToString(sections.technique),
            findings: sectionToString(sections.findings),
            impression: sectionToString(sections.impression || sections.conclusion),
            reporting_physician_id: null,  // Keep for compatibility
            reporting_physician_name: physicianElement ? physicianElement.value.trim() : null
        };

        console.log('Saving report data:', reportData);

        const basePath = document.querySelector('meta[name="base-path"]')?.content || '';
        const response = await fetch(`${basePath}/api/reports/create.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reportData)
        });

        const responseText = await response.text();
        console.log('Server response:', response.status, responseText);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText} - ${responseText}`);
        }

        let result;
        try {
            result = JSON.parse(responseText);
        } catch (e) {
            throw new Error(`Invalid JSON response: ${responseText}`);
        }

        if (!result.success) {
            throw new Error(result.message || 'Unknown error saving report');
        }

        return result;
    }

    startAutosave() {
        this.stopAutosave();
        this.autosaveInterval = setInterval(() => {
            this.saveReportToServer(true).catch(err => {
                console.log('Autosave failed:', err.message);
            });
        }, 30000);
    }

    stopAutosave() {
        if (this.autosaveInterval) {
            clearInterval(this.autosaveInterval);
            this.autosaveInterval = null;
        }
    }

    async loadReportForImage() {
        const state = window.DICOM_VIEWER.STATE;
        const currentImage = state.currentSeriesImages[state.currentImageIndex];
        
        if (!currentImage) {
            window.DICOM_VIEWER.showAISuggestion('No image selected');
            return;
        }

        try {
            const response = await fetch(`load_report.php?imageId=${currentImage.id}&studyUID=${currentImage.study_instance_uid}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Cache-Control': 'no-cache'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const responseText = await response.text();
            const cleanedResponse = this.cleanJSONResponse(responseText);
            
            let result;
            try {
                result = JSON.parse(cleanedResponse);
            } catch (parseError) {
                throw new Error(`Invalid JSON response`);
            }

            if (result && result.success && result.report) {
                this.displayReportInModal(result.report);
            } else {
                window.DICOM_VIEWER.showAISuggestion('No report found for this study');
            }
        } catch (error) {
            console.error('Failed to load report:', error);
            window.DICOM_VIEWER.showAISuggestion(`Error loading report: ${error.message}`);
        }
    }

    cleanJSONResponse(responseText) {
        const jsonStart = responseText.indexOf('{');
        const jsonEnd = responseText.lastIndexOf('}');
        
        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
            return responseText.substring(jsonStart, jsonEnd + 1);
        }
        
        return responseText;
    }

    displayReportInModal(reportData) {
        const existingModal = document.getElementById('viewReportModal');
        if (existingModal) existingModal.remove();

        const reportContent = reportData.sections || {};
        let findingsHtml = '<p class="text-secondary">No findings reported.</p>';
        if (reportContent.findings) {
            if (typeof reportContent.findings === 'object') {
                findingsHtml = Object.entries(reportContent.findings)
                    .map(([key, value]) => `<p><strong>${this.formatSectionName(key)}:</strong> ${this.escapeHtml(value)}</p>`)
                    .join('');
            } else {
                findingsHtml = this.escapeHtml(reportContent.findings).replace(/\n/g, '<br>');
            }
        }

        const modalHtml = `
            <div class="modal fade" id="viewReportModal" tabindex="-1">
                <div class="modal-dialog modal-lg modal-dialog-scrollable">
                    <div class="modal-content bg-dark text-light">
                        <div class="modal-header border-secondary">
                            <h5 class="modal-title"><i class="bi bi-file-earmark-medical-fill me-2"></i>Study Report</h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-3 small text-secondary">
                                <strong>Patient:</strong> ${this.escapeHtml(reportData.patientName || reportData.patientInfo?.name || 'Unknown')} | 
                                <strong>Study:</strong> ${this.escapeHtml(reportData.studyDescription || 'N/A')}
                            </div>
                            <hr>
                            ${reportContent.indication ? `<h6>Indication</h6><p>${this.escapeHtml(reportContent.indication)}</p><hr>` : ''}
                            ${reportContent.technique ? `<h6>Technique</h6><p>${this.escapeHtml(reportContent.technique)}</p><hr>` : ''}
                            <h6>Findings</h6>
                            ${findingsHtml}
                            <hr>
                            <h6>Impression</h6>
                            <p>${reportContent.impression ? this.escapeHtml(reportContent.impression).replace(/\n/g, '<br>') : 'N/A'}</p>
                        </div>
                        <div class="modal-footer border-secondary justify-content-between">
                             <div class="small text-muted">
                                <strong>Physician:</strong> ${this.escapeHtml(reportData.reportingPhysician || 'Unknown')}<br>
                                <strong>Date:</strong> ${new Date(reportData.reportDateTime || reportData.timestamp).toLocaleString()}
                             </div>
                             <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const reportModal = new bootstrap.Modal(document.getElementById('viewReportModal'));
        reportModal.show();

        document.getElementById('viewReportModal').addEventListener('hidden.bs.modal', function() {
            this.remove();
        });
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showSaveSuccessAlert(result) {
        const alertHtml = `
            <div class="alert alert-success alert-dismissible fade show position-fixed" 
                 style="top: 20px; right: 20px; z-index: 9999; min-width: 300px;" 
                 role="alert">
                <i class="bi bi-check-circle-fill me-2"></i>
                <strong>Report Saved Successfully!</strong><br>
                <small>Version ${result.version || 1} saved at ${new Date().toLocaleTimeString()}</small>
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
        
        const alertElement = document.createElement('div');
        alertElement.innerHTML = alertHtml;
        document.body.appendChild(alertElement);
        
        setTimeout(() => {
            alertElement.querySelector('.alert')?.remove();
        }, 4000);
    }

    showSaveErrorAlert(errorMessage) {
        const alertHtml = `
            <div class="alert alert-danger alert-dismissible fade show position-fixed" 
                 style="top: 20px; right: 20px; z-index: 9999; min-width: 300px;" 
                 role="alert">
                <i class="bi bi-exclamation-triangle-fill me-2"></i>
                <strong>Save Failed!</strong><br>
                <small>${errorMessage}</small>
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
        
        const alertElement = document.createElement('div');
        alertElement.innerHTML = alertHtml;
        document.body.appendChild(alertElement);
        
        setTimeout(() => {
            alertElement.querySelector('.alert')?.remove();
        }, 6000);
    }

    async setupComprehensiveReportChecking() {
        if (window.DICOM_VIEWER.loadImageSeries) {
            const originalLoadImageSeries = window.DICOM_VIEWER.loadImageSeries;
            window.DICOM_VIEWER.loadImageSeries = async function(uploadedFiles) {
                const result = await originalLoadImageSeries.call(this, uploadedFiles);
                
                if (window.DICOM_VIEWER.MANAGERS.reportingSystem && uploadedFiles && uploadedFiles.length > 0) {
                    console.log(`Checking reports for ${uploadedFiles.length} images in series`);
                    
                    setTimeout(async () => {
                        await window.DICOM_VIEWER.MANAGERS.reportingSystem.checkAllSeriesImagesForReports(uploadedFiles);
                    }, 1500);
                }
                
                return result;
            };
        }
    }

    async checkAllSeriesImagesForReports(images) {
        console.log('=== CHECKING ALL SERIES IMAGES FOR REPORTS (OPTIMIZED BATCH) ===');
        
        // OPTIMIZATION: Prevent ERR_INSUFFICIENT_RESOURCES by limiting and batching requests
        const MAX_IMAGES_TO_CHECK = 100; // Only check first 100 images
        const BATCH_SIZE = 5; // Check 5 images at a time
        const BATCH_DELAY = 200; // 200ms delay between batches
        
        if (images.length > MAX_IMAGES_TO_CHECK) {
            console.log(`Series has ${images.length} images. Only checking first ${MAX_IMAGES_TO_CHECK} for reports to prevent resource exhaustion.`);
            images = images.slice(0, MAX_IMAGES_TO_CHECK);
        }
        
        const results = [];
        let reportCount = 0;
        
        // Process in batches to avoid overwhelming the browser
        for (let i = 0; i < images.length; i += BATCH_SIZE) {
            const batch = images.slice(i, i + BATCH_SIZE);
            
            const batchPromises = batch.map(async (image) => {
                try {
                    const hasReport = await this.checkSingleImageForReport(image.id, image.study_instance_uid);
                    return { imageId: image.id, hasReport };
                } catch (error) {
                    // Silently handle errors to avoid console spam with large series
                    return { imageId: image.id, hasReport: false };
                }
            });
            
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);
            
            // Process results immediately for this batch - add badges
            batchResults.forEach(result => {
                if (result.hasReport) {
                    reportCount++;
                    this.addReportIndicatorToSeriesItem(result.imageId);
                }
            });
            
            // Wait between batches to avoid overwhelming the browser
            if (i + BATCH_SIZE < images.length) {
                await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
            }
        }
        
        console.log(`Found ${reportCount} reports out of ${results.length} images checked`);
        
        if (reportCount > 0) {
            window.DICOM_VIEWER.showAISuggestion(`Found ${reportCount} medical report${reportCount > 1 ? 's' : ''} in this series`);
        }
        
        // Also check the current image
        await this.checkCurrentImageForReports();
    }

    async checkSingleImageForReport(imageId, studyUID) {
        try {
            const response = await fetch(`check_report.php?imageId=${imageId}&studyUID=${studyUID || ''}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Cache-Control': 'no-cache'
                }
            });
            
            if (!response.ok) return false;
            
            const responseText = await response.text();
            const cleanedResponse = this.cleanJSONResponse(responseText);
            
            let result;
            try {
                result = JSON.parse(cleanedResponse);
            } catch (parseError) {
                return false;
            }
            
            return result && result.success && result.exists;
            
        } catch (error) {
            console.error(`Error checking report for ${imageId}:`, error);
            return false;
        }
    }

    async checkCurrentImageForReports() {
        const state = window.DICOM_VIEWER.STATE;
        if (!state.currentSeriesImages || state.currentSeriesImages.length === 0) return;

        const currentImage = state.currentSeriesImages[state.currentImageIndex];
        const viewReportMenuItem = document.getElementById('viewReportMenuItem');

        if (!currentImage) return;

        // Get the correct image ID (handle both regular uploads and Orthanc images)
        const imageId = currentImage.orthancInstanceId || currentImage.instanceId || currentImage.id;
        const studyUID = currentImage.study_instance_uid;

        try {
            const response = await fetch(`check_report.php?imageId=${imageId}&studyUID=${studyUID}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Cache-Control': 'no-cache'
                }
            });

            if (!response.ok) {
                if (viewReportMenuItem) viewReportMenuItem.style.display = 'none';
                return;
            }

            const responseText = await response.text();
            const cleanedResponse = this.cleanJSONResponse(responseText);

            let result;
            try {
                result = JSON.parse(cleanedResponse);
            } catch (parseError) {
                if (viewReportMenuItem) viewReportMenuItem.style.display = 'none';
                return;
            }

            if (result && result.success && result.exists) {
                if (viewReportMenuItem) {
                    viewReportMenuItem.style.display = 'block';
                    console.log('✓ View Report menu item shown - report exists');
                }
            } else {
                if (viewReportMenuItem) {
                    viewReportMenuItem.style.display = 'none';
                    console.log('✗ View Report menu item hidden - no report');
                }
            }
        } catch (error) {
            console.error('Error checking current image for reports:', error);
            if (viewReportMenuItem) viewReportMenuItem.style.display = 'none';
        }
    }

    async loadReportForImage() {
        const state = window.DICOM_VIEWER.STATE;
        if (!state.currentSeriesImages || state.currentSeriesImages.length === 0) {
            alert('No images loaded');
            return;
        }

        const currentImage = state.currentSeriesImages[state.currentImageIndex];
        if (!currentImage) {
            alert('No current image');
            return;
        }

        // Get the correct image ID (handle both regular uploads and Orthanc images)
        const imageId = currentImage.orthancInstanceId || currentImage.instanceId || currentImage.id;
        const studyUID = currentImage.study_instance_uid;

        try {
            // Fetch existing report
            const response = await fetch(`api/get_report.php?imageId=${imageId}&studyUID=${studyUID}`);

            if (!response.ok) {
                throw new Error('Failed to load report');
            }

            const result = await response.json();

            if (result.success && result.report) {
                console.log('✓ Found existing report, loading into reporting mode...');

                // Store the report data temporarily
                this.existingReportData = JSON.parse(result.report.report_data || '{}');

                // Enter reporting mode (this will show the template selector)
                this.enterReportingMode();

                // Wait for the template selector to be ready
                await new Promise(resolve => setTimeout(resolve, 100));

                // Auto-select the appropriate template based on saved data
                const savedTemplate = this.existingReportData.templateType || 'general';
                this.loadTemplate(savedTemplate);

                // Wait for form to be created
                await new Promise(resolve => setTimeout(resolve, 200));

                // Populate the form fields with saved data
                this.populateFormWithExistingData(this.existingReportData);

                console.log('✓ Loaded existing report for viewing/editing');
            } else {
                alert('No report found for this image');
            }
        } catch (error) {
            console.error('Error loading report:', error);
            alert('Failed to load report: ' + error.message);
        }
    }

    populateFormWithExistingData(reportData) {
        // Safely populate each field
        const fields = {
            'patient-name': reportData.patientName,
            'patient-age': reportData.patientAge,
            'patient-gender': reportData.patientGender,
            'clinical-history': reportData.clinicalHistory,
            'findings': reportData.findings,
            'impression': reportData.impression,
            'recommendations': reportData.recommendations,
            'reporting-physician': reportData.radiologistName || reportData.reportingPhysician
        };

        for (const [fieldId, value] of Object.entries(fields)) {
            const element = document.getElementById(fieldId);
            if (element && value) {
                element.value = value;
                console.log(`Populated ${fieldId} with saved data`);
            }
        }

        // Update internal reportData
        this.updateReportData();
    }

    addReportIndicatorToSeriesItem(imageId) {
        const seriesItem = document.querySelector(`[data-file-id="${imageId}"]`);
        
        if (!seriesItem) {
            console.log(`Series item not found for image ${imageId}`);
            return;
        }
        
        if (seriesItem.querySelector('.report-indicator')) {
            return;
        }
        
        const indicator = document.createElement('div');
        indicator.className = 'report-indicator';
        indicator.innerHTML = '<i class="bi bi-file-medical-fill text-success"></i>';
        indicator.title = 'Medical report available - Click to view';
        indicator.style.cssText = `
            position: absolute;
            top: 5px;
            right: 30px;
            background: rgba(40, 167, 69, 0.95);
            color: white;
            width: 22px;
            height: 22px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 11px;
            z-index: 15;
            cursor: pointer;
            box-shadow: 0 2px 6px rgba(0,0,0,0.4);
            transition: all 0.2s ease;
        `;
        
        indicator.addEventListener('mouseenter', () => {
            indicator.style.transform = 'scale(1.2)';
            indicator.style.boxShadow = '0 3px 8px rgba(40, 167, 69, 0.6)';
        });
        
        indicator.addEventListener('mouseleave', () => {
            indicator.style.transform = 'scale(1)';
            indicator.style.boxShadow = '0 2px 6px rgba(0,0,0,0.4)';
        });
        
        seriesItem.style.position = 'relative';
        seriesItem.appendChild(indicator);
        
        indicator.addEventListener('click', (e) => {
            e.stopPropagation();
            const imageIndex = window.DICOM_VIEWER.STATE.currentSeriesImages.findIndex(img => img.id === imageId);
            if (imageIndex !== -1) {
                window.DICOM_VIEWER.STATE.currentImageIndex = imageIndex;
                window.DICOM_VIEWER.STATE.currentFileId = imageId;
            }
            this.loadReportForImage();
        });
        
        console.log(`✓ Added report indicator for image ${imageId}`);
    }

    exportReport() {
        this.updateReportData();
        
        const reportContent = this.generatePrintableReport();
        const printWindow = window.open('', '_blank');
        
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Medical Report - ${this.reportData.patientInfo?.name || 'Unknown'}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
                    .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
                    .patient-info { background: #f5f5f5; padding: 10px; margin-bottom: 20px; }
                    .section { margin-bottom: 20px; }
                    .section-title { font-weight: bold; color: #333; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-bottom: 10px; }
                    .subsection { margin-left: 20px; margin-bottom: 10px; }
                    .subsection-title { font-weight: bold; color: #666; margin-bottom: 5px; }
                    .footer { border-top: 1px solid #ccc; padding-top: 10px; margin-top: 30px; }
                    @media print { body { margin: 0; } }
                </style>
            </head>
            <body>
                ${reportContent}
            </body>
            </html>
        `);
        
        printWindow.document.close();
        setTimeout(() => printWindow.print(), 500);
    }

    generatePrintableReport() {
        const template = this.templates[this.currentTemplate];
        const patientInfo = this.reportData.patientInfo || {};
        
        let html = `
            <div class="header">
                <h1>RADIOLOGY REPORT</h1>
                <h2>${template?.name || 'Medical Report'}</h2>
            </div>
            
            <div class="patient-info">
                <div><strong>Patient Name:</strong> ${patientInfo.name || 'Unknown'}</div>
                <div><strong>Patient ID:</strong> ${patientInfo.id || 'Unknown'}</div>
                <div><strong>Study Date:</strong> ${patientInfo.studyDate || 'Unknown'}</div>
                <div><strong>Modality:</strong> ${patientInfo.modality || 'Unknown'}</div>
                <div><strong>Study Description:</strong> ${patientInfo.studyDescription || 'Unknown'}</div>
            </div>
        `;

        Object.entries(this.reportData.sections || {}).forEach(([sectionKey, sectionValue]) => {
            html += `<div class="section">`;
            html += `<div class="section-title">${this.formatSectionName(sectionKey).toUpperCase()}</div>`;
            
            if (typeof sectionValue === 'object') {
                Object.entries(sectionValue).forEach(([subKey, subValue]) => {
                    html += `
                        <div class="subsection">
                            <div class="subsection-title">${this.formatSectionName(subKey)}:</div>
                            <div>${(subValue || '').replace(/\n/g, '<br>')}</div>
                        </div>
                    `;
                });
            } else {
                html += `<div>${(sectionValue || '').replace(/\n/g, '<br>')}</div>`;
            }
            
            html += `</div>`;
        });

        html += `
            <div class="footer">
                <div><strong>Reporting Physician:</strong> ${this.reportData.reportingPhysician || 'Unknown'}</div>
                <div><strong>Report Date:</strong> ${new Date(this.reportData.reportDateTime || Date.now()).toLocaleString()}</div>
                <div><strong>Report Generated:</strong> ${new Date().toLocaleString()}</div>
            </div>
        `;

        return html;
    }
};