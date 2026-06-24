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
import type { ReportTypeDef, DetectionResult, ReportRouterCtx } from './types';
import type { Patient } from '@/types/patient';
import { useReportStore } from '@/stores/reportStore';

// ── Helpers ──────────────────────────────────────────────────────────────────
const norm = (s: string | null | undefined) => (s ?? '').toUpperCase();

/**
 * Ensure the CR Viewer is showing THIS study before we open a report panel.
 * The report panels (inline radiology / fetal) render *next to* the images on
 * /cr-viewer, which loads its study from the `cr-viewer-launch` handoff in
 * localStorage. When Report is launched from the patient list there's no viewer
 * yet — so seed the study and navigate. If we're already on the viewer we leave
 * the loaded study alone (the user is reporting on what they're looking at).
 */
function ensureCrViewerWithStudy(ctx: ReportRouterCtx, patient: Patient) {
  const onCrViewer = typeof window !== 'undefined'
    && (window.location.hash.indexOf('/cr-viewer') !== -1 || window.location.pathname.endsWith('/cr-viewer'));
  const filePaths: string[] = (patient as any).filePaths || [];
  // Authorize with the local DICOM server up-front so serve-file (token +
  // allowed-roots gated) will stream the images — don't rely solely on the
  // CR page's own authorize call, which races the study load.
  try { (window as any).electronAPI?.authorizeDicomPaths?.(filePaths); } catch { /* browser */ }
  if (!onCrViewer) {
    try {
      localStorage.setItem('cr-viewer-launch', JSON.stringify({
        patientName: patient.patientName,
        patientId: patient.patientId || patient.id,
        studyDate: patient.studyDate,
        filePaths,
        modality: patient.modality,
        studyDescription: patient.studyDescription,
        timestamp: Date.now(),
      }));
    } catch { /* ignore quota/serialisation errors */ }
    ctx.navigate('/cr-viewer');
  }
}

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
    // Fetal panel renders on the CR Viewer page beside the images — make sure
    // the study is loaded there first (also covers launching from the list).
    ensureCrViewerWithStudy(ctx, patient);
    useReportStore.getState().setShowFetalPanel(true, patient.patientId || patient.id);
  },

  openExisting(ctx, patient) {
    ensureCrViewerWithStudy(ctx, patient);
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
    // Render the inline report panel beside the images on the CR Viewer. Seed
    // the study + navigate when launched from the patient list, otherwise the
    // panel flag is set but nothing is visible (the original bug).
    ensureCrViewerWithStudy(ctx, patient);
    // Open the editor under the SAME key used to look up existing reports
    // (patientId, falling back to study id) so a saved report is found again
    // by Open Report instead of being orphaned under a different key.
    ctx.openLegacyReportEditor(patient.patientId || patient.id, patient.patientName);
    useReportStore.getState().setShowInlineReport(true);
  },

  openExisting(ctx, patient) {
    ensureCrViewerWithStudy(ctx, patient);
    ctx.openLegacyReportEditor(patient.patientId || patient.id, patient.patientName);
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
