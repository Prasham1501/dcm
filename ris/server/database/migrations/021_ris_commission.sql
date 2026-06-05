-- =====================================================
-- One Clickz RIS — Migration 021: referring-doctor commission
-- Phase 5. Idempotent. (Accounting/MIS feature; can be disabled.)
-- =====================================================

CREATE TABLE IF NOT EXISTS `ris_commission_payouts` (
  `id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `referring_doctor_id` INT(11) UNSIGNED NOT NULL,
  `period_start` DATE DEFAULT NULL,
  `period_end` DATE DEFAULT NULL,
  `total_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `status` ENUM('draft','approved','paid') NOT NULL DEFAULT 'draft',
  `reference` VARCHAR(100) DEFAULT NULL,
  `notes` TEXT DEFAULT NULL,
  `paid_at` DATETIME DEFAULT NULL,
  `created_by` INT(11) UNSIGNED DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ris_payout_doctor` (`referring_doctor_id`),
  KEY `idx_ris_payout_status` (`status`),
  CONSTRAINT `fk_ris_payout_doctor` FOREIGN KEY (`referring_doctor_id`) REFERENCES `ris_referring_doctors` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ris_commission_entries` (
  `id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `order_id` INT(11) UNSIGNED NOT NULL,
  `visit_id` INT(11) UNSIGNED DEFAULT NULL,
  `referring_doctor_id` INT(11) UNSIGNED NOT NULL,
  `service_id` INT(11) UNSIGNED DEFAULT NULL,
  `base_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `rate_type` ENUM('percent','flat') NOT NULL DEFAULT 'percent',
  `rate_value` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `commission_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `period_ym` VARCHAR(7) DEFAULT NULL,
  `status` ENUM('accrued','approved','paid','void') NOT NULL DEFAULT 'accrued',
  `payout_id` INT(11) UNSIGNED DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ris_comm_order` (`order_id`),
  KEY `idx_ris_comm_doctor` (`referring_doctor_id`),
  KEY `idx_ris_comm_status` (`status`),
  KEY `idx_ris_comm_period` (`period_ym`),
  KEY `idx_ris_comm_payout` (`payout_id`),
  CONSTRAINT `fk_ris_comm_order` FOREIGN KEY (`order_id`) REFERENCES `ris_orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ris_comm_doctor` FOREIGN KEY (`referring_doctor_id`) REFERENCES `ris_referring_doctors` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ris_comm_payout` FOREIGN KEY (`payout_id`) REFERENCES `ris_commission_payouts` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `hospital_settings` (`setting_key`, `setting_value`, `setting_group`) VALUES
  ('commission_enabled', '1', 'commission')
ON DUPLICATE KEY UPDATE `setting_key` = `setting_key`;
