-- Migration: Add 'pcpndt' to print_type enum
-- This adds PCPNDT as a separate trackable print type

-- Modify the print_type enum to include 'pcpndt'
ALTER TABLE print_logs 
MODIFY COLUMN print_type ENUM('image', 'report', 'pcpndt') DEFAULT 'image';
