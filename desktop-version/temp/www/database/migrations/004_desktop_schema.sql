-- =====================================================
-- Hospital DICOM Viewer Pro - Desktop Edition
-- Complete Database Schema
-- =====================================================

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";

-- =====================================================
-- Users Table
-- =====================================================
CREATE TABLE IF NOT EXISTS `users` (
  `id` int(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `full_name` varchar(100) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `role` enum('admin','doctor','viewer') NOT NULL DEFAULT 'viewer',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `last_login` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Default admin user (password: admin123)
INSERT INTO `users` (`username`, `password_hash`, `full_name`, `email`, `role`, `is_active`) VALUES
('admin', '$2y$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4cKiVZGKXLRvNMV6', 'System Administrator', 'admin@hospital.local', 'admin', 1)
ON DUPLICATE KEY UPDATE username=username;

-- =====================================================
-- Sessions Table
-- =====================================================
CREATE TABLE IF NOT EXISTS `sessions` (
  `id` int(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `session_id` varchar(128) NOT NULL,
  `user_id` int(11) UNSIGNED NOT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `last_activity` datetime DEFAULT CURRENT_TIMESTAMP,
  `expires_at` datetime NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `session_id` (`session_id`),
  KEY `user_id` (`user_id`),
  KEY `expires_at` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Audit Logs Table
-- =====================================================
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` int(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` int(11) UNSIGNED DEFAULT NULL,
  `username` varchar(50) DEFAULT NULL,
  `action` varchar(50) NOT NULL,
  `resource_type` varchar(50) DEFAULT NULL,
  `resource_id` varchar(100) DEFAULT NULL,
  `details` text DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `action` (`action`),
  KEY `created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Cached Patients Table
-- =====================================================
CREATE TABLE IF NOT EXISTS `cached_patients` (
  `id` int(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `orthanc_id` varchar(64) DEFAULT NULL,
  `patient_id` varchar(64) NOT NULL,
  `patient_name` varchar(255) DEFAULT NULL,
  `patient_birth_date` date DEFAULT NULL,
  `patient_sex` varchar(10) DEFAULT NULL,
  `study_count` int(11) DEFAULT 0,
  `last_study_date` date DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `patient_id` (`patient_id`),
  KEY `orthanc_id` (`orthanc_id`),
  KEY `patient_name` (`patient_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Cached Studies Table
-- =====================================================
CREATE TABLE IF NOT EXISTS `cached_studies` (
  `id` int(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `study_instance_uid` varchar(128) NOT NULL,
  `orthanc_id` varchar(64) DEFAULT NULL,
  `patient_id` varchar(64) DEFAULT NULL,
  `study_date` date DEFAULT NULL,
  `study_time` time DEFAULT NULL,
  `study_description` varchar(255) DEFAULT NULL,
  `accession_number` varchar(64) DEFAULT NULL,
  `modality` varchar(20) DEFAULT NULL,
  `series_count` int(11) DEFAULT 0,
  `instance_count` int(11) DEFAULT 0,
  `is_starred` tinyint(1) DEFAULT 0,
  `remarks` text DEFAULT NULL,
  `last_synced` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `study_instance_uid` (`study_instance_uid`),
  KEY `orthanc_id` (`orthanc_id`),
  KEY `patient_id` (`patient_id`),
  KEY `study_date` (`study_date`),
  KEY `modality` (`modality`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Medical Reports Table
-- =====================================================
CREATE TABLE IF NOT EXISTS `medical_reports` (
  `id` int(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `study_uid` varchar(128) NOT NULL,
  `patient_id` varchar(64) DEFAULT NULL,
  `patient_name` varchar(255) DEFAULT NULL,
  `patient_age` varchar(20) DEFAULT NULL,
  `patient_sex` varchar(10) DEFAULT NULL,
  `study_date` date DEFAULT NULL,
  `modality` varchar(20) DEFAULT NULL,
  `referring_physician` varchar(255) DEFAULT NULL,
  `clinical_history` text DEFAULT NULL,
  `technique` text DEFAULT NULL,
  `findings` text DEFAULT NULL,
  `impression` text DEFAULT NULL,
  `recommendations` text DEFAULT NULL,
  `measurements` json DEFAULT NULL,
  `status` enum('draft','final','printed','amended') DEFAULT 'draft',
  `created_by` int(11) UNSIGNED DEFAULT NULL,
  `finalized_by` int(11) UNSIGNED DEFAULT NULL,
  `finalized_at` datetime DEFAULT NULL,
  `printed_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `study_uid` (`study_uid`),
  KEY `patient_id` (`patient_id`),
  KEY `status` (`status`),
  KEY `created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Medical Notes Table
-- =====================================================
CREATE TABLE IF NOT EXISTS `medical_notes` (
  `id` int(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `study_uid` varchar(128) NOT NULL,
  `instance_uid` varchar(128) DEFAULT NULL,
  `note_type` enum('general','finding','annotation','measurement') DEFAULT 'general',
  `content` text NOT NULL,
  `position_data` json DEFAULT NULL,
  `created_by` int(11) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `study_uid` (`study_uid`),
  KEY `instance_uid` (`instance_uid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Prescriptions Table
-- =====================================================
CREATE TABLE IF NOT EXISTS `prescriptions` (
  `id` int(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `report_id` int(11) UNSIGNED DEFAULT NULL,
  `study_uid` varchar(128) NOT NULL,
  `patient_id` varchar(64) DEFAULT NULL,
  `medication_name` varchar(255) NOT NULL,
  `dosage` varchar(100) DEFAULT NULL,
  `frequency` varchar(100) DEFAULT NULL,
  `duration` varchar(100) DEFAULT NULL,
  `instructions` text DEFAULT NULL,
  `created_by` int(11) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `report_id` (`report_id`),
  KEY `study_uid` (`study_uid`),
  KEY `patient_id` (`patient_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Hospital Settings Table
-- =====================================================
CREATE TABLE IF NOT EXISTS `hospital_settings` (
  `id` int(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `setting_key` varchar(100) NOT NULL,
  `setting_value` text DEFAULT NULL,
  `setting_group` varchar(50) DEFAULT 'general',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `setting_key` (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Default hospital settings
INSERT INTO `hospital_settings` (`setting_key`, `setting_value`, `setting_group`) VALUES
('hospital_name', 'Hospital DICOM Viewer Pro', 'general'),
('hospital_address', '', 'general'),
('hospital_phone', '', 'general'),
('hospital_email', '', 'general'),
('hospital_logo', '', 'general'),
('orthanc_url', 'http://localhost:8042', 'orthanc'),
('orthanc_username', 'orthanc', 'orthanc'),
('orthanc_password', 'orthanc', 'orthanc'),
('auto_sync_enabled', 'true', 'sync'),
('sync_interval', '300', 'sync')
ON DUPLICATE KEY UPDATE setting_key=setting_key;

-- =====================================================
-- Print Settings Table
-- =====================================================
CREATE TABLE IF NOT EXISTS `print_settings` (
  `id` int(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` int(11) UNSIGNED DEFAULT NULL,
  `setting_name` varchar(100) NOT NULL,
  `paper_size` varchar(20) DEFAULT 'A4',
  `orientation` enum('portrait','landscape') DEFAULT 'portrait',
  `margins` json DEFAULT NULL,
  `header_enabled` tinyint(1) DEFAULT 1,
  `footer_enabled` tinyint(1) DEFAULT 1,
  `show_patient_info` tinyint(1) DEFAULT 1,
  `show_study_info` tinyint(1) DEFAULT 1,
  `show_window_level` tinyint(1) DEFAULT 1,
  `is_default` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Backup History Table
-- =====================================================
CREATE TABLE IF NOT EXISTS `backup_history` (
  `id` int(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `backup_type` enum('local','google_drive','ftp','dropbox') DEFAULT 'local',
  `backup_path` varchar(500) DEFAULT NULL,
  `file_size` bigint(20) DEFAULT NULL,
  `status` enum('pending','running','completed','failed') DEFAULT 'pending',
  `error_message` text DEFAULT NULL,
  `started_at` datetime DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `backup_type` (`backup_type`),
  KEY `status` (`status`),
  KEY `created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- AI Analysis Table
-- =====================================================
CREATE TABLE IF NOT EXISTS `ai_analysis` (
  `id` int(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `study_uid` varchar(255) NOT NULL,
  `series_uid` varchar(255) DEFAULT NULL,
  `instance_uid` varchar(255) DEFAULT NULL,
  `patient_id` varchar(64) DEFAULT NULL,
  `patient_name` varchar(255) DEFAULT NULL,
  `analysis_type` enum('USG','CT','MRI','XRAY','OTHER') DEFAULT 'USG',
  `body_region` varchar(100) DEFAULT NULL,
  `model_used` varchar(50) DEFAULT 'gemini-2.0-flash',
  `model_version` varchar(50) DEFAULT NULL,
  `findings` json DEFAULT NULL,
  `measurements` json DEFAULT NULL,
  `anomalies` json DEFAULT NULL,
  `generated_report` text DEFAULT NULL,
  `overall_confidence` decimal(5,4) DEFAULT NULL,
  `quality_score` decimal(5,4) DEFAULT NULL,
  `processing_time_ms` int(11) UNSIGNED DEFAULT NULL,
  `tokens_used` int(11) UNSIGNED DEFAULT NULL,
  `api_cost` decimal(10,6) DEFAULT NULL,
  `status` enum('pending','processing','completed','failed','reviewed') DEFAULT 'pending',
  `error_message` text DEFAULT NULL,
  `created_by` int(11) UNSIGNED DEFAULT NULL,
  `reviewed_by` int(11) UNSIGNED DEFAULT NULL,
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `study_uid` (`study_uid`),
  KEY `patient_id` (`patient_id`),
  KEY `status` (`status`),
  KEY `created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Measurements Table
-- =====================================================
CREATE TABLE IF NOT EXISTS `measurements` (
  `id` int(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `study_uid` varchar(128) NOT NULL,
  `series_uid` varchar(128) DEFAULT NULL,
  `instance_uid` varchar(128) DEFAULT NULL,
  `measurement_type` varchar(50) NOT NULL,
  `measurement_data` json NOT NULL,
  `value` decimal(10,4) DEFAULT NULL,
  `unit` varchar(20) DEFAULT NULL,
  `created_by` int(11) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `study_uid` (`study_uid`),
  KEY `instance_uid` (`instance_uid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Backup Accounts Table
-- =====================================================
CREATE TABLE IF NOT EXISTS `backup_accounts` (
  `id` int(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `provider` enum('google_drive','dropbox','ftp','local') NOT NULL,
  `account_name` varchar(100) NOT NULL,
  `credentials` text DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `last_backup` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Printers Table
-- =====================================================
CREATE TABLE IF NOT EXISTS `printers` (
  `id` int(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `printer_name` varchar(100) NOT NULL,
  `printer_type` enum('system','dicom','pdf') DEFAULT 'system',
  `ip_address` varchar(45) DEFAULT NULL,
  `port` int(11) DEFAULT NULL,
  `is_default` tinyint(1) DEFAULT 0,
  `is_active` tinyint(1) DEFAULT 1,
  `settings` json DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Debug Logs Table (Desktop specific)
-- =====================================================
CREATE TABLE IF NOT EXISTS `debug_logs` (
  `id` int(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `level` enum('DEBUG','INFO','WARN','ERROR','FATAL') DEFAULT 'INFO',
  `category` varchar(50) DEFAULT 'general',
  `message` text NOT NULL,
  `context` json DEFAULT NULL,
  `file` varchar(255) DEFAULT NULL,
  `line` int(11) DEFAULT NULL,
  `user_id` int(11) UNSIGNED DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `level` (`level`),
  KEY `category` (`category`),
  KEY `created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- System Status Table (Desktop specific)
-- =====================================================
CREATE TABLE IF NOT EXISTS `system_status` (
  `id` int(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `component` varchar(50) NOT NULL,
  `status` enum('online','offline','error','unknown') DEFAULT 'unknown',
  `last_check` datetime DEFAULT NULL,
  `details` json DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `component` (`component`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert initial status records
INSERT INTO `system_status` (`component`, `status`) VALUES
('orthanc', 'unknown'),
('database', 'online'),
('filesystem', 'unknown'),
('internet', 'unknown')
ON DUPLICATE KEY UPDATE component=component;

-- =====================================================
-- End of Schema
-- =====================================================
