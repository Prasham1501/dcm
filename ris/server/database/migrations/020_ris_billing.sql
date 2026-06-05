-- =====================================================
-- One Clickz RIS — Migration 020: billing (payments + receipts)
-- Phase 4. Idempotent.
-- =====================================================

CREATE TABLE IF NOT EXISTS `ris_payments` (
  `id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `visit_id` INT(11) UNSIGNED NOT NULL,
  `amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `mode` ENUM('cash','upi','card','other') NOT NULL DEFAULT 'cash',
  `reference` VARCHAR(100) DEFAULT NULL,
  `is_refund` TINYINT(1) NOT NULL DEFAULT 0,
  `received_by` INT(11) UNSIGNED DEFAULT NULL,
  `received_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ris_pay_visit` (`visit_id`),
  KEY `idx_ris_pay_received` (`received_at`),
  CONSTRAINT `fk_ris_pay_visit` FOREIGN KEY (`visit_id`) REFERENCES `ris_visits` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ris_receipts` (
  `id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `visit_id` INT(11) UNSIGNED NOT NULL,
  `receipt_no` VARCHAR(32) NOT NULL,
  `pdf_path` VARCHAR(255) DEFAULT NULL,
  `gst_number` VARCHAR(40) DEFAULT NULL,
  `subtotal` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `discount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `tax_percentage` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `tax_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `total` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `created_by` INT(11) UNSIGNED DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ris_receipt_no` (`receipt_no`),
  KEY `idx_ris_receipt_visit` (`visit_id`),
  CONSTRAINT `fk_ris_receipt_visit` FOREIGN KEY (`visit_id`) REFERENCES `ris_visits` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `hospital_settings` (`setting_key`, `setting_value`, `setting_group`) VALUES
  ('brand_name', 'One Clickz Imaging', 'branding'),
  ('brand_tagline', 'Radiology Information System', 'branding'),
  ('brand_phone', '', 'branding'),
  ('brand_email', '', 'branding'),
  ('brand_address', '', 'branding'),
  ('brand_website', '', 'branding'),
  ('receipt_header', '', 'branding'),
  ('gst_number', '', 'billing'),
  ('default_tax_percentage', '0', 'billing'),
  ('receipt_footer', 'Thank you. Get well soon.', 'billing')
ON DUPLICATE KEY UPDATE `setting_key` = `setting_key`;

-- Receipt number sequence (RCP000001, ...)
INSERT INTO `app_counters` (`name`, `current_value`, `prefix`) VALUES ('receipt', 0, 'RCP')
ON DUPLICATE KEY UPDATE `name` = `name`;
