-- Super Admin and Activity Tracking Schema
-- Migration 010: Super admin, activity logs, and setup wizard support

-- Activity log table for real-time tracking
CREATE TABLE IF NOT EXISTS activity_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    license_key VARCHAR(32),
    machine_id VARCHAR(64),
    user_id INT,
    user_name VARCHAR(255),
    event_type VARCHAR(50) NOT NULL,
    event_category ENUM('auth', 'study', 'report', 'print', 'settings', 'system') DEFAULT 'system',
    event_data JSON,
    ip_address VARCHAR(45),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_license (license_key),
    INDEX idx_event_type (event_type),
    INDEX idx_created_at (created_at),
    INDEX idx_category (event_category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Sample patient data for demo/tutorial
CREATE TABLE IF NOT EXISTS sample_data (
    id INT AUTO_INCREMENT PRIMARY KEY,
    data_type VARCHAR(50),
    data_content JSON,
    is_active TINYINT(1) DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Onboarding progress tracking
CREATE TABLE IF NOT EXISTS onboarding_progress (
    id INT PRIMARY KEY DEFAULT 1,
    license_key VARCHAR(32),
    current_step INT DEFAULT 1,
    completed_steps JSON,
    sample_data_created TINYINT(1) DEFAULT 0,
    completed_at DATETIME
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO onboarding_progress (id, completed_steps) VALUES (1, '[]');
