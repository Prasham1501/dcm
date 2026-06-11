-- =====================================================
-- One Clickz RIS - Migration 027: masters (centers/PROs/lookups), center billing,
-- EMI dues, doctor types, age detail, and the offline outbox queue.
-- Idempotent. New ALTER columns are plain nullable (no FK) to stay re-runnable.
-- =====================================================

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";

-- -----------------------------------------------------
-- Centers (referring labs/collection centers) with credit/debit billing.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `ris_centers` (
  `id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(40) NOT NULL,
  `name` VARCHAR(200) NOT NULL,
  `billing_type` ENUM('credit','debit') NOT NULL DEFAULT 'debit',
  `contact_person` VARCHAR(160) DEFAULT NULL,
  `phone` VARCHAR(20) DEFAULT NULL,
  `email` VARCHAR(120) DEFAULT NULL,
  `address` TEXT DEFAULT NULL,
  `discount_percent` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ris_centers_code` (`code`),
  KEY `idx_ris_centers_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Public Relations Officers (PRO) with commission config.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `ris_pros` (
  `id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(160) NOT NULL,
  `phone` VARCHAR(20) DEFAULT NULL,
  `commission_type` ENUM('none','percent','flat') NOT NULL DEFAULT 'none',
  `commission_value` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ris_pros_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Generic lookup lists (staff, areas, patient groups, dispatch modes, email domains).
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `ris_lookups` (
  `id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `category` VARCHAR(40) NOT NULL,
  `value` VARCHAR(160) NOT NULL,
  `sort_order` INT(11) NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ris_lookups_cat_value` (`category`, `value`),
  KEY `idx_ris_lookups_cat` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `ris_lookups` (`category`, `value`, `sort_order`) VALUES
  ('phlebotomy_staff', 'Deepali', 1),
  ('phlebotomy_staff', 'Roopa', 2),
  ('phlebotomy_staff', 'Rasika', 3),
  ('patient_group', 'Regular', 1),
  ('patient_group', 'Center', 2),
  ('patient_group', 'Home visit', 3),
  ('patient_group', 'Corporate', 4),
  ('dispatch_mode', 'Center delivery', 1),
  ('dispatch_mode', 'Home delivery', 2),
  ('dispatch_mode', 'Email', 3),
  ('dispatch_mode', 'Printed', 4),
  ('dispatch_mode', 'Courier', 5),
  ('dispatch_mode', 'Patient pickup', 6),
  ('email_domain', 'gmail.com', 1),
  ('email_domain', 'yahoo.com', 2),
  ('email_domain', 'outlook.com', 3),
  ('email_domain', 'rediffmail.com', 4)
ON DUPLICATE KEY UPDATE `value` = `value`;

-- -----------------------------------------------------
-- Monthly invoices for credit centers.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `ris_center_invoices` (
  `id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `center_id` INT(11) UNSIGNED NOT NULL,
  `period` CHAR(7) NOT NULL,
  `total` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `discount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `net` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `paid_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `visit_count` INT(11) NOT NULL DEFAULT 0,
  `status` ENUM('draft','final','paid') NOT NULL DEFAULT 'draft',
  `generated_by` INT(11) UNSIGNED DEFAULT NULL,
  `generated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ris_center_invoice_period` (`center_id`, `period`),
  KEY `idx_ris_center_invoice_center` (`center_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Offline send queue (email / whatsapp / sms). Flushed when connectivity exists.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `ris_outbox` (
  `id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `channel` ENUM('email','whatsapp','sms') NOT NULL DEFAULT 'email',
  `visit_id` INT(11) UNSIGNED DEFAULT NULL,
  `order_id` INT(11) UNSIGNED DEFAULT NULL,
  `recipient` VARCHAR(180) DEFAULT NULL,
  `subject` VARCHAR(255) DEFAULT NULL,
  `body` TEXT DEFAULT NULL,
  `attachment_path` VARCHAR(500) DEFAULT NULL,
  `status` ENUM('queued','sent','failed') NOT NULL DEFAULT 'queued',
  `error` TEXT DEFAULT NULL,
  `created_by` INT(11) UNSIGNED DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `sent_at` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_ris_outbox_status` (`status`),
  KEY `idx_ris_outbox_visit` (`visit_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Doctor types (GP / consultant / both).
-- -----------------------------------------------------
ALTER TABLE `ris_referring_doctors`
  ADD COLUMN IF NOT EXISTS `doctor_type` ENUM('gp','consultant','both') NOT NULL DEFAULT 'gp' AFTER `qualification`;

-- -----------------------------------------------------
-- Age detail for paediatric patients.
-- -----------------------------------------------------
ALTER TABLE `ris_patients`
  ADD COLUMN IF NOT EXISTS `age_months` INT(11) DEFAULT NULL AFTER `age_years`,
  ADD COLUMN IF NOT EXISTS `age_days` INT(11) DEFAULT NULL AFTER `age_months`;

-- -----------------------------------------------------
-- Link visits to center/PRO masters (center_name/pro_name kept as display text).
-- -----------------------------------------------------
ALTER TABLE `ris_visits`
  ADD COLUMN IF NOT EXISTS `center_id` INT(11) UNSIGNED DEFAULT NULL AFTER `center_name`,
  ADD COLUMN IF NOT EXISTS `pro_id` INT(11) UNSIGNED DEFAULT NULL AFTER `pro_name`;

-- -----------------------------------------------------
-- EMI payment mode + due date.
-- -----------------------------------------------------
ALTER TABLE `ris_payments`
  MODIFY `mode` ENUM('cash','upi','card','emi','other') NOT NULL DEFAULT 'cash';

ALTER TABLE `ris_payments`
  ADD COLUMN IF NOT EXISTS `due_date` DATE DEFAULT NULL AFTER `reference`;

-- -----------------------------------------------------
-- Settings: label dimensions (printing) + messaging (SMTP) placeholders.
-- -----------------------------------------------------
INSERT INTO `hospital_settings` (`setting_key`, `setting_value`, `setting_group`) VALUES
  ('barcode_label_width_mm', '50', 'printing'),
  ('barcode_label_height_mm', '25', 'printing'),
  ('smtp_host', '', 'messaging'),
  ('smtp_port', '587', 'messaging'),
  ('smtp_user', '', 'messaging'),
  ('smtp_pass', '', 'messaging'),
  ('smtp_from', '', 'messaging'),
  ('smtp_secure', 'tls', 'messaging')
ON DUPLICATE KEY UPDATE `setting_key` = `setting_key`;
