-- Migration 011: Fix Setup Wizard Requirements
-- Creates missing settings table and adds required columns to users table

-- =====================================================
-- Create settings table (used by setup wizard and check-setup API)
-- =====================================================
CREATE TABLE IF NOT EXISTS `settings` (
    `id` int(11) UNSIGNED NOT NULL AUTO_INCREMENT,
    `setting_key` varchar(100) NOT NULL,
    `setting_value` text DEFAULT NULL,
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `setting_key` (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Add missing columns to users table
-- =====================================================

-- Add setup_completed column (tracks if user has completed first-time setup)
-- Using ALTER IGNORE to handle case where column might already exist
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'setup_completed');
SET @sql = IF(@col_exists = 0,
    'ALTER TABLE `users` ADD COLUMN `setup_completed` TINYINT(1) NOT NULL DEFAULT 0',
    'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add is_super_admin column (for super admin portal access)
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'is_super_admin');
SET @sql = IF(@col_exists = 0,
    'ALTER TABLE `users` ADD COLUMN `is_super_admin` TINYINT(1) NOT NULL DEFAULT 0',
    'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =====================================================
-- Mark existing admin users as NOT having completed setup
-- This ensures the wizard shows for existing installations
-- =====================================================
UPDATE `users` SET `setup_completed` = 0 WHERE `role` = 'admin';

-- =====================================================
-- Clear any existing setup_complete flags to force wizard
-- (Only if hospital_name is empty or doesn't exist)
-- =====================================================
DELETE FROM `settings` WHERE `setting_key` = 'setup_complete'
    AND NOT EXISTS (SELECT 1 FROM `settings` WHERE `setting_key` = 'hospital_name' AND `setting_value` != '' AND `setting_value` IS NOT NULL);
