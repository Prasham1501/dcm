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
  const deduped = deduplicateReadings(readings);
  if (deduped.length < readings.length) {
    console.log(`[extractReadings] Dedup: ${readings.length} → ${deduped.length} readings`);
  }
  return {
    studyUID,
    source,
    templateKey: detectTemplate(deduped),
    readings: deduped,
    extractedAt: Date.now(),
    warnings,
  };
}

/**
 * Deduplicate readings across multiple images.
 * Same base key + same value → keep one.
 * Same base key + different values → keep all (legitimate repeat measurements).
 * Context keys (GA, EDD) that repeat across images with different values
 * are capped to 1 — the per-measurement GA is already computed by Hadlock.
 * Generic vessel duplicates (e.g. "Lower Ext. Artery_Vel 63.61" when
 * "Ant. Tibial A._Vel 63.61" already exists) are removed.
 * Re-numbers keys sequentially after dedup.
 */
function deduplicateReadings(readings: Reading[]): Reading[] {
  // Context keys: appear on every image as machine context, not independent measurements.
  const CONTEXT_KEYS = new Set(['GA', 'EDD']);

  // Generic vessel prefixes — these are category headers, not specific vessels.
  // Readings attributed to them are duplicates of readings under specific vessels.
  const GENERIC_VESSELS = ['Lower Ext. Artery', 'Upper Ext. Artery'];

  // Measurement suffixes used in vessel-prefixed keys
  const MEASUREMENT_SUFFIXES = ['_Vel', '_angle', '_PSV', '_EDV', '_RI', '_PI', '_TAMV', '_SD', '_IMT'];

  const seen = new Set<string>();
  const baseKeyCounts = new Map<string, number>();
  const kept: Reading[] = [];

  for (const r of readings) {
    const baseKey = r.key.replace(/_\d+$/, '');
    const normValue = String(r.value).trim().toLowerCase();
    const dedupKey = `${baseKey}::${normValue}`;

    if (seen.has(dedupKey)) continue; // Exact duplicate (same key + same value) — skip
    seen.add(dedupKey);

    // Cap context keys to 1 unique value
    if (CONTEXT_KEYS.has(baseKey)) {
      const count = baseKeyCounts.get(baseKey) || 0;
      if (count >= 1) continue;
    }

    baseKeyCounts.set(baseKey, (baseKeyCounts.get(baseKey) || 0) + 1);
    kept.push(r);
  }

  // Second pass: remove generic vessel duplicates.
  // If "Lower Ext. Artery_Vel = 63.61" exists AND "Ant. Tibial A._Vel = 63.61" also exists,
  // drop the generic one.
  const specificValues = new Set<string>();
  for (const r of kept) {
    const baseKey = r.key.replace(/_\d+$/, '');
    const isGeneric = GENERIC_VESSELS.some(gv => baseKey.startsWith(gv + '_'));
    if (!isGeneric) {
      // Extract measurement suffix to build a lookup key
      for (const suf of MEASUREMENT_SUFFIXES) {
        if (baseKey.endsWith(suf)) {
          const measType = suf;
          const normValue = String(r.value).trim().toLowerCase();
          specificValues.add(`${measType}::${normValue}`);
          break;
        }
      }
    }
  }

  const filtered = kept.filter(r => {
    const baseKey = r.key.replace(/_\d+$/, '');
    const isGeneric = GENERIC_VESSELS.some(gv => baseKey.startsWith(gv + '_'));
    if (!isGeneric) return true;

    // Check if a specific vessel already has this measurement+value
    for (const suf of MEASUREMENT_SUFFIXES) {
      if (baseKey.endsWith(suf)) {
        const normValue = String(r.value).trim().toLowerCase();
        if (specificValues.has(`${suf}::${normValue}`)) {
          console.log(`[dedup] Dropping generic: ${r.key}=${r.value} (specific vessel has same)`);
          return false;
        }
        break;
      }
    }
    return true;
  });

  // Re-number keys sequentially
  const keyCount = new Map<string, number>();
  for (const r of filtered) {
    const baseKey = r.key.replace(/_\d+$/, '');
    const baseLabel = r.label.replace(/\s*\(\d+\)$/, '');
    const count = (keyCount.get(baseKey) || 0) + 1;
    keyCount.set(baseKey, count);
    r.key = count === 1 ? baseKey : `${baseKey}_${count}`;
    r.label = count === 1 ? baseLabel : `${baseLabel} (${count})`;
  }

  return filtered;
}
