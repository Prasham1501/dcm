-- Print Tracking and Billing System
-- Migration 012: Complete print tracking, location management, and billing system
-- SAFE VERSION - No foreign keys initially to avoid constraint errors

-- ============================================================================
-- 1. LOCATION/ROOM MANAGEMENT
-- ============================================================================

-- Locations table - stores rooms where software is installed
CREATE TABLE IF NOT EXISTS locations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    license_id INT NULL COMMENT 'Link to specific license, NULL for local-only installations',
    location_code VARCHAR(50) NOT NULL COMMENT 'Short code like SONO1, XRAY1, CT1',
    location_name VARCHAR(100) NOT NULL COMMENT 'Full name like Sonography Room 1',
    department VARCHAR(100) COMMENT 'Department like Radiology, Cardiology',
    floor VARCHAR(20) COMMENT 'Floor location',
    building VARCHAR(100) COMMENT 'Building name',
    description TEXT COMMENT 'Additional notes',
    is_active TINYINT(1) DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_license (license_id),
    INDEX idx_location_code (location_code),
    INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Machine-to-Location assignment (allows history tracking)
CREATE TABLE IF NOT EXISTS machine_locations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    activation_id INT NOT NULL COMMENT 'Links to license_activations',
    location_id INT NOT NULL COMMENT 'Links to locations',
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    assigned_by INT COMMENT 'User ID who made assignment',
    is_current TINYINT(1) DEFAULT 1 COMMENT 'Current assignment (allows history)',
    notes TEXT,
    INDEX idx_activation (activation_id),
    INDEX idx_location (location_id),
    INDEX idx_current (is_current),
    INDEX idx_assigned_by (assigned_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================================
-- 2. DETAILED PRINT LOGS (CORE TABLE)
-- ============================================================================

-- Stores every single print with full details for billing
CREATE TABLE IF NOT EXISTS print_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,

    -- Identification
    license_key VARCHAR(32) COMMENT 'License key for multi-hospital tracking',
    machine_id VARCHAR(64) NOT NULL COMMENT 'Unique machine fingerprint',
    activation_id INT COMMENT 'Links to license_activations',
    location_id INT COMMENT 'Room/location where print occurred',
    user_id INT COMMENT 'User who initiated print',
    user_name VARCHAR(100) COMMENT 'Username for quick reference',

    -- Print Job Details
    print_job_id VARCHAR(64) NOT NULL COMMENT 'Unique UUID for this print job',
    study_uid VARCHAR(128) COMMENT 'DICOM Study Instance UID',
    patient_id VARCHAR(64) COMMENT 'Patient ID (can be anonymized)',
    patient_name VARCHAR(255) COMMENT 'Patient name for reference',

    -- Print Specifications
    paper_size VARCHAR(20) NOT NULL DEFAULT 'A4' COMMENT 'A4, A3, Letter, Legal, etc.',
    orientation VARCHAR(20) DEFAULT 'landscape' COMMENT 'landscape or portrait',
    copies INT DEFAULT 1 COMMENT 'Number of copies printed',
    pages_per_copy INT DEFAULT 1 COMMENT 'Pages in each copy',
    total_pages INT NOT NULL DEFAULT 1 COMMENT 'Total pages (copies * pages_per_copy)',
    color_mode VARCHAR(20) DEFAULT 'grayscale' COMMENT 'grayscale or color',
    quality VARCHAR(20) DEFAULT 'high' COMMENT 'high, medium, low',

    -- Printer Info
    printer_name VARCHAR(100) COMMENT 'Selected printer name',
    printer_type VARCHAR(20) DEFAULT 'local' COMMENT 'local, network, dicom',

    -- Layout/Content Info
    layout_type VARCHAR(50) COMMENT 'Layout used: 1x1, 2x2, etc.',
    include_patient_info TINYINT(1) DEFAULT 1,
    include_annotations TINYINT(1) DEFAULT 1,
    include_measurements TINYINT(1) DEFAULT 1,

    -- Status Tracking
    status ENUM('queued', 'printing', 'completed', 'failed', 'cancelled') DEFAULT 'queued',
    error_message TEXT COMMENT 'Error details if failed',

    -- Timestamps
    queued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME COMMENT 'When printing actually started',
    completed_at DATETIME COMMENT 'When print completed',

    -- Offline Support
    is_offline_print TINYINT(1) DEFAULT 0 COMMENT 'Was this printed while offline?',
    offline_queue_id VARCHAR(64) COMMENT 'Reference to offline queue entry',
    synced_at DATETIME COMMENT 'When synced to central server',

    -- Billing
    billable TINYINT(1) DEFAULT 1 COMMENT 'Should this be billed?',
    billed TINYINT(1) DEFAULT 0 COMMENT 'Has this been invoiced?',
    invoice_id INT COMMENT 'Link to invoice when billed',
    cost_per_page DECIMAL(10,4) COMMENT 'Cost at time of print (for historical accuracy)',
    total_cost DECIMAL(10,2) COMMENT 'Total cost for this print job',

    INDEX idx_license_date (license_key, queued_at),
    INDEX idx_machine_date (machine_id, queued_at),
    INDEX idx_location_date (location_id, queued_at),
    INDEX idx_user_date (user_id, queued_at),
    INDEX idx_status (status),
    INDEX idx_billable (billable, billed),
    INDEX idx_offline (is_offline_print, synced_at),
    INDEX idx_print_job (print_job_id),
    INDEX idx_invoice (invoice_id),
    INDEX idx_activation (activation_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================================
-- 3. PRINT PRICING CONFIGURATION
-- ============================================================================

-- Flexible pricing per paper size, color mode, with date ranges
CREATE TABLE IF NOT EXISTS print_pricing (
    id INT AUTO_INCREMENT PRIMARY KEY,
    license_id INT COMMENT 'NULL = global default pricing',

    -- Pricing criteria
    paper_size VARCHAR(20) NOT NULL COMMENT 'A4, A3, Letter, etc. or "default"',
    color_mode VARCHAR(20) NOT NULL DEFAULT 'any' COMMENT 'grayscale, color, or any',

    -- Pricing
    cost_per_page DECIMAL(10,4) NOT NULL COMMENT 'Cost per page',
    currency VARCHAR(3) DEFAULT 'INR' COMMENT 'Currency code',

    -- Validity
    effective_from DATE NOT NULL,
    effective_until DATE COMMENT 'NULL = no end date',

    -- Metadata
    description VARCHAR(255),
    created_by INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_license (license_id),
    INDEX idx_paper_color (paper_size, color_mode),
    INDEX idx_effective (effective_from, effective_until)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insert default pricing
INSERT INTO print_pricing (license_id, paper_size, color_mode, cost_per_page, currency, effective_from, description)
VALUES
    (NULL, 'A4', 'grayscale', 5.00, 'INR', CURDATE(), 'Default A4 grayscale pricing'),
    (NULL, 'A4', 'color', 10.00, 'INR', CURDATE(), 'Default A4 color pricing'),
    (NULL, 'A3', 'grayscale', 10.00, 'INR', CURDATE(), 'Default A3 grayscale pricing'),
    (NULL, 'A3', 'color', 20.00, 'INR', CURDATE(), 'Default A3 color pricing'),
    (NULL, 'Letter', 'grayscale', 5.00, 'INR', CURDATE(), 'Default Letter grayscale pricing'),
    (NULL, 'Letter', 'color', 10.00, 'INR', CURDATE(), 'Default Letter color pricing'),
    (NULL, 'default', 'any', 5.00, 'INR', CURDATE(), 'Fallback default pricing')
ON DUPLICATE KEY UPDATE cost_per_page = VALUES(cost_per_page);

-- ============================================================================
-- 4. BILLING/INVOICE SYSTEM
-- ============================================================================

-- Invoice headers
CREATE TABLE IF NOT EXISTS invoices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    license_id INT NOT NULL,
    invoice_number VARCHAR(50) NOT NULL UNIQUE COMMENT 'Invoice number like INV-2025-0001',

    -- Billing Period
    billing_period_start DATE NOT NULL,
    billing_period_end DATE NOT NULL,

    -- Summary Totals
    total_prints INT NOT NULL DEFAULT 0,
    total_pages INT NOT NULL DEFAULT 0,
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    discount_percentage DECIMAL(5,2) DEFAULT 0.00,
    discount_amount DECIMAL(12,2) DEFAULT 0.00,
    tax_percentage DECIMAL(5,2) DEFAULT 0.00,
    tax_amount DECIMAL(12,2) DEFAULT 0.00,
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,

    -- Currency
    currency VARCHAR(3) DEFAULT 'INR',

    -- Status
    status ENUM('draft', 'generated', 'sent', 'paid', 'overdue', 'cancelled') DEFAULT 'draft',
    due_date DATE,
    paid_date DATE,
    payment_reference VARCHAR(100),

    -- Detailed Breakdown (JSON for flexibility)
    breakdown_by_location JSON COMMENT '{"location_id": {"name": "X", "prints": N, "pages": N, "cost": N}}',
    breakdown_by_paper JSON COMMENT '{"A4": {"grayscale": N, "color": N, "cost": N}}',
    breakdown_by_user JSON COMMENT '{"user_id": {"name": "X", "prints": N, "pages": N}}',
    breakdown_by_day JSON COMMENT '{"2025-01-01": {"prints": N, "pages": N, "cost": N}}',

    -- Notes
    notes TEXT,
    internal_notes TEXT COMMENT 'Private notes not shown to customer',

    -- Metadata
    generated_by INT,
    generated_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_license (license_id),
    INDEX idx_status (status),
    INDEX idx_period (billing_period_start, billing_period_end),
    INDEX idx_invoice_number (invoice_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Invoice line items (detailed breakdown)
CREATE TABLE IF NOT EXISTS invoice_items (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    invoice_id INT NOT NULL,

    -- What this line item represents
    item_type ENUM('print', 'adjustment', 'discount', 'tax', 'other') DEFAULT 'print',
    description VARCHAR(255) NOT NULL,

    -- Reference (for print items)
    location_id INT,
    location_name VARCHAR(100),
    paper_size VARCHAR(20),
    color_mode VARCHAR(20),

    -- Quantities and pricing
    quantity INT NOT NULL DEFAULT 0 COMMENT 'Number of pages',
    unit_price DECIMAL(10,4) NOT NULL DEFAULT 0,
    total_price DECIMAL(12,2) NOT NULL DEFAULT 0,

    -- Sort order
    sort_order INT DEFAULT 0,

    INDEX idx_invoice (invoice_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================================
-- 5. OFFLINE SYNC QUEUE
-- ============================================================================

-- Queue for syncing data when connection is restored
CREATE TABLE IF NOT EXISTS offline_sync_queue (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    machine_id VARCHAR(64) NOT NULL,

    -- Data info
    data_type VARCHAR(50) NOT NULL COMMENT 'print_log, activity, etc.',
    payload JSON NOT NULL COMMENT 'The actual data to sync',

    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Sync status
    sync_attempts INT DEFAULT 0,
    last_sync_attempt DATETIME,
    synced_at DATETIME,
    sync_status ENUM('pending', 'syncing', 'synced', 'failed') DEFAULT 'pending',
    sync_error TEXT COMMENT 'Error message if failed',

    INDEX idx_machine_status (machine_id, sync_status),
    INDEX idx_status (sync_status),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================================
-- 6. AGGREGATED DAILY STATS (FOR FASTER DASHBOARD QUERIES)
-- ============================================================================

-- Pre-aggregated daily statistics for fast dashboard loading
CREATE TABLE IF NOT EXISTS daily_print_stats (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    stat_date DATE NOT NULL,

    -- Grouping dimensions
    license_key VARCHAR(32),
    machine_id VARCHAR(64),
    location_id INT,
    user_id INT,

    -- Print Counts
    total_prints INT DEFAULT 0 COMMENT 'Number of print jobs',
    total_pages INT DEFAULT 0 COMMENT 'Total pages printed',
    successful_prints INT DEFAULT 0,
    failed_prints INT DEFAULT 0,
    cancelled_prints INT DEFAULT 0,

    -- By Paper Size
    a4_pages INT DEFAULT 0,
    a3_pages INT DEFAULT 0,
    letter_pages INT DEFAULT 0,
    other_pages INT DEFAULT 0,

    -- By Color Mode
    grayscale_pages INT DEFAULT 0,
    color_pages INT DEFAULT 0,

    -- Cost Tracking
    total_cost DECIMAL(12,2) DEFAULT 0.00,
    billed_cost DECIMAL(12,2) DEFAULT 0.00,
    unbilled_cost DECIMAL(12,2) DEFAULT 0.00,

    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY unique_daily_stat (stat_date, license_key, machine_id, location_id, user_id),
    INDEX idx_date (stat_date),
    INDEX idx_date_license (stat_date, license_key),
    INDEX idx_location (location_id),
    INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================================
-- 7. ADD LOCATION ASSIGNMENT TO USERS TABLE (if users table exists)
-- ============================================================================

-- Add default_location_id to users (only if column doesn't exist)
SET @dbname = DATABASE();
SET @tablename = 'users';
SET @columnname = 'default_location_id';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  "SELECT 1",
  CONCAT("ALTER TABLE ", @tablename, " ADD COLUMN ", @columnname, " INT NULL COMMENT 'Default location for this user'")
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- ============================================================================
-- 8. SYSTEM SETTINGS FOR PRINT TRACKING
-- ============================================================================

-- Insert print tracking related system settings (if system_settings table exists)
INSERT IGNORE INTO system_settings (setting_key, setting_value, setting_type, category, description) VALUES
('print_tracking_enabled', 'true', 'boolean', 'printing', 'Enable detailed print tracking'),
('print_tracking_offline_enabled', 'true', 'boolean', 'printing', 'Enable offline print queue'),
('print_billing_enabled', 'true', 'boolean', 'billing', 'Enable print billing system'),
('print_auto_invoice_day', '1', 'number', 'billing', 'Day of month to auto-generate invoices'),
('print_invoice_prefix', 'INV', 'string', 'billing', 'Invoice number prefix'),
('print_default_currency', 'INR', 'string', 'billing', 'Default currency for billing'),
('print_sync_interval_minutes', '5', 'number', 'printing', 'Interval to sync offline prints (minutes)');
