-- Mediview SaaS — Seed Data
-- Run AFTER 001_schema.sql:  mysql -u user -p mediview < 002_seed.sql
-- Edit SUPER_ADMIN_EMAIL below before running!

SET NAMES utf8mb4;

-- ─────────────────────────────────────────────────────────────────────────────
-- DEFAULT SETTINGS (all empty — fill in Admin Panel after deploy)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT IGNORE INTO settings (`key`, `value`) VALUES
-- Brand
('brand.name',          'Mediview'),
('brand.tagline',       'See more. Diagnose faster. Bill accurately.'),
('brand.support_email', ''),
('brand.phone',         ''),
('brand.address',       ''),
('brand.website',       ''),

-- SMTP (fill via Admin → Settings)
('smtp.host',           ''),
('smtp.port',           '587'),
('smtp.encryption',     'tls'),
('smtp.username',       ''),
('smtp.password',       ''),
('smtp.from_email',     ''),
('smtp.from_name',      'Mediview'),

-- Razorpay (fill via Admin → Settings)
('razorpay.key_id',       ''),
('razorpay.key_secret',   ''),
('razorpay.webhook_secret',''),
('razorpay.mode',         'test'),  -- test | live

-- Google OAuth
('google.client_id',    ''),

-- Gemini AI
('gemini.api_key',      ''),
('gemini.model',        'gemini-1.5-flash'),
('gemini.system_prompt','You are a helpful support assistant for Mediview, a professional DICOM medical imaging viewer. Help users with billing, license activation, technical issues, and product questions. Be concise and professional.'),

-- Pricing (INR)
('pricing.monthly_inr',  '8000'),
('pricing.annual_inr',   '100000'),
('pricing.trial_days',   '30'),
('pricing.trial_seats',  '1'),

-- Business / Invoice
('business.upi_id',      ''),
('business.bank_name',   ''),
('business.bank_account',''),
('business.bank_ifsc',   ''),

-- License
('license.hmac_secret',  ''),

-- App download
('app.exe_url',          ''),
('app.exe_version',      '1.0.0'),
('app.exe_changelog',    ''),

-- Features toggles
('feature.chat_enabled',     '1'),
('feature.referrals_enabled','1'),
('feature.ai_wallet_enabled','1');

-- ─────────────────────────────────────────────────────────────────────────────
-- SUPER ADMIN ACCOUNT
-- Change the email below to YOUR email before running!
-- After deploy, use /api/setup to set the password.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT IGNORE INTO accounts (id, name, plan, status, created_at) VALUES
('acc_superadmin00', 'Mediview Internal', 'enterprise', 'active', UTC_TIMESTAMP());

-- Password will be set via /api/setup endpoint on first visit.
-- This inserts a placeholder hash that will NOT work for login until setup runs.
INSERT IGNORE INTO users (id, account_id, name, email, password_hash, role, email_verified, created_at) VALUES
('usr_superadmin00', 'acc_superadmin00', 'Super Admin',
 'prashamk15@gmail.com',
 '$2y$12$AsUBady.MIRKOARMPYdWF.TuEyJmNWS9xjypy4RQPdfdtz5.FnAsa',
 'super_admin', 1, UTC_TIMESTAMP());

-- If the seed was already run with a placeholder, update in-place:
UPDATE users
SET email = 'prashamk15@gmail.com',
    password_hash = '$2y$12$AsUBady.MIRKOARMPYdWF.TuEyJmNWS9xjypy4RQPdfdtz5.FnAsa'
WHERE id = 'usr_superadmin00'
  AND (email = 'admin@mediview.in' OR password_hash LIKE '$2y$12$placeholder%');
