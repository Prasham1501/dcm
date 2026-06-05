-- =====================================================
-- One Clickz Viewer — Migration 023: PCPNDT Form F (viewer-native)
-- Makes the PCPNDT Form F usable from the DICOM viewer WITHOUT the RIS:
--   - keyed by study_uid (the open study), order_id optional (soft RIS link)
--   - no FK to ris_orders (so it works on a viewer-only install)
--   - adds the remaining statutory Form F columns
-- Idempotent: safe whether or not RIS migration 022 already created the tables.
-- =====================================================

-- 1) Create the tables standalone if they don't exist yet (viewer-only install).
CREATE TABLE IF NOT EXISTS `pcpndt_form_f` (
  `id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `study_uid` VARCHAR(128) DEFAULT NULL,
  `order_id` INT(11) UNSIGNED DEFAULT NULL,
  `visit_id` INT(11) UNSIGNED DEFAULT NULL,
  `patient_id` INT(11) UNSIGNED DEFAULT NULL,
  `examination_id` INT(11) UNSIGNED DEFAULT NULL,
  `status` ENUM('draft','generated','printed','submitted','failed') NOT NULL DEFAULT 'draft',
  `created_by` INT(11) UNSIGNED DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `pcpndt_portal_credentials` (
  `id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `state_code` VARCHAR(20) NOT NULL,
  `username` VARCHAR(120) DEFAULT NULL,
  `password_enc` TEXT DEFAULT NULL,
  `extra` JSON DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pcpndt_state` (`state_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2) Idempotent column adds (covers both the viewer-only table above and a
--    table previously created by RIS migration 022). All statutory Form F fields.
DROP PROCEDURE IF EXISTS `pcpndt_add_col`;
DELIMITER //
CREATE PROCEDURE `pcpndt_add_col`(IN cname VARCHAR(64), IN cdef VARCHAR(255))
BEGIN
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pcpndt_form_f' AND COLUMN_NAME = cname) THEN
    SET @s = CONCAT('ALTER TABLE `pcpndt_form_f` ADD COLUMN `', cname, '` ', cdef);
    PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
  END IF;
END //
DELIMITER ;

CALL pcpndt_add_col('study_uid', "VARCHAR(128) DEFAULT NULL");
CALL pcpndt_add_col('ref_no', "VARCHAR(64) DEFAULT NULL");
CALL pcpndt_add_col('clinic_name', "VARCHAR(255) DEFAULT NULL");
CALL pcpndt_add_col('clinic_registration_no', "VARCHAR(80) DEFAULT NULL");
CALL pcpndt_add_col('clinic_address', "TEXT DEFAULT NULL");
CALL pcpndt_add_col('patient_name', "VARCHAR(255) DEFAULT NULL");
CALL pcpndt_add_col('patient_age', "VARCHAR(20) DEFAULT NULL");
CALL pcpndt_add_col('husband_or_father_name', "VARCHAR(255) DEFAULT NULL");
CALL pcpndt_add_col('full_address', "TEXT DEFAULT NULL");
CALL pcpndt_add_col('phone', "VARCHAR(20) DEFAULT NULL");
CALL pcpndt_add_col('id_proof_type', "VARCHAR(60) DEFAULT NULL");
CALL pcpndt_add_col('id_proof_number', "VARCHAR(80) DEFAULT NULL");
CALL pcpndt_add_col('num_living_children', "VARCHAR(20) DEFAULT NULL");
CALL pcpndt_add_col('children_details', "VARCHAR(255) DEFAULT NULL");
CALL pcpndt_add_col('referring_doctor', "VARCHAR(255) DEFAULT NULL");
CALL pcpndt_add_col('referring_doctor_address', "TEXT DEFAULT NULL");
CALL pcpndt_add_col('referring_doctor_reg_no', "VARCHAR(80) DEFAULT NULL");
CALL pcpndt_add_col('lmp_date', "DATE DEFAULT NULL");
CALL pcpndt_add_col('gestational_age', "VARCHAR(40) DEFAULT NULL");
CALL pcpndt_add_col('edd', "DATE DEFAULT NULL");
CALL pcpndt_add_col('family_history', "TEXT DEFAULT NULL");
CALL pcpndt_add_col('basis_of_diagnosis', "VARCHAR(255) DEFAULT NULL");
CALL pcpndt_add_col('indications', "JSON DEFAULT NULL");
CALL pcpndt_add_col('procedure_type', "VARCHAR(20) DEFAULT NULL");
CALL pcpndt_add_col('procedures', "JSON DEFAULT NULL");
CALL pcpndt_add_col('procedure_date', "DATE DEFAULT NULL");
CALL pcpndt_add_col('complications', "TEXT DEFAULT NULL");
CALL pcpndt_add_col('result', "TEXT DEFAULT NULL");
CALL pcpndt_add_col('result_conveyed', "VARCHAR(8) DEFAULT NULL");
CALL pcpndt_add_col('performing_doctor', "VARCHAR(255) DEFAULT NULL");
CALL pcpndt_add_col('performing_doctor_qualification', "VARCHAR(120) DEFAULT NULL");
CALL pcpndt_add_col('performing_doctor_reg_no', "VARCHAR(80) DEFAULT NULL");
CALL pcpndt_add_col('declaration_text', "TEXT DEFAULT NULL");
CALL pcpndt_add_col('pdf_path', "VARCHAR(255) DEFAULT NULL");
CALL pcpndt_add_col('portal_ack_no', "VARCHAR(100) DEFAULT NULL");
CALL pcpndt_add_col('submitted_at', "DATETIME DEFAULT NULL");
CALL pcpndt_add_col('submitted_by', "INT(11) UNSIGNED DEFAULT NULL");

DROP PROCEDURE IF EXISTS `pcpndt_add_col`;

-- 3) Make order_id nullable (RIS migration 022 created it NOT NULL).
SET @nn := (SELECT IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pcpndt_form_f' AND COLUMN_NAME = 'order_id');
SET @sql := IF(@nn = 'NO', 'ALTER TABLE `pcpndt_form_f` MODIFY `order_id` INT(11) UNSIGNED NULL', 'SELECT 1');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

-- 4) Unique index on study_uid (one Form F per study). Guarded.
SET @hasIdx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pcpndt_form_f' AND INDEX_NAME = 'uq_pcpndt_study');
SET @sql := IF(@hasIdx = 0, 'ALTER TABLE `pcpndt_form_f` ADD UNIQUE KEY `uq_pcpndt_study` (`study_uid`)', 'SELECT 1');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

-- 5) Settings (idempotent).
INSERT INTO `hospital_settings` (`setting_key`, `setting_value`, `setting_group`) VALUES
  ('pcpndt_registration_no', '', 'pcpndt'),
  ('clinic_state', 'maharashtra', 'pcpndt')
ON DUPLICATE KEY UPDATE `setting_key` = `setting_key`;
