-- =====================================================
-- One Clickz RIS - Migration 026: lab result entry
-- Parameters per test, reference ranges, entered results, and order result status.
-- Idempotent: CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS.
-- =====================================================

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";

CREATE TABLE IF NOT EXISTS `ris_test_parameters` (
  `id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `service_id` INT(11) UNSIGNED NOT NULL,
  `name` VARCHAR(180) NOT NULL,
  `unit` VARCHAR(40) DEFAULT NULL,
  `input_type` ENUM('numeric','text','select') NOT NULL DEFAULT 'numeric',
  `options` TEXT DEFAULT NULL,
  `decimals` TINYINT(3) NOT NULL DEFAULT 2,
  `formula` VARCHAR(255) DEFAULT NULL,
  `default_value` VARCHAR(120) DEFAULT NULL,
  `sort_order` INT(11) NOT NULL DEFAULT 0,
  `is_heading` TINYINT(1) NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ris_param_service` (`service_id`),
  KEY `idx_ris_param_active` (`is_active`),
  CONSTRAINT `fk_ris_param_service` FOREIGN KEY (`service_id`) REFERENCES `ris_services` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ris_test_ref_ranges` (
  `id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `parameter_id` INT(11) UNSIGNED NOT NULL,
  `sex` ENUM('any','male','female') NOT NULL DEFAULT 'any',
  `age_min_days` INT(11) NOT NULL DEFAULT 0,
  `age_max_days` INT(11) NOT NULL DEFAULT 54750,
  `low` DECIMAL(14,4) DEFAULT NULL,
  `high` DECIMAL(14,4) DEFAULT NULL,
  `normal_text` VARCHAR(255) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ris_range_param` (`parameter_id`),
  CONSTRAINT `fk_ris_range_param` FOREIGN KEY (`parameter_id`) REFERENCES `ris_test_parameters` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ris_test_results` (
  `id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `order_id` INT(11) UNSIGNED NOT NULL,
  `parameter_id` INT(11) UNSIGNED NOT NULL,
  `value` VARCHAR(255) DEFAULT NULL,
  `flag` ENUM('L','N','H','') NOT NULL DEFAULT '',
  `entered_by` INT(11) UNSIGNED DEFAULT NULL,
  `entered_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ris_result_order_param` (`order_id`, `parameter_id`),
  KEY `idx_ris_result_param` (`parameter_id`),
  CONSTRAINT `fk_ris_result_order` FOREIGN KEY (`order_id`) REFERENCES `ris_orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ris_result_param` FOREIGN KEY (`parameter_id`) REFERENCES `ris_test_parameters` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `ris_orders`
  ADD COLUMN IF NOT EXISTS `result_status` ENUM('registered','pending','complete','authenticated','printed') NOT NULL DEFAULT 'registered' AFTER `status`,
  ADD COLUMN IF NOT EXISTS `authenticated_by` INT(11) UNSIGNED DEFAULT NULL AFTER `result_status`,
  ADD COLUMN IF NOT EXISTS `authenticated_at` DATETIME DEFAULT NULL AFTER `authenticated_by`,
  ADD COLUMN IF NOT EXISTS `result_remark` TEXT DEFAULT NULL AFTER `authenticated_at`,
  ADD COLUMN IF NOT EXISTS `result_advice` TEXT DEFAULT NULL AFTER `result_remark`,
  ADD COLUMN IF NOT EXISTS `result_note` TEXT DEFAULT NULL AFTER `result_advice`;
