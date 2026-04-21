-- Add print_type column to differentiate between DICOM image prints and medical report prints
-- Migration 013: Print Type Differentiation

-- Add print_type column to print_logs table
ALTER TABLE print_logs
ADD COLUMN print_type ENUM('image', 'report') NOT NULL DEFAULT 'image' 
COMMENT 'Type of print: image for DICOM images, report for medical reports'
AFTER layout_type;

-- Add index for faster filtering by print_type
ALTER TABLE print_logs
ADD INDEX idx_print_type (print_type);

-- Add compound index for type + date queries
ALTER TABLE print_logs
ADD INDEX idx_type_date (print_type, queued_at);

-- Update daily_print_stats to include print type breakdown
ALTER TABLE daily_print_stats
ADD COLUMN image_prints INT DEFAULT 0 COMMENT 'Number of image print jobs',
ADD COLUMN report_prints INT DEFAULT 0 COMMENT 'Number of report print jobs';
