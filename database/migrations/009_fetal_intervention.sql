-- =====================================================
-- 009 — Fetal Intervention tab persistence
--   - new `examination_interventions` table: one row per procedure / counselling event
--   - new `counselling_notes` longtext column on `examinations`
-- =====================================================

CREATE TABLE IF NOT EXISTS `examination_interventions` (
  `id`              int(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `examination_id`  int(11) UNSIGNED NOT NULL,
  `procedure_type`  varchar(64)  NOT NULL,
  `procedure_date`  date         DEFAULT NULL,
  `operator`        varchar(128) DEFAULT NULL,
  `indication`      text         DEFAULT NULL,
  `findings`        text         DEFAULT NULL,
  `complications`   text         DEFAULT NULL,
  `outcome`         text         DEFAULT NULL,
  `include_in_report` tinyint(1) NOT NULL DEFAULT 1,
  `created_at`      timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `examination_id` (`examination_id`),
  KEY `procedure_date` (`procedure_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Free-text counselling notes live on the examination itself (one per exam).
ALTER TABLE `examinations`
  ADD COLUMN IF NOT EXISTS `counselling_notes` longtext DEFAULT NULL AFTER `family_history`;
