/**
 * Persistent JSON config store at %APPDATA%/AccurateBridge/config.json
 */

const fs = require('fs');
const path = require('path');
const { defaultConfig, migrateConfig } = require('./schema');

class ConfigStore {
  constructor({ configPath, logger }) {
    this.configPath = configPath;
    this.logger = logger;
    this.config = this._load();
  }

  _load() {
    try {
      if (fs.existsSync(this.configPath)) {
        const raw = fs.readFileSync(this.configPath, 'utf8').replace(/^\uFEFF/, '');
        const parsed = JSON.parse(raw);
        const merged = { ...defaultConfig(), ...parsed };
        const migrated = migrateConfig(merged);
        // Persist if migrated
        if (parsed.version !== migrated.version) {
          this.logger?.info(`[Config] migrated v${parsed.version || 1} → v${migrated.version}`);
          this._save(migrated);
        }
        return migrated;
      }
    } catch (e) {
      this.logger?.error(`[Config] failed to load: ${e.message}`);
    }
    const cfg = defaultConfig();
    this._save(cfg);
    return cfg;
  }

  _save(cfg) {
    try {
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.configPath, JSON.stringify(cfg, null, 2), 'utf8');
    } catch (e) {
      this.logger?.error(`[Config] failed to save: ${e.message}`);
    }
  }

  get() { return this.config; }

  update(partial) {
    this.config = { ...this.config, ...partial };
    this._save(this.config);
    return this.config;
  }

  upsertSlot(slot) {
    const slots = [...this.config.slots];
    const idx = slots.findIndex((s) => s.id === slot.id);
    if (idx >= 0) slots[idx] = slot; else slots.push(slot);
    return this.update({ slots });
  }

  removeSlot(slotId) {
    const slots = this.config.slots.filter((s) => s.id !== slotId);
    return this.update({ slots });
  }
}

module.exports = { ConfigStore };
