-- =====================================================
-- Hospital-Based Multi-Tenancy System
-- Complete Data Isolation for Multi-Hospital Management
-- =====================================================

-- STEP 1: Create hospitals table
CREATE TABLE IF NOT EXISTS `hospitals` (
  `id` int(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `hospital_code` varchar(50) NOT NULL UNIQUE COMMENT 'Unique identifier for the hospital',
  `hospital_name` varchar(255) NOT NULL,
  `location` varchar(255) DEFAULT NULL,
  `admin_email` varchar(255) DEFAULT NULL,
  `admin_phone` varchar(50) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `hospital_code` (`hospital_code`),
  KEY `is_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- STEP 2: Create user-hospital access mapping
CREATE TABLE IF NOT EXISTS `user_hospital_access` (
  `id` int(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` int(11) UNSIGNED NOT NULL,
  `hospital_id` int(11) UNSIGNED NOT NULL,
  `access_level` enum('owner','admin','read_only') DEFAULT 'read_only',
  `granted_by` int(11) UNSIGNED DEFAULT NULL COMMENT 'User ID who granted access',
  `granted_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_hospital` (`user_id`, `hospital_id`),
  KEY `user_id` (`user_id`),
  KEY `hospital_id` (`hospital_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`hospital_id`) REFERENCES `hospitals`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- STEP 3: Add hospital_id to existing data tables
ALTER TABLE `cached_patients` 
ADD COLUMN `hospital_id` int(11) UNSIGNED DEFAULT NULL AFTER `id`,
ADD INDEX `hospital_id` (`hospital_id`);

ALTER TABLE `cached_studies` 
ADD COLUMN `hospital_id` int(11) UNSIGNED DEFAULT NULL AFTER `id`,
ADD INDEX `hospital_id` (`hospital_id`);

ALTER TABLE `medical_reports` 
ADD COLUMN `hospital_id` int(11) UNSIGNED DEFAULT NULL AFTER `id`,
ADD INDEX `hospital_id` (`hospital_id`);

-- STEP 4: Add hospital settings
INSERT INTO `hospital_settings` (`setting_key`, `setting_value`, `setting_group`) VALUES
('current_hospital_id', '1', 'hospital'),
('hospital_isolation_enabled', 'true', 'hospital')
ON DUPLICATE KEY UPDATE setting_key=setting_key;

-- STEP 5: Create default hospital from current clinic
INSERT INTO `hospitals` (`id`, `hospital_code`, `hospital_name`, `location`, `is_active`)
SELECT 
    1,
    'HOSP_MAIN_001',
    COALESCE((SELECT setting_value FROM hospital_settings WHERE setting_key = 'clinic_location_name'), 'Main Hospital'),
    COALESCE((SELECT setting_value FROM hospital_settings WHERE setting_key = 'hospital_address'), 'Primary Location'),
    1
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM hospitals WHERE id = 1);

-- STEP 6: Assign admin user to default hospital
INSERT INTO `user_hospital_access` (`user_id`, `hospital_id`, `access_level`)
SELECT 
    u.id,
    1,
    'owner'
FROM `users` u
WHERE u.role = 'admin'
AND NOT EXISTS (
    SELECT 1 FROM user_hospital_access WHERE user_id = u.id AND hospital_id = 1
);

-- STEP 7: Update existing data with default hospital_id
UPDATE `cached_patients` 
SET `hospital_id` = 1 
WHERE `hospital_id` IS NULL;

UPDATE `cached_studies` 
SET `hospital_id` = 1 
WHERE `hospital_id` IS NULL;

UPDATE `medical_reports` 
SET `hospital_id` = 1 
WHERE `hospital_id` IS NULL;

-- =====================================================
-- Verification Queries
-- =====================================================

-- Check hospitals
SELECT * FROM hospitals;

-- Check user-hospital access
SELECT u.username, h.hospital_name, uha.access_level
FROM user_hospital_access uha
INNER JOIN users u ON uha.user_id = u.id
INNER JOIN hospitals h ON uha.hospital_id = h.id;

-- Check data distribution
SELECT 
    h.hospital_name,
    COUNT(DISTINCT p.id) as patients,
    COUNT(DISTINCT s.id) as studies
FROM hospitals h
LEFT JOIN cached_patients p ON h.id = p.hospital_id
LEFT JOIN cached_studies s ON h.id = s.hospital_id
GROUP BY h.id, h.hospital_name;

-- =====================================================
-- SUCCESS!
-- Hospital isolation system is now active
-- =====================================================
