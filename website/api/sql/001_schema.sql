-- Mediview SaaS — Full MySQL Schema
-- Run this once against your database: mysql -u user -p mediview < 001_schema.sql
-- All IDs are 16-char hex strings (bin2hex(random_bytes(8)))
-- All timestamps stored as DATETIME in UTC

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- ─────────────────────────────────────────────────────────────────────────────
-- ACCOUNTS & USERS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS accounts (
  id          VARCHAR(32)  NOT NULL PRIMARY KEY,
  name        VARCHAR(255) NOT NULL DEFAULT '',
  plan        VARCHAR(50)  NOT NULL DEFAULT 'free',
  status      VARCHAR(30)  NOT NULL DEFAULT 'active',  -- active | suspended
  referral_code VARCHAR(20) NULL UNIQUE,
  referred_by   VARCHAR(32) NULL,
  created_at  DATETIME     NOT NULL,
  updated_at  DATETIME     NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id              VARCHAR(32)  NOT NULL PRIMARY KEY,
  account_id      VARCHAR(32)  NOT NULL,
  name            VARCHAR(255) NOT NULL,
  email           VARCHAR(255) NOT NULL UNIQUE,
  password_hash   VARCHAR(255) NULL,                -- NULL for Google-only users
  role            VARCHAR(30)  NOT NULL DEFAULT 'admin', -- super_admin | admin | member
  google_sub      VARCHAR(100) NULL,
  avatar_url      VARCHAR(500) NULL,
  email_verified  TINYINT(1)   NOT NULL DEFAULT 0,
  last_login_at   DATETIME     NULL,
  last_login_ip   VARCHAR(45)  NULL,
  created_at      DATETIME     NOT NULL,
  updated_at      DATETIME     NULL,
  INDEX idx_users_account (account_id),
  INDEX idx_users_email   (email),
  INDEX idx_users_google  (google_sub)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────────────────────
-- AUTH TOKENS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS email_verifications (
  id         VARCHAR(32)  NOT NULL PRIMARY KEY,
  user_id    VARCHAR(32)  NOT NULL,
  token      VARCHAR(128) NOT NULL UNIQUE,
  expires_at DATETIME     NOT NULL,
  used_at    DATETIME     NULL,
  INDEX idx_ev_token (token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS password_resets (
  id         VARCHAR(32)  NOT NULL PRIMARY KEY,
  email      VARCHAR(255) NOT NULL,
  token      VARCHAR(128) NOT NULL UNIQUE,
  expires_at DATETIME     NOT NULL,
  used_at    DATETIME     NULL,
  INDEX idx_pr_token (token),
  INDEX idx_pr_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS team_invites (
  id          VARCHAR(32)  NOT NULL PRIMARY KEY,
  account_id  VARCHAR(32)  NOT NULL,
  email       VARCHAR(255) NOT NULL,
  role        VARCHAR(30)  NOT NULL DEFAULT 'member',
  token       VARCHAR(128) NOT NULL UNIQUE,
  invited_by  VARCHAR(32)  NOT NULL,
  created_at  DATETIME     NOT NULL,
  expires_at  DATETIME     NOT NULL,
  used_at     DATETIME     NULL,
  INDEX idx_ti_account (account_id),
  INDEX idx_ti_token   (token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────────────────────────────────────
-- LICENSES & DEVICES
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS licenses (
  id              VARCHAR(32)  NOT NULL PRIMARY KEY,
  account_id      VARCHAR(32)  NOT NULL,
  key_code        VARCHAR(24)  NOT NULL UNIQUE,        -- MV-XXXX-XXXX-XXXX-XXXX
  plan            VARCHAR(50)  NOT NULL,               -- trial | monthly | annual | enterprise
  seats           INT          NOT NULL DEFAULT 1,
  status          VARCHAR(30)  NOT NULL DEFAULT 'active', -- active | expired | revoked
  starts_at       DATETIME     NOT NULL,
  expires_at      DATETIME     NULL,                   -- NULL = perpetual
  hmac_signature  VARCHAR(128) NULL,
  invoice_id      VARCHAR(32)  NULL,
  notes           TEXT         NULL,
  created_at      DATETIME     NOT NULL,
  INDEX idx_lic_account  (account_id),
  INDEX idx_lic_key_code (key_code),
  INDEX idx_lic_status   (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS devices (
  id                 VARCHAR(32)  NOT NULL PRIMARY KEY,
  license_id         VARCHAR(32)  NOT NULL,
  account_id         VARCHAR(32)  NOT NULL,
  fingerprint        VARCHAR(128) NOT NULL,
  machine_name       VARCHAR(255) NOT NULL DEFAULT 'Unknown',
  os                 VARCHAR(100) NULL,
  app_version        VARCHAR(50)  NULL,
  status             VARCHAR(30)  NOT NULL DEFAULT 'active', -- active | deactivated
  activated_at       DATETIME     NOT NULL,
  deactivated_at     DATETIME     NULL,
  last_heartbeat_at  DATETIME     NULL,
  last_ip            VARCHAR(45)  NULL,
  INDEX idx_dev_license     (license_id),
  INDEX idx_dev_account     (account_id),
  INDEX idx_dev_fingerprint (license_id, fingerprint)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────────────────────────────────────
-- WALLETS & TRANSACTIONS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS wallets (
  account_id    VARCHAR(32) NOT NULL,
  type          VARCHAR(20) NOT NULL,   -- print | ai
  balance       INT         NOT NULL DEFAULT 0,
  threshold     INT         NOT NULL DEFAULT 200,
  auto_recharge TINYINT(1)  NOT NULL DEFAULT 0,
  auto_amount   INT         NOT NULL DEFAULT 1000,
  updated_at    DATETIME    NULL,
  PRIMARY KEY (account_id, type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS transactions (
  id             VARCHAR(32)  NOT NULL PRIMARY KEY,
  account_id     VARCHAR(32)  NOT NULL,
  wallet_type    VARCHAR(20)  NOT NULL,
  kind           VARCHAR(20)  NOT NULL,  -- topup | spend | refund | bonus
  credits_delta  INT          NOT NULL,
  balance_after  INT          NOT NULL,
  amount_inr     DECIMAL(10,2) NULL,
  payment_id     VARCHAR(32)  NULL,
  invoice_id     VARCHAR(32)  NULL,
  meta           TEXT         NULL,
  created_at     DATETIME     NOT NULL,
  INDEX idx_txn_account (account_id, wallet_type),
  INDEX idx_txn_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────────────────────────────────────
-- PAYMENTS & INVOICES
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payments (
  id              VARCHAR(32)   NOT NULL PRIMARY KEY,
  account_id      VARCHAR(32)   NOT NULL,
  purpose         VARCHAR(50)   NOT NULL,   -- license | print_topup | ai_topup
  rzp_order_id    VARCHAR(100)  NOT NULL UNIQUE,
  rzp_payment_id  VARCHAR(100)  NULL,
  rzp_signature   VARCHAR(255)  NULL,
  amount_inr      DECIMAL(10,2) NOT NULL,
  status          VARCHAR(30)   NOT NULL DEFAULT 'created', -- created | captured | failed | refunded
  meta            TEXT          NULL,
  invoice_id      VARCHAR(32)   NULL,
  created_at      DATETIME      NOT NULL,
  captured_at     DATETIME      NULL,
  INDEX idx_pay_account  (account_id),
  INDEX idx_pay_rzp_ord  (rzp_order_id),
  INDEX idx_pay_status   (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS invoices (
  id           VARCHAR(32)   NOT NULL PRIMARY KEY,
  account_id   VARCHAR(32)   NOT NULL,
  number       VARCHAR(30)   NOT NULL UNIQUE,  -- MV-2025-0001
  payment_id   VARCHAR(100)  NULL,
  subtotal_inr DECIMAL(10,2) NOT NULL DEFAULT 0,
  gst_inr      DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_inr    DECIMAL(10,2) NOT NULL DEFAULT 0,
  items_json   TEXT          NULL,
  status       VARCHAR(20)   NOT NULL DEFAULT 'paid',
  notes        TEXT          NULL,
  created_at   DATETIME      NOT NULL,
  INDEX idx_inv_account (account_id),
  INDEX idx_inv_number  (number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────────────────────────────────────
-- SUPPORT
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tickets (
  id          VARCHAR(32)  NOT NULL PRIMARY KEY,
  account_id  VARCHAR(32)  NOT NULL,
  user_id     VARCHAR(32)  NOT NULL,
  category    VARCHAR(50)  NOT NULL,
  subject     VARCHAR(255) NOT NULL,
  status      VARCHAR(20)  NOT NULL DEFAULT 'open',  -- open | waiting | closed
  created_at  DATETIME     NOT NULL,
  closed_at   DATETIME     NULL,
  INDEX idx_tick_account (account_id),
  INDEX idx_tick_status  (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ticket_messages (
  id          VARCHAR(32)  NOT NULL PRIMARY KEY,
  ticket_id   VARCHAR(32)  NOT NULL,
  sender_role VARCHAR(20)  NOT NULL,  -- user | admin
  sender_id   VARCHAR(32)  NOT NULL,
  body        TEXT         NOT NULL,
  attachments TEXT         NULL,      -- JSON array of file paths
  created_at  DATETIME     NOT NULL,
  INDEX idx_tm_ticket (ticket_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS bugs (
  id          VARCHAR(32)  NOT NULL PRIMARY KEY,
  account_id  VARCHAR(32)  NOT NULL,
  user_id     VARCHAR(32)  NOT NULL,
  title       VARCHAR(255) NOT NULL,
  description TEXT         NOT NULL,
  severity    VARCHAR(20)  NOT NULL DEFAULT 'medium', -- low | medium | high | critical
  status      VARCHAR(30)  NOT NULL DEFAULT 'open',   -- open | in_progress | resolved | wontfix
  attachments TEXT         NULL,
  created_at  DATETIME     NOT NULL,
  resolved_at DATETIME     NULL,
  INDEX idx_bug_account (account_id),
  INDEX idx_bug_status  (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────────────────────────────────────
-- AUDIT & API KEYS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_logs (
  id          VARCHAR(32)  NOT NULL PRIMARY KEY,
  account_id  VARCHAR(32)  NULL,
  user_id     VARCHAR(32)  NULL,
  actor_name  VARCHAR(255) NOT NULL DEFAULT 'system',
  action      VARCHAR(100) NOT NULL,
  target      VARCHAR(255) NULL,
  meta        TEXT         NULL,
  ip          VARCHAR(45)  NULL,
  created_at  DATETIME     NOT NULL,
  INDEX idx_audit_account (account_id),
  INDEX idx_audit_action  (action),
  INDEX idx_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS api_keys (
  id          VARCHAR(32)  NOT NULL PRIMARY KEY,
  account_id  VARCHAR(32)  NOT NULL,
  user_id     VARCHAR(32)  NOT NULL,
  label       VARCHAR(255) NOT NULL,
  prefix      VARCHAR(16)  NOT NULL UNIQUE,  -- first 12 chars of plain key
  key_hash    VARCHAR(255) NOT NULL,         -- bcrypt of full plain key
  last_used_at DATETIME    NULL,
  revoked_at  DATETIME     NULL,
  created_at  DATETIME     NOT NULL,
  INDEX idx_ak_account (account_id),
  INDEX idx_ak_prefix  (prefix)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────────────────────────────────────
-- REFERRALS & ANALYTICS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS referrals (
  id              VARCHAR(32)  NOT NULL PRIMARY KEY,
  account_id      VARCHAR(32)  NOT NULL UNIQUE,
  code            VARCHAR(20)  NOT NULL UNIQUE,
  signups         INT          NOT NULL DEFAULT 0,
  credits_earned  INT          NOT NULL DEFAULT 0,
  created_at      DATETIME     NOT NULL,
  INDEX idx_ref_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS analytics_events (
  id         VARCHAR(32)  NOT NULL PRIMARY KEY,
  account_id VARCHAR(32)  NULL,
  event      VARCHAR(100) NOT NULL,
  meta       TEXT         NULL,
  ip         VARCHAR(45)  NULL,
  ua         VARCHAR(500) NULL,
  created_at DATETIME     NOT NULL,
  INDEX idx_ae_account (account_id),
  INDEX idx_ae_event   (event),
  INDEX idx_ae_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────────────────────────────────────
-- CHAT & CONTACT
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS chat_conversations (
  id         VARCHAR(32)  NOT NULL PRIMARY KEY,
  account_id VARCHAR(32)  NOT NULL,
  user_id    VARCHAR(32)  NOT NULL,
  created_at DATETIME     NOT NULL,
  updated_at DATETIME     NULL,
  INDEX idx_chat_account (account_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS chat_messages (
  id              VARCHAR(32) NOT NULL PRIMARY KEY,
  conversation_id VARCHAR(32) NOT NULL,
  role            VARCHAR(20) NOT NULL,  -- user | model
  body            TEXT        NOT NULL,
  tokens_in       INT         NULL,
  tokens_out      INT         NULL,
  created_at      DATETIME    NOT NULL,
  INDEX idx_cm_conv (conversation_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS contact_submissions (
  id         VARCHAR(32)  NOT NULL PRIMARY KEY,
  name       VARCHAR(255) NOT NULL,
  email      VARCHAR(255) NOT NULL,
  subject    VARCHAR(255) NULL,
  message    TEXT         NOT NULL,
  ip         VARCHAR(45)  NULL,
  created_at DATETIME     NOT NULL,
  INDEX idx_cs_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────────────────────────────────────
-- SETTINGS & INFRA
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS settings (
  `key`       VARCHAR(100) NOT NULL PRIMARY KEY,
  `value`     TEXT         NOT NULL DEFAULT '',
  updated_by  VARCHAR(32)  NULL,
  updated_at  DATETIME     NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS rate_limits (
  `key`        VARCHAR(200) NOT NULL PRIMARY KEY,
  hits         INT          NOT NULL DEFAULT 1,
  window_start INT          NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS jobs (
  id          VARCHAR(32)  NOT NULL PRIMARY KEY,
  type        VARCHAR(100) NOT NULL,
  payload     TEXT         NULL,
  status      VARCHAR(20)  NOT NULL DEFAULT 'pending',  -- pending | done | failed
  attempts    INT          NOT NULL DEFAULT 0,
  run_at      DATETIME     NOT NULL,
  done_at     DATETIME     NULL,
  error       TEXT         NULL,
  INDEX idx_jobs_status (status, run_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
