-- =====================================================
-- Complete Multi-Hospital System Setup
-- Run this ONCE in your MySQL database
-- =====================================================

-- PART 1: Add clinic_location to existing studies (if not exists)
ALTER TABLE `cached_studies` 
ADD COLUMN IF NOT EXISTS `clinic_location` VARCHAR(100) DEFAULT NULL AFTER `accession_number`,
ADD INDEX IF NOT EXISTS `clinic_location` (`clinic_location`);

-- PART 2: Add clinic settings (if not exists)
INSERT INTO `hospital_settings` (`setting_key`, `setting_value`, `setting_group`) VALUES
('clinic_location_name', 'Main Clinic', 'clinic'),
('multi_clinic_mode', 'false', 'clinic'),
('clinic_locations_list', '[]', 'clinic')
ON DUPLICATE KEY UPDATE setting_key=setting_key;

-- PART 3: Update existing studies with current clinic location
UPDATE `cached_studies` 
SET `clinic_location` = (
    SELECT `setting_value` 
    FROM `hospital_settings` 
    WHERE `setting_key` = 'clinic_location_name'
)
WHERE `clinic_location` IS NULL;

-- =====================================================
-- Verify the changes
-- =====================================================
-- Check if column exists
SHOW COLUMNS FROM `cached_studies` LIKE 'clinic_location';

-- Check if settings exist
SELECT * FROM `hospital_settings` WHERE `setting_group` = 'clinic';

-- Check existing studies
SELECT study_description, accession_number, clinic_location 
FROM `cached_studies` 
LIMIT 5;

-- =====================================================
-- SUCCESS! 
-- Now refresh your browser and try saving clinic settings again
-- =====================================================
