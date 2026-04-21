/**
 * Advanced Medical Reporting System v2.0
 *
 * Features:
 * - Auto-detection of modality from study
 * - Modality-specific structured report templates
 * - Split-screen reporting interface
 * - Professional print-ready reports with hospital branding
 * - RSNA RadReport standard compliance
 *
 * Based on research from:
 * - RSNA RadReport Templates (radreport.org)
 * - ACR BI-RADS Guidelines
 * - Cleveland Clinic structured reporting standards
 */

window.DICOM_VIEWER = window.DICOM_VIEWER || {};

window.DICOM_VIEWER.AdvancedReportingSystem = class {
    constructor() {
        this.currentReport = null;
        this.reportingMode = false;
        this.currentTemplate = null;
        this.reportData = {};
        this.autosaveInterval = null;
        this.hospitalSettings = null;

        // Modality templates based on RSNA standards
        this.modalityTemplates = this.initializeModalityTemplates();

        // Initialize
        this.init();
    }

    async init() {
        console.log('Initializing Advanced Medical Reporting System v2.0...');
        await this.loadHospitalSettings();
        this.setupReportButton();
        console.log('✓ Advanced Reporting System initialized');
    }

    async loadHospitalSettings() {
        try {
            const basePath = document.querySelector('meta[name="base-path"]')?.content || '';
            const response = await fetch(`${basePath}/api/settings/get-settings.php`);
            const data = await response.json();

            if (data.success) {
                this.hospitalSettings = {};
                Object.values(data.settings).flat().forEach(setting => {
                    this.hospitalSettings[setting.setting_key] = setting.setting_value;
                });
            }
        } catch (error) {
            console.error('Error loading hospital settings:', error);
            this.hospitalSettings = {
                hospital_name: 'Medical Imaging Center',
                hospital_timezone: 'Asia/Kolkata'
            };
        }
    }

    setupReportButton() {
        // Listen for Medical Report button click in navbar (createMedicalReport in dropdown)
        const reportBtn = document.getElementById('createMedicalReport');
        if (reportBtn) {
            reportBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.openReportingInterface();
            });
        }

        // Also add a standalone button if it exists
        const medicalReportBtn = document.getElementById('medicalReportBtn');
        if (medicalReportBtn) {
            medicalReportBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.openReportingInterface();
            });
        }
    }

    /**
     * Initialize all modality-specific templates based on RSNA and industry standards
     */
    initializeModalityTemplates() {
        return {
            // CT TEMPLATES
            'CT': {
                'CT_HEAD': {
                    name: 'CT Head/Brain',
                    icon: 'bi-diagram-3',
                    sections: [
                        {
                            id: 'clinical_info',
                            title: 'Clinical Information',
                            type: 'textarea',
                            placeholder: 'Enter clinical history and indication for the study...',
                            required: true
                        },
                        {
                            id: 'technique',
                            title: 'Technique',
                            type: 'select',
                            options: [
                                'Non-contrast CT of the head was performed with axial images at 5mm intervals',
                                'Contrast-enhanced CT of the head was performed following IV administration of contrast',
                                'CT angiography of the head was performed with IV contrast'
                            ],
                            allowCustom: true
                        },
                        {
                            id: 'comparison',
                            title: 'Comparison',
                            type: 'text',
                            placeholder: 'Prior studies for comparison (e.g., "CT Head dated MM/DD/YYYY" or "None available")'
                        },
                        {
                            id: 'findings',
                            title: 'Findings',
                            type: 'structured',
                            subsections: [
                                { id: 'brain_parenchyma', label: 'Brain Parenchyma', default: 'The brain parenchyma demonstrates normal gray-white matter differentiation. No acute intracranial hemorrhage, mass, or midline shift.' },
                                { id: 'ventricles', label: 'Ventricular System', default: 'The ventricular system is normal in size and configuration. No hydrocephalus.' },
                                { id: 'extra_axial', label: 'Extra-axial Spaces', default: 'No extra-axial fluid collection or mass.' },
                                { id: 'skull_base', label: 'Skull Base & Calvarium', default: 'The visualized skull base and calvarium are intact. No fracture identified.' },
                                { id: 'paranasal', label: 'Paranasal Sinuses', default: 'The visualized paranasal sinuses and mastoid air cells are clear.' },
                                { id: 'orbits', label: 'Orbits', default: 'The orbits are unremarkable.' },
                                { id: 'soft_tissues', label: 'Soft Tissues', default: 'The soft tissues are unremarkable.' }
                            ]
                        },
                        {
                            id: 'impression',
                            title: 'Impression',
                            type: 'impression',
                            placeholder: 'Enter numbered impression points...',
                            required: true
                        }
                    ]
                },
                'CT_CHEST': {
                    name: 'CT Chest',
                    icon: 'bi-lungs',
                    sections: [
                        {
                            id: 'clinical_info',
                            title: 'Clinical Information',
                            type: 'textarea',
                            placeholder: 'Enter clinical history and indication...',
                            required: true
                        },
                        {
                            id: 'technique',
                            title: 'Technique',
                            type: 'select',
                            options: [
                                'CT of the chest was performed without IV contrast',
                                'CT of the chest was performed with IV contrast',
                                'High-resolution CT of the chest was performed',
                                'CT pulmonary angiography was performed with IV contrast'
                            ],
                            allowCustom: true
                        },
                        {
                            id: 'comparison',
                            title: 'Comparison',
                            type: 'text',
                            placeholder: 'Prior studies for comparison'
                        },
                        {
                            id: 'findings',
                            title: 'Findings',
                            type: 'structured',
                            subsections: [
                                { id: 'lungs', label: 'Lungs', default: 'The lungs are clear bilaterally. No pulmonary nodules, masses, or consolidation. No pleural effusion or pneumothorax.' },
                                { id: 'airways', label: 'Airways', default: 'The trachea and major bronchi are patent. No endobronchial lesion.' },
                                { id: 'pleura', label: 'Pleura', default: 'No pleural effusion or thickening.' },
                                { id: 'mediastinum', label: 'Mediastinum', default: 'The mediastinum is unremarkable. No lymphadenopathy.' },
                                { id: 'heart', label: 'Heart & Great Vessels', default: 'The heart is normal in size. No pericardial effusion. The thoracic aorta is normal in caliber.' },
                                { id: 'chest_wall', label: 'Chest Wall & Bones', default: 'No chest wall mass. Visualized osseous structures are unremarkable.' },
                                { id: 'upper_abdomen', label: 'Upper Abdomen', default: 'Visualized portions of the upper abdomen are unremarkable.' }
                            ]
                        },
                        {
                            id: 'impression',
                            title: 'Impression',
                            type: 'impression',
                            required: true
                        }
                    ]
                },
                'CT_ABDOMEN_PELVIS': {
                    name: 'CT Abdomen & Pelvis',
                    icon: 'bi-body-text',
                    sections: [
                        {
                            id: 'clinical_info',
                            title: 'Clinical Information',
                            type: 'textarea',
                            required: true
                        },
                        {
                            id: 'technique',
                            title: 'Technique',
                            type: 'select',
                            options: [
                                'CT of the abdomen and pelvis was performed with oral and IV contrast',
                                'CT of the abdomen and pelvis was performed with IV contrast only',
                                'CT of the abdomen and pelvis was performed without contrast',
                                'CT urography was performed with IV contrast'
                            ],
                            allowCustom: true
                        },
                        {
                            id: 'comparison',
                            title: 'Comparison',
                            type: 'text'
                        },
                        {
                            id: 'findings',
                            title: 'Findings',
                            type: 'structured',
                            subsections: [
                                { id: 'liver', label: 'Liver', default: 'The liver is normal in size and attenuation. No focal hepatic lesion.' },
                                { id: 'gallbladder', label: 'Gallbladder & Biliary', default: 'The gallbladder is unremarkable. No biliary dilatation.' },
                                { id: 'pancreas', label: 'Pancreas', default: 'The pancreas is normal in size and appearance.' },
                                { id: 'spleen', label: 'Spleen', default: 'The spleen is normal in size.' },
                                { id: 'adrenals', label: 'Adrenal Glands', default: 'The adrenal glands are unremarkable.' },
                                { id: 'kidneys', label: 'Kidneys & Ureters', default: 'Both kidneys are normal in size and enhancement. No hydronephrosis or stones.' },
                                { id: 'gi_tract', label: 'GI Tract', default: 'The stomach and bowel loops are unremarkable. No bowel obstruction.' },
                                { id: 'mesentery', label: 'Mesentery & Lymph Nodes', default: 'No mesenteric or retroperitoneal lymphadenopathy.' },
                                { id: 'pelvis', label: 'Pelvis', default: 'The urinary bladder is unremarkable. No pelvic mass or free fluid.' },
                                { id: 'vessels', label: 'Vessels', default: 'The abdominal aorta and iliac vessels are normal in caliber.' },
                                { id: 'bones', label: 'Bones', default: 'No aggressive osseous lesion. Degenerative changes noted.' }
                            ]
                        },
                        {
                            id: 'impression',
                            title: 'Impression',
                            type: 'impression',
                            required: true
                        }
                    ]
                },
                'CT_SPINE': {
                    name: 'CT Spine',
                    icon: 'bi-person-standing',
                    sections: [
                        {
                            id: 'clinical_info',
                            title: 'Clinical Information',
                            type: 'textarea',
                            required: true
                        },
                        {
                            id: 'region',
                            title: 'Region',
                            type: 'select',
                            options: ['Cervical Spine', 'Thoracic Spine', 'Lumbar Spine', 'Whole Spine'],
                            required: true
                        },
                        {
                            id: 'technique',
                            title: 'Technique',
                            type: 'textarea',
                            default: 'CT of the spine was performed with multiplanar reconstructions.'
                        },
                        {
                            id: 'findings',
                            title: 'Findings',
                            type: 'structured',
                            subsections: [
                                { id: 'alignment', label: 'Alignment', default: 'Normal spinal alignment. No listhesis.' },
                                { id: 'vertebral_bodies', label: 'Vertebral Bodies', default: 'Vertebral body heights are maintained. No fracture or destructive lesion.' },
                                { id: 'disc_spaces', label: 'Disc Spaces', default: 'Disc spaces are preserved.' },
                                { id: 'canal', label: 'Spinal Canal', default: 'The spinal canal is patent. No significant stenosis.' },
                                { id: 'neural_foramina', label: 'Neural Foramina', default: 'Neural foramina are patent bilaterally.' },
                                { id: 'posterior_elements', label: 'Posterior Elements', default: 'Posterior elements are intact.' },
                                { id: 'paraspinal', label: 'Paraspinal Soft Tissues', default: 'Paraspinal soft tissues are unremarkable.' }
                            ]
                        },
                        {
                            id: 'impression',
                            title: 'Impression',
                            type: 'impression',
                            required: true
                        }
                    ]
                }
            },

            // MRI TEMPLATES
            'MR': {
                'MRI_BRAIN': {
                    name: 'MRI Brain',
                    icon: 'bi-activity',
                    sections: [
                        {
                            id: 'clinical_info',
                            title: 'Clinical Information',
                            type: 'textarea',
                            required: true
                        },
                        {
                            id: 'technique',
                            title: 'Technique',
                            type: 'select',
                            options: [
                                'MRI of the brain was performed without IV contrast including T1, T2, FLAIR, and DWI sequences',
                                'MRI of the brain was performed with and without IV gadolinium contrast',
                                'MR angiography of the brain was performed'
                            ],
                            allowCustom: true
                        },
                        {
                            id: 'comparison',
                            title: 'Comparison',
                            type: 'text'
                        },
                        {
                            id: 'findings',
                            title: 'Findings',
                            type: 'structured',
                            subsections: [
                                { id: 'brain_parenchyma', label: 'Brain Parenchyma', default: 'Normal brain parenchymal signal intensity. No abnormal enhancement.' },
                                { id: 'white_matter', label: 'White Matter', default: 'No abnormal white matter signal. No evidence of demyelination.' },
                                { id: 'ventricles', label: 'Ventricular System', default: 'The ventricular system is normal in size and configuration.' },
                                { id: 'dwi', label: 'Diffusion', default: 'No restricted diffusion to suggest acute infarction.' },
                                { id: 'posterior_fossa', label: 'Posterior Fossa', default: 'The cerebellum and brainstem are normal.' },
                                { id: 'extra_axial', label: 'Extra-axial Spaces', default: 'No extra-axial collection.' },
                                { id: 'vessels', label: 'Intracranial Vessels', default: 'Major intracranial vessels demonstrate normal flow voids.' },
                                { id: 'pituitary', label: 'Sella & Pituitary', default: 'The sella and pituitary gland are unremarkable.' },
                                { id: 'orbits', label: 'Orbits', default: 'The orbits are unremarkable.' }
                            ]
                        },
                        {
                            id: 'impression',
                            title: 'Impression',
                            type: 'impression',
                            required: true
                        }
                    ]
                },
                'MRI_SPINE': {
                    name: 'MRI Spine',
                    icon: 'bi-person-standing',
                    sections: [
                        {
                            id: 'clinical_info',
                            title: 'Clinical Information',
                            type: 'textarea',
                            required: true
                        },
                        {
                            id: 'region',
                            title: 'Region',
                            type: 'select',
                            options: ['Cervical Spine', 'Thoracic Spine', 'Lumbar Spine', 'Whole Spine'],
                            required: true
                        },
                        {
                            id: 'technique',
                            title: 'Technique',
                            type: 'select',
                            options: [
                                'MRI of the spine was performed without IV contrast',
                                'MRI of the spine was performed with and without IV gadolinium contrast'
                            ],
                            allowCustom: true
                        },
                        {
                            id: 'findings',
                            title: 'Findings',
                            type: 'structured',
                            subsections: [
                                { id: 'alignment', label: 'Alignment', default: 'Normal alignment. No listhesis.' },
                                { id: 'cord', label: 'Spinal Cord', default: 'The spinal cord is normal in signal and caliber. No cord compression.' },
                                { id: 'vertebrae', label: 'Vertebral Bodies', default: 'Normal vertebral body marrow signal. No compression fracture.' },
                                { id: 'discs', label: 'Intervertebral Discs', default: '' },
                                { id: 'canal', label: 'Spinal Canal', default: 'No significant central canal stenosis.' },
                                { id: 'foramina', label: 'Neural Foramina', default: 'Neural foramina are patent.' },
                                { id: 'paraspinal', label: 'Paraspinal Soft Tissues', default: 'Paraspinal soft tissues are unremarkable.' }
                            ]
                        },
                        {
                            id: 'disc_assessment',
                            title: 'Disc-by-Disc Assessment',
                            type: 'disc_table',
                            levels: ['C2-C3', 'C3-C4', 'C4-C5', 'C5-C6', 'C6-C7', 'C7-T1']
                        },
                        {
                            id: 'impression',
                            title: 'Impression',
                            type: 'impression',
                            required: true
                        }
                    ]
                },
                'MRI_KNEE': {
                    name: 'MRI Knee',
                    icon: 'bi-bandaid',
                    sections: [
                        {
                            id: 'clinical_info',
                            title: 'Clinical Information',
                            type: 'textarea',
                            required: true
                        },
                        {
                            id: 'side',
                            title: 'Side',
                            type: 'select',
                            options: ['Right', 'Left'],
                            required: true
                        },
                        {
                            id: 'technique',
                            title: 'Technique',
                            type: 'text',
                            default: 'MRI of the knee was performed without IV contrast using standard protocols.'
                        },
                        {
                            id: 'findings',
                            title: 'Findings',
                            type: 'structured',
                            subsections: [
                                { id: 'acl', label: 'ACL', default: 'The anterior cruciate ligament is intact.' },
                                { id: 'pcl', label: 'PCL', default: 'The posterior cruciate ligament is intact.' },
                                { id: 'mcl', label: 'MCL', default: 'The medial collateral ligament is intact.' },
                                { id: 'lcl', label: 'LCL', default: 'The lateral collateral ligament complex is intact.' },
                                { id: 'medial_meniscus', label: 'Medial Meniscus', default: 'The medial meniscus is intact without tear.' },
                                { id: 'lateral_meniscus', label: 'Lateral Meniscus', default: 'The lateral meniscus is intact without tear.' },
                                { id: 'cartilage', label: 'Articular Cartilage', default: 'The articular cartilage is preserved.' },
                                { id: 'patella', label: 'Patella & Extensor Mechanism', default: 'The patellar tendon and quadriceps tendon are intact.' },
                                { id: 'bone', label: 'Bone', default: 'No bone marrow edema or fracture.' },
                                { id: 'effusion', label: 'Joint Effusion', default: 'Small physiologic joint effusion.' }
                            ]
                        },
                        {
                            id: 'impression',
                            title: 'Impression',
                            type: 'impression',
                            required: true
                        }
                    ]
                },
                'MRI_SHOULDER': {
                    name: 'MRI Shoulder',
                    icon: 'bi-bandaid',
                    sections: [
                        {
                            id: 'clinical_info',
                            title: 'Clinical Information',
                            type: 'textarea',
                            required: true
                        },
                        {
                            id: 'side',
                            title: 'Side',
                            type: 'select',
                            options: ['Right', 'Left'],
                            required: true
                        },
                        {
                            id: 'technique',
                            title: 'Technique',
                            type: 'text',
                            default: 'MRI of the shoulder was performed without IV contrast.'
                        },
                        {
                            id: 'findings',
                            title: 'Findings',
                            type: 'structured',
                            subsections: [
                                { id: 'supraspinatus', label: 'Supraspinatus Tendon', default: 'The supraspinatus tendon is intact.' },
                                { id: 'infraspinatus', label: 'Infraspinatus Tendon', default: 'The infraspinatus tendon is intact.' },
                                { id: 'subscapularis', label: 'Subscapularis Tendon', default: 'The subscapularis tendon is intact.' },
                                { id: 'teres_minor', label: 'Teres Minor', default: 'The teres minor is intact.' },
                                { id: 'biceps', label: 'Biceps Tendon', default: 'The long head of biceps tendon is intact and located within the bicipital groove.' },
                                { id: 'labrum', label: 'Glenoid Labrum', default: 'The glenoid labrum is intact.' },
                                { id: 'acj', label: 'AC Joint', default: 'The acromioclavicular joint is unremarkable.' },
                                { id: 'bone', label: 'Bone', default: 'No bone marrow edema or fracture.' },
                                { id: 'bursa', label: 'Bursa', default: 'No significant subacromial-subdeltoid bursitis.' }
                            ]
                        },
                        {
                            id: 'impression',
                            title: 'Impression',
                            type: 'impression',
                            required: true
                        }
                    ]
                }
            },

            // X-RAY TEMPLATES
            'CR': {
                'XRAY_CHEST': {
                    name: 'Chest X-Ray',
                    icon: 'bi-lungs',
                    sections: [
                        {
                            id: 'clinical_info',
                            title: 'Clinical Information',
                            type: 'textarea',
                            required: true
                        },
                        {
                            id: 'technique',
                            title: 'Technique',
                            type: 'select',
                            options: [
                                'PA and lateral views of the chest were obtained',
                                'AP portable chest radiograph was obtained',
                                'Single PA view of the chest was obtained'
                            ]
                        },
                        {
                            id: 'comparison',
                            title: 'Comparison',
                            type: 'text'
                        },
                        {
                            id: 'findings',
                            title: 'Findings',
                            type: 'structured',
                            subsections: [
                                { id: 'lungs', label: 'Lungs', default: 'The lungs are clear bilaterally. No focal consolidation, pleural effusion, or pneumothorax.' },
                                { id: 'heart', label: 'Heart', default: 'The cardiac silhouette is normal in size. Cardiothoracic ratio is within normal limits.' },
                                { id: 'mediastinum', label: 'Mediastinum', default: 'The mediastinal contours are normal.' },
                                { id: 'bones', label: 'Bones', default: 'Visualized osseous structures are intact.' },
                                { id: 'soft_tissues', label: 'Soft Tissues', default: 'Soft tissues are unremarkable.' }
                            ]
                        },
                        {
                            id: 'impression',
                            title: 'Impression',
                            type: 'impression',
                            required: true
                        }
                    ]
                },
                'XRAY_ABDOMEN': {
                    name: 'Abdominal X-Ray',
                    icon: 'bi-body-text',
                    sections: [
                        {
                            id: 'clinical_info',
                            title: 'Clinical Information',
                            type: 'textarea',
                            required: true
                        },
                        {
                            id: 'technique',
                            title: 'Technique',
                            type: 'text',
                            default: 'Supine and erect views of the abdomen were obtained.'
                        },
                        {
                            id: 'findings',
                            title: 'Findings',
                            type: 'structured',
                            subsections: [
                                { id: 'bowel_gas', label: 'Bowel Gas Pattern', default: 'Normal bowel gas pattern. No dilated loops of bowel.' },
                                { id: 'free_air', label: 'Free Air', default: 'No evidence of pneumoperitoneum.' },
                                { id: 'calcifications', label: 'Calcifications', default: 'No abnormal calcifications.' },
                                { id: 'soft_tissues', label: 'Soft Tissue Shadows', default: 'Soft tissue shadows are unremarkable.' },
                                { id: 'bones', label: 'Bones', default: 'Visualized osseous structures are unremarkable.' }
                            ]
                        },
                        {
                            id: 'impression',
                            title: 'Impression',
                            type: 'impression',
                            required: true
                        }
                    ]
                },
                'XRAY_EXTREMITY': {
                    name: 'Extremity X-Ray',
                    icon: 'bi-bandaid',
                    sections: [
                        {
                            id: 'clinical_info',
                            title: 'Clinical Information',
                            type: 'textarea',
                            required: true
                        },
                        {
                            id: 'body_part',
                            title: 'Body Part',
                            type: 'select',
                            options: ['Hand', 'Wrist', 'Forearm', 'Elbow', 'Shoulder', 'Foot', 'Ankle', 'Tibia/Fibula', 'Knee', 'Hip', 'Pelvis'],
                            required: true
                        },
                        {
                            id: 'side',
                            title: 'Side',
                            type: 'select',
                            options: ['Right', 'Left', 'Bilateral']
                        },
                        {
                            id: 'technique',
                            title: 'Technique',
                            type: 'text',
                            default: 'Standard views were obtained.'
                        },
                        {
                            id: 'findings',
                            title: 'Findings',
                            type: 'structured',
                            subsections: [
                                { id: 'bones', label: 'Bones', default: 'No fracture or dislocation. Bones are intact.' },
                                { id: 'joints', label: 'Joints', default: 'Joint spaces are preserved. No significant arthritis.' },
                                { id: 'soft_tissues', label: 'Soft Tissues', default: 'Soft tissues are unremarkable. No foreign body.' }
                            ]
                        },
                        {
                            id: 'impression',
                            title: 'Impression',
                            type: 'impression',
                            required: true
                        }
                    ]
                }
            },

            // DX (Digital X-Ray) - Same as CR
            'DX': null, // Will be populated from CR

            // ULTRASOUND TEMPLATES
            'US': {
                'US_ABDOMEN': {
                    name: 'Ultrasound Abdomen',
                    icon: 'bi-soundwave',
                    sections: [
                        {
                            id: 'clinical_info',
                            title: 'Clinical Information',
                            type: 'textarea',
                            required: true
                        },
                        {
                            id: 'technique',
                            title: 'Technique',
                            type: 'text',
                            default: 'Real-time ultrasound of the abdomen was performed using gray-scale and color Doppler techniques.'
                        },
                        {
                            id: 'findings',
                            title: 'Findings',
                            type: 'structured',
                            subsections: [
                                { id: 'liver', label: 'Liver', default: 'The liver is normal in size and echogenicity. No focal lesion.' },
                                { id: 'gallbladder', label: 'Gallbladder', default: 'The gallbladder is normal. No stones or wall thickening.' },
                                { id: 'cbd', label: 'Common Bile Duct', default: 'The common bile duct measures within normal limits.' },
                                { id: 'pancreas', label: 'Pancreas', default: 'The visualized portions of the pancreas are unremarkable.' },
                                { id: 'spleen', label: 'Spleen', default: 'The spleen is normal in size.' },
                                { id: 'right_kidney', label: 'Right Kidney', default: 'The right kidney is normal in size and echogenicity. No hydronephrosis or stone.' },
                                { id: 'left_kidney', label: 'Left Kidney', default: 'The left kidney is normal in size and echogenicity. No hydronephrosis or stone.' },
                                { id: 'aorta', label: 'Aorta', default: 'The abdominal aorta is normal in caliber.' },
                                { id: 'ascites', label: 'Free Fluid', default: 'No ascites.' }
                            ]
                        },
                        {
                            id: 'impression',
                            title: 'Impression',
                            type: 'impression',
                            required: true
                        }
                    ]
                },
                'US_PELVIS': {
                    name: 'Ultrasound Pelvis',
                    icon: 'bi-gender-female',
                    sections: [
                        {
                            id: 'clinical_info',
                            title: 'Clinical Information',
                            type: 'textarea',
                            required: true
                        },
                        {
                            id: 'lmp',
                            title: 'Last Menstrual Period (LMP)',
                            type: 'date'
                        },
                        {
                            id: 'technique',
                            title: 'Technique',
                            type: 'select',
                            options: [
                                'Transabdominal pelvic ultrasound was performed',
                                'Transvaginal pelvic ultrasound was performed',
                                'Both transabdominal and transvaginal ultrasound were performed'
                            ]
                        },
                        {
                            id: 'findings',
                            title: 'Findings',
                            type: 'structured',
                            subsections: [
                                { id: 'uterus', label: 'Uterus', default: 'The uterus is anteverted and normal in size. The endometrium is normal.' },
                                { id: 'right_ovary', label: 'Right Ovary', default: 'The right ovary is normal in size and appearance.' },
                                { id: 'left_ovary', label: 'Left Ovary', default: 'The left ovary is normal in size and appearance.' },
                                { id: 'adnexa', label: 'Adnexa', default: 'No adnexal mass.' },
                                { id: 'pod', label: 'Pouch of Douglas', default: 'No free fluid in the pouch of Douglas.' }
                            ]
                        },
                        {
                            id: 'impression',
                            title: 'Impression',
                            type: 'impression',
                            required: true
                        }
                    ]
                },
                'US_THYROID': {
                    name: 'Ultrasound Thyroid',
                    icon: 'bi-bullseye',
                    sections: [
                        {
                            id: 'clinical_info',
                            title: 'Clinical Information',
                            type: 'textarea',
                            required: true
                        },
                        {
                            id: 'technique',
                            title: 'Technique',
                            type: 'text',
                            default: 'High-resolution ultrasound of the thyroid gland was performed.'
                        },
                        {
                            id: 'findings',
                            title: 'Findings',
                            type: 'structured',
                            subsections: [
                                { id: 'right_lobe', label: 'Right Lobe', default: 'The right lobe measures ___ x ___ x ___ cm. Normal echogenicity.' },
                                { id: 'left_lobe', label: 'Left Lobe', default: 'The left lobe measures ___ x ___ x ___ cm. Normal echogenicity.' },
                                { id: 'isthmus', label: 'Isthmus', default: 'The isthmus measures ___ mm in thickness.' },
                                { id: 'nodules', label: 'Nodules', default: 'No thyroid nodules identified.' },
                                { id: 'lymph_nodes', label: 'Lymph Nodes', default: 'No abnormal cervical lymphadenopathy.' }
                            ]
                        },
                        {
                            id: 'tirads',
                            title: 'TI-RADS Classification (if nodule present)',
                            type: 'select',
                            options: ['Not Applicable', 'TI-RADS 1 - Benign', 'TI-RADS 2 - Not Suspicious', 'TI-RADS 3 - Mildly Suspicious', 'TI-RADS 4 - Moderately Suspicious', 'TI-RADS 5 - Highly Suspicious']
                        },
                        {
                            id: 'impression',
                            title: 'Impression',
                            type: 'impression',
                            required: true
                        }
                    ]
                },
                'US_OBSTETRIC': {
                    name: 'Obstetric Ultrasound',
                    icon: 'bi-heart-pulse',
                    sections: [
                        {
                            id: 'clinical_info',
                            title: 'Clinical Information',
                            type: 'textarea',
                            required: true
                        },
                        {
                            id: 'lmp',
                            title: 'Last Menstrual Period (LMP)',
                            type: 'date',
                            required: true
                        },
                        {
                            id: 'technique',
                            title: 'Technique',
                            type: 'select',
                            options: [
                                'Transabdominal obstetric ultrasound was performed',
                                'Transvaginal obstetric ultrasound was performed'
                            ]
                        },
                        {
                            id: 'findings',
                            title: 'Findings',
                            type: 'structured',
                            subsections: [
                                { id: 'fetal_number', label: 'Number of Fetuses', default: 'Single live intrauterine pregnancy.' },
                                { id: 'presentation', label: 'Presentation', default: '' },
                                { id: 'fetal_heart', label: 'Fetal Heart Activity', default: 'Fetal heart activity present.' },
                                { id: 'biometry', label: 'Biometry', default: 'BPD: ___ mm\nHC: ___ mm\nAC: ___ mm\nFL: ___ mm' },
                                { id: 'ega', label: 'Estimated Gestational Age', default: '' },
                                { id: 'efw', label: 'Estimated Fetal Weight', default: '' },
                                { id: 'placenta', label: 'Placenta', default: 'The placenta is ' },
                                { id: 'amniotic_fluid', label: 'Amniotic Fluid', default: 'AFI: ___ cm. Normal amniotic fluid volume.' },
                                { id: 'cervix', label: 'Cervix', default: 'The cervix is closed.' }
                            ]
                        },
                        {
                            id: 'impression',
                            title: 'Impression',
                            type: 'impression',
                            required: true
                        }
                    ]
                }
            },

            // MAMMOGRAPHY TEMPLATES
            'MG': {
                'MAMMOGRAPHY': {
                    name: 'Mammography',
                    icon: 'bi-gender-female',
                    sections: [
                        {
                            id: 'clinical_info',
                            title: 'Clinical Information',
                            type: 'textarea',
                            required: true
                        },
                        {
                            id: 'exam_type',
                            title: 'Examination Type',
                            type: 'select',
                            options: ['Screening Mammogram', 'Diagnostic Mammogram', 'Follow-up Mammogram'],
                            required: true
                        },
                        {
                            id: 'technique',
                            title: 'Technique',
                            type: 'text',
                            default: 'Digital mammography was performed with standard MLO and CC views bilaterally.'
                        },
                        {
                            id: 'comparison',
                            title: 'Comparison',
                            type: 'text'
                        },
                        {
                            id: 'breast_composition',
                            title: 'Breast Composition',
                            type: 'select',
                            options: [
                                'A - Almost entirely fatty',
                                'B - Scattered areas of fibroglandular density',
                                'C - Heterogeneously dense, which may obscure small masses',
                                'D - Extremely dense, which lowers the sensitivity of mammography'
                            ],
                            required: true
                        },
                        {
                            id: 'findings',
                            title: 'Findings',
                            type: 'structured',
                            subsections: [
                                { id: 'masses', label: 'Masses', default: 'No suspicious masses.' },
                                { id: 'calcifications', label: 'Calcifications', default: 'No suspicious calcifications.' },
                                { id: 'asymmetries', label: 'Asymmetries', default: 'No focal asymmetry.' },
                                { id: 'architectural', label: 'Architectural Distortion', default: 'No architectural distortion.' },
                                { id: 'skin', label: 'Skin & Nipple', default: 'Skin and nipples are unremarkable.' },
                                { id: 'lymph_nodes', label: 'Axillary Lymph Nodes', default: 'Axillary lymph nodes are unremarkable.' }
                            ]
                        },
                        {
                            id: 'birads',
                            title: 'BI-RADS Assessment Category',
                            type: 'select',
                            options: [
                                'Category 0 - Incomplete: Need Additional Imaging Evaluation',
                                'Category 1 - Negative',
                                'Category 2 - Benign',
                                'Category 3 - Probably Benign (Short Interval Follow-up)',
                                'Category 4A - Low Suspicion for Malignancy',
                                'Category 4B - Moderate Suspicion for Malignancy',
                                'Category 4C - High Suspicion for Malignancy',
                                'Category 5 - Highly Suggestive of Malignancy',
                                'Category 6 - Known Biopsy-Proven Malignancy'
                            ],
                            required: true
                        },
                        {
                            id: 'recommendation',
                            title: 'Recommendation',
                            type: 'textarea',
                            placeholder: 'Management recommendation based on BI-RADS category...'
                        },
                        {
                            id: 'impression',
                            title: 'Impression',
                            type: 'impression',
                            required: true
                        }
                    ]
                }
            },

            // FLUOROSCOPY
            'RF': {
                'FLUORO_GI': {
                    name: 'Upper GI/Barium Study',
                    icon: 'bi-droplet',
                    sections: [
                        {
                            id: 'clinical_info',
                            title: 'Clinical Information',
                            type: 'textarea',
                            required: true
                        },
                        {
                            id: 'technique',
                            title: 'Technique',
                            type: 'text',
                            default: 'Upper GI series was performed with oral barium contrast.'
                        },
                        {
                            id: 'findings',
                            title: 'Findings',
                            type: 'structured',
                            subsections: [
                                { id: 'pharynx', label: 'Pharynx', default: 'The pharynx is unremarkable.' },
                                { id: 'esophagus', label: 'Esophagus', default: 'The esophagus demonstrates normal motility and mucosal pattern.' },
                                { id: 'gej', label: 'GE Junction', default: 'The gastroesophageal junction is normal.' },
                                { id: 'stomach', label: 'Stomach', default: 'The stomach is normal in size and contour.' },
                                { id: 'duodenum', label: 'Duodenum', default: 'The duodenum is unremarkable.' }
                            ]
                        },
                        {
                            id: 'impression',
                            title: 'Impression',
                            type: 'impression',
                            required: true
                        }
                    ]
                }
            },

            // NUCLEAR MEDICINE
            'NM': {
                'NM_BONE_SCAN': {
                    name: 'Bone Scan',
                    icon: 'bi-radioactive',
                    sections: [
                        {
                            id: 'clinical_info',
                            title: 'Clinical Information',
                            type: 'textarea',
                            required: true
                        },
                        {
                            id: 'technique',
                            title: 'Technique',
                            type: 'text',
                            default: 'Whole body bone scintigraphy was performed following IV injection of Tc-99m MDP.'
                        },
                        {
                            id: 'findings',
                            title: 'Findings',
                            type: 'structured',
                            subsections: [
                                { id: 'skull', label: 'Skull', default: 'Normal tracer uptake in the skull.' },
                                { id: 'spine', label: 'Spine', default: 'No focal increased uptake along the spine.' },
                                { id: 'ribs', label: 'Ribs', default: 'No focal rib lesions.' },
                                { id: 'pelvis', label: 'Pelvis', default: 'The pelvis shows normal tracer distribution.' },
                                { id: 'extremities', label: 'Extremities', default: 'The extremities show normal tracer uptake.' },
                                { id: 'kidneys', label: 'Kidneys', default: 'The kidneys are visualized.' }
                            ]
                        },
                        {
                            id: 'impression',
                            title: 'Impression',
                            type: 'impression',
                            required: true
                        }
                    ]
                }
            },

            // GENERAL/FALLBACK TEMPLATE
            'OTHER': {
                'GENERAL': {
                    name: 'General Radiology Report',
                    icon: 'bi-file-medical',
                    sections: [
                        {
                            id: 'clinical_info',
                            title: 'Clinical Information',
                            type: 'textarea',
                            required: true
                        },
                        {
                            id: 'exam_type',
                            title: 'Examination Type',
                            type: 'text',
                            required: true
                        },
                        {
                            id: 'technique',
                            title: 'Technique',
                            type: 'textarea'
                        },
                        {
                            id: 'comparison',
                            title: 'Comparison',
                            type: 'text'
                        },
                        {
                            id: 'findings',
                            title: 'Findings',
                            type: 'textarea',
                            placeholder: 'Enter detailed findings...',
                            required: true
                        },
                        {
                            id: 'impression',
                            title: 'Impression',
                            type: 'impression',
                            required: true
                        }
                    ]
                }
            }
        };
    }

    /**
     * Detect the appropriate template based on modality
     */
    detectTemplateForModality(modality, studyDescription = '') {
        const mod = (modality || '').toUpperCase().trim();
        const desc = (studyDescription || '').toLowerCase();

        // Check if DX, use CR templates
        if (mod === 'DX') {
            return this.detectTemplateForModality('CR', studyDescription);
        }

        // Get templates for this modality
        let templates = this.modalityTemplates[mod];

        if (!templates) {
            // Fallback to general
            return { modality: 'OTHER', templateKey: 'GENERAL', template: this.modalityTemplates['OTHER']['GENERAL'] };
        }

        // Try to match based on study description
        const templateKeys = Object.keys(templates);

        for (const key of templateKeys) {
            const keyLower = key.toLowerCase();

            // Match specific body parts in description
            if (mod === 'CT') {
                if ((desc.includes('head') || desc.includes('brain')) && keyLower.includes('head')) {
                    return { modality: mod, templateKey: key, template: templates[key] };
                }
                if ((desc.includes('chest') || desc.includes('thorax')) && keyLower.includes('chest')) {
                    return { modality: mod, templateKey: key, template: templates[key] };
                }
                if ((desc.includes('abdomen') || desc.includes('pelvis')) && keyLower.includes('abdomen')) {
                    return { modality: mod, templateKey: key, template: templates[key] };
                }
                if (desc.includes('spine') && keyLower.includes('spine')) {
                    return { modality: mod, templateKey: key, template: templates[key] };
                }
            }

            if (mod === 'MR') {
                if ((desc.includes('brain') || desc.includes('head')) && keyLower.includes('brain')) {
                    return { modality: mod, templateKey: key, template: templates[key] };
                }
                if (desc.includes('spine') && keyLower.includes('spine')) {
                    return { modality: mod, templateKey: key, template: templates[key] };
                }
                if (desc.includes('knee') && keyLower.includes('knee')) {
                    return { modality: mod, templateKey: key, template: templates[key] };
                }
                if (desc.includes('shoulder') && keyLower.includes('shoulder')) {
                    return { modality: mod, templateKey: key, template: templates[key] };
                }
            }

            if (mod === 'CR' || mod === 'DX') {
                if (desc.includes('chest') && keyLower.includes('chest')) {
                    return { modality: mod, templateKey: key, template: templates[key] };
                }
                if (desc.includes('abdomen') && keyLower.includes('abdomen')) {
                    return { modality: mod, templateKey: key, template: templates[key] };
                }
            }

            if (mod === 'US') {
                if (desc.includes('abdomen') && keyLower.includes('abdomen')) {
                    return { modality: mod, templateKey: key, template: templates[key] };
                }
                if ((desc.includes('pelvi') || desc.includes('uterus') || desc.includes('ovary')) && keyLower.includes('pelvis')) {
                    return { modality: mod, templateKey: key, template: templates[key] };
                }
                if (desc.includes('thyroid') && keyLower.includes('thyroid')) {
                    return { modality: mod, templateKey: key, template: templates[key] };
                }
                if ((desc.includes('obstetric') || desc.includes('pregnancy') || desc.includes('fetal')) && keyLower.includes('obstetric')) {
                    return { modality: mod, templateKey: key, template: templates[key] };
                }
            }

            if (mod === 'MG') {
                return { modality: mod, templateKey: key, template: templates[key] };
            }
        }

        // Return first template for this modality as fallback
        const firstKey = templateKeys[0];
        return { modality: mod, templateKey: firstKey, template: templates[firstKey] };
    }

    /**
     * Open the reporting interface
     */
    async openReportingInterface() {
        const state = window.DICOM_VIEWER?.STATE;

        if (!state?.currentSeriesImages || state.currentSeriesImages.length === 0) {
            this.showToast('Please load a study first', 'warning');
            return;
        }

        const currentImage = state.currentSeriesImages[state.currentImageIndex];
        const modality = currentImage?.modality || 'OTHER';
        const studyDescription = currentImage?.study_description || currentImage?.studyDescription || '';

        // Detect appropriate template
        const { templateKey, template } = this.detectTemplateForModality(modality, studyDescription);

        console.log(`Opening reporting interface for modality: ${modality}, template: ${templateKey}`);

        // Store current data
        this.currentModality = modality;
        this.currentTemplate = templateKey;
        this.templateData = template;
        this.patientInfo = this.getPatientInfo(currentImage);
        this.extractedMeasurements = [];

        // Fetch DICOM measurements if available (for US, CT, MR, etc.)
        await this.fetchDicomMeasurements(currentImage);

        // If no structured measurements found and it's ultrasound, try OCR extraction
        if ((!this.extractedMeasurements || this.extractedMeasurements.length === 0) &&
            ['US', 'SR'].includes(modality)) {
            await this.extractMeasurementsWithOCR();
        }

        // Create split-screen interface
        this.createSplitScreenInterface();
    }

    /**
     * Fetch measurements from DICOM file via API
     */
    async fetchDicomMeasurements(image) {
        try {
            // Debug: log the image object to see its structure
            console.log('Image object for measurement extraction:', image);

            // Get instance ID (Orthanc ID) - try multiple possible field names
            const instanceId = image?.orthancInstanceId ||
                image?.instanceId ||
                image?.id ||
                image?.orthancId;

            // Get study ID - try multiple possible field names
            const studyId = image?.orthancStudyId ||
                image?.studyId ||
                image?.study_instance_uid ||
                image?.studyInstanceUID;

            console.log('Extracted IDs - instanceId:', instanceId, 'studyId:', studyId);

            if (!instanceId) {
                console.log('No Orthanc instance ID available for measurement extraction');
                console.log('Available image keys:', image ? Object.keys(image) : 'image is null');
                return;
            }

            const basePath = document.querySelector('meta[name="base-path"]')?.content || '';
            let url = `${basePath}/api/dicom/extract-measurements.php?instanceId=${instanceId}`;
            if (studyId) {
                url += `&studyId=${studyId}`;
            }

            console.log('Fetching DICOM measurements from:', url);

            const response = await fetch(url);
            const responseText = await response.text();

            console.log('Measurement API response:', responseText.substring(0, 500));

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${responseText}`);
            }

            let result;
            try {
                result = JSON.parse(responseText);
            } catch (e) {
                console.error('Failed to parse measurement response:', e);
                return;
            }

            if (result.success && result.measurements && result.measurements.length > 0) {
                this.extractedMeasurements = result.measurements;
                this.measurementCategories = result.categories || {};
                console.log(`✓ Extracted ${result.measurements.length} measurements from DICOM`);
                this.showToast(`Found ${result.measurements.length} measurements in DICOM`, 'info');
            } else if (result.success) {
                console.log('No measurements found in DICOM data. Modality:', result.modality);
                // Still log if we got a successful response but no measurements
                if (result.raw) {
                    console.log('Raw extraction data:', result.raw);
                }
                // Store metadata even if no measurements found
                this.dicomMetadata = result.raw?.metadata || {};
            } else {
                console.warn('Measurement extraction failed:', result.error);
            }

        } catch (error) {
            console.warn('Could not extract DICOM measurements:', error.message);
            // Don't show error to user - measurements are optional
        }
    }

    /**
     * Extract measurements from image using OCR (Tesseract.js)
     * Used when no structured DICOM measurements are available
     */
    async extractMeasurementsWithOCR() {
        try {
            const ocrExtractor = window.DICOM_VIEWER?.ocrExtractor;
            if (!ocrExtractor) {
                console.warn('OCR extractor not available');
                return;
            }

            // Show OCR progress indicator
            this.showOCRProgress();

            // Get the active viewport
            const viewports = document.querySelectorAll('.viewport');
            const activeViewport = viewports[0]; // Use first viewport or the active one

            if (!activeViewport) {
                console.warn('No viewport found for OCR extraction');
                this.hideOCRProgress();
                return;
            }

            console.log('Starting OCR measurement extraction...');
            const result = await ocrExtractor.extractFromViewport(activeViewport);

            this.hideOCRProgress();

            if (result.success && result.measurements.length > 0) {
                this.extractedMeasurements = result.measurements;
                this.ocrRawText = result.rawText;
                this.ocrConfidence = result.confidence;

                console.log(`✓ OCR extracted ${result.measurements.length} measurements`);
                console.log('OCR Confidence:', result.confidence);
                this.showToast(`OCR found ${result.measurements.length} measurements`, 'success');
            } else {
                console.log('OCR completed but no measurements found in text');
                if (result.rawText) {
                    console.log('OCR Raw text:', result.rawText.substring(0, 500));
                }
            }

        } catch (error) {
            console.error('OCR extraction error:', error);
            this.hideOCRProgress();
        }
    }

    /**
     * Show OCR progress indicator
     */
    showOCRProgress() {
        // Remove existing progress if any
        this.hideOCRProgress();

        const progressHTML = `
            <div id="ocr-progress-overlay" style="
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(0, 0, 0, 0.9);
                border: 2px solid #0d6efd;
                border-radius: 12px;
                padding: 30px 50px;
                z-index: 10001;
                text-align: center;
                color: white;
            ">
                <div class="spinner-border text-primary mb-3" role="status" style="width: 3rem; height: 3rem;">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <div class="fw-bold mb-2">Extracting Measurements with OCR</div>
                <div class="progress" style="width: 200px; height: 8px;">
                    <div id="ocr-progress" class="progress-bar progress-bar-striped progress-bar-animated"
                         role="progressbar" style="width: 0%;">0%</div>
                </div>
                <small class="text-muted d-block mt-2">Analyzing image text...</small>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', progressHTML);
    }

    /**
     * Hide OCR progress indicator
     */
    hideOCRProgress() {
        const overlay = document.getElementById('ocr-progress-overlay');
        if (overlay) {
            overlay.remove();
        }
    }

    generateTemplateOptions() {
        let options = '';

        Object.entries(this.modalityTemplates).forEach(([modality, templates]) => {
            if (templates && modality !== 'DX') {
                Object.entries(templates).forEach(([key, template]) => {
                    const selected = key === this.currentTemplate ? 'selected' : '';
                    options += `<option value="${modality}:${key}" ${selected}>${template.name} (${modality})</option>`;
                });
            }
        });

        return options;
    }

    getPatientInfo(image) {
        return {
            name: image?.patient_name || image?.patientName || 'Unknown Patient',
            id: image?.patient_id || image?.patientId || 'Unknown',
            age: image?.patient_age || image?.patientAge || '',
            sex: image?.patient_sex || image?.patientSex || '',
            dob: image?.patient_birth_date || '',
            studyDate: image?.study_date || image?.studyDate || new Date().toISOString().split('T')[0],
            studyDescription: image?.study_description || image?.studyDescription || '',
            studyUID: image?.study_instance_uid || image?.studyInstanceUID || '',
            accessionNumber: image?.accession_number || '',
            referringPhysician: image?.referring_physician || '',
            modality: image?.modality || 'Unknown'
        };
    }

    /**
     * Create the split-screen reporting interface
     */
    createSplitScreenInterface() {
        // Remove existing if present
        const existing = document.getElementById('advanced-report-container');
        if (existing) existing.remove();

        const mainContent = document.getElementById('main-content');
        if (!mainContent) {
            console.error('Main content not found');
            return;
        }

        // Create container
        const container = document.createElement('div');
        container.id = 'advanced-report-container';
        container.innerHTML = this.generateReportInterfaceHTML();

        mainContent.appendChild(container);

        // Attach events
        this.attachReportEvents();

        // Add keyboard shortcuts
        this.setupKeyboardShortcuts();

        this.reportingMode = true;

        // Add body class to hide sidebar toggle button
        document.body.classList.add('advanced-report-open');

        console.log('✓ Split-screen reporting interface created');
    }

    generateReportInterfaceHTML() {
        const template = this.templateData;
        const patient = this.patientInfo;
        const hospital = this.hospitalSettings || {};

        return `
            <div class="report-split-container">
                <!-- Report Panel (Right side) -->
                <div class="report-panel" id="report-panel">
                    <!-- Header -->
                    <div class="report-panel-header">
                        <div class="d-flex justify-content-between align-items-center">
                            <div class="d-flex align-items-center gap-2">
                                <i class="bi ${template.icon || 'bi-file-medical'} fs-4 text-primary"></i>
                                <div>
                                    <h5 class="mb-0">${template.name}</h5>
                                    <small class="text-muted">${this.currentModality} Report</small>
                                </div>
                            </div>
                            <div class="report-actions-header">
                                <button class="btn btn-sm btn-outline-info me-1" id="change-template-btn" title="Change Template">
                                    <i class="bi bi-list-ul"></i>
                                </button>
                                <button class="btn btn-sm btn-outline-secondary me-1" id="minimize-report-btn" title="Minimize">
                                    <i class="bi bi-chevron-right"></i>
                                </button>
                                <button class="btn btn-sm btn-outline-danger" id="close-report-btn" title="Close">
                                    <i class="bi bi-x-lg"></i>
                                </button>
                            </div>
                        </div>
                        <!-- Template Selector (hidden by default) -->
                        <div id="template-selector" class="mt-2" style="display: none;">
                            <select class="form-select form-select-sm" id="template-select">
                                ${this.generateTemplateOptions()}
                            </select>
                        </div>
                    </div>

                    <!-- Patient Info Bar -->
                    <div class="patient-info-bar">
                        <div class="row g-2 text-white small">
                            <div class="col-6">
                                <i class="bi bi-person-fill me-1"></i>
                                <strong>${patient.name}</strong>
                            </div>
                            <div class="col-6 text-end">
                                <span class="badge bg-primary">${patient.id}</span>
                            </div>
                            <div class="col-4">
                                <i class="bi bi-calendar3 me-1"></i>${patient.studyDate}
                            </div>
                            <div class="col-4 text-center">
                                ${patient.age ? `<i class="bi bi-hourglass me-1"></i>${patient.age}` : ''}
                                ${patient.sex ? ` / ${patient.sex}` : ''}
                            </div>
                            <div class="col-4 text-end">
                                <span class="badge bg-secondary">${patient.modality}</span>
                            </div>
                        </div>
                    </div>

                    <!-- DICOM Measurements Section (if available) -->
                    ${this.generateMeasurementsSection()}

                    <!-- Report Form -->
                    <div class="report-form-container" id="report-form-container">
                        <form id="report-form">
                            ${this.generateFormSections(template.sections)}
                        </form>
                    </div>

                    <!-- Footer Actions -->
                    <div class="report-panel-footer">
                        <div class="row g-2">
                            <div class="col-6">
                                <select class="form-select form-select-sm" id="report-status">
                                    <option value="draft">Draft</option>
                                    <option value="final">Final</option>
                                    <option value="amended">Amended</option>
                                </select>
                            </div>
                            <div class="col-6">
                                <div class="btn-group w-100">
                                    <button type="button" class="btn btn-success btn-sm" id="save-report-btn">
                                        <i class="bi bi-check-lg me-1"></i>Save
                                    </button>
                                    <button type="button" class="btn btn-primary btn-sm" id="print-report-btn">
                                        <i class="bi bi-printer me-1"></i>Print
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div class="mt-2">
                            <input type="text" class="form-control form-control-sm" id="reporting-physician"
                                   placeholder="Reporting Physician Name"
                                   value="${hospital.default_physician || ''}">
                        </div>
                    </div>
                </div>

                <!-- Minimized Button (hidden by default) -->
                <button class="report-expand-btn" id="expand-report-btn" style="display: none;">
                    <i class="bi bi-file-medical-fill"></i>
                    <span>Report</span>
                </button>
            </div>

            <style>
                /* ===== DESKTOP STYLES (Split Screen Layout) ===== */
                .report-split-container {
                    position: absolute;
                    top: 0;
                    right: 0;
                    bottom: 0;
                    width: 450px;
                    z-index: 1100;
                    display: flex;
                    transition: width 0.3s ease;
                }

                .report-panel {
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(180deg, #1a1f35 0%, #0d1117 100%);
                    border-left: 2px solid #0d6efd;
                    display: flex;
                    flex-direction: column;
                    box-shadow: -4px 0 20px rgba(0, 0, 0, 0.5);
                    animation: slideInRight 0.3s ease-out;
                }

                /* Adjust main content/viewport when report is open */
                body.advanced-report-open #main-content {
                    margin-right: 450px;
                    transition: margin-right 0.3s ease;
                }

                body.advanced-report-open #viewport-container {
                    transition: all 0.3s ease;
                }

                /* Hide the right sidebar toggle button when report panel is open */
                body.advanced-report-open #toggleRightSidebar {
                    display: none !important;
                }

                /* Also hide the right sidebar itself when report panel is open */
                body.advanced-report-open #rightSidebar {
                    display: none !important;
                }

                /* Hide the medical report button when report panel is open */
                body.advanced-report-open #medicalReportBtn {
                    display: none !important;
                }

                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }

                @keyframes slideUpMobile {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }

                .report-panel-header {
                    padding: 12px 15px;
                    background: linear-gradient(135deg, #1e3a5f 0%, #0d1f35 100%);
                    border-bottom: 1px solid rgba(13, 110, 253, 0.3);
                    flex-shrink: 0;
                }

                .report-panel-header h5 {
                    font-size: 1rem;
                    margin: 0;
                }

                .patient-info-bar {
                    padding: 8px 12px;
                    background: rgba(13, 110, 253, 0.1);
                    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                    flex-shrink: 0;
                }

                .report-form-container {
                    flex: 1;
                    overflow-y: auto;
                    padding: 12px;
                    -webkit-overflow-scrolling: touch;
                }

                .report-form-container::-webkit-scrollbar {
                    width: 6px;
                }

                .report-form-container::-webkit-scrollbar-thumb {
                    background: rgba(13, 110, 253, 0.5);
                    border-radius: 3px;
                }

                .report-section {
                    margin-bottom: 15px;
                    background: rgba(255, 255, 255, 0.03);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 8px;
                    overflow: hidden;
                }

                .report-section-header {
                    padding: 10px 12px;
                    background: rgba(13, 110, 253, 0.15);
                    border-bottom: 1px solid rgba(13, 110, 253, 0.2);
                    cursor: pointer;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    color: #fff;
                    font-weight: 500;
                    font-size: 14px;
                    -webkit-tap-highlight-color: transparent;
                }

                .report-section-header:hover {
                    background: rgba(13, 110, 253, 0.25);
                }

                .report-section-header:active {
                    background: rgba(13, 110, 253, 0.35);
                }

                .report-section-header .toggle-icon {
                    transition: transform 0.2s;
                }

                .report-section.collapsed .report-section-header .toggle-icon {
                    transform: rotate(-90deg);
                }

                .report-section-content {
                    padding: 12px;
                }

                .report-section.collapsed .report-section-content {
                    display: none;
                }

                .subsection-group {
                    margin-bottom: 10px;
                }

                .subsection-label {
                    font-size: 12px;
                    font-weight: 500;
                    color: #8ec8ff;
                    margin-bottom: 4px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }

                .form-control, .form-select {
                    background: rgba(0, 0, 0, 0.3);
                    border: 1px solid rgba(255, 255, 255, 0.15);
                    color: #fff;
                    font-size: 14px;
                }

                .form-control:focus, .form-select:focus {
                    background: rgba(0, 0, 0, 0.4);
                    border-color: #0d6efd;
                    box-shadow: 0 0 0 2px rgba(13, 110, 253, 0.25);
                    color: #fff;
                }

                .form-control::placeholder {
                    color: rgba(255, 255, 255, 0.4);
                }

                textarea.form-control {
                    min-height: 50px;
                    resize: vertical;
                }

                .impression-field {
                    border-left: 3px solid #ffc107;
                    background: rgba(255, 193, 7, 0.1) !important;
                }

                .report-panel-footer {
                    padding: 12px;
                    background: linear-gradient(0deg, #0d1117 0%, transparent 100%);
                    border-top: 1px solid rgba(255, 255, 255, 0.1);
                    flex-shrink: 0;
                }

                .report-expand-btn {
                    position: fixed;
                    right: 0;
                    top: 50%;
                    transform: translateY(-50%);
                    background: linear-gradient(135deg, #0d6efd 0%, #0a58ca 100%);
                    border: none;
                    border-radius: 8px 0 0 8px;
                    padding: 15px 10px;
                    color: white;
                    cursor: pointer;
                    box-shadow: -2px 0 10px rgba(0, 0, 0, 0.3);
                    z-index: 1201;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 5px;
                }

                .report-expand-btn:hover {
                    background: linear-gradient(135deg, #0a58ca 0%, #084298 100%);
                }

                .report-expand-btn i {
                    font-size: 24px;
                }

                .report-expand-btn span {
                    font-size: 11px;
                    writing-mode: vertical-rl;
                    text-orientation: mixed;
                }

                .quick-insert-btn {
                    font-size: 10px;
                    padding: 2px 5px;
                    margin-left: 4px;
                }

                /* ===== TABLET STYLES (medium screens) ===== */
                @media (max-width: 1024px) {
                    .report-split-container {
                        width: 380px;
                    }

                    body.advanced-report-open #main-content {
                        margin-right: 380px;
                    }
                }

                /* ===== MOBILE STYLES (Bottom Sheet Layout) ===== */
                @media (max-width: 768px) {
                    .report-split-container {
                        position: fixed;
                        top: auto;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        width: 100%;
                        height: 85vh;
                        max-height: 85vh;
                        border-radius: 20px 20px 0 0;
                        overflow: hidden;
                        z-index: 1300;
                        animation: slideUpMobile 0.3s ease-out;
                    }

                    .report-panel {
                        border-left: none;
                        border-top: 3px solid #0d6efd;
                        border-radius: 20px 20px 0 0;
                    }

                    /* Mobile drag handle */
                    .report-panel::before {
                        content: '';
                        display: block;
                        width: 40px;
                        height: 4px;
                        background: rgba(255, 255, 255, 0.3);
                        border-radius: 2px;
                        margin: 8px auto;
                        flex-shrink: 0;
                    }

                    body.advanced-report-open #main-content {
                        margin-right: 0;
                    }

                    /* Add overlay behind mobile panel */
                    .report-split-container::after {
                        content: '';
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 85vh;
                        background: rgba(0, 0, 0, 0.5);
                        z-index: -1;
                        pointer-events: none;
                    }

                    .report-panel-header {
                        padding: 8px 12px 12px;
                    }

                    .report-panel-header h5 {
                        font-size: 0.95rem;
                    }

                    .report-panel-header small {
                        font-size: 0.75rem;
                    }

                    .patient-info-bar {
                        padding: 6px 10px;
                    }

                    .patient-info-bar .row {
                        font-size: 11px;
                    }

                    .report-form-container {
                        padding: 10px;
                    }

                    .report-section {
                        margin-bottom: 12px;
                    }

                    .report-section-header {
                        padding: 10px;
                        font-size: 13px;
                    }

                    .report-section-content {
                        padding: 10px;
                    }

                    .subsection-label {
                        font-size: 11px;
                    }

                    .form-control, .form-select {
                        font-size: 16px; /* Prevents iOS zoom on focus */
                        padding: 10px;
                    }

                    textarea.form-control {
                        min-height: 60px;
                    }

                    .report-panel-footer {
                        padding: 10px;
                        padding-bottom: max(10px, env(safe-area-inset-bottom));
                    }

                    .report-panel-footer .btn {
                        padding: 10px 12px;
                        font-size: 14px;
                    }

                    .report-expand-btn {
                        bottom: 80px;
                        top: auto;
                        transform: none;
                        right: 10px;
                        padding: 12px;
                        border-radius: 50%;
                        width: 56px;
                        height: 56px;
                    }

                    .report-expand-btn span {
                        display: none;
                    }

                    .report-expand-btn i {
                        font-size: 20px;
                    }

                    .quick-insert-btn {
                        display: none;
                    }

                    /* Adjust buttons for touch */
                    .report-actions-header .btn {
                        padding: 8px 10px;
                        min-width: 40px;
                        min-height: 40px;
                    }

                    #template-selector {
                        margin-top: 8px;
                    }

                    /* Hide minimize on mobile - use close only */
                    #minimize-report-btn {
                        display: none;
                    }
                }

                /* ===== SMALL MOBILE (iPhone SE, etc) ===== */
                @media (max-width: 375px) {
                    .report-split-container {
                        height: 90vh;
                        max-height: 90vh;
                    }

                    .report-panel-header {
                        padding: 6px 10px 10px;
                    }

                    .report-panel-header h5 {
                        font-size: 0.85rem;
                    }

                    .patient-info-bar {
                        padding: 5px 8px;
                    }

                    .patient-info-bar .row {
                        font-size: 10px;
                    }

                    .report-section-header {
                        padding: 8px;
                        font-size: 12px;
                    }

                    .report-section-content {
                        padding: 8px;
                    }

                    .subsection-group {
                        margin-bottom: 8px;
                    }
                }

                /* ===== LANDSCAPE MOBILE ===== */
                @media (max-width: 768px) and (orientation: landscape) {
                    .report-split-container {
                        height: 100vh;
                        max-height: 100vh;
                        border-radius: 0;
                        left: 50%;
                        width: 50%;
                    }

                    .report-panel {
                        border-radius: 0;
                        border-top: none;
                        border-left: 2px solid #0d6efd;
                    }

                    .report-panel::before {
                        display: none;
                    }

                    .report-split-container::after {
                        display: none;
                    }

                    body.advanced-report-open #main-content {
                        margin-right: 50vw;
                    }

                    #minimize-report-btn {
                        display: inline-flex;
                    }
                }

                /* ===== ACCESSIBILITY & INTERACTION ===== */
                @media (hover: none) {
                    .report-section-header:hover {
                        background: rgba(13, 110, 253, 0.15);
                    }
                }

                /* Reduced motion preference */
                @media (prefers-reduced-motion: reduce) {
                    .report-panel,
                    .report-split-container,
                    body.advanced-report-open #main-content {
                        animation: none;
                        transition: none;
                    }
                }
            </style>
        `;
    }

    /**
     * Generate the DICOM measurements section with editable fields
     * Measurements are auto-extracted from DICOM SR, annotations, overlays
     * If no measurements found, shows manual entry template for US modality
     * Doctors can edit/override any value
     * 
     * DISABLED: User requested to remove auto extract measurements section
     */
    generateMeasurementsSection() {
        // Return empty string to hide measurements section
        return '';
    }

    /**
     * Generate OCR extraction button and manual entry section for ultrasound/unknown modalities
     */
    generateOCRAndManualSection() {
        const manualTemplate = this.generateManualMeasurementTemplate();

        return `
            <div class="ocr-section mb-3" id="ocr-extraction-section">
                <div class="ocr-header p-3 rounded" style="background: rgba(13, 110, 253, 0.1); border: 1px solid rgba(13, 110, 253, 0.3);">
                    <div class="d-flex justify-content-between align-items-center">
                        <div class="d-flex align-items-center gap-2">
                            <i class="bi bi-eye text-primary fs-5"></i>
                            <div>
                                <span class="fw-semibold text-white">Auto-Extract Measurements</span>
                                <small class="d-block text-muted">Use OCR to extract text from the image</small>
                            </div>
                        </div>
                        <button type="button" class="btn btn-primary" id="run-ocr-extraction-btn">
                            <i class="bi bi-search me-1"></i>Extract with OCR
                        </button>
                    </div>
                </div>
            </div>
            ${manualTemplate}
        `;
    }

    /**
     * Generate generic measurements section for non-ultrasound modalities
     */
    generateGenericMeasurementsSection() {
        return `
            <div class="ocr-section mb-3" id="ocr-extraction-section">
                <div class="ocr-header p-3 rounded" style="background: rgba(13, 110, 253, 0.1); border: 1px solid rgba(13, 110, 253, 0.3);">
                    <div class="d-flex justify-content-between align-items-center">
                        <div class="d-flex align-items-center gap-2">
                            <i class="bi bi-rulers text-primary fs-5"></i>
                            <div>
                                <span class="fw-semibold text-white">Measurements</span>
                                <small class="d-block text-muted">Extract measurements from image or enter manually</small>
                            </div>
                        </div>
                        <button type="button" class="btn btn-outline-primary btn-sm" id="run-ocr-extraction-btn">
                            <i class="bi bi-eye me-1"></i>OCR Extract
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Generate manual measurement entry template for ultrasound
     * Provides common measurement fields with normal reference values
     */
    generateManualMeasurementTemplate() {
        const templateType = this.currentTemplate || '';

        // Define measurement templates based on ultrasound type
        const measurementTemplates = {
            'US_ABDOMEN': [
                { id: 'liver_length', name: 'Liver Length', unit: 'cm', normal: '< 16', placeholder: 'e.g., 14.5' },
                { id: 'liver_span', name: 'Liver Span (MCL)', unit: 'cm', normal: '< 15', placeholder: 'e.g., 13.2' },
                { id: 'cbd', name: 'Common Bile Duct', unit: 'mm', normal: '< 6', placeholder: 'e.g., 4' },
                { id: 'portal_vein', name: 'Portal Vein', unit: 'mm', normal: '< 13', placeholder: 'e.g., 11' },
                { id: 'gb_wall', name: 'Gallbladder Wall', unit: 'mm', normal: '< 3', placeholder: 'e.g., 2' },
                { id: 'spleen_length', name: 'Spleen Length', unit: 'cm', normal: '< 12', placeholder: 'e.g., 10.5' },
                { id: 'right_kidney', name: 'Right Kidney', unit: 'cm', normal: '9-12', placeholder: 'e.g., 10.2 × 4.5' },
                { id: 'left_kidney', name: 'Left Kidney', unit: 'cm', normal: '9-12', placeholder: 'e.g., 10.5 × 4.8' },
                { id: 'aorta', name: 'Aorta Diameter', unit: 'cm', normal: '< 3', placeholder: 'e.g., 2.1' },
                { id: 'ivc', name: 'IVC Diameter', unit: 'cm', normal: '< 2.5', placeholder: 'e.g., 1.8' },
            ],
            'US_PELVIS': [
                { id: 'uterus_size', name: 'Uterus Size', unit: 'cm', normal: '7-8 × 4-5 × 3-4', placeholder: 'L × W × AP' },
                { id: 'endometrium', name: 'Endometrial Thickness', unit: 'mm', normal: 'Varies with cycle', placeholder: 'e.g., 8' },
                { id: 'right_ovary', name: 'Right Ovary', unit: 'cm', normal: '3 × 2 × 1.5', placeholder: 'L × W × H' },
                { id: 'left_ovary', name: 'Left Ovary', unit: 'cm', normal: '3 × 2 × 1.5', placeholder: 'L × W × H' },
                { id: 'right_ovary_vol', name: 'Right Ovary Volume', unit: 'cc', normal: '< 10', placeholder: 'e.g., 6.5' },
                { id: 'left_ovary_vol', name: 'Left Ovary Volume', unit: 'cc', normal: '< 10', placeholder: 'e.g., 7.2' },
                { id: 'pod_fluid', name: 'POD Fluid', unit: '', normal: 'Minimal/None', placeholder: 'e.g., Trace' },
            ],
            'US_THYROID': [
                { id: 'right_lobe', name: 'Right Lobe', unit: 'cm', normal: '4-6 × 1.5-2 × 1-2', placeholder: 'L × W × AP' },
                { id: 'left_lobe', name: 'Left Lobe', unit: 'cm', normal: '4-6 × 1.5-2 × 1-2', placeholder: 'L × W × AP' },
                { id: 'isthmus', name: 'Isthmus', unit: 'mm', normal: '< 5', placeholder: 'e.g., 3' },
                { id: 'right_vol', name: 'Right Lobe Volume', unit: 'cc', normal: '5-10', placeholder: 'e.g., 7.5' },
                { id: 'left_vol', name: 'Left Lobe Volume', unit: 'cc', normal: '5-10', placeholder: 'e.g., 6.8' },
                { id: 'nodule_1', name: 'Nodule (if any)', unit: 'cm', normal: '-', placeholder: 'Size & location' },
            ],
            'US_OBSTETRIC': [
                { id: 'bpd', name: 'Biparietal Diameter (BPD)', unit: 'mm', normal: 'See chart', placeholder: 'e.g., 45' },
                { id: 'hc', name: 'Head Circumference (HC)', unit: 'mm', normal: 'See chart', placeholder: 'e.g., 175' },
                { id: 'ac', name: 'Abdominal Circumference (AC)', unit: 'mm', normal: 'See chart', placeholder: 'e.g., 160' },
                { id: 'fl', name: 'Femur Length (FL)', unit: 'mm', normal: 'See chart', placeholder: 'e.g., 32' },
                { id: 'crl', name: 'Crown Rump Length (CRL)', unit: 'mm', normal: 'See chart', placeholder: 'e.g., 65' },
                { id: 'efw', name: 'Estimated Fetal Weight', unit: 'g', normal: 'See chart', placeholder: 'e.g., 1500' },
                { id: 'ga_bpd', name: 'GA by BPD', unit: 'weeks', normal: '-', placeholder: 'e.g., 20w3d' },
                { id: 'afi', name: 'Amniotic Fluid Index', unit: 'cm', normal: '5-25', placeholder: 'e.g., 14' },
                { id: 'placenta', name: 'Placental Location', unit: '', normal: '-', placeholder: 'e.g., Anterior/Grade I' },
            ],
            'default': [
                { id: 'measurement_1', name: 'Measurement 1', unit: 'cm', normal: '-', placeholder: 'Enter value' },
                { id: 'measurement_2', name: 'Measurement 2', unit: 'cm', normal: '-', placeholder: 'Enter value' },
                { id: 'measurement_3', name: 'Measurement 3', unit: 'mm', normal: '-', placeholder: 'Enter value' },
            ]
        };

        // Get appropriate template
        const measurements = measurementTemplates[templateType] || measurementTemplates['default'];

        let html = `
            <div class="measure-card measure-manual" id="manual-measurements-section">
                <div class="measure-header">
                    <div class="measure-header-content">
                        <div class="measure-icon" style="background: linear-gradient(135deg, #4dabf7, #339af0)">
                            <i class="bi bi-pencil-fill"></i>
                        </div>
                        <div class="measure-info">
                            <h6 class="measure-title">Manual Entry</h6>
                            <p class="measure-subtitle">Enter measurements manually - normal ranges shown</p>
                        </div>
                        <div class="measure-count">${measurements.length}</div>
                    </div>
                    <div class="measure-actions">
                        <button type="button" class="btn-action btn-primary-action" id="copy-manual-measurements-btn" title="Copy to findings">
                            <i class="bi bi-clipboard-check"></i>
                            <span>Copy</span>
                        </button>
                        <button type="button" class="btn-action btn-toggle-action" id="toggle-manual-measurements-btn" title="Toggle">
                            <i class="bi bi-chevron-up"></i>
                        </button>
                    </div>
                </div>
                <div class="measure-body" id="manual-measurements-body">
                    <div class="measure-list">
        `;

        measurements.forEach((m, index) => {
            html += `
                <div class="measure-row" data-measurement-id="${m.id}">
                    <div class="measure-label">
                        <span class="measure-name">${m.name}</span>
                        <span class="measure-normal">Normal: ${m.normal}</span>
                    </div>
                    <div class="measure-value">
                        <input type="text" class="measure-input manual-measurement-input"
                               id="manual_${m.id}"
                               placeholder="${m.placeholder}"
                               data-name="${m.name}"
                               data-unit="${m.unit}">
                        ${m.unit ? `<span class="measure-unit">${m.unit}</span>` : ''}
                    </div>
                </div>
            `;
        });

        html += `
                    </div>
                </div>
            </div>
            <style>
                .measure-card.measure-manual { border-top: 3px solid #4dabf7; }

                .measure-normal {
                    display: block;
                    font-size: 11px;
                    color: #69db7c;
                    font-weight: 500;
                    margin-top: 4px;
                }

                .manual-measurement-input {
                    width: 130px;
                }

                @media (max-width: 768px) {
                    .manual-measurement-input {
                        width: auto;
                        flex: 1;
                    }
                }
            </style>
        `;

        return html;
    }

    /**
     * Generate UI for extracted DICOM measurements (or OCR-extracted)
     */
    generateExtractedMeasurementsUI() {
        const isOCR = this.extractedMeasurements.some(m => m.source === 'ocr');
        const confidenceText = this.ocrConfidence ? ` (${Math.round(this.ocrConfidence)}% confidence)` : '';

        // Group measurements by category
        const categories = {};
        this.extractedMeasurements.forEach((m, index) => {
            const category = m.category || 'general';
            if (!categories[category]) categories[category] = [];
            categories[category].push({ ...m, index });
        });

        const categoryInfo = {
            'obstetric': { label: 'Obstetric', icon: 'bi-heart-pulse-fill', gradient: 'linear-gradient(135deg, #ff6b9d, #ff8fab)' },
            'abdominal': { label: 'Abdominal', icon: 'bi-activity', gradient: 'linear-gradient(135deg, #4dabf7, #74c0fc)' },
            'thyroid': { label: 'Thyroid', icon: 'bi-circle-fill', gradient: 'linear-gradient(135deg, #51cf66, #69db7c)' },
            'cardiac': { label: 'Cardiac', icon: 'bi-heart-fill', gradient: 'linear-gradient(135deg, #ff6b6b, #ff8787)' },
            'vascular': { label: 'Vascular', icon: 'bi-droplet-fill', gradient: 'linear-gradient(135deg, #748ffc, #91a7ff)' },
            'pelvic': { label: 'Pelvic', icon: 'bi-diagram-3-fill', gradient: 'linear-gradient(135deg, #ffa94d, #ffb366)' },
            'general': { label: 'General', icon: 'bi-rulers', gradient: 'linear-gradient(135deg, #868e96, #adb5bd)' }
        };

        const themeColor = isOCR ? '#ffc107' : '#20c997';
        const headerTitle = isOCR ? 'OCR Measurements' : 'DICOM Measurements';
        const infoText = isOCR
            ? `Extracted via OCR${confidenceText} - Please verify values`
            : 'Extracted from DICOM metadata';

        let html = `
            <div class="measure-card ${isOCR ? 'measure-ocr' : 'measure-dicom'}" id="dicom-measurements-section">
                <div class="measure-header">
                    <div class="measure-header-content">
                        <div class="measure-icon" style="background: ${isOCR ? 'linear-gradient(135deg, #ffc107, #ffcd39)' : 'linear-gradient(135deg, #20c997, #3ddc b4)'}">
                            <i class="bi ${isOCR ? 'bi-eye-fill' : 'bi-clipboard2-data-fill'}"></i>
                        </div>
                        <div class="measure-info">
                            <h6 class="measure-title">${headerTitle}</h6>
                            <p class="measure-subtitle">${infoText}</p>
                        </div>
                        <div class="measure-count">${this.extractedMeasurements.length}</div>
                    </div>
                    <div class="measure-actions">
                        <button type="button" class="btn-action btn-primary-action" id="copy-measurements-btn" title="Copy to findings">
                            <i class="bi bi-clipboard-check"></i>
                            <span>Copy</span>
                        </button>
                        <button type="button" class="btn-action btn-toggle-action" id="toggle-measurements-btn" title="Toggle">
                            <i class="bi bi-chevron-up"></i>
                        </button>
                    </div>
                </div>
                <div class="measure-body" id="measurements-body">
        `;

        for (const [category, measurements] of Object.entries(categories)) {
            const catInfo = categoryInfo[category] || categoryInfo['general'];
            html += `
                <div class="measure-group">
                    <div class="measure-group-header">
                        <div class="measure-group-icon" style="background: ${catInfo.gradient}">
                            <i class="bi ${catInfo.icon}"></i>
                        </div>
                        <span class="measure-group-title">${catInfo.label}</span>
                        <span class="measure-group-badge">${measurements.length}</span>
                    </div>
                    <div class="measure-list">
            `;

            measurements.forEach(m => {
                const displayValue = m.type === 'dimensions' ? m.value :
                    (typeof m.value === 'number' ? m.value.toFixed(2) : m.value);
                const isNumeric = m.type === 'numeric' || m.type === 'dimensions';

                html += `
                    <div class="measure-row" data-measurement-index="${m.index}">
                        <div class="measure-label">
                            <span class="measure-name">${this.escapeHtml(m.name || 'Measurement')}</span>
                            ${m.source ? `<span class="measure-badge">${m.source}</span>` : ''}
                        </div>
                        <div class="measure-value">
                            ${isNumeric ?
                        `<input type="text" class="measure-input" id="measurement_${m.index}" 
                                        value="${displayValue}" data-original="${displayValue}"
                                        data-name="${this.escapeHtml(m.name || '')}" data-unit="${m.unit || ''}">` :
                        `<textarea class="measure-input" id="measurement_${m.index}" rows="1"
                                          data-original="${this.escapeHtml(String(m.value))}"
                                          data-name="${this.escapeHtml(m.name || '')}">${this.escapeHtml(String(m.value))}</textarea>`
                    }
                            ${m.unit ? `<span class="measure-unit">${m.unit}</span>` : ''}
                            <button type="button" class="btn-reset" data-index="${m.index}" style="display:none;" title="Reset">
                                <i class="bi bi-arrow-counterclockwise"></i>
                            </button>
                        </div>
                    </div>
                `;
            });

            html += `
                    </div>
                </div>
            `;
        }

        html += `
                </div>
            </div>
            <style>
                .measure-card {
                    background: linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02));
                    backdrop-filter: blur(20px);
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 16px;
                    margin: 16px 12px;
                    overflow: hidden;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.1);
                }

                .measure-card.measure-dicom { border-top: 3px solid #20c997; }
                .measure-card.measure-ocr { border-top: 3px solid #ffc107; }

                .measure-header {
                    padding: 20px;
                    background: rgba(0,0,0,0.2);
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                }

                .measure-header-content {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    margin-bottom: 12px;
                }

                .measure-icon {
                    width: 48px;
                    height: 48px;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-size: 20px;
                    box-shadow: 0 4px 16px rgba(0,0,0,0.2);
                }

                .measure-info { flex: 1; }

                .measure-title {
                    font-size: 15px;
                    font-weight: 600;
                    color: #fff;
                    margin: 0;
                    letter-spacing: 0.3px;
                }

                .measure-subtitle {
                    font-size: 12px;
                    color: rgba(255,255,255,0.6);
                    margin: 4px 0 0;
                }

                .measure-count {
                    width: 36px;
                    height: 36px;
                    border-radius: 10px;
                    background: rgba(255,255,255,0.1);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 14px;
                    font-weight: 700;
                    color: #fff;
                }

                .measure-actions {
                    display: flex;
                    gap: 8px;
                }

                .btn-action {
                    background: rgba(255,255,255,0.08);
                    border: 1px solid rgba(255,255,255,0.12);
                    color: #fff;
                    padding: 8px 16px;
                    border-radius: 10px;
                    font-size: 13px;
                    font-weight: 500;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .btn-action:hover {
                    background: rgba(255,255,255,0.15);
                    transform: translateY(-1px);
                }

                .btn-primary-action {
                    background: linear-gradient(135deg, #339af0, #228be6);
                    border: none;
                }

                .btn-primary-action:hover {
                    background: linear-gradient(135deg, #228be6, #1c7ed6);
                }

                .btn-toggle-action {
                    padding: 8px 12px;
                }

                .measure-body {
                    padding: 20px;
                    max-height: 450px;
                    overflow-y: auto;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }

                .measure-body.collapsed {
                    max-height: 0;
                    padding: 0 20px;
                    opacity: 0;
                }

                .measure-body::-webkit-scrollbar { width: 6px; }
                .measure-body::-webkit-scrollbar-track { background: rgba(0,0,0,0.1); border-radius: 3px; }
                .measure-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 3px; }

                .measure-group {
                    margin-bottom: 20px;
                    animation: slideIn 0.3s ease;
                }

                @keyframes slideIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                .measure-group:last-child { margin-bottom: 0; }

                .measure-group-header {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 10px 14px;
                    background: rgba(255,255,255,0.03);
                    border-radius: 10px;
                    margin-bottom: 12px;
                }

                .measure-group-icon {
                    width: 32px;
                    height: 32px;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-size: 14px;
                }

                .measure-group-title {
                    flex: 1;
                    font-size: 13px;
                    font-weight: 600;
                    color: #fff;
                }

                .measure-group-badge {
                    padding: 3px 10px;
                    background: rgba(255,255,255,0.1);
                    border-radius: 12px;
                    font-size: 11px;
                    font-weight: 600;
                    color: rgba(255,255,255,0.8);
                }

                .measure-list {
                    display: grid;
                    gap: 10px;
                }

                .measure-row {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 14px 16px;
                    background: rgba(255,255,255,0.04);
                    border: 1px solid rgba(255,255,255,0.06);
                    border-radius: 10px;
                    gap: 16px;
                    transition: all 0.2s;
                }

                .measure-row:hover {
                    background: rgba(255,255,255,0.08);
                    border-color: rgba(255,255,255,0.12);
                    transform: translateX(4px);
                }

                .measure-label { flex: 1; min-width: 0; }

                .measure-name {
                    font-size: 14px;
                    font-weight: 500;
                    color: #e9ecef;
                    display: block;
                }

                .measure-badge {
                    display: inline-block;
                    margin-top: 4px;
                    padding: 2px 8px;
                    background: rgba(255,255,255,0.1);
                    border-radius: 6px;
                    font-size: 10px;
                    font-weight: 500;
                    color: rgba(255,255,255,0.7);
                }

                .measure-value {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }

                .measure-input {
                    width: 110px;
                    padding: 10px 14px;
                    background: rgba(255,255,255,0.06);
                    border: 1.5px solid rgba(255,255,255,0.12);
                    border-radius: 8px;
                    color: #fff;
                    font-size: 14px;
                    font-weight: 600;
                    text-align: right;
                    transition: all 0.2s;
                }

                .measure-input:focus {
                    background: rgba(255,255,255,0.1);
                    border-color: #339af0;
                    outline: none;
                    box-shadow: 0 0 0 3px rgba(51,154,240,0.15);
                }

                .measure-input.modified {
                    border-color: #ffc107;
                    background: rgba(255,193,7,0.1);
                }

                .measure-unit {
                    font-size: 13px;
                    font-weight: 600;
                    color: rgba(255,255,255,0.5);
                    min-width: 35px;
                }

                .btn-reset {
                    background: transparent;
                    border: none;
                    color: #ffc107;
                    font-size: 16px;
                    padding: 4px;
                    cursor: pointer;
                    opacity: 0.8;
                    transition: all 0.2s;
                }

                .btn-reset:hover {
                    opacity: 1;
                    transform: rotate(-90deg);
                }

                @media (max-width: 768px) {
                    .measure-card { margin: 12px 8px; }
                    .measure-header { padding: 16px; }
                    .measure-body { padding: 16px; max-height: 350px; }
                    .measure-row { flex-direction: column; align-items: stretch; gap: 12px; }
                    .measure-value { justify-content: space-between; }
                    .measure-input { flex: 1; width: auto; }
                }
            </style>
        `;

        return html;
    }

    generateFormSections(sections) {
        if (!sections || !Array.isArray(sections)) return '';

        return sections.map(section => {
            let content = '';

            switch (section.type) {
                case 'textarea':
                    content = `
                        <textarea class="form-control" id="${section.id}"
                                  placeholder="${section.placeholder || ''}"
                                  rows="3"
                                  ${section.required ? 'required' : ''}>${section.default || ''}</textarea>
                    `;
                    break;

                case 'text':
                    content = `
                        <input type="text" class="form-control" id="${section.id}"
                               placeholder="${section.placeholder || ''}"
                               value="${section.default || ''}"
                               ${section.required ? 'required' : ''}>
                    `;
                    break;

                case 'date':
                    content = `
                        <input type="date" class="form-control" id="${section.id}"
                               ${section.required ? 'required' : ''}>
                    `;
                    break;

                case 'select':
                    content = `
                        <select class="form-select" id="${section.id}" ${section.required ? 'required' : ''}>
                            <option value="">-- Select --</option>
                            ${(section.options || []).map(opt => `<option value="${opt}">${opt}</option>`).join('')}
                            ${section.allowCustom ? '<option value="custom">Custom...</option>' : ''}
                        </select>
                        ${section.allowCustom ? `
                            <textarea class="form-control mt-2 d-none" id="${section.id}_custom"
                                      placeholder="Enter custom text..."></textarea>
                        ` : ''}
                    `;
                    break;

                case 'structured':
                    content = (section.subsections || []).map(sub => `
                        <div class="subsection-group">
                            <label class="subsection-label">
                                ${sub.label}
                                <button type="button" class="btn btn-outline-info btn-sm quick-insert-btn"
                                        data-target="${sub.id}" data-default="${this.escapeHtml(sub.default || '')}">
                                    <i class="bi bi-plus-circle"></i>
                                </button>
                            </label>
                            <textarea class="form-control" id="${sub.id}" rows="2"
                                      placeholder="${sub.default || ''}">${sub.default || ''}</textarea>
                        </div>
                    `).join('');
                    break;

                case 'impression':
                    content = `
                        <textarea class="form-control impression-field" id="${section.id}"
                                  placeholder="${section.placeholder || 'Enter numbered impression points...\n1. \n2. '}"
                                  rows="4"
                                  ${section.required ? 'required' : ''}></textarea>
                        <div class="mt-2">
                            <button type="button" class="btn btn-outline-success btn-sm" id="add-impression-line">
                                <i class="bi bi-plus-circle me-1"></i>Add Line
                            </button>
                            <button type="button" class="btn btn-outline-warning btn-sm" id="normal-study-btn">
                                <i class="bi bi-check-circle me-1"></i>Normal Study
                            </button>
                        </div>
                    `;
                    break;

                default:
                    content = `
                        <textarea class="form-control" id="${section.id}" rows="3"></textarea>
                    `;
            }

            return `
                <div class="report-section" data-section-id="${section.id}">
                    <div class="report-section-header">
                        <span>${section.title}</span>
                        <i class="bi bi-chevron-down toggle-icon"></i>
                    </div>
                    <div class="report-section-content">
                        ${content}
                    </div>
                </div>
            `;
        }).join('');
    }

    attachReportEvents() {
        // Close button
        document.getElementById('close-report-btn')?.addEventListener('click', () => this.closeReportInterface());

        // Minimize/Expand
        document.getElementById('minimize-report-btn')?.addEventListener('click', () => this.minimizeReport());
        document.getElementById('expand-report-btn')?.addEventListener('click', () => this.expandReport());

        // Change template button
        document.getElementById('change-template-btn')?.addEventListener('click', () => {
            const selector = document.getElementById('template-selector');
            if (selector) {
                selector.style.display = selector.style.display === 'none' ? 'block' : 'none';
            }
        });

        // Template select change
        document.getElementById('template-select')?.addEventListener('change', (e) => {
            const value = e.target.value;
            if (value) {
                const [modality, templateKey] = value.split(':');
                this.switchTemplate(modality, templateKey);
            }
        });

        // Section collapse/expand
        document.querySelectorAll('.report-section-header').forEach(header => {
            header.addEventListener('click', () => {
                header.closest('.report-section').classList.toggle('collapsed');
            });
        });

        // Custom select handling
        document.querySelectorAll('select').forEach(select => {
            select.addEventListener('change', (e) => {
                const customTextarea = document.getElementById(`${e.target.id}_custom`);
                if (customTextarea) {
                    if (e.target.value === 'custom') {
                        customTextarea.classList.remove('d-none');
                        customTextarea.focus();
                    } else {
                        customTextarea.classList.add('d-none');
                    }
                }
            });
        });

        // Quick insert buttons
        document.querySelectorAll('.quick-insert-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const target = document.getElementById(btn.dataset.target);
                const defaultText = btn.dataset.default;
                if (target && !target.value.trim()) {
                    target.value = defaultText;
                }
            });
        });

        // Add impression line
        document.getElementById('add-impression-line')?.addEventListener('click', () => {
            const impression = document.getElementById('impression');
            if (impression) {
                const lines = impression.value.split('\n').filter(l => l.trim());
                const nextNum = lines.length + 1;
                impression.value = impression.value.trim() + (impression.value.trim() ? '\n' : '') + `${nextNum}. `;
                impression.focus();
                impression.setSelectionRange(impression.value.length, impression.value.length);
            }
        });

        // Normal study shortcut
        document.getElementById('normal-study-btn')?.addEventListener('click', () => {
            const impression = document.getElementById('impression');
            if (impression) {
                impression.value = `1. Normal ${this.templateData?.name || 'study'} examination.\n2. No significant abnormality detected.`;
            }
        });

        // Save button
        document.getElementById('save-report-btn')?.addEventListener('click', () => this.saveReport());

        // Print button
        document.getElementById('print-report-btn')?.addEventListener('click', () => this.printReport());

        // Measurement section events
        this.attachMeasurementEvents();
    }

    /**
     * Attach event handlers for the measurements section
     */
    attachMeasurementEvents() {
        // OCR extraction button
        document.getElementById('run-ocr-extraction-btn')?.addEventListener('click', async () => {
            await this.runOCRExtraction();
        });

        // Toggle measurements section (extracted)
        document.getElementById('toggle-measurements-btn')?.addEventListener('click', () => {
            const body = document.getElementById('measurements-body');
            const btn = document.getElementById('toggle-measurements-btn');
            if (body && btn) {
                body.classList.toggle('collapsed');
                const icon = btn.querySelector('i');
                if (icon) {
                    icon.className = body.classList.contains('collapsed')
                        ? 'bi bi-chevron-down'
                        : 'bi bi-chevron-up';
                }
            }
        });

        // Toggle measurements section (manual)
        document.getElementById('toggle-manual-measurements-btn')?.addEventListener('click', () => {
            const body = document.getElementById('manual-measurements-body');
            const btn = document.getElementById('toggle-manual-measurements-btn');
            if (body && btn) {
                body.classList.toggle('collapsed');
                const icon = btn.querySelector('i');
                if (icon) {
                    icon.className = body.classList.contains('collapsed')
                        ? 'bi bi-chevron-down'
                        : 'bi bi-chevron-up';
                }
            }
        });

        // Copy manual measurements to findings
        document.getElementById('copy-manual-measurements-btn')?.addEventListener('click', () => {
            this.copyManualMeasurementsToFindings();
        });

        // Copy measurements to findings
        document.getElementById('copy-measurements-btn')?.addEventListener('click', () => {
            this.copyMeasurementsToFindings();
        });

        // Track measurement edits
        document.querySelectorAll('.measurement-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const original = e.target.dataset.original;
                const current = e.target.value;
                const index = e.target.id.replace('measurement_', '');
                const resetBtn = e.target.closest('.measurement-value-group')?.querySelector('.reset-measurement-btn');

                if (current !== original) {
                    e.target.classList.add('modified');
                    if (resetBtn) resetBtn.style.display = 'inline-block';
                } else {
                    e.target.classList.remove('modified');
                    if (resetBtn) resetBtn.style.display = 'none';
                }

                // Update the stored measurement
                if (this.extractedMeasurements && this.extractedMeasurements[index]) {
                    this.extractedMeasurements[index].editedValue = current;
                }
            });
        });

        // Reset measurement to original
        document.querySelectorAll('.reset-measurement-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = btn.dataset.index;
                const input = document.getElementById(`measurement_${index}`);
                if (input) {
                    input.value = input.dataset.original;
                    input.classList.remove('modified');
                    btn.style.display = 'none';

                    // Clear edited value
                    if (this.extractedMeasurements && this.extractedMeasurements[index]) {
                        delete this.extractedMeasurements[index].editedValue;
                    }
                }
            });
        });
    }

    /**
     * Copy all measurements to the findings section
     */
    copyMeasurementsToFindings() {
        if (!this.extractedMeasurements || this.extractedMeasurements.length === 0) {
            this.showToast('No measurements to copy', 'warning');
            return;
        }

        // Build formatted measurement text
        let measurementText = 'MEASUREMENTS:\n';

        // Group by category
        const categories = {};
        this.extractedMeasurements.forEach((m, index) => {
            const category = m.category || 'general';
            if (!categories[category]) {
                categories[category] = [];
            }
            // Use edited value if available
            const input = document.getElementById(`measurement_${index}`);
            const value = input ? input.value : (m.editedValue || m.value);
            categories[category].push({ ...m, displayValue: value });
        });

        const categoryNames = {
            'obstetric': 'Obstetric',
            'abdominal': 'Abdominal Organs',
            'thyroid': 'Thyroid',
            'cardiac': 'Cardiac',
            'vascular': 'Vascular',
            'generic': 'General',
            'general': 'General'
        };

        for (const [category, measurements] of Object.entries(categories)) {
            if (measurements.length > 0) {
                measurementText += `\n${categoryNames[category] || 'Measurements'}:\n`;
                measurements.forEach(m => {
                    const unit = m.unit ? ` ${m.unit}` : '';
                    measurementText += `- ${m.name}: ${m.displayValue}${unit}\n`;
                });
            }
        }

        // Find the findings field and append
        // Try different possible field IDs
        const findingsFields = ['findings', 'findings_general', 'us_findings'];
        let targetField = null;

        for (const fieldId of findingsFields) {
            const field = document.getElementById(fieldId);
            if (field) {
                targetField = field;
                break;
            }
        }

        // If no findings field, try any textarea in findings section
        if (!targetField) {
            targetField = document.querySelector('.report-section-content textarea');
        }

        if (targetField) {
            const currentValue = targetField.value.trim();
            targetField.value = currentValue
                ? `${currentValue}\n\n${measurementText}`
                : measurementText;

            // Scroll to the field
            targetField.scrollIntoView({ behavior: 'smooth', block: 'center' });
            targetField.focus();

            this.showToast('Measurements copied to findings', 'success');
        } else {
            // If no field found, copy to clipboard
            navigator.clipboard.writeText(measurementText).then(() => {
                this.showToast('Measurements copied to clipboard', 'info');
            }).catch(() => {
                this.showToast('Could not copy measurements', 'error');
            });
        }
    }

    /**
     * Copy manual measurements to findings section
     */
    copyManualMeasurementsToFindings() {
        // Collect all manual measurement inputs that have values
        const inputs = document.querySelectorAll('.manual-measurement-input');
        const measurements = [];

        inputs.forEach(input => {
            const value = input.value.trim();
            if (value) {
                const name = input.dataset.name || 'Measurement';
                const unit = input.dataset.unit || '';
                measurements.push({ name, value, unit });
            }
        });

        if (measurements.length === 0) {
            this.showToast('No measurements entered', 'warning');
            return;
        }

        // Build formatted measurement text
        let measurementText = 'MEASUREMENTS:\n';
        measurements.forEach(m => {
            const unit = m.unit ? ` ${m.unit}` : '';
            measurementText += `- ${m.name}: ${m.value}${unit}\n`;
        });

        // Find the findings field
        const findingsFields = ['findings', 'findings_general', 'us_findings'];
        let targetField = null;

        for (const fieldId of findingsFields) {
            const field = document.getElementById(fieldId);
            if (field) {
                targetField = field;
                break;
            }
        }

        if (!targetField) {
            targetField = document.querySelector('.report-section-content textarea');
        }

        if (targetField) {
            const currentValue = targetField.value.trim();
            targetField.value = currentValue
                ? `${currentValue}\n\n${measurementText}`
                : measurementText;

            targetField.scrollIntoView({ behavior: 'smooth', block: 'center' });
            targetField.focus();
            this.showToast('Measurements copied to findings', 'success');
        } else {
            navigator.clipboard.writeText(measurementText).then(() => {
                this.showToast('Measurements copied to clipboard', 'info');
            }).catch(() => {
                this.showToast('Could not copy measurements', 'error');
            });
        }
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (!this.reportingMode) return;

            // Ctrl+S to save
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                this.saveReport();
            }

            // Escape to close
            if (e.key === 'Escape') {
                this.closeReportInterface();
            }
        });
    }

    switchTemplate(modality, templateKey) {
        const templates = this.modalityTemplates[modality];
        if (!templates || !templates[templateKey]) {
            this.showToast('Template not found', 'error');
            return;
        }

        // Preserve the current form data
        const currentData = this.collectFormData();

        // Update the template
        this.currentModality = modality;
        this.currentTemplate = templateKey;
        this.templateData = templates[templateKey];

        // Recreate the form container
        const formContainer = document.getElementById('report-form-container');
        if (formContainer) {
            formContainer.innerHTML = `
                <form id="report-form">
                    ${this.generateFormSections(this.templateData.sections)}
                </form>
            `;

            // Update the header
            const header = document.querySelector('.report-panel-header');
            if (header) {
                const icon = header.querySelector('i.fs-4');
                const title = header.querySelector('h5');
                const subtitle = header.querySelector('small');

                if (icon) icon.className = `bi ${this.templateData.icon || 'bi-file-medical'} fs-4 text-primary`;
                if (title) title.textContent = this.templateData.name;
                if (subtitle) subtitle.textContent = `${modality} Report`;
            }

            // Re-attach events for new form elements
            this.attachFormEvents();

            // Try to restore common fields
            ['clinical_info', 'comparison', 'impression'].forEach(field => {
                const el = document.getElementById(field);
                if (el && currentData[field]) {
                    el.value = currentData[field];
                }
            });

            // Hide the template selector
            const selector = document.getElementById('template-selector');
            if (selector) selector.style.display = 'none';

            this.showToast(`Switched to ${this.templateData.name}`, 'success');
        }
    }

    attachFormEvents() {
        // Section collapse/expand
        document.querySelectorAll('.report-section-header').forEach(header => {
            header.addEventListener('click', () => {
                header.closest('.report-section').classList.toggle('collapsed');
            });
        });

        // Custom select handling
        document.querySelectorAll('select').forEach(select => {
            if (select.id === 'template-select' || select.id === 'report-status') return;
            select.addEventListener('change', (e) => {
                const customTextarea = document.getElementById(`${e.target.id}_custom`);
                if (customTextarea) {
                    if (e.target.value === 'custom') {
                        customTextarea.classList.remove('d-none');
                        customTextarea.focus();
                    } else {
                        customTextarea.classList.add('d-none');
                    }
                }
            });
        });

        // Quick insert buttons
        document.querySelectorAll('.quick-insert-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const target = document.getElementById(btn.dataset.target);
                const defaultText = btn.dataset.default;
                if (target && !target.value.trim()) {
                    target.value = defaultText;
                }
            });
        });

        // Add impression line
        document.getElementById('add-impression-line')?.addEventListener('click', () => {
            const impression = document.getElementById('impression');
            if (impression) {
                const lines = impression.value.split('\n').filter(l => l.trim());
                const nextNum = lines.length + 1;
                impression.value = impression.value.trim() + (impression.value.trim() ? '\n' : '') + `${nextNum}. `;
                impression.focus();
                impression.setSelectionRange(impression.value.length, impression.value.length);
            }
        });

        // Normal study shortcut
        document.getElementById('normal-study-btn')?.addEventListener('click', () => {
            const impression = document.getElementById('impression');
            if (impression) {
                impression.value = `1. Normal ${this.templateData?.name || 'study'} examination.\n2. No significant abnormality detected.`;
            }
        });
    }

    minimizeReport() {
        const panel = document.getElementById('report-panel');
        const expandBtn = document.getElementById('expand-report-btn');
        const container = document.querySelector('.report-split-container');

        if (panel) panel.style.display = 'none';
        if (container) container.style.width = '0';
        if (expandBtn) expandBtn.style.display = 'flex';

        // Remove body class to restore viewport
        document.body.classList.remove('advanced-report-open');
    }

    expandReport() {
        const panel = document.getElementById('report-panel');
        const expandBtn = document.getElementById('expand-report-btn');
        const container = document.querySelector('.report-split-container');

        // Restore container width based on screen size
        if (container) {
            if (window.innerWidth <= 768) {
                container.style.width = '100%';
            } else if (window.innerWidth <= 1024) {
                container.style.width = '380px';
            } else {
                container.style.width = '450px';
            }
        }

        if (panel) panel.style.display = 'flex';
        if (expandBtn) expandBtn.style.display = 'none';

        // Add body class to adjust viewport
        document.body.classList.add('advanced-report-open');
    }

    closeReportInterface() {
        const container = document.getElementById('advanced-report-container');
        if (container) {
            container.remove();
        }
        this.reportingMode = false;

        // Remove body class to show sidebar toggle button again
        document.body.classList.remove('advanced-report-open');

        console.log('Report interface closed');
    }

    collectFormData() {
        const form = document.getElementById('report-form');
        if (!form) return {};

        const data = {};

        // Collect all inputs, textareas, selects
        form.querySelectorAll('input, textarea, select').forEach(field => {
            if (field.id) {
                // Handle custom selects
                if (field.tagName === 'SELECT' && field.value === 'custom') {
                    const customField = document.getElementById(`${field.id}_custom`);
                    data[field.id] = customField?.value || '';
                } else {
                    data[field.id] = field.value;
                }
            }
        });

        return data;
    }

    async saveReport() {
        const saveBtn = document.getElementById('save-report-btn');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Saving...';
        }

        try {
            const formData = this.collectFormData();
            const status = document.getElementById('report-status')?.value || 'draft';
            const physician = document.getElementById('reporting-physician')?.value || '';

            const reportPayload = {
                study_uid: this.patientInfo.studyUID,
                patient_id: this.patientInfo.id,
                patient_name: this.patientInfo.name,
                template_name: this.currentTemplate,
                title: this.templateData?.name || 'Medical Report',
                indication: formData.clinical_info || '',
                technique: formData.technique || '',
                findings: this.buildFindingsText(formData),
                impression: formData.impression || '',
                status: status,
                reporting_physician_name: physician,
                modality: this.currentModality,
                full_report_data: JSON.stringify(formData)
            };

            const basePath = document.querySelector('meta[name="base-path"]')?.content || '';
            const response = await fetch(`${basePath}/api/reports/create.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(reportPayload)
            });

            const result = await response.json();

            if (result.success) {
                this.showToast('Report saved successfully!', 'success');
            } else {
                throw new Error(result.message || 'Failed to save report');
            }

        } catch (error) {
            console.error('Save error:', error);
            this.showToast(`Save failed: ${error.message}`, 'error');
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="bi bi-check-lg me-1"></i>Save';
            }
        }
    }

    buildFindingsText(formData) {
        const sections = this.templateData?.sections || [];
        let findings = '';

        sections.forEach(section => {
            if (section.type === 'structured' && section.subsections) {
                section.subsections.forEach(sub => {
                    const value = formData[sub.id];
                    if (value && value.trim()) {
                        findings += `${sub.label}: ${value}\n\n`;
                    }
                });
            }
        });

        return findings.trim() || formData.findings || '';
    }

    async printReport() {
        const formData = this.collectFormData();
        const hospital = this.hospitalSettings || {};

        const printHTML = this.generatePrintHTML(formData, hospital);

        const printWindow = window.open('', '_blank', 'width=800,height=1000');
        if (!printWindow) {
            this.showToast('Please allow popups to print', 'warning');
            return;
        }

        printWindow.document.write(printHTML);
        printWindow.document.close();

        // Auto print
        setTimeout(() => printWindow.print(), 500);
    }

    generatePrintHTML(formData, hospital) {
        const patient = this.patientInfo;
        const template = this.templateData;
        const physician = document.getElementById('reporting-physician')?.value || '';
        const status = document.getElementById('report-status')?.value || 'draft';

        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Radiology Report - ${patient.name}</title>
    <style>
        @page {
            size: A4 portrait;
            margin: 15mm;
        }

        @media print {
            body { margin: 0; }
            .no-print { display: none !important; }
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: 'Segoe UI', Arial, sans-serif;
            font-size: 11pt;
            line-height: 1.5;
            color: #333;
        }

        .report-container {
            max-width: 210mm;
            margin: 0 auto;
            padding: 20px;
        }

        .header {
            text-align: center;
            border-bottom: 3px solid #0d6efd;
            padding-bottom: 15px;
            margin-bottom: 20px;
        }

        .hospital-name {
            font-size: 22pt;
            font-weight: bold;
            color: #0d6efd;
            margin-bottom: 5px;
        }

        .hospital-subtitle {
            font-size: 12pt;
            color: #666;
        }

        .report-title {
            font-size: 16pt;
            font-weight: bold;
            margin-top: 10px;
            color: #333;
        }

        .patient-info {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 20px;
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
        }

        .patient-info-item {
            font-size: 10pt;
        }

        .patient-info-item strong {
            color: #0d6efd;
        }

        .section {
            margin-bottom: 15px;
        }

        .section-title {
            font-weight: bold;
            color: #0d6efd;
            border-bottom: 1px solid #dee2e6;
            padding-bottom: 3px;
            margin-bottom: 8px;
            font-size: 11pt;
        }

        .section-content {
            padding-left: 10px;
        }

        .findings-subsection {
            margin-bottom: 8px;
        }

        .findings-subsection strong {
            color: #555;
        }

        .impression {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 10px 15px;
            margin-top: 20px;
        }

        .impression .section-title {
            color: #856404;
            border-bottom-color: #ffc107;
        }

        .footer {
            margin-top: 30px;
            padding-top: 15px;
            border-top: 2px solid #dee2e6;
            display: flex;
            justify-content: space-between;
        }

        .signature-block {
            text-align: center;
            min-width: 200px;
        }

        .signature-line {
            border-top: 1px solid #333;
            margin: 40px auto 5px;
            width: 180px;
        }

        .status-badge {
            display: inline-block;
            padding: 3px 10px;
            border-radius: 3px;
            font-size: 9pt;
            font-weight: bold;
            text-transform: uppercase;
        }

        .status-draft { background: #ffc107; color: #333; }
        .status-final { background: #28a745; color: #fff; }
        .status-amended { background: #17a2b8; color: #fff; }

        .disclaimer {
            margin-top: 20px;
            font-size: 8pt;
            color: #666;
            text-align: center;
            border-top: 1px solid #dee2e6;
            padding-top: 10px;
        }

        .print-toolbar {
            position: fixed;
            top: 10px;
            right: 10px;
            background: #1a1a2e;
            padding: 15px;
            border-radius: 8px;
            z-index: 1000;
        }

        .print-toolbar button {
            padding: 10px 20px;
            margin: 0 5px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-weight: bold;
        }

        .btn-print { background: #0d6efd; color: white; }
        .btn-close { background: #6c757d; color: white; }
    </style>
</head>
<body>
    <div class="print-toolbar no-print">
        <button class="btn-print" onclick="window.print()">Print Report</button>
        <button class="btn-close" onclick="window.close()">Close</button>
    </div>

    <div class="report-container">
        <div class="header">
            <div class="hospital-name">${hospital.hospital_name || 'Medical Imaging Center'}</div>
            <div class="hospital-subtitle">Department of Radiology</div>
            <div class="report-title">${template?.name || 'RADIOLOGY REPORT'}</div>
            <span class="status-badge status-${status}">${status}</span>
        </div>

        <div class="patient-info">
            <div class="patient-info-item"><strong>Patient Name:</strong> ${patient.name}</div>
            <div class="patient-info-item"><strong>Patient ID:</strong> ${patient.id}</div>
            <div class="patient-info-item"><strong>Study Date:</strong> ${patient.studyDate}</div>
            <div class="patient-info-item"><strong>Age/Sex:</strong> ${patient.age || 'N/A'} / ${patient.sex || 'N/A'}</div>
            <div class="patient-info-item"><strong>Modality:</strong> ${patient.modality}</div>
            <div class="patient-info-item"><strong>Accession:</strong> ${patient.accessionNumber || 'N/A'}</div>
            <div class="patient-info-item" style="grid-column: span 2;"><strong>Study:</strong> ${patient.studyDescription || 'N/A'}</div>
        </div>

        <div class="section">
            <div class="section-title">CLINICAL INFORMATION</div>
            <div class="section-content">${formData.clinical_info || 'Not provided'}</div>
        </div>

        <div class="section">
            <div class="section-title">TECHNIQUE</div>
            <div class="section-content">${formData.technique || 'Standard protocol'}</div>
        </div>

        ${formData.comparison ? `
        <div class="section">
            <div class="section-title">COMPARISON</div>
            <div class="section-content">${formData.comparison}</div>
        </div>
        ` : ''}

        <div class="section">
            <div class="section-title">FINDINGS</div>
            <div class="section-content">
                ${this.formatFindingsForPrint(formData)}
            </div>
        </div>

        <div class="impression">
            <div class="section-title">IMPRESSION</div>
            <div class="section-content">${(formData.impression || 'No impression provided').replace(/\n/g, '<br>')}</div>
        </div>

        <div class="footer">
            <div class="signature-block">
                <div class="signature-line"></div>
                <strong>${physician || 'Reporting Physician'}</strong>
                <div style="font-size: 9pt; color: #666;">Radiologist</div>
            </div>
            <div class="signature-block">
                <div class="signature-line"></div>
                <strong>Verified By</strong>
                <div style="font-size: 9pt; color: #666;">${new Date().toLocaleDateString()}</div>
            </div>
        </div>

        <div class="disclaimer">
            Report ID: ${Date.now()} | Generated: ${new Date().toLocaleString()}<br>
            This is a computer-generated report. For medical use only. Confidential patient information.
        </div>
    </div>
</body>
</html>
        `;
    }

    formatFindingsForPrint(formData) {
        const sections = this.templateData?.sections || [];
        let html = '';

        sections.forEach(section => {
            if (section.type === 'structured' && section.subsections) {
                section.subsections.forEach(sub => {
                    const value = formData[sub.id];
                    if (value && value.trim()) {
                        html += `<div class="findings-subsection"><strong>${sub.label}:</strong> ${value}</div>`;
                    }
                });
            }
        });

        return html || formData.findings || 'No findings documented.';
    }

    escapeHtml(text) {
        if (!text) return '';
        return text.replace(/[&<>"']/g, char => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[char]);
    }

    showToast(message, type = 'info') {
        const bgColors = {
            success: 'bg-success',
            error: 'bg-danger',
            warning: 'bg-warning',
            info: 'bg-info'
        };

        const toast = document.createElement('div');
        toast.className = `alert ${bgColors[type]} text-white position-fixed`;
        toast.style.cssText = 'top: 80px; right: 20px; z-index: 9999; min-width: 300px; animation: fadeIn 0.3s;';
        toast.innerHTML = `
            <div class="d-flex align-items-center">
                <i class="bi ${type === 'success' ? 'bi-check-circle' : type === 'error' ? 'bi-exclamation-circle' : 'bi-info-circle'} me-2 fs-5"></i>
                <span>${message}</span>
            </div>
        `;

        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    if (!window.DICOM_VIEWER.MANAGERS) {
        window.DICOM_VIEWER.MANAGERS = {};
    }
    window.DICOM_VIEWER.MANAGERS.advancedReporting = new window.DICOM_VIEWER.AdvancedReportingSystem();
    console.log('✓ Advanced Reporting System v2.0 loaded');
});
