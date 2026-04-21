export type ReadingSource = 'dicom-sr' | 'pixel-ocr' | 'vision-llm' | 'manual';
export type TemplateKey = 'obstetric' | 'abdominal' | 'pelvic' | 'smallParts' | 'cardiac' | 'vascular' | 'generic';

export interface Reading {
  key: string;       // e.g. 'BPD', 'HC', 'liver_length'
  label: string;     // e.g. 'Biparietal Diameter'
  value: number | string; // string for dimension triples like "5.2 × 3.1"
  unit: string;
  confidence: number; // 0..1 — always 1.0 for dicom-sr
  category: TemplateKey;
  rawText?: string;   // original string seen by parser (for audit)
}

export interface ReadingSet {
  studyUID: string;
  source: ReadingSource;
  templateKey: TemplateKey;
  readings: Reading[];
  extractedAt: number;
  warnings: string[];
}

export const EMPTY_READING_SET = (studyUID: string): ReadingSet => ({
  studyUID,
  source: 'manual',
  templateKey: 'generic',
  readings: [],
  extractedAt: Date.now(),
  warnings: [],
});
