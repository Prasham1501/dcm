/**
 * Per-slot debounced job queue.
 *
 * Rule: when files arrive on a slot, group them by StudyInstanceUID. Reset a
 * timer (slot.studyDebounceSeconds) every time a new file lands for that
 * study. When the timer expires, that study is "complete" and we hand the
 * full set of files to the print worker as one job.
 *
 * StudyInstanceUID is read from the DICOM dataset by the renderer; here we
 * receive it via the SCP 'file' event payload only when it's already known.
 * To keep this module decoupled from dicom-parser we instead group purely
 * by the file's first-seen study UID — the renderer module supplies that
 * via parseStudyUid().
 */

const path = require('path');
const fs = require('fs');
const { EventEmitter } = require('events');

class JobQueue extends EventEmitter {
  constructor({ logger, parseStudyUid, printWorker, printedRoot, failedRoot }) {
    super();
    this.logger = logger;
    this.parseStudyUid = parseStudyUid;
    this.printWorker = printWorker;
    this.printedRoot = printedRoot;
    this.failedRoot = failedRoot;
    // Map<slotId, Map<studyUid, { slot, files: [{filepath, info}], timer }>>
    this.studies = new Map();
    this.processing = false;
    this.queue = [];
  }

  enqueueFile(slot, info) {
    let studyUid = '';
    try { studyUid = this.parseStudyUid(info.filepath) || ''; }
    catch (e) { this.logger.warn(`[Queue] parseStudyUid failed: ${e?.exception || e?.message || String(e)}`); }
    if (!studyUid) studyUid = `unknown-${info.sopInstanceUid}`;

    if (!this.studies.has(slot.id)) this.studies.set(slot.id, new Map());
    const slotStudies = this.studies.get(slot.id);

    let entry = slotStudies.get(studyUid);
    if (!entry) {
      entry = { slot, studyUid, files: [], timer: null };
      slotStudies.set(studyUid, entry);
    }
    entry.files.push({ filepath: info.filepath, info });
    this.logger.info(`[Queue] slot=${slot.name} study=${studyUid} files=${entry.files.length}`);

    if (entry.timer) clearTimeout(entry.timer);
    entry.timer = setTimeout(() => this._finalizeStudy(slot, studyUid), slot.studyDebounceSeconds * 1000);
  }

  _finalizeStudy(slot, studyUid) {
    const slotStudies = this.studies.get(slot.id);
    if (!slotStudies) return;
    const entry = slotStudies.get(studyUid);
    if (!entry) return;
    slotStudies.delete(studyUid);
    this.queue.push({ slot, studyUid, files: entry.files });
    this._tick();
  }

  async _tick() {
    if (this.processing) return;
    this.processing = true;
    while (this.queue.length > 0) {
      const job = this.queue.shift();
      try {
        this.logger.info(`[Queue] printing slot=${job.slot.name} study=${job.studyUid} files=${job.files.length}`);
        const result = await this.printWorker.print(job);
        this.logger.info(`[Queue] printed slot=${job.slot.name} pages=${result.pages}`);
        this._move(job.files, this.printedRoot);
        this.emit('printed', { ...job, result });
      } catch (e) {
        this.logger.error(`[Queue] print failed slot=${job.slot.name}: ${e.message}`);
        this._move(job.files, this.failedRoot);
        this.emit('failed', { ...job, error: e.message });
      }
    }
    this.processing = false;
  }

  _move(files, targetRoot) {
    // Fire-and-forget; don't block the print pipeline
    const ymd = new Date().toISOString().slice(0, 10);
    const dir = path.join(targetRoot, ymd);
    fs.promises.mkdir(dir, { recursive: true }).then(() => {
      for (const f of files) {
        fs.promises.rename(f.filepath, path.join(dir, path.basename(f.filepath)))
          .catch(() => {});
      }
    }).catch(e => this.logger.warn(`[Queue] move root failed: ${e.message}`));
  }
}

module.exports = { JobQueue };
