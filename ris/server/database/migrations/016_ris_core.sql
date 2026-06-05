-- =====================================================
-- One Clickz RIS — Migration 016: RIS core schema spine
-- Phase 0: patients master, atomic counters, receptionist role, RIS settings.
-- Idempotent: safe to re-run (CREATE IF NOT EXISTS, MODIFY enum, ON DUPLICATE KEY).
-- =====================================================

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";

-- -----------------------------------------------------
-- RIS patient master (clinic-owned, distinct from Orthanc-derived cached_patients).
-- Links to DICOM/Orthanc via dicom_patient_id.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `ris_patients` (
  `id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `mrn` VARCHAR(32) NOT NULL COMMENT 'Clinic medical record number (auto)',
  `dicom_patient_id` VARCHAR(64) DEFAULT NULL COMMENT 'PatientID used in DICOM/Orthanc',
  `full_name` VARCHAR(255) NOT NULL,
  `dob` DATE DEFAULT NULL,
  `age_years` INT(11) DEFAULT NULL COMMENT 'Captured age when DOB unknown',
  `sex` VARCHAR(10) DEFAULT NULL,
  `phone` VARCHAR(20) DEFAULT NULL,
  `email` VARCHAR(100) DEFAULT NULL,
  `address` TEXT DEFAULT NULL,
  `husband_or_father_name` VARCHAR(255) DEFAULT NULL,
  `id_proof_type` VARCHAR(40) DEFAULT NULL,
  `id_proof_number` VARCHAR(80) DEFAULT NULL,
  `created_by` INT(11) UNSIGNED DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ris_patients_mrn` (`mrn`),
  KEY `idx_ris_patients_dicom` (`dicom_patient_id`),
  KEY `idx_ris_patients_phone` (`phone`),
  KEY `idx_ris_patients_name` (`full_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Atomic counters for accession / receipt / invoice / mrn numbering.
-- Read+increment inside a transaction with SELECT ... FOR UPDATE (multi-client safe).
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `app_counters` (
  `name` VARCHAR(64) NOT NULL,
  `current_value` BIGINT(20) NOT NULL DEFAULT 0,
  `prefix` VARCHAR(16) NOT NULL DEFAULT '',
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `app_counters` (`name`, `current_value`, `prefix`) VALUES
  ('mrn',       0, 'P'),
  ('accession', 0, 'OCZ'),
  ('receipt',   0, 'RCP'),
  ('visit',     0, 'V')
ON DUPLICATE KEY UPDATE `name` = `name`;

-- -----------------------------------------------------
-- Add the receptionist role (idempotent: MODIFY restates the full enum).
-- -----------------------------------------------------
ALTER TABLE `users`
  MODIFY `role` ENUM('admin','doctor','viewer','receptionist') NOT NULL DEFAULT 'viewer';

-- -----------------------------------------------------
-- RIS configuration keys (reuse hospital_settings key/value/group store).
-- -----------------------------------------------------
INSERT INTO `hospital_settings` (`setting_key`, `setting_value`, `setting_group`) VALUES
  ('clinic_state',           'Maharashtra', 'ris'),
  ('accession_prefix',       'OCZ',         'ris'),
  ('default_station_ae',     'ULTRASOUND',  'ris'),
  ('worklist_dir',           '',            'ris'),
  ('dicom_uid_root',         '1.2.826.0.1.3680043.10.1338', 'ris')
ON DUPLICATE KEY UPDATE `setting_key` = `setting_key`;
