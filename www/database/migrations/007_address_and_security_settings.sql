-- Address Fields and Security Settings Migration
-- Add hospital address fields and private settings security PIN

-- Add hospital address fields to system_settings (simple key-value table)
INSERT IGNORE INTO system_settings (setting_key, setting_value)
VALUES
    ('hospital_address1', ''),
    ('hospital_address2', ''),
    ('hospital_address3', ''),
    ('hospital_city', ''),
    ('hospital_state', ''),
    ('hospital_pincode', '');

-- Security settings will be created dynamically when user sets up PIN