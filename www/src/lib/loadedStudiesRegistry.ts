/**
 * Cross-window registry of currently-loaded studies.
 *
 *  Each Electron BrowserWindow has its own React + Zustand state, so the
 *  Cloud-backup tab (opened from Config) can't see what's loaded in a
 *  separate viewer window. localStorage IS shared across same-origin
 *  renderer processes, so we use it as a tiny shared cache:
 *
 *    key:   `dcm-loaded-studies`
 *    value: { [studyKey]: { patient_name, patient_id, files, updated_at } }
 *
 *  Each viewer (main / CR / Dual) calls `recordLoadedStudy()` when it
 *  finishes loading a study. The cloud tab walks the object and dedupes.
 *
 *  Entries older than 24h are pruned on every write so the registry
 *  doesn't grow forever — backups only care about what's currently in
 *  view anyway.
 */

const KEY = 'dcm-loaded-studies';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

interface Entry {
  patient_name: string;
  patient_id:   string;
  files:        string[];
  /** Common parent directory of `files`. The server scans this folder to
   *  capture other studies the user has dropped alongside the currently-
   *  loaded one (e.g. multiple studies under a single Downloads/usg/). */
  folder?:      string;
  updated_at:   number;
}

/** Find the longest common path prefix of an array of file paths.
 *  Returns the directory portion (without trailing slash). */
function commonParent(paths: string[]): string {
  if (paths.length === 0) return '';
  const norm = paths.map((p) => p.replace(/\\/g, '/'));
  let prefix = norm[0];
  for (const p of norm.slice(1)) {
    let i = 0;
    while (i < prefix.length && i < p.length && prefix[i] === p[i]) i++;
    prefix = prefix.slice(0, i);
  }
  // Trim back to the last "/" so we end on a directory boundary.
  const slash = prefix.lastIndexOf('/');
  return slash > 0 ? prefix.slice(0, slash) : '';
}

function readAll(): Record<string, Entry> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const data = JSON.parse(raw);
    return (data && typeof data === 'object') ? data : {};
  } catch {
    return {};
  }
}

function writeAll(map: Record<string, Entry>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* quota etc — best-effort */
  }
}

function studyKey(viewer: string, patientId: string, files: string[]): string {
  // Combine viewer + patient + first file hash so re-loading the same
  // study in the same viewer overwrites the previous entry rather than
  // creating duplicates.
  return `${viewer}:${patientId || 'unknown'}:${files[0] || 'empty'}`;
}

export function recordLoadedStudy(input: {
  viewer:       'main' | 'cr' | 'dual-left' | 'dual-right';
  patient_name: string;
  patient_id:   string;
  files:        string[];
}): void {
  const files = input.files.filter(Boolean);
  if (files.length === 0) return;

  const all = readAll();
  // Prune stale entries (>24h) so the bundle doesn't include stuff the
  // operator stopped looking at days ago.
  const now = Date.now();
  for (const k of Object.keys(all)) {
    if (!all[k] || (now - (all[k].updated_at ?? 0)) > MAX_AGE_MS) {
      delete all[k];
    }
  }

  const folder = commonParent(files);
  all[studyKey(input.viewer, input.patient_id, files)] = {
    patient_name: input.patient_name || 'unknown',
    patient_id:   input.patient_id   || '',
    files,
    folder:       folder || undefined,
    updated_at:   now,
  };
  writeAll(all);
}

/** Returns the registry as the array shape the backup endpoint expects. */
export function listLoadedStudies(): Array<{ patient_name: string; patient_id: string; files: string[]; folder?: string }> {
  const all = readAll();
  // Dedupe by patient + file-set across viewers (the same study can be
  // open in CR and Dual simultaneously).
  const seen = new Set<string>();
  const out: Array<{ patient_name: string; patient_id: string; files: string[]; folder?: string }> = [];
  for (const entry of Object.values(all)) {
    if (!entry || !entry.files?.length) continue;
    const sig = `${entry.patient_id}|${entry.files.join(',')}`;
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push({
      patient_name: entry.patient_name,
      patient_id:   entry.patient_id,
      files:        entry.files,
      folder:       entry.folder,
    });
  }
  return out;
}

/** Unique list of parent folders across every recorded study — the server
 *  will scan each one for additional DICOMs that aren't currently loaded
 *  in a viewer (the "3 studies in one folder" case). */
export function listLoadedStudyFolders(): string[] {
  const all = readAll();
  const set = new Set<string>();
  for (const e of Object.values(all)) {
    if (e?.folder) set.add(e.folder);
  }
  return Array.from(set);
}

export function clearLoadedStudiesRegistry(): void {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
