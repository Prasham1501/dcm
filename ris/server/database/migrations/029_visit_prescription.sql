-- Prescription attachment for a reception visit (image/PDF uploaded at registration).
ALTER TABLE ris_visits ADD COLUMN IF NOT EXISTS prescription_path VARCHAR(255) DEFAULT NULL;
ALTER TABLE ris_visits ADD COLUMN IF NOT EXISTS prescription_name VARCHAR(255) DEFAULT NULL;
