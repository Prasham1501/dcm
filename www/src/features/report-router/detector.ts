/**
 * Detection orchestrator: runs every registered report type's `detect()`,
 * returns them sorted best→worst.
 */
import type { Patient } from '@/types/patient';
import type { DetectionConfidence } from './types';
import { REPORT_TYPES } from './registry';

const SCORE: Record<DetectionConfidence, number> = {
  high: 0.9,
  medium: 0.6,
  low: 0.3,
  none: 0,
};

export interface ScoredDetection {
  typeId: string;
  confidence: DetectionConfidence;
  score: number;
  reason?: string;
}

/**
 * Run all registered detectors, sort by score (best first), drop `none` matches.
 */
export function detectReportTypes(patient: Patient): ScoredDetection[] {
  return REPORT_TYPES
    .map((t) => {
      const r = t.detect(patient);
      return { typeId: t.id, confidence: r.confidence, score: SCORE[r.confidence], reason: r.reason };
    })
    .filter((d) => d.score > 0)
    .sort((a, b) => b.score - a.score);
}

/**
 * Decide whether we can auto-open a report or must show the picker.
 *
 * Rules:
 *   - top match is `high` AND it's the unique high match  → auto-open
 *   - otherwise → show picker (with the top match preselected)
 */
export interface RoutingDecision {
  mode: 'auto' | 'pick';
  preselected?: string;
  candidates: ScoredDetection[];
}

export function routeFor(patient: Patient): RoutingDecision {
  const results = detectReportTypes(patient);
  if (results.length === 0) {
    return { mode: 'pick', candidates: [] };
  }

  const [top] = results;
  const highMatches = results.filter((r) => r.confidence === 'high');

  if (top.confidence === 'high' && highMatches.length === 1) {
    return { mode: 'auto', preselected: top.typeId, candidates: results };
  }

  return { mode: 'pick', preselected: top.typeId, candidates: results };
}
