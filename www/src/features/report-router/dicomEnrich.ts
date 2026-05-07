/**
 * Enriches a Patient object with extra DICOM metadata read directly from
 * the file (not just the cached patient row). This lets the detector see
 * BodyPartExamined, ProtocolName, SeriesDescription — fields that are
 * absent from the patient list cache but very useful for type detection.
 *
 * Falls back to the original Patient if Electron is unavailable or the
 * extraction fails.
 */
import type { Patient } from '@/types/patient';

export interface ExtractedDicomMeta {
  modality?: string;
  studyDescription?: string;
  seriesDescription?: string;
  bodyPart?: string;
  protocolName?: string;
}

/** Extract metadata from the first DICOM file in `filePaths`. */
export async function extractDicomMeta(filePaths: string[] | undefined): Promise<ExtractedDicomMeta | null> {
  if (!filePaths || filePaths.length === 0) return null;
  const api = (window as any).electronAPI;
  if (!api?.invoke) return null;
  try {
    const meta = await api.invoke('extract-dicom-metadata', { filePaths: filePaths.slice(0, 1) });
    if (!meta || typeof meta !== 'object') return null;
    return {
      modality:          meta.modality,
      studyDescription:  meta.studyDescription,
      seriesDescription: meta.seriesDescription,
      bodyPart:          meta.bodyPart,
      protocolName:      meta.protocolName,
    };
  } catch (err) {
    console.warn('[reportRouter] DICOM metadata extraction failed:', err);
    return null;
  }
}

/**
 * Returns a new Patient with detection-relevant fields back-filled from the
 * actual DICOM file. Existing values on `patient` win — we only fill blanks.
 *
 * `studyDescription` is the heaviest hitter for fetal detection, so when
 * the cached row is empty we splice in series description, body part, and
 * protocol name (joined with " | ") to give the keyword matcher more text
 * to work with.
 */
export async function enrichPatientFromDicom(patient: Patient): Promise<Patient> {
  const meta = await extractDicomMeta(patient.filePaths);
  if (!meta) return patient;

  const fallbackDesc = [
    patient.studyDescription,
    meta.studyDescription,
    meta.seriesDescription,
    meta.protocolName,
    meta.bodyPart,
  ]
    .filter((s) => typeof s === 'string' && s.trim() !== '')
    .join(' | ');

  return {
    ...patient,
    modality:          patient.modality          || meta.modality          || '',
    studyDescription:  fallbackDesc              || patient.studyDescription || '',
  };
}
