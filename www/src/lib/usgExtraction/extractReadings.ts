import type { ReadingSet, ReadingSource, Reading } from './types';
import { EMPTY_READING_SET } from './types';
import { detectTemplate } from './detectTemplate';
import { fromDicomStructured } from './strategies/fromDicomStructured';
import { fromDicomTags } from './strategies/fromDicomTags';
import { fromNodeOcr } from './strategies/fromNodeOcr';
import { fromPixelOcr } from './strategies/fromPixelOcr';
import { fromVisionModel } from './strategies/fromVisionModel';

export interface ExtractionParams {
  studyUID: string;
  orthancStudyId: string;
  orthancInstanceIds: string[];
  imageUrls: string[];
  filePaths?: string[];   // local file paths for direct DICOM parsing
  hfToken?: string;
}

/**
 * Comprehensive extraction pipeline:
 *
 * Phase 1 — DICOM Tags (100% accuracy when available):
 *   a. Structured extraction: SR sequences, graphic annotations, overlay text,
 *      private tags, all text-bearing tags (single IPC call)
 *   b. Orthanc backend (if available)
 *
 * Phase 2 — OCR fallback (if tags yielded nothing):
 *   a. Node.js Tesseract (native DICOM pixel → BMP → OCR)
 *   b. Browser Tesseract (rendered canvas → OCR)
 *
 * Phase 3 — AI Vision (if OCR yielded nothing and HF token set):
 *   a. HuggingFace vision model
 *
 * Tag results are ALWAYS preferred. OCR only runs if tags found nothing.
 * Within each phase, results are merged (not short-circuited).
 */
export async function extractReadings(params: ExtractionParams): Promise<ReadingSet> {
  const allWarnings: string[] = [];
  let tagReadings: Reading[] = [];

  // ════════════════════════════════════════════════════════════
  // Phase 1: DICOM Tags — try ALL tag-based sources
  // ════════════════════════════════════════════════════════════

  // 1a. Comprehensive structured extraction (SR + annotations + overlays + private tags + all text tags)
  if (params.filePaths && params.filePaths.length > 0) {
    try {
      console.log('[extractReadings] Phase 1a: DICOM structured + text tags');
      const { readings, warnings } = await fromDicomStructured(params.filePaths);
      allWarnings.push(...warnings);
      if (readings.length > 0) {
        console.log(`[extractReadings] Phase 1a: ${readings.length} tag-based readings`);
        tagReadings.push(...readings);
      }
    } catch (err: any) {
      allWarnings.push(`Phase 1a (structured tags) threw: ${err?.message}`);
    }
  }

  // 1b. Orthanc backend (if available — adds any readings not already found)
  try {
    const { readings, warnings } = await fromDicomTags(
      params.orthancStudyId,
      params.orthancInstanceIds
    );
    allWarnings.push(...warnings);
    if (readings.length > 0) {
      // Merge: only add readings with keys not already present
      const existingKeys = new Set(tagReadings.map(r => r.key.replace(/_\d+$/, '')));
      for (const r of readings) {
        if (!existingKeys.has(r.key.replace(/_\d+$/, ''))) {
          tagReadings.push(r);
        }
      }
    }
  } catch (err: any) {
    allWarnings.push(`Phase 1b (Orthanc tags) threw: ${err?.message}`);
  }

  // If tags found readings, return with dicom-sr source (highest confidence)
  if (tagReadings.length > 0) {
    console.log(`[extractReadings] Tags found ${tagReadings.length} readings — using dicom-sr source`);
    return build(params.studyUID, 'dicom-sr', tagReadings, allWarnings);
  }

  // ════════════════════════════════════════════════════════════
  // Phase 2: OCR — tags found nothing, fall back to pixel reading
  // ════════════════════════════════════════════════════════════

  // 2a. Node.js Tesseract OCR (native resolution, best quality)
  console.log('[extractReadings] Phase 2a: Node OCR');
  try {
    const { readings, warnings } = await fromNodeOcr(params.filePaths);
    allWarnings.push(...warnings);
    console.log(`[extractReadings] Phase 2a: ${readings.length} OCR readings`);
    if (readings.length > 0) {
      return build(params.studyUID, 'pixel-ocr', readings, allWarnings);
    }
  } catch (err: any) {
    console.warn('[extractReadings] Phase 2a threw:', err?.message);
    allWarnings.push(`Phase 2a (Node OCR) threw: ${err?.message}`);
  }

  // 2b. Browser Tesseract OCR (fallback — lower quality from rendered canvas)
  try {
    const { readings, warnings } = await fromPixelOcr(params.imageUrls);
    allWarnings.push(...warnings);
    if (readings.length > 0) {
      return build(params.studyUID, 'pixel-ocr', readings, allWarnings);
    }
  } catch (err: any) {
    allWarnings.push(`Phase 2b (browser OCR) threw: ${err?.message}`);
  }

  // ════════════════════════════════════════════════════════════
  // Phase 3: AI Vision — last resort
  // ════════════════════════════════════════════════════════════
  if (params.hfToken) {
    try {
      const { readings, warnings } = await fromVisionModel(params.hfToken, params.imageUrls);
      allWarnings.push(...warnings);
      if (readings.length > 0) {
        return build(params.studyUID, 'vision-llm', readings, allWarnings);
      }
    } catch (err: any) {
      allWarnings.push(`Phase 3 (Vision LLM) threw: ${err?.message}`);
    }
  }

  // All phases exhausted — return empty
  return { ...EMPTY_READING_SET(params.studyUID), warnings: allWarnings };
}

function build(
  studyUID: string,
  source: ReadingSource,
  readings: ReadingSet['readings'],
  warnings: string[]
): ReadingSet {
  return {
    studyUID,
    source,
    templateKey: detectTemplate(readings),
    readings,
    extractedAt: Date.now(),
    warnings,
  };
}
