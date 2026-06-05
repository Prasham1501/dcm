-- =====================================================
-- One Clickz RIS - Migration 022: reception fields, tokens, receipt options
-- =====================================================

ALTER TABLE `ris_patients`
  ADD COLUMN IF NOT EXISTS `name_prefix` VARCHAR(20) DEFAULT NULL AFTER `dicom_patient_id`,
  ADD COLUMN IF NOT EXISTS `last_name` VARCHAR(120) DEFAULT NULL AFTER `full_name`,
  ADD COLUMN IF NOT EXISTS `alt_phone` VARCHAR(20) DEFAULT NULL AFTER `phone`,
  ADD COLUMN IF NOT EXISTS `address_line1` VARCHAR(255) DEFAULT NULL AFTER `email`,
  ADD COLUMN IF NOT EXISTS `address_line2` VARCHAR(255) DEFAULT NULL AFTER `address_line1`,
  ADD COLUMN IF NOT EXISTS `address_line3` VARCHAR(255) DEFAULT NULL AFTER `address_line2`,
  ADD COLUMN IF NOT EXISTS `city` VARCHAR(100) DEFAULT NULL AFTER `address_line3`,
  ADD COLUMN IF NOT EXISTS `state` VARCHAR(100) DEFAULT NULL AFTER `city`,
  ADD COLUMN IF NOT EXISTS `aadhaar_number` VARCHAR(20) DEFAULT NULL AFTER `id_proof_number`;

ALTER TABLE `ris_orders`
  ADD COLUMN IF NOT EXISTS `token_no` VARCHAR(32) DEFAULT NULL AFTER `accession_number`,
  ADD COLUMN IF NOT EXISTS `room_title` VARCHAR(120) DEFAULT NULL AFTER `scheduled_station_ae`;

ALTER TABLE `hospital_settings`
  MODIFY `setting_value` MEDIUMTEXT DEFAULT NULL;

INSERT INTO `app_counters` (`name`, `current_value`, `prefix`) VALUES
  ('token', 0, 'T')
ON DUPLICATE KEY UPDATE `name` = `name`;

INSERT INTO `hospital_settings` (`setting_key`, `setting_value`, `setting_group`) VALUES
  ('receipt_paper_size', 'A5', 'billing'),
  ('receipt_signature_label', 'Authorized sign / stamp', 'billing'),
  ('receipt_signature_image', '', 'billing'),
  ('receipt_stamp_image', '', 'billing'),
  ('brand_logo_image', '', 'branding')
ON DUPLICATE KEY UPDATE `setting_key` = `setting_key`;
