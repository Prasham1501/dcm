-- =====================================================
-- Hospital DICOM Viewer Pro - Fetal Medicine Module
-- Adds Patient -> Examination workflow (ScanOFe-style)
-- =====================================================

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";

-- =====================================================
-- Examinations Table
-- One patient may have multiple fetal examinations over time.
-- study_uid is OPTIONAL: lets us link a DICOM study when present.
-- =====================================================
CREATE TABLE IF NOT EXISTS `examinations` (
  `id` int(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `patient_id` varchar(64) NOT NULL,
  `study_uid` varchar(128) DEFAULT NULL,
  `exam_label` varchar(64) DEFAULT NULL,
  `exam_type` enum('FTS','SECOND_TRIMESTER','THIRD_TRIMESTER','FETAL_ECHO','NEURO','OTHER') NOT NULL DEFAULT 'FTS',
  `exam_date` date DEFAULT NULL,
  `lmp_date` date DEFAULT NULL,
  `gestational_age_weeks` decimal(5,2) DEFAULT NULL,
  `edd` date DEFAULT NULL,
  `obstetric_history` json DEFAULT NULL,
  `maternal_assessment` json DEFAULT NULL,
  `family_history` json DEFAULT NULL,
  `status` enum('draft','final') NOT NULL DEFAULT 'draft',
  `created_by` int(11) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `patient_id` (`patient_id`),
  KEY `study_uid` (`study_uid`),
  KEY `exam_date` (`exam_date`),
  KEY `status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Examination Biometry (per-field measurements with reference binding)
-- =====================================================
CREATE TABLE IF NOT EXISTS `examination_biometry` (
  `examination_id` int(11) UNSIGNED NOT NULL,
  `field_key` varchar(32) NOT NULL,
  `value` decimal(10,3) DEFAULT NULL,
  `unit` varchar(8) DEFAULT NULL,
  `reference_author_code` varchar(32) DEFAULT NULL,
  `percentile` decimal(5,2) DEFAULT NULL,
  `z_score` decimal(6,3) DEFAULT NULL,
  `is_abnormal` tinyint(1) DEFAULT 0,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`examination_id`,`field_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Examination Structural Assessment (Body Part Checklist)
-- =====================================================
CREATE TABLE IF NOT EXISTS `examination_structural` (
  `examination_id` int(11) UNSIGNED NOT NULL,
  `system` varchar(32) NOT NULL,
  `anatomy_key` varchar(64) NOT NULL,
  `status` enum('normal','abnormal','not_seen','select') NOT NULL DEFAULT 'select',
  `comments` text DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`examination_id`,`system`,`anatomy_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Examination DST selections (Findings, Syndromes, Genes, Investigations)
-- =====================================================
CREATE TABLE IF NOT EXISTS `examination_findings` (
  `examination_id` int(11) UNSIGNED NOT NULL,
  `finding_id` int(11) UNSIGNED NOT NULL,
  `include_in_report` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`examination_id`,`finding_id`),
  KEY `finding_id` (`finding_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `examination_syndromes` (
  `examination_id` int(11) UNSIGNED NOT NULL,
  `syndrome_id` int(11) UNSIGNED NOT NULL,
  `match_score_num` int(11) DEFAULT NULL,
  `match_score_den` int(11) DEFAULT NULL,
  `include_in_report` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`examination_id`,`syndrome_id`),
  KEY `syndrome_id` (`syndrome_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `examination_genes` (
  `examination_id` int(11) UNSIGNED NOT NULL,
  `gene_id` int(11) UNSIGNED NOT NULL,
  `include_in_report` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`examination_id`,`gene_id`),
  KEY `gene_id` (`gene_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `examination_investigations` (
  `examination_id` int(11) UNSIGNED NOT NULL,
  `investigation_id` int(11) UNSIGNED NOT NULL,
  `category` enum('basic','specific') NOT NULL DEFAULT 'basic',
  `include_in_report` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`examination_id`,`investigation_id`),
  KEY `investigation_id` (`investigation_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Examination Risk Calculator Results
-- =====================================================
CREATE TABLE IF NOT EXISTS `examination_risk_results` (
  `examination_id` int(11) UNSIGNED NOT NULL,
  `calculator` enum('aneuploidy','preeclampsia','preterm') NOT NULL,
  `inputs` json DEFAULT NULL,
  `results` json DEFAULT NULL,
  `include_in_report` tinyint(1) NOT NULL DEFAULT 1,
  `computed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`examination_id`,`calculator`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Reference Catalogs (populated later from user-supplied data)
-- =====================================================
CREATE TABLE IF NOT EXISTS `findings` (
  `id` int(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `system` varchar(32) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `details_md` mediumtext DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`),
  KEY `system` (`system`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `syndromes` (
  `id` int(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `omim_id` varchar(16) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `references_md` mediumtext DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `genes` (
  `id` int(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `symbol` varchar(64) NOT NULL,
  `full_name` varchar(255) DEFAULT NULL,
  `hgnc_id` varchar(16) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `symbol` (`symbol`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `investigations` (
  `id` int(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `category` enum('basic','specific') NOT NULL DEFAULT 'basic',
  `description` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Mapping tables (for Syndrome match-scoring & Gene/Investigation suggestions)
CREATE TABLE IF NOT EXISTS `finding_syndrome_map` (
  `finding_id` int(11) UNSIGNED NOT NULL,
  `syndrome_id` int(11) UNSIGNED NOT NULL,
  PRIMARY KEY (`finding_id`,`syndrome_id`),
  KEY `syndrome_id` (`syndrome_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `syndrome_gene_map` (
  `syndrome_id` int(11) UNSIGNED NOT NULL,
  `gene_id` int(11) UNSIGNED NOT NULL,
  PRIMARY KEY (`syndrome_id`,`gene_id`),
  KEY `gene_id` (`gene_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `finding_investigation_map` (
  `finding_id` int(11) UNSIGNED NOT NULL,
  `investigation_id` int(11) UNSIGNED NOT NULL,
  PRIMARY KEY (`finding_id`,`investigation_id`),
  KEY `investigation_id` (`investigation_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Multi-author Growth Charts (Salomon, Kustermann, etc.)
-- =====================================================
CREATE TABLE IF NOT EXISTS `growth_chart_authors` (
  `id` int(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` varchar(32) NOT NULL,
  `display_name` varchar(255) NOT NULL,
  `citation` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `growth_chart_data` (
  `author_id` int(11) UNSIGNED NOT NULL,
  `parameter` varchar(32) NOT NULL,
  `ga_weeks` decimal(5,2) NOT NULL,
  `p5` decimal(10,3) DEFAULT NULL,
  `p50` decimal(10,3) DEFAULT NULL,
  `p95` decimal(10,3) DEFAULT NULL,
  `mean` decimal(10,3) DEFAULT NULL,
  `sd` decimal(10,3) DEFAULT NULL,
  PRIMARY KEY (`author_id`,`parameter`,`ga_weeks`),
  KEY `parameter` (`parameter`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `biometry_field_defaults` (
  `field_key` varchar(32) NOT NULL,
  `display_label` varchar(64) NOT NULL,
  `unit` varchar(8) DEFAULT 'mm',
  `default_author_code` varchar(32) DEFAULT NULL,
  `exam_type` varchar(32) DEFAULT NULL,
  `display_order` int(11) DEFAULT 0,
  PRIMARY KEY (`field_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed the FTS field set (matches ScanOFe screenshots)
INSERT INTO `biometry_field_defaults` (`field_key`,`display_label`,`unit`,`default_author_code`,`exam_type`,`display_order`) VALUES
('CRL','CRL','mm','salomon','FTS',10),
('BPD_CRL','BPD_CRL','mm','kustermann','FTS',20),
('HC_CRL','HC_CRL','mm','kustermann','FTS',30),
('AC_CRL','AC_CRL','mm','kustermann','FTS',40),
('FL_CRL','FL_CRL','mm','kustermann','FTS',50),
('NB','NB','mm','prakash','FTS',60),
('NT','NT','mm','junior','FTS',70),
('IT','IT','mm','sung_hee_yang','FTS',80)
ON DUPLICATE KEY UPDATE display_order=VALUES(display_order);

-- Seed the chart-author registry (data rows added later from user-supplied tables)
INSERT INTO `growth_chart_authors` (`code`,`display_name`,`citation`) VALUES
('salomon','L_J_Salomon','Salomon LJ et al. ISUOG practice guidelines.'),
('kustermann','Kustermann','Kustermann et al. British Journal of Obstetrics and Gynaecology. January 1992;99:38-42.'),
('prakash','RB_Prakash','Prakash RB et al.'),
('junior','E_A_Junior','E_A_Junior et al. Ultrasound Obstet Gynecol. 2011;38(1):67-70.'),
('sung_hee_yang','Sung_Hee_Yang','Sung_Hee_Yang et al. Prenat Diagn. 2013;33(8):737-741.'),
('indian_population','Indian_Population','Indian Population et al. Ultrasound Obstet Gynecol. 2006;28(4):406-411.')
ON DUPLICATE KEY UPDATE display_name=VALUES(display_name), citation=VALUES(citation);

-- =====================================================
-- Risk Calculator Coefficients (FMF likelihood-ratio model, configurable)
-- =====================================================
CREATE TABLE IF NOT EXISTS `risk_coefficients` (
  `calculator` varchar(32) NOT NULL,
  `parameter` varchar(64) NOT NULL,
  `coeff_json` json DEFAULT NULL,
  `source_citation` text DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`calculator`,`parameter`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Extend report_templates with placeholders + exam_type columns
-- (Wrapped in IF NOT EXISTS-style guards via INFORMATION_SCHEMA check)
-- =====================================================
SET @col_check := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'report_templates'
    AND COLUMN_NAME = 'placeholders_supported');
SET @sql := IF(@col_check = 0,
  'ALTER TABLE `report_templates` ADD COLUMN `placeholders_supported` TINYINT(1) NOT NULL DEFAULT 0',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_check := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'report_templates'
    AND COLUMN_NAME = 'exam_type');
SET @sql := IF(@col_check = 0,
  'ALTER TABLE `report_templates` ADD COLUMN `exam_type` VARCHAR(32) NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- =====================================================
-- Link medical_reports rows to an examination (optional FK).
-- =====================================================
SET @col_check := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'medical_reports'
    AND COLUMN_NAME = 'examination_id');
SET @sql := IF(@col_check = 0,
  'ALTER TABLE `medical_reports` ADD COLUMN `examination_id` INT(11) UNSIGNED NULL, ADD KEY `examination_id` (`examination_id`)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- =====================================================
-- End of 005_fetal_module.sql
-- =====================================================
