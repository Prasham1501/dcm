/**
 * Simple rotating file logger.
 * Writes to %APPDATA%/MediviewBridge/logs/bridge-YYYY-MM-DD.log
 * Also tees to console and emits 'line' for live in-app log viewer.
 */

const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

class Logger extends EventEmitter {
  constructor({ logDir, retentionDays = 30, minLevel = 'info' }) {
    super();
    this.setMaxListeners(100);
    this.logDir = logDir;
    this.retentionDays = retentionDays;
    this.minLevel = LEVELS[minLevel] || LEVELS.info;
    this.currentDate = null;
    this.stream = null;
    this._ensureDir();
    this._pruneOld();
  }

  _ensureDir() {
    if (!fs.existsSync(this.logDir)) fs.mkdirSync(this.logDir, { recursive: true });
  }

  _filePathForDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return path.join(this.logDir, `bridge-${y}-${m}-${d}.log`);
  }

  _rotateIfNeeded() {
    const today = new Date();
    const key = today.toDateString();
    if (this.currentDate === key && this.stream) return;
    if (this.stream) { try { this.stream.end(); } catch (_) {} }
    this.currentDate = key;
    this.stream = fs.createWriteStream(this._filePathForDate(today), { flags: 'a' });
    this._pruneOld();
  }

  _pruneOld() {
    try {
      const cutoff = Date.now() - this.retentionDays * 86400 * 1000;
      for (const f of fs.readdirSync(this.logDir)) {
        if (!f.startsWith('bridge-') || !f.endsWith('.log')) continue;
        const full = path.join(this.logDir, f);
        const stat = fs.statSync(full);
        if (stat.mtimeMs < cutoff) fs.unlinkSync(full);
      }
    } catch (_) { /* best-effort */ }
  }

  _write(level, message) {
    if (LEVELS[level] < this.minLevel) return;
    const ts = new Date().toISOString();
    const line = `${ts} [${level.toUpperCase()}] ${message}`;
    try {
      this._rotateIfNeeded();
      this.stream.write(line + '\n');
    } catch (_) { /* best-effort */ }
    if (level === 'error' || level === 'warn') {
      console.error(line);
    } else {
      console.log(line);
    }
    this.emit('line', { ts, level, message });
  }

  debug(m) { this._write('debug', m); }
  info(m) { this._write('info', m); }
  warn(m) { this._write('warn', m); }
  error(m) { this._write('error', m); }

  // Read recent lines for the in-app log viewer
  tail(maxLines = 500) {
    try {
      const file = this._filePathForDate(new Date());
      if (!fs.existsSync(file)) return [];
      const text = fs.readFileSync(file, 'utf8');
      const lines = text.split(/\r?\n/).filter(Boolean);
      return lines.slice(-maxLines);
    } catch (_) { return []; }
  }

  close() {
    if (this.stream) { try { this.stream.end(); } catch (_) {} this.stream = null; }
  }
}

module.exports = { Logger };
