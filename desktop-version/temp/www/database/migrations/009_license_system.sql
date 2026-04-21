-- License Key System Schema
-- Migration 009: License management tables

-- Main licenses table (admin-managed)
CREATE TABLE IF NOT EXISTS licenses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    license_key VARCHAR(32) UNIQUE NOT NULL,
    license_type ENUM('trial_15', 'trial_30', 'trial_90', 'full', 'enterprise') NOT NULL DEFAULT 'trial_15',
    customer_name VARCHAR(255),
    customer_email VARCHAR(255),
    customer_phone VARCHAR(50),
    customer_hospital VARCHAR(255),
    max_activations INT DEFAULT 5 COMMENT 'Maximum number of machines that can activate this key',
    valid_from DATE DEFAULT (CURRENT_DATE),
    valid_until DATE COMMENT 'NULL for perpetual licenses',
    is_active TINYINT(1) DEFAULT 1 COMMENT '0 = revoked/suspended',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_license_key (license_key),
    INDEX idx_is_active (is_active),
    INDEX idx_valid_until (valid_until)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Track each machine/installation activated with a license
CREATE TABLE IF NOT EXISTS license_activations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    license_id INT NOT NULL,
    machine_id VARCHAR(64) NOT NULL COMMENT 'Unique hardware fingerprint',
    machine_name VARCHAR(255) COMMENT 'Computer hostname',
    os_info VARCHAR(255) COMMENT 'Operating system details',
    ip_address VARCHAR(45),
    activated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_heartbeat DATETIME COMMENT 'Last time this machine checked in',
    is_active TINYINT(1) DEFAULT 1,
    deactivated_at DATETIME,
    FOREIGN KEY (license_id) REFERENCES licenses(id) ON DELETE CASCADE,
    UNIQUE KEY unique_license_machine (license_id, machine_id),
    INDEX idx_machine_id (machine_id),
    INDEX idx_last_heartbeat (last_heartbeat)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Daily usage statistics per machine
CREATE TABLE IF NOT EXISTS license_usage_stats (
    id INT AUTO_INCREMENT PRIMARY KEY,
    activation_id INT NOT NULL,
    stat_date DATE NOT NULL,
    total_prints INT DEFAULT 0,
    printer_stats JSON COMMENT '{"printer_name": count, ...}',
    paper_stats JSON COMMENT '{"paper_type": count, ...}',
    studies_opened INT DEFAULT 0,
    reports_created INT DEFAULT 0,
    dicom_images_viewed INT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (activation_id) REFERENCES license_activations(id) ON DELETE CASCADE,
    UNIQUE KEY unique_activation_date (activation_id, stat_date),
    INDEX idx_stat_date (stat_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Local installation license cache (only 1 row needed)
CREATE TABLE IF NOT EXISTS installation_license (
    id INT PRIMARY KEY DEFAULT 1,
    license_key VARCHAR(32),
    machine_id VARCHAR(64),
    license_type VARCHAR(20),
    activated_at DATETIME,
    last_online_check DATETIME,
    cached_valid_until DATE,
    cached_is_active TINYINT(1) DEFAULT 1,
    grace_period_start DATETIME COMMENT 'When offline grace period started',
    CHECK (id = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insert empty row for local license
INSERT IGNORE INTO installation_license (id) VALUES (1);
