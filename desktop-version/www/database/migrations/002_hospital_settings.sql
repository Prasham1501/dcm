-- Hospital Settings Migration
-- Add hospital configuration settings to system_settings table

-- Check if settings already exist, insert only if not
INSERT IGNORE INTO system_settings (setting_key, setting_value, setting_type, category, description, is_sensitive)
VALUES 
    ('hospital_name', 'Medical Imaging Center', 'string', 'hospital', 'Hospital/Clinic Name', 0),
    ('hospital_address', '', 'string', 'hospital', 'Hospital Address', 0),
    ('hospital_phone', '', 'string', 'hospital', 'Hospital Phone Number', 0),
    ('hospital_email', '', 'string', 'hospital', 'Hospital Email', 0),
    ('hospital_website', '', 'string', 'hospital', 'Hospital Website', 0),
    ('hospital_logo', '', 'string', 'hospital', 'Hospital Logo URL', 0),
    ('hospital_registration', '', 'string', 'hospital', 'Hospital Registration Number', 0),
    ('doctor_name', '', 'string', 'hospital', 'Default Reporting Doctor Name', 0),
    ('doctor_qualification', 'MBBS, MD (Radiology)', 'string', 'hospital', 'Doctor Qualification', 0),
    ('doctor_registration', '', 'string', 'hospital', 'Doctor Registration Number', 0),
    ('report_footer', 'This report is generated using AI-assisted analysis and should be verified by the reporting physician.', 'string', 'hospital', 'Default Report Footer Text', 0),
    ('report_header_text', '', 'string', 'hospital', 'Additional Report Header Text', 0);

-- Create report_templates table if not exists
CREATE TABLE IF NOT EXISTS report_templates (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    template_key VARCHAR(50) NOT NULL UNIQUE,
    template_name VARCHAR(100) NOT NULL,
    template_category ENUM('CT', 'MRI', 'X-Ray', 'Ultrasound', 'Mammography', 'Nuclear', 'Other') NOT NULL,
    template_content JSON NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_by INT UNSIGNED NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Insert Obstetric USG template
INSERT IGNORE INTO report_templates (template_key, template_name, template_category, template_content)
VALUES (
    'obstetric_usg',
    'Obstetric Ultrasound',
    'Ultrasound',
    '{
        "sections": {
            "patient_info": ["patient_name", "patient_age", "patient_id", "exam_date", "lmp", "referring_physician", "clinical_history"],
            "biometry": ["bpd", "hc", "ac", "fl", "crl", "efw", "average_ga", "edd"],
            "fetal_parameters": ["fetal_number", "presentation", "position", "fetal_heart", "fhr", "fetal_movements"],
            "placenta": ["location", "grade", "previa"],
            "amniotic_fluid": ["status", "afi"],
            "anatomy": ["head_shape", "ventricles", "cerebellum", "cisterna_magna", "spine", "heart_chambers", "stomach", "kidneys", "bladder", "cord_insertion", "cord_vessels", "limbs"],
            "impression": ["impression", "recommendations"]
        },
        "defaults": {
            "fetal_number": "Single",
            "presentation": "Cephalic",
            "position": "Longitudinal",
            "fetal_heart": "Present, regular",
            "fetal_movements": "Present",
            "placenta_location": "Anterior",
            "placenta_grade": "Grade I",
            "placenta_previa": "Excluded",
            "amniotic_fluid": "Adequate",
            "anatomy_normal": true
        }
    }'
);

-- Insert X-Ray Chest template
INSERT IGNORE INTO report_templates (template_key, template_name, template_category, template_content)
VALUES (
    'xray_chest',
    'X-Ray Chest',
    'X-Ray',
    '{
        "sections": {
            "patient_info": ["patient_name", "patient_age", "patient_id", "exam_date", "clinical_history"],
            "technique": ["projection", "position", "quality"],
            "findings": ["lungs", "heart", "mediastinum", "bones", "soft_tissues", "devices"],
            "impression": ["impression", "recommendations"]
        },
        "defaults": {
            "projection": "PA view",
            "position": "Erect",
            "quality": "Adequate penetration and inspiration"
        }
    }'
);

-- Insert Ultrasound Abdomen template  
INSERT IGNORE INTO report_templates (template_key, template_name, template_category, template_content)
VALUES (
    'usg_abdomen',
    'Ultrasound Abdomen',
    'Ultrasound',
    '{
        "sections": {
            "patient_info": ["patient_name", "patient_age", "patient_id", "exam_date", "clinical_history"],
            "technique": ["approach"],
            "findings": ["liver", "gallbladder", "cbd", "pancreas", "spleen", "kidneys", "urinary_bladder", "aorta", "ivc", "bowel", "free_fluid", "lymph_nodes"],
            "impression": ["impression", "recommendations"]
        },
        "defaults": {
            "approach": "Transabdominal real-time ultrasound"
        }
    }'
);
