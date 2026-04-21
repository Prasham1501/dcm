import type { ReadingSet, ReadingSource } from './types';
import { EMPTY_READING_SET } from './types';
import { detectTemplate } from './detectTemplate';
import { fromDicomFileText } from './strategies/fromDicomFileText';
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
 * Run the three-strategy fallback chain:
 * 1. DICOM SR/tag extraction via backend
 * 2. Pixel OCR via Tesseract.js on rendered canvases
 * 3. HuggingFace vision model (only if hfToken is set)
 *
 * Stops at the first strategy that returns non-empty readings.
 * Always resolves — never throws.
 */
export async function extractReadings(params: ExtractionParams): Promise<ReadingSet> {
  const allWarnings: string[] = [];

  // Strategy 0: Direct DICOM file text parsing (Electron IPC → Node.js dicom-parser)
  // Works for all local files — no network, no OCR needed
  if (params.filePaths && params.filePaths.length > 0) {
    try {
      const { readings, warnings } = await fromDicomFileText(params.filePaths);
      allWarnings.push(...warnings);
      if (readings.length > 0) {
        return build(params.studyUID, 'dicom-sr', readings, allWarnings);
      }
    } catch (err: any) {
      allWarnings.push(`Strategy 0 (DICOM file text) threw: ${err?.message}`);
    }
  }

  // Strategy 1: DICOM SR tags via Orthanc backend
  try {
    const { readings, warnings } = await fromDicomTags(
      params.orthancStudyId,
      params.orthancInstanceIds
    );
    allWarnings.push(...warnings);
    if (readings.length > 0) {
      return build(params.studyUID, 'dicom-sr', readings, allWarnings);
    }
  } catch (err: any) {
    allWarnings.push(`Strategy 1 (DICOM tags) threw: ${err?.message}`);
  }

  // Strategy 2a: Node.js Tesseract OCR via Electron IPC (local WASM, no CDN)
  try {
    const { readings, warnings } = await fromNodeOcr();
    allWarnings.push(...warnings);
    if (readings.length > 0) {
      return build(params.studyUID, 'pixel-ocr', readings, allWarnings);
    }
  } catch (err: any) {
    allWarnings.push(`Strategy 2a (Node OCR) threw: ${err?.message}`);
  }

  // Strategy 2b: Browser Tesseract OCR (fallback)
  try {
    const { readings, warnings } = await fromPixelOcr(params.imageUrls);
    allWarnings.push(...warnings);
    if (readings.length > 0) {
      return build(params.studyUID, 'pixel-ocr', readings, allWarnings);
    }
  } catch (err: any) {
    allWarnings.push(`Strategy 2b (browser OCR) threw: ${err?.message}`);
  }

  // Strategy 3: Vision LLM
  if (params.hfToken) {
    try {
      const { readings, warnings } = await fromVisionModel(params.hfToken, params.imageUrls);
      allWarnings.push(...warnings);
      if (readings.length > 0) {
        return build(params.studyUID, 'vision-llm', readings, allWarnings);
      }
    } catch (err: any) {
      allWarnings.push(`Strategy 3 (Vision LLM) threw: ${err?.message}`);
    }
  }

  // All strategies exhausted — return empty set (not a failure)
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
