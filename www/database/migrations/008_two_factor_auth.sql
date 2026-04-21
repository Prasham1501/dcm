-- Two-Factor Authentication Migration
-- Add TOTP columns to users table for Google Authenticator / Microsoft Authenticator support

ALTER TABLE `users` 
ADD COLUMN `totp_secret` VARCHAR(32) DEFAULT NULL COMMENT 'Base32 encoded TOTP secret',
ADD COLUMN `totp_enabled` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Whether 2FA is enabled',
ADD COLUMN `totp_verified_at` DATETIME DEFAULT NULL COMMENT 'When 2FA was first verified';

-- Index for faster lookups
ALTER TABLE `users` ADD INDEX `idx_totp_enabled` (`totp_enabled`);
