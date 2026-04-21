/**
 * Strategy 0: Read DICOM files directly via Electron IPC + dicom-parser (Node.js).
 * Parses every text-bearing DICOM tag looking for measurement strings.
 * No network required — reads local files only. Works for all USG machines.
 */
import type { Reading } from '../types';
import { parseTextBlock } from '../parseUsgText';

export async function fromDicomFileText(
  filePaths: string[]
): Promise<{ readings: Reading[]; warnings: string[] }> {
  const warnings: string[] = [];

  if (!filePaths || filePaths.length === 0) {
    warnings.push('No file paths provided for DICOM text extraction');
    return { readings: [], warnings };
  }

  const api = (window as any).electronAPI;
  if (!api?.invoke) {
    warnings.push('Electron IPC not available — skipping DICOM file text extraction');
    return { readings: [], warnings };
  }

  try {
    const result = await api.invoke('extract-dicom-text', { filePaths });
    const textStrings: string[] = result?.textStrings ?? [];

    if (textStrings.length === 0) {
      warnings.push('No text tags found in DICOM files');
      return { readings: [], warnings };
    }

    const combined = textStrings.join('\n');
    const { readings, warnings: parseWarnings } = parseTextBlock(combined);
    return { readings, warnings: [...warnings, ...parseWarnings] };
  } catch (err: any) {
    warnings.push(`DICOM file text extraction failed: ${err?.message}`);
    return { readings: [], warnings };
  }
}
