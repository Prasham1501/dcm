-- Bridge offline recharge log
-- Records every voucher issued from bridge-voucher.php
CREATE TABLE IF NOT EXISTS bridge_recharges (
  id            VARCHAR(16)  NOT NULL,
  request_id    VARCHAR(64)  NOT NULL,
  fingerprint   VARCHAR(64)  NOT NULL DEFAULT '',
  license_key   VARCHAR(64)  NOT NULL DEFAULT 'TRIAL',
  prints_granted INT UNSIGNED NOT NULL DEFAULT 0,
  voucher_id    VARCHAR(64)  NOT NULL DEFAULT '',
  created_at    DATETIME     NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_request (request_id),
  KEY idx_fingerprint (fingerprint),
  KEY idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
