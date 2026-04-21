import { api } from '@/services/api';
import type { Reading, TemplateKey } from '../types';

interface BackendMeasurement {
  type: string;
  name: string;
  value: number | string;
  unit?: string;
  category?: string;
  rawText?: string;
  dimensions?: { length: number; width: number; depth?: number | null };
}

const CATEGORY_MAP: Record<string, TemplateKey> = {
  obstetric: 'obstetric',
  abdominal: 'abdominal',
  thyroid: 'smallParts',
  cardiac: 'cardiac',
  vascular: 'vascular',
  generic: 'generic',
};

function normalize(m: BackendMeasurement, idx: number): Reading {
  const category: TemplateKey = CATEGORY_MAP[m.category ?? 'generic'] ?? 'generic';
  const key = m.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '') || `measurement_${idx}`;

  return {
    key,
    label: m.name,
    value: m.dimensions
      ? m.dimensions.depth != null
        ? `${m.dimensions.length} × ${m.dimensions.width} × ${m.dimensions.depth}`
        : `${m.dimensions.length} × ${m.dimensions.width}`
      : m.value,
    unit: m.unit ?? '',
    confidence: 1.0,
    category,
    rawText: m.rawText,
  };
}

export async function fromDicomTags(
  orthancStudyId: string,
  orthancInstanceIds: string[]
): Promise<{ readings: Reading[]; warnings: string[] }> {
  const warnings: string[] = [];

  if (!orthancStudyId && orthancInstanceIds.length === 0) {
    return { readings: [], warnings: ['No Orthanc IDs available for tag extraction'] };
  }

  try {
    // Use the POST batch endpoint — sends Orthanc instance IDs (not DICOM UIDs)
    const response = await api.post<any>('dicom/extract-measurements.php', {
      instanceIds: orthancInstanceIds.filter(Boolean).slice(0, 20), // cap to avoid huge requests
      studyId: orthancStudyId || undefined,
    });

    const results: BackendMeasurement[] = [];
    const data = (response as any)?.data ?? response;

    if (data?.results) {
      // Batch response: { results: { [instanceId]: { measurements: [...] } } }
      for (const instanceResult of Object.values(data.results) as any[]) {
        if (instanceResult?.measurements) {
          results.push(...instanceResult.measurements);
        }
      }
    } else if (data?.measurements) {
      // Single instance response
      results.push(...data.measurements);
    }

    if (results.length === 0) {
      warnings.push('No measurements found in DICOM tags/SR');
    }

    // Deduplicate by name (backend already deduplicates, but across instances there may be repeats)
    const seen = new Map<string, Reading>();
    results.forEach((m, idx) => {
      const r = normalize(m, idx);
      if (!seen.has(r.key)) seen.set(r.key, r);
    });

    return { readings: Array.from(seen.values()), warnings };
  } catch (err: any) {
    warnings.push(`DICOM tag extraction failed: ${err?.message ?? 'network error'}`);
    return { readings: [], warnings };
  }
}
