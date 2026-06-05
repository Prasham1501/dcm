-- =====================================================
-- One Clickz RIS — Migration 018: Modality Worklist tracking
-- Phase 2: track the generated .wl file per order. Idempotent.
-- =====================================================

SET @col := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ris_orders' AND COLUMN_NAME = 'mwl_path');
SET @sql := IF(@col = 0,
  'ALTER TABLE `ris_orders` ADD COLUMN `mwl_path` VARCHAR(255) NULL AFTER `linked_study_uid`',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @col := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ris_orders' AND COLUMN_NAME = 'mwl_written_at');
SET @sql := IF(@col = 0,
  'ALTER TABLE `ris_orders` ADD COLUMN `mwl_written_at` DATETIME NULL AFTER `mwl_path`',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
