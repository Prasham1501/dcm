/**
 * SlotHistory — append-only JSON-Lines per-day log of print/receive events
 * for each printer slot. Stored under
 *   %APPDATA%\MediviewBridge\history\<slotId>\YYYY-MM-DD.jsonl
 *
 * The renderer reads these files via IPC (bridge:get-slot-history) and
 * filters them by date range (today, this month, this year).
 */
const fs = require('fs');
const path = require('path');

class SlotHistory {
  constructor({ historyRoot, logger }) {
    this.historyRoot = historyRoot;
    this.logger = logger || console;
    if (!fs.existsSync(historyRoot)) fs.mkdirSync(historyRoot, { recursive: true });
  }

  _dayFile(slotId, date = new Date()) {
    const dir = path.join(this.historyRoot, slotId);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return path.join(dir, `${y}-${m}-${d}.jsonl`);
  }

  /** Append one event. Best-effort — errors are logged, not thrown. */
  record(slotId, event) {
    try {
      const line = JSON.stringify({ ts: Date.now(), ...event }) + '\n';
      fs.appendFileSync(this._dayFile(slotId), line, 'utf8');
    } catch (e) {
      this.logger.error(`[SlotHistory] append failed for ${slotId}: ${e.message}`);
    }
  }

  /**
   * Read events for a slot between two timestamps (ms).
   * Returns an array of event objects sorted newest first.
   * Cap at `limit` to avoid huge payloads (default 1000).
   */
  read(slotId, { fromTs, toTs, limit = 1000 } = {}) {
    const dir = path.join(this.historyRoot, slotId);
    if (!fs.existsSync(dir)) return [];
    const from = new Date(fromTs);
    const to   = new Date(toTs);
    const events = [];
    // Iterate day files in [from..to]; cheap because at most ~365 files.
    const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    const end    = new Date(to.getFullYear(),   to.getMonth(),   to.getDate());
    while (cursor <= end) {
      const file = this._dayFile(slotId, cursor);
      if (fs.existsSync(file)) {
        try {
          const text = fs.readFileSync(file, 'utf8');
          for (const raw of text.split(/\r?\n/)) {
            if (!raw.trim()) continue;
            try {
              const evt = JSON.parse(raw);
              if (evt.ts >= fromTs && evt.ts <= toTs) events.push(evt);
            } catch { /* skip malformed line */ }
          }
        } catch (e) {
          this.logger.error(`[SlotHistory] read failed ${file}: ${e.message}`);
        }
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    events.sort((a, b) => b.ts - a.ts);
    return events.slice(0, limit);
  }
}

module.exports = { SlotHistory };
