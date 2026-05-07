/**
 * Report-router type system.
 *
 * Each "report type" plugs into a registry; the router auto-detects which
 * type best matches a study and routes Create/Open Report actions accordingly.
 *
 * Add a new modality (Mammography, Cardiology, etc.) by:
 *  1. Defining its `ReportTypeDef` (id, name, detect, openCreate, openExisting)
 *  2. Registering it in `registry.ts`
 *
 * No other file needs to change.
 */
import type { Patient } from '@/types/patient';

export type ReportTypeId = string;   // 'fetal' | 'radiology' | 'mammography' | …

export type DetectionConfidence =
  | 'none'      // 0   – this type is definitely not a match
  | 'low'       // .3  – fallback / generic match
  | 'medium'    // .6  – probably this type
  | 'high';     // .9  – very confident match

export interface DetectionResult {
  typeId: ReportTypeId;
  confidence: DetectionConfidence;
  /** Human-readable hint shown next to the type in the picker */
  reason?: string;
}

/**
 * One pluggable report type.  Pure data + small callbacks – no UI here.
 * The orchestrator hook (`useReportRouter`) decides what to do with these.
 */
export interface ReportTypeDef {
  id: ReportTypeId;
  /** Short display name shown in the picker */
  name: string;
  /** Tagline shown under the name in the picker */
  description: string;
  /** Lucide icon name (string) – kept loose so registry has no JSX deps */
  iconName: string;
  /** Tailwind colour class for the icon background */
  accent: string;

  /** Inspect a Patient/Study record and return a confidence score. */
  detect: (patient: Patient) => DetectionResult;

  /**
   * Whether the patient already has saved reports of this type.
   * Used by "Open Report" to filter out empty types.
   */
  hasExistingReports: (patient: Patient) => boolean | Promise<boolean>;

  /** Number of existing reports of this type for display in "Open Report" picker */
  countExistingReports?: (patient: Patient) => number | Promise<number>;

  /**
   * Imperative actions.  Receive the orchestrator context (navigate, openLegacyEditor, etc.)
   * and the patient. They handle their own opening logic.
   */
  openCreate: (ctx: ReportRouterCtx, patient: Patient) => void | Promise<void>;
  openExisting: (ctx: ReportRouterCtx, patient: Patient) => void | Promise<void>;
}

export interface ReportRouterCtx {
  navigate: (path: string) => void;
  /** Opens the legacy modal ReportEditor for the given patient */
  openLegacyReportEditor: (patientId: string, patientName: string) => void;
}
