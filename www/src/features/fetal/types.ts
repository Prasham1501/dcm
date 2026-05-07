/**
 * Shared types for the Fetal Medicine module.
 */

export type ExamType =
  | 'FTS'
  | 'SECOND_TRIMESTER'
  | 'THIRD_TRIMESTER'
  | 'FETAL_ECHO'
  | 'NEURO'
  | 'OTHER';

export type ExamStatus = 'draft' | 'final';

export interface ObstetricHistory {
  gravida?: number;
  para?: number;
  abortion?: number;
  living?: number;
  ectopic?: number;
  pregnancy_type?: 'single' | 'twin' | 'triplet' | 'higher';
}

export interface MaternalAssessment {
  height_cm?: number;
  current_weight_kg?: number;
  pre_pregnancy_weight_kg?: number;
  bmi?: number;
  bp_systolic?: number;
  bp_diastolic?: number;
  mean_arterial_pressure?: number;
  pulse_pressure?: number;
  cycle_regularity?: 'regular' | 'irregular';
  cycle_days?: number;
  conception?: 'spontaneous' | 'iui' | 'ivf' | 'icsi' | 'other';
  cigarettes?: boolean;
  consanguinity?: boolean;
}

export interface FamilyHistory {
  diabetes_mellitus?: { maternal?: boolean; partner?: boolean };
  hypertension?: { maternal?: boolean; partner?: boolean };
  recurrent_miscarriage?: { maternal?: boolean; partner?: boolean };
  medical_termination?: { maternal?: boolean; partner?: boolean };
  malformations?: { maternal?: boolean; partner?: boolean };
  hemoglobinopathy?: { maternal?: boolean; partner?: boolean };
  disability?: { maternal?: boolean; partner?: boolean };
}

export interface Examination {
  id: number;
  patient_id: string;
  study_uid: string | null;
  exam_label: string;
  exam_type: ExamType;
  exam_date: string | null;          // YYYY-MM-DD
  lmp_date: string | null;
  gestational_age_weeks: number | null;
  edd: string | null;
  obstetric_history: ObstetricHistory | null;
  maternal_assessment: MaternalAssessment | null;
  family_history: FamilyHistory | null;
  status: ExamStatus;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreateExaminationInput {
  patient_id: string;
  study_uid?: string | null;
  exam_label?: string;
  exam_type?: ExamType;
  exam_date?: string;
  lmp_date?: string | null;
  gestational_age_weeks?: number | null;
  edd?: string | null;
  obstetric_history?: ObstetricHistory | null;
  maternal_assessment?: MaternalAssessment | null;
  family_history?: FamilyHistory | null;
}

export type UpdateExaminationInput = Partial<
  Omit<Examination, 'id' | 'patient_id' | 'created_by' | 'created_at' | 'updated_at'>
>;

// ── Biometry ──────────────────────────────────────────────────────────────────

export interface BiometryField {
  value: number | null;
  unit: string;
  referenceAuthor: string | null;
  percentile: number | null;
  zScore: number | null;
  isAbnormal: boolean;
}

export interface BiometryFieldDef {
  field_key: string;
  display_label: string;
  unit: string;
  default_author_code: string | null;
}

// ── Growth charts ─────────────────────────────────────────────────────────────

export interface GrowthChartAuthor {
  id: number;
  code: string;
  display_name: string;
  citation: string;
}

export interface GrowthChartPoint {
  ga_weeks: number;
  p5: number;
  p50: number;
  p95: number;
  mean: number;
  sd: number;
  author_id?: number;
  code?: string;
  display_name?: string;
}
