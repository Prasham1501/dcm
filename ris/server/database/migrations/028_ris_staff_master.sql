-- One Clickz RIS - Migration 028: staff master linked to login users.

CREATE TABLE IF NOT EXISTS `ris_staff` (
  `id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT(11) UNSIGNED DEFAULT NULL,
  `staff_code` VARCHAR(32) DEFAULT NULL,
  `full_name` VARCHAR(160) NOT NULL,
  `designation` VARCHAR(120) DEFAULT NULL,
  `department` VARCHAR(120) DEFAULT NULL,
  `phone` VARCHAR(30) DEFAULT NULL,
  `email` VARCHAR(160) DEFAULT NULL,
  `address` VARCHAR(255) DEFAULT NULL,
  `username` VARCHAR(80) DEFAULT NULL,
  `user_role` VARCHAR(40) NOT NULL DEFAULT 'receptionist',
  `can_login` TINYINT(1) NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ris_staff_code` (`staff_code`),
  UNIQUE KEY `uq_ris_staff_user` (`user_id`),
  KEY `idx_ris_staff_active` (`is_active`),
  KEY `idx_ris_staff_name` (`full_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

