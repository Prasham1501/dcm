/**
 * SlotManager — owns one DicomScp listener per enabled printer slot
 * and routes received files into the print job queue.
 */

const path = require('path');
const fs = require('fs');
const { EventEmitter } = require('events');
const { DicomScp } = require('./dicomScp');

class SlotManager extends EventEmitter {
  constructor({ incomingRoot, archiveRoot, logger, jobQueue }) {
    super();
    this.incomingRoot = incomingRoot;
    this.archiveRoot = archiveRoot; // optional: save copies to bridge/received/
    this.logger = logger;
    this.jobQueue = jobQueue;
    this.scps = new Map(); // slotId -> DicomScp
  }

  async syncFromConfig(slots) {
    const wanted = new Set(slots.filter((s) => s.enabled).map((s) => s.id));

    // Stop SCPs for slots that are no longer enabled / removed
    for (const [slotId, scp] of this.scps.entries()) {
      const slot = slots.find((s) => s.id === slotId);
      if (!wanted.has(slotId) || !slot ||
          slot.aeTitle !== scp.aeTitle || slot.port !== scp.port ||
          (slot.bindHost || '0.0.0.0') !== scp.bindHost) {
        await scp.stop();
        this.scps.delete(slotId);
      }
    }

    // Start SCPs for newly-enabled slots
    for (const slot of slots) {
      if (!slot.enabled) continue;
      if (this.scps.has(slot.id)) continue;
      await this._startSlot(slot);
    }
  }

  async _startSlot(slot) {
    const storageDir = path.join(this.incomingRoot, slot.id);
    const scp = new DicomScp({
      aeTitle: slot.aeTitle,
      port: slot.port,
      bindHost: slot.bindHost || '0.0.0.0',
      storageDir,
      logger: this.logger,
    });

    scp.on('file', (info) => {
      this.jobQueue.enqueueFile(slot, info);
      this.emit('file', { slot, info });
      // Archive a copy into bridge/received/<slotName>/ (async to avoid blocking)
      if (this.archiveRoot) {
        const archiveDir = path.join(this.archiveRoot, slot.name || slot.id);
        const dest = path.join(archiveDir, path.basename(info.filepath));
        fs.promises.mkdir(archiveDir, { recursive: true })
          .then(() => fs.promises.copyFile(info.filepath, dest))
          .catch((copyErr) => {
            this.logger.error(`[SlotManager] archive copy failed: ${copyErr.message}`);
          });
      }
    });

    scp.on('error', (err) => {
      this.emit('slot-error', { slot, error: err.message });
    });

    scp.on('echo', (info) => {
      this.emit('echo', { slot, info });
    });

    try {
      await scp.start();
      this.scps.set(slot.id, scp);
    } catch (e) {
      this.logger.error(`[SlotManager] failed to start slot ${slot.name}: ${e.message}`);
      this.emit('slot-error', { slot, error: e.message });
    }
  }

  async stopAll() {
    for (const scp of this.scps.values()) await scp.stop();
    this.scps.clear();
  }

  getStatus() {
    return Array.from(this.scps.entries()).map(([slotId, scp]) => ({
      slotId,
      aeTitle: scp.aeTitle,
      port: scp.port,
      listening: scp.server !== null,
    }));
  }
}

module.exports = { SlotManager };
