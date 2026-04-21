-- Hospital Printers Assignment System
-- Migration 015: Store Windows/system printers assigned to hospitals
-- This allows restricting which printers users can access in the custom print dialog

-- ============================================================================
-- HOSPITAL PRINTERS TABLE
-- Stores Windows/system printers that are assigned to a hospital
-- ============================================================================

CREATE TABLE IF NOT EXISTS hospital_printers (
    id INT AUTO_INCREMENT PRIMARY KEY,

    -- Hospital/License link
    license_id INT NULL COMMENT 'Link to specific license/hospital, NULL for local installation',

    -- Printer Info (matches Windows system printer names)
    printer_name VARCHAR(255) NOT NULL COMMENT 'Exact Windows printer name (as reported by system)',
    display_name VARCHAR(255) COMMENT 'Friendly name to show in UI',
    description TEXT COMMENT 'Additional notes about this printer',

    -- Location (optional - for printer-per-room assignment)
    location_id INT NULL COMMENT 'Optional: assign printer to specific location/room',

    -- Settings
    is_default TINYINT(1) DEFAULT 0 COMMENT 'Is this the default printer for this hospital',
    is_active TINYINT(1) DEFAULT 1 COMMENT 'Is printer currently available',

    -- Printer capabilities (optional)
    supports_color TINYINT(1) DEFAULT 1 COMMENT 'Can print in color',
    supports_duplex TINYINT(1) DEFAULT 0 COMMENT 'Supports double-sided printing',
    default_paper_size VARCHAR(20) DEFAULT 'A4' COMMENT 'Default paper size for this printer',

    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP,
    created_by INT COMMENT 'User who added this printer',

    -- Foreign keys
    FOREIGN KEY (license_id) REFERENCES licenses(id) ON DELETE CASCADE,
    FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,

    -- Indexes
    INDEX idx_license (license_id),
    INDEX idx_location (location_id),
    INDEX idx_active (is_active),
    INDEX idx_printer_name (printer_name),

    -- Unique constraint: one printer name per hospital
    UNIQUE KEY unique_printer_per_hospital (license_id, printer_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insert some default entries for testing (optional)
-- These will be replaced with actual printers when admin configures them
