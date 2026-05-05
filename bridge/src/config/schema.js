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
    enabled: false,
    aeTitle: `BRIDGE_P${index}`,
    port: 7000 + index,
    windowsPrinterName: '',
    paperSize: 'A4',
    layoutId: 'auto',
    studyDebounceSeconds: 5,
    copies: 1,
  };
}

function defaultConfig() {
  return {
    version: 2,
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
  // Ensure branding always has all keys (new defaults added in future)
  if (cfg.branding) {
    cfg.branding = { ...DEFAULT_BRANDING, ...cfg.branding };
  }
  return cfg;
}

module.exports = { PAPER_SIZES, newSlotId, defaultSlot, defaultConfig, validateSlot, migrateConfig };
