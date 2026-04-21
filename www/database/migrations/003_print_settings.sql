-- Migration: Create system_settings table for print settings
-- Version: 003
-- Date: 2025-12-05

-- Create system_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS `system_settings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `setting_key` varchar(100) NOT NULL,
  `setting_value` text,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `setting_key` (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insert default print settings
INSERT INTO `system_settings` (`setting_key`, `setting_value`) VALUES
('print_includePatientInfo', 'true'),
('print_includeStudyInfo', 'true'),
('print_includeInstitutionInfo', 'true'),
('print_includeAnnotations', 'true'),
('print_includeWindowLevel', 'true'),
('print_includeMeasurements', 'true'),
('print_includeTimestamp', 'true'),
('print_paperSize', 'A4'),
('print_orientation', 'landscape'),
('print_quality', 'high'),
('print_colorMode', 'grayscale'),
('print_margins', 'normal')
ON DUPLICATE KEY UPDATE setting_value = setting_value;
