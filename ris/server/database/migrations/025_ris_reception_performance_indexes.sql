-- =====================================================
-- One Clickz RIS - Migration 025: reception performance indexes
-- =====================================================

ALTER TABLE `ris_visits`
  ADD INDEX IF NOT EXISTS `idx_ris_visits_datetime` (`visit_datetime`),
  ADD INDEX IF NOT EXISTS `idx_ris_visits_center_datetime` (`center_name`, `visit_datetime`),
  ADD INDEX IF NOT EXISTS `idx_ris_visits_dispatch` (`dispatch_mode`, `delivery_destination`),
  ADD INDEX IF NOT EXISTS `idx_ris_visits_urgent_datetime` (`urgent_report`, `visit_datetime`);

ALTER TABLE `ris_patients`
  ADD INDEX IF NOT EXISTS `idx_ris_patients_phone` (`phone`),
  ADD INDEX IF NOT EXISTS `idx_ris_patients_name` (`full_name`);

ALTER TABLE `ris_payments`
  ADD INDEX IF NOT EXISTS `idx_ris_payments_visit` (`visit_id`),
  ADD INDEX IF NOT EXISTS `idx_ris_payments_received` (`received_at`);

ALTER TABLE `ris_result_assets`
  ADD INDEX IF NOT EXISTS `idx_ris_assets_visit` (`visit_id`),
  ADD INDEX IF NOT EXISTS `idx_ris_assets_patient` (`patient_id`);
