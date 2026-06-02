/**
 * referringPhysicians — single source of truth for the referring-physician
 * dropdown shown in Create / Edit patient modals and the report editor.
 *
 *  Sources merged (deduplicated, case-insensitive):
 *    1. The user-curated list saved by Settings → Clinical
 *       (localStorage key `clinical-referring-physicians`).
 *    2. Distinct referring-physician names found on patients currently
 *       in the patient store — i.e. anything that came in via folder
 *       sync, network receiver, or Orthanc.
 */
import { usePatientStore } from '@/stores/patientStore';

const REFERRING_KEY = 'clinical-referring-physicians';

function loadStoredList(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(REFERRING_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((s: unknown): s is string => typeof s === 'string' && s.trim().length > 0) : [];
  } catch {
    return [];
  }
}

/** Returns the deduped, sorted union of stored list + names seen on
 *  patients in the patient store. Names are normalised (trimmed, ^/extra
 *  spaces collapsed) and compared case-insensitively. */
export function listReferringPhysicians(): string[] {
  const stored = loadStoredList();
  const patients = usePatientStore.getState().patients;
  const seen = new Set<string>();
  const out: string[] = [];

  const add = (raw: string | undefined | null) => {
    if (!raw) return;
    // DICOM PN can have caret separators (Last^First^Middle) — show as a
    // single line with spaces, like the rest of the UI does.
    const cleaned = String(raw).replace(/\^/g, ' ').replace(/\s+/g, ' ').trim();
    if (!cleaned) return;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(cleaned);
  };

  stored.forEach(add);
  for (const p of patients) add(p.referringPhysician);

  return out.sort((a, b) => a.localeCompare(b));
}

/** Append a new name to the user-curated list (idempotent). Use this when
 *  the operator types a fresh name on the Create form so it shows up in
 *  the dropdown next time. */
export function rememberReferringPhysician(name: string): void {
  const cleaned = String(name || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return;
  const stored = loadStoredList();
  if (stored.some((s) => s.toLowerCase() === cleaned.toLowerCase())) return;
  stored.push(cleaned);
  try { localStorage.setItem(REFERRING_KEY, JSON.stringify(stored)); } catch { /* quota — ignore */ }
}
