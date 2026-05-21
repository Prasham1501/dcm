/**
 * BridgeConfig schema + defaults.
 * Each PrinterSlot binds an AE title + TCP port to a Windows printer + paper + layout.
 */

const crypto = require('crypto');
const { DEFAULT_BRANDING } = require('./defaultBranding');

const PAPER_SIZES = ['A3', 'A4', 'A5', 'Letter', 'Legal'];

function newSlotId() {
  return crypto.randomBytes(8).toString('hex');
}

function defaultSlot(index = 1) {
  return {
    id: newSlotId(),
    name: `Printer ${index}`,
    // New slots come up enabled so the listener starts right away.
    enabled: true,
    aeTitle: `MVBRIDGE_P${index}`,
    // Bind to all interfaces by default; users on multi-NIC hospital LANs
    // can pin this to a specific IP per slot.
    bindHost: '0.0.0.0',
    port: 7000 + index,
    windowsPrinterName: '',
    paperSize: 'A4',
    // layoutId is auto-selected from image count; UI no longer surfaces it.
    layoutId: 'auto',
    // studyDebounceSeconds + copies kept in schema for backward compat,
    // but removed from the UI per product spec.
    studyDebounceSeconds: 5,
    copies: 1,
    // Print-quota system (sell-by-print model). When quotaEnabled is false
    // the slot prints unlimited (software licence). When true, each printed
    // page decrements quotaRemaining; UI warns at <=50 and blocks at 0.
    quotaEnabled: false,
    quotaRemaining: 0,
    quotaTotal: 0,
  };
}

function defaultConfig() {
  return {
    version: 6,
    slots: [],
    startupBehavior: 'tray',
    logRetentionDays: 30,
    branding: { ...DEFAULT_BRANDING },
  };
}

function validateSlot(slot) {
  const errors = [];
  if (!slot.aeTitle || slot.aeTitle.length > 16) errors.push('aeTitle must be 1-16 chars');
  if (!Number.isInteger(slot.port) || slot.port < 1 || slot.port > 65535) errors.push('port must be 1-65535');
  if (slot.bindHost && !/^(\d{1,3}\.){3}\d{1,3}$/.test(slot.bindHost)) errors.push('bindHost must be a valid IPv4 address (e.g. 192.168.1.50) or 0.0.0.0');
  if (!PAPER_SIZES.includes(slot.paperSize)) errors.push(`paperSize must be one of ${PAPER_SIZES.join(', ')}`);
  if (!slot.layoutId) errors.push('layoutId required');
  // 'auto' is a valid special value (auto-select best layout based on image count)
  if (!Number.isInteger(slot.studyDebounceSeconds) || slot.studyDebounceSeconds < 1) errors.push('studyDebounceSeconds must be >=1');
  if (!Number.isInteger(slot.copies) || slot.copies < 1 || slot.copies > 10) errors.push('copies must be 1-10');
  return errors;
}

/**
 * Migrate older config versions to current.
 * v1 → v2: adds branding object with defaults.
 */
function migrateConfig(cfg) {
  if (!cfg.version || cfg.version < 2) {
    cfg.branding = { ...DEFAULT_BRANDING, ...(cfg.branding || {}) };
    cfg.version = 2;
  }
  // v2 → v3: AE title prefix BRIDGE_P → MVBRIDGE_P (product rename to "Mediview Bridge").
  // Existing modalities will need their destination AET updated, but new installs
  // and re-saved slots use the new prefix.
  if (cfg.version < 3) {
    for (const s of (cfg.slots || [])) {
      if (typeof s.aeTitle === 'string' && /^BRIDGE_P\d+$/.test(s.aeTitle)) {
        s.aeTitle = s.aeTitle.replace(/^BRIDGE_P/, 'MVBRIDGE_P');
      }
    }
    cfg.version = 3;
  }
  // v3 → v4: per-slot bind host (defaults to 0.0.0.0 so existing behavior
  // is preserved).
  if (cfg.version < 4) {
    for (const s of (cfg.slots || [])) {
      if (!s.bindHost) s.bindHost = '0.0.0.0';
    }
    cfg.version = 4;
  }
  // v4 → v6: per-slot print quota fields. v5 was footer migration (kept).
  // v5 → v6: add quotaEnabled / quotaRemaining / quotaTotal defaults.
  if (cfg.version < 5) {
    const b = cfg.branding;
    if (b && b.footerLayout) {
      for (const slot of ['left', 'center', 'right']) {
        const v = b.footerLayout[slot];
        if (typeof v === 'string') {
          if (!v || v === 'none') b.footerLayout[slot] = [];
          else {
            const item = { type: v };
            if (v === 'custom') item.customText = b[`customFooter${slot[0].toUpperCase()}${slot.slice(1)}`] || '';
            b.footerLayout[slot] = [item];
          }
        } else if (!Array.isArray(v)) {
          b.footerLayout[slot] = [];
        }
      }
    }
    cfg.version = 5;
  }
  if (cfg.version < 6) {
    for (const s of (cfg.slots || [])) {
      if (typeof s.quotaEnabled !== 'boolean') s.quotaEnabled = false;
      if (typeof s.quotaRemaining !== 'number') s.quotaRemaining = 0;
      if (typeof s.quotaTotal     !== 'number') s.quotaTotal = 0;
    }
    cfg.version = 6;
  }
  if (cfg.branding) {
    cfg.branding = { ...DEFAULT_BRANDING, ...cfg.branding };
  }
  return cfg;
}

module.exports = { PAPER_SIZES, newSlotId, defaultSlot, defaultConfig, validateSlot, migrateConfig };
