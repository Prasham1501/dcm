-- =====================================================
-- Multi-Clinic System Migration
-- Adds clinic location tracking and multi-clinic support
-- =====================================================

-- Add clinic_location column to cached_studies
ALTER TABLE `cached_studies` 
ADD COLUMN `clinic_location` VARCHAR(100) DEFAULT NULL AFTER `accession_number`,
ADD INDEX `clinic_location` (`clinic_location`);

-- Add clinic settings
INSERT INTO `hospital_settings` (`setting_key`, `setting_value`, `setting_group`) VALUES
('clinic_location_name', 'Main Clinic', 'clinic'),
('multi_clinic_mode', 'false', 'clinic'),
('clinic_locations_list', '[]', 'clinic')
ON DUPLICATE KEY UPDATE setting_key=setting_key;

-- Update existing studies to have the current clinic location
UPDATE `cached_studies` 
SET `clinic_location` = (
    SELECT `setting_value` 
    FROM `hospital_settings` 
    WHERE `setting_key` = 'clinic_location_name'
)
WHERE `clinic_location` IS NULL;
