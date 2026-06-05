-- =====================================================
-- One Clickz RIS — Migration 017: referring doctors, services, visits, orders
-- Phase 1: reception registration spine. Idempotent.
-- =====================================================

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";

-- -----------------------------------------------------
-- Referring doctors (with commission config).
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `ris_referring_doctors` (
  `id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `qualification` VARCHAR(120) DEFAULT NULL,
  `registration_no` VARCHAR(80) DEFAULT NULL,
  `phone` VARCHAR(20) DEFAULT NULL,
  `email` VARCHAR(100) DEFAULT NULL,
  `clinic_name` VARCHAR(255) DEFAULT NULL,
  `address` TEXT DEFAULT NULL,
  `commission_type` ENUM('none','percent','flat') NOT NULL DEFAULT 'none',
  `commission_value` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `commission_overrides` JSON DEFAULT NULL COMMENT 'Per-service rate overrides',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ris_refdoc_name` (`name`),
  KEY `idx_ris_refdoc_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Services / exam catalog.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `ris_services` (
  `id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(40) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `modality` ENUM('US','CR','DX','CT','MR','OTHER') NOT NULL DEFAULT 'US',
  `body_part` VARCHAR(120) DEFAULT NULL,
  `price` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `default_duration_min` INT(11) NOT NULL DEFAULT 15,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ris_services_code` (`code`),
  KEY `idx_ris_services_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `ris_services` (`code`,`name`,`modality`,`body_part`,`price`,`default_duration_min`) VALUES
  ('USG-OBS',  'USG Obstetric / Anomaly',  'US', 'Obstetric', 1500.00, 20),
  ('USG-ABD',  'USG Abdomen & Pelvis',     'US', 'Abdomen',   1000.00, 15),
  ('USG-KUB',  'USG KUB',                  'US', 'KUB',        800.00, 15),
  ('XR-CHEST', 'X-Ray Chest PA',           'CR', 'Chest',      300.00, 10)
ON DUPLICATE KEY UPDATE `code` = `code`;

-- -----------------------------------------------------
-- Visits (one per patient walk-in; holds billing totals).
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `ris_visits` (
  `id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `patient_id` INT(11) UNSIGNED NOT NULL,
  `visit_no` VARCHAR(32) NOT NULL,
  `visit_datetime` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `referring_doctor_id` INT(11) UNSIGNED DEFAULT NULL,
  `total_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `discount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `tax` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `net_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `paid_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `balance` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `status` ENUM('open','partly_paid','paid','cancelled') NOT NULL DEFAULT 'open',
  `created_by` INT(11) UNSIGNED DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ris_visits_no` (`visit_no`),
  KEY `idx_ris_visits_patient` (`patient_id`),
  KEY `idx_ris_visits_refdoc` (`referring_doctor_id`),
  KEY `idx_ris_visits_status` (`status`),
  CONSTRAINT `fk_ris_visits_patient` FOREIGN KEY (`patient_id`) REFERENCES `ris_patients` (`id`),
  CONSTRAINT `fk_ris_visits_refdoc` FOREIGN KEY (`referring_doctor_id`) REFERENCES `ris_referring_doctors` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Orders (one per procedure; the MWL/accession linchpin).
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `ris_orders` (
  `id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `visit_id` INT(11) UNSIGNED NOT NULL,
  `patient_id` INT(11) UNSIGNED NOT NULL,
  `service_id` INT(11) UNSIGNED DEFAULT NULL,
  `modality` VARCHAR(16) DEFAULT NULL,
  `accession_number` VARCHAR(32) NOT NULL,
  `study_instance_uid` VARCHAR(128) DEFAULT NULL,
  `scheduled_station_ae` VARCHAR(32) DEFAULT NULL,
  `scheduled_datetime` DATETIME DEFAULT NULL,
  `price` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `status` ENUM('scheduled','arrived','sent_to_viewer','in_progress','acquired','reported','delivered','cancelled') NOT NULL DEFAULT 'scheduled',
  `clinical_notes` TEXT DEFAULT NULL,
  `linked_study_uid` VARCHAR(128) DEFAULT NULL,
  `created_by` INT(11) UNSIGNED DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ris_orders_accession` (`accession_number`),
  KEY `idx_ris_orders_visit` (`visit_id`),
  KEY `idx_ris_orders_patient` (`patient_id`),
  KEY `idx_ris_orders_status` (`status`),
  KEY `idx_ris_orders_studyuid` (`study_instance_uid`),
  KEY `idx_ris_orders_linked` (`linked_study_uid`),
  CONSTRAINT `fk_ris_orders_visit` FOREIGN KEY (`visit_id`) REFERENCES `ris_visits` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ris_orders_patient` FOREIGN KEY (`patient_id`) REFERENCES `ris_patients` (`id`),
  CONSTRAINT `fk_ris_orders_service` FOREIGN KEY (`service_id`) REFERENCES `ris_services` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
