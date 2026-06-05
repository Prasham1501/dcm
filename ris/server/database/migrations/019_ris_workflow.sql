-- =====================================================
-- One Clickz RIS — Migration 019: doctor workflow (report link + delivery)
-- Phase 3. Idempotent.
-- =====================================================

SET @col := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ris_orders' AND COLUMN_NAME = 'report_id');
SET @sql := IF(@col = 0,
  'ALTER TABLE `ris_orders` ADD COLUMN `report_id` INT(11) UNSIGNED NULL AFTER `linked_study_uid`',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @col := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ris_orders' AND COLUMN_NAME = 'delivered_at');
SET @sql := IF(@col = 0,
  'ALTER TABLE `ris_orders` ADD COLUMN `delivered_at` DATETIME NULL',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @col := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ris_orders' AND COLUMN_NAME = 'delivered_by');
SET @sql := IF(@col = 0,
  'ALTER TABLE `ris_orders` ADD COLUMN `delivered_by` INT(11) UNSIGNED NULL',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
