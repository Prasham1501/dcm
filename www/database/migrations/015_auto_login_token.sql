-- Migration: Add auto_login_token column for Electron auto-login feature
-- This token allows the Electron app to auto-login on restart without storing passwords

-- Add auto_login_token column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS auto_login_token VARCHAR(255) NULL AFTER password_hash;

-- Add index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_users_auto_login_token ON users(auto_login_token);
