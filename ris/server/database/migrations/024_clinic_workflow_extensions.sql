-- =====================================================
-- One Clickz RIS - Migration 024: clinic workflow extensions
-- =====================================================

ALTER TABLE `ris_visits`
  ADD COLUMN IF NOT EXISTS `center_name` VARCHAR(160) DEFAULT NULL AFTER `visit_datetime`,
  ADD COLUMN IF NOT EXISTS `consultant_doctor` VARCHAR(160) DEFAULT NULL AFTER `referring_doctor_id`,
  ADD COLUMN IF NOT EXISTS `sample_collected_at` DATETIME DEFAULT NULL AFTER `consultant_doctor`,
  ADD COLUMN IF NOT EXISTS `ref_no` VARCHAR(80) DEFAULT NULL AFTER `sample_collected_at`,
  ADD COLUMN IF NOT EXISTS `urgent_report` TINYINT(1) NOT NULL DEFAULT 0 AFTER `ref_no`,
  ADD COLUMN IF NOT EXISTS `visit_comment` TEXT DEFAULT NULL AFTER `urgent_report`,
  ADD COLUMN IF NOT EXISTS `phlebotomy_staff` VARCHAR(160) DEFAULT NULL AFTER `visit_comment`,
  ADD COLUMN IF NOT EXISTS `home_visit_area` VARCHAR(160) DEFAULT NULL AFTER `phlebotomy_staff`,
  ADD COLUMN IF NOT EXISTS `home_visit_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER `home_visit_area`,
  ADD COLUMN IF NOT EXISTS `home_visit_time` TIME DEFAULT NULL AFTER `home_visit_amount`,
  ADD COLUMN IF NOT EXISTS `home_visit` TINYINT(1) NOT NULL DEFAULT 0 AFTER `home_visit_time`,
  ADD COLUMN IF NOT EXISTS `dispatch_mode` VARCHAR(80) DEFAULT NULL AFTER `home_visit`,
  ADD COLUMN IF NOT EXISTS `dispatch_note` TEXT DEFAULT NULL AFTER `dispatch_mode`,
  ADD COLUMN IF NOT EXISTS `delivery_destination` ENUM('center','home','patient','other') NOT NULL DEFAULT 'patient' AFTER `dispatch_note`,
  ADD COLUMN IF NOT EXISTS `pro_name` VARCHAR(160) DEFAULT NULL AFTER `delivery_destination`,
  ADD COLUMN IF NOT EXISTS `commission_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER `pro_name`,
  ADD COLUMN IF NOT EXISTS `regular_patient` TINYINT(1) NOT NULL DEFAULT 0 AFTER `commission_amount`,
  ADD COLUMN IF NOT EXISTS `misc_charge` DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER `total_amount`,
  ADD COLUMN IF NOT EXISTS `print_barcode` TINYINT(1) NOT NULL DEFAULT 0 AFTER `visit_comment`,
  ADD COLUMN IF NOT EXISTS `print_srs` TINYINT(1) NOT NULL DEFAULT 0 AFTER `print_barcode`,
  ADD COLUMN IF NOT EXISTS `print_receipt` TINYINT(1) NOT NULL DEFAULT 1 AFTER `print_srs`,
  ADD COLUMN IF NOT EXISTS `print_bill_receipt` TINYINT(1) NOT NULL DEFAULT 0 AFTER `print_receipt`,
  ADD COLUMN IF NOT EXISTS `send_to_printer` TINYINT(1) NOT NULL DEFAULT 1 AFTER `print_bill_receipt`;

ALTER TABLE `ris_patients`
  ADD COLUMN IF NOT EXISTS `patient_group` VARCHAR(120) DEFAULT NULL AFTER `alt_phone`;

ALTER TABLE `ris_orders`
  ADD COLUMN IF NOT EXISTS `report_emailed_at` DATETIME DEFAULT NULL AFTER `report_id`,
  ADD COLUMN IF NOT EXISTS `report_printed_at` DATETIME DEFAULT NULL AFTER `report_emailed_at`,
  ADD COLUMN IF NOT EXISTS `priority_rank` TINYINT(3) UNSIGNED NOT NULL DEFAULT 0 AFTER `report_printed_at`;

ALTER TABLE `ris_payments`
  ADD COLUMN IF NOT EXISTS `payer_name` VARCHAR(160) DEFAULT NULL AFTER `reference`,
  ADD COLUMN IF NOT EXISTS `payer_relation` VARCHAR(80) DEFAULT NULL AFTER `payer_name`,
  ADD COLUMN IF NOT EXISTS `payer_mobile` VARCHAR(20) DEFAULT NULL AFTER `payer_relation`,
  ADD COLUMN IF NOT EXISTS `notes` TEXT DEFAULT NULL AFTER `payer_mobile`;

ALTER TABLE `ris_services`
  ADD COLUMN IF NOT EXISTS `department` VARCHAR(120) DEFAULT NULL AFTER `body_part`,
  ADD COLUMN IF NOT EXISTS `family` VARCHAR(120) DEFAULT NULL AFTER `department`,
  ADD COLUMN IF NOT EXISTS `lab_name` VARCHAR(160) DEFAULT NULL AFTER `family`,
  ADD COLUMN IF NOT EXISTS `sample_type` VARCHAR(80) DEFAULT NULL AFTER `lab_name`,
  ADD COLUMN IF NOT EXISTS `tube_type` VARCHAR(80) DEFAULT NULL AFTER `sample_type`,
  ADD COLUMN IF NOT EXISTS `tube_count` INT(11) NOT NULL DEFAULT 1 AFTER `tube_type`,
  ADD COLUMN IF NOT EXISTS `barcode_label_count` INT(11) NOT NULL DEFAULT 1 AFTER `tube_count`;

CREATE TABLE IF NOT EXISTS `ris_result_assets` (
  `id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `order_id` INT(11) UNSIGNED NOT NULL,
  `visit_id` INT(11) UNSIGNED DEFAULT NULL,
  `patient_id` INT(11) UNSIGNED DEFAULT NULL,
  `asset_type` ENUM('graph','image','pdf','other') NOT NULL DEFAULT 'graph',
  `title` VARCHAR(180) DEFAULT NULL,
  `source_path` VARCHAR(600) NOT NULL,
  `source_mtime` DATETIME DEFAULT NULL,
  `created_by` INT(11) UNSIGNED DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ris_asset_order_path` (`order_id`, `source_path`),
  KEY `idx_ris_asset_order` (`order_id`),
  KEY `idx_ris_asset_patient` (`patient_id`),
  CONSTRAINT `fk_ris_asset_order` FOREIGN KEY (`order_id`) REFERENCES `ris_orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `hospital_settings` (`setting_key`, `setting_value`, `setting_group`) VALUES
  ('analyzer_graph_source_dirs', '', 'analyzer'),
  ('analyzer_graph_extensions', 'png,jpg,jpeg,pdf,bmp', 'analyzer')
ON DUPLICATE KEY UPDATE `setting_key` = `setting_key`;
