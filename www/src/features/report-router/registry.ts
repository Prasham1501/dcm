/**
 * Registry of all known report types.
 *
 * To add a new modality (Mammography, Cardiology, MSK, etc.):
 *   1. Implement a ReportTypeDef object below.
 *   2. Push it into REPORT_TYPES.
 *
 * Detection follows the DICOM tag convention:
 *   - Modality (0008,0060)            : 'US', 'CT', 'MR', 'MG', 'CR', 'DX', …
 *   - StudyDescription (0008,1030)    : free text – we keyword-match
 *   - BodyPartExamined (0018,0015)    : 'FETUS', 'BREAST', 'CHEST', …
 */
import type { ReportTypeDef, DetectionResult } from './types';
import { useReportStore } from '@/stores/reportStore';

// ── Helpers ──────────────────────────────────────────────────────────────────
const norm = (s: string | null | undefined) => (s ?? '').toUpperCase();

/** True if any keyword from `keywords` appears in `haystack`. */
const hasKeyword = (haystack: string, keywords: readonly string[]): boolean => {
  const h = norm(haystack);
  return keywords.some((k) => h.includes(k.toUpperCase()));
};

// ── Fetal Medicine ───────────────────────────────────────────────────────────
const FETAL_KEYWORDS = [
  'OB',        // OB / OBS
  'OBSTETR',   // OBSTETRIC, OBSTETRICS, OBSTETRICAL
  'FETAL',
  'FETUS',
  'FOETAL',
  'PRENATAL',
  'ANTENATAL',
  'PREGNANCY',
  'GRAVID',
  'NUCHAL',
  'NT SCAN',
  ' NT ',
  'FTS',        // First Trimester Scan
  'ANC',        // Ante-Natal Care
  'ANOMALY',
  'GESTATION',
  'TIFFA',      // Targeted Imaging for Fetal Anomalies
  'CRL',
  'BIOPHYSICAL',
] as const;

const FETAL_BODY_PARTS = ['FETUS', 'UTERUS', 'PLACENTA'] as const;

export const fetalMedicineType: ReportTypeDef = {
  id: 'fetal',
  name: 'Fetal Medicine',
  description: 'Obstetric / fetal ultrasound — biometry, structural assessment, risk calculators',
  iconName: 'Baby',
  accent: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',

  detect(patient): DetectionResult {
    const modality = norm(patient.modality);
    const desc = norm(patient.studyDescription);

    // Must be ultrasound to even consider fetal
    if (modality && modality !== 'US') {
      return { typeId: 'fetal', confidence: 'none' };
    }

    // High confidence: explicit fetal/OB keyword in description
    if (hasKeyword(desc, FETAL_KEYWORDS)) {
      return {
        typeId: 'fetal',
        confidence: 'high',
        reason: 'Study description matches fetal/obstetric keywords',
      };
    }

    // High confidence: body part is fetus/uterus/placenta
    if (hasKeyword(desc, FETAL_BODY_PARTS)) {
      return {
        typeId: 'fetal',
        confidence: 'high',
        reason: 'Body part indicates fetal study',
      };
    }

    // Medium: it IS ultrasound, but no fetal keywords — could be abdominal, etc.
    if (modality === 'US') {
      return {
        typeId: 'fetal',
        confidence: 'medium',
        reason: 'Ultrasound study — could be fetal',
      };
    }

    return { typeId: 'fetal', confidence: 'none' };
  },

  hasExistingReports(_patient) {
    // Phase 1+ stub: use the store later. For now, pretend none exist client-side.
    // TODO: hit /api/fetal/examinations.php?patient_id=… and cache.
    return false;
  },

  openCreate(ctx, patient) {
    // Fetal panel only renders on the CR Viewer page — navigate there first
    // (no-op if already there) so the panel has a host regardless of where
    // the user clicked Report from.
    if (typeof window !== 'undefined' && window.location.hash.indexOf('/cr-viewer') === -1
        && !window.location.pathname.endsWith('/cr-viewer')) {
      ctx.navigate('/cr-viewer');
    }
    useReportStore.getState().setShowFetalPanel(true, patient.patientId || patient.id);
  },

  openExisting(ctx, patient) {
    if (typeof window !== 'undefined' && window.location.hash.indexOf('/cr-viewer') === -1
        && !window.location.pathname.endsWith('/cr-viewer')) {
      ctx.navigate('/cr-viewer');
    }
    useReportStore.getState().setShowFetalPanel(true, patient.patientId || patient.id);
  },
};

// ── Radiology (default / catch-all) ──────────────────────────────────────────
export const radiologyType: ReportTypeDef = {
  id: 'radiology',
  name: 'General Radiology',
  description: 'Findings · Impression · Recommendation report (X-Ray, CT, MRI, Mammo, …)',
  iconName: 'FileText',
  accent: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',

  detect(patient): DetectionResult {
    const modality = norm(patient.modality);
    // High for non-US imaging modalities
    const radModalities = ['CR', 'DX', 'CT', 'MR', 'XA', 'MG', 'NM', 'PT', 'OT'];
    if (radModalities.includes(modality)) {
      return {
        typeId: 'radiology',
        confidence: 'high',
        reason: `${modality} study — generic radiology report`,
      };
    }
    // Always available as a low-confidence fallback so the picker can show it
    return {
      typeId: 'radiology',
      confidence: 'low',
      reason: 'Generic radiology report (default)',
    };
  },

  hasExistingReports(patient) {
    const list = useReportStore.getState().getReportsForPatient(patient.patientId || patient.id);
    return list.length > 0;
  },

  countExistingReports(patient) {
    return useReportStore.getState().getReportsForPatient(patient.patientId || patient.id).length;
  },

  openCreate(ctx, patient) {
    // Always render the inline report panel in the current viewer window
    // (splits the viewport 50/50) — no separate Electron windows. The
    // viewer pages mount InlineReportPanel based on `showInlineReport`.
    ctx.openLegacyReportEditor(patient.id, patient.patientName);
    useReportStore.getState().setShowInlineReport(true);
  },

  openExisting(ctx, patient) {
    ctx.openLegacyReportEditor(patient.id, patient.patientName);
    useReportStore.getState().setShowInlineReport(true);
  },
};

// ── Master registry ──────────────────────────────────────────────────────────
export const REPORT_TYPES: ReportTypeDef[] = [
  fetalMedicineType,
  radiologyType,
  // Add new modalities here.
];

export const getReportType = (id: string): ReportTypeDef | undefined =>
  REPORT_TYPES.find((t) => t.id === id);
