/**
 * Reception patient-form helpers (pure, unit-tested).
 * Mirrors server-side validation so the UI fails fast before calling the API.
 */
export interface PatientForm {
  full_name?: string;
  phone?: string;
  sex?: string;
  dob?: string;
  age_years?: number | string;
  email?: string;
  address?: string;
  husband_or_father_name?: string;
  id_proof_type?: string;
  id_proof_number?: string;
  dicom_patient_id?: string;
  mrn?: string;
}

const OPTIONAL_STRING_FIELDS: (keyof PatientForm)[] = [
  'phone', 'sex', 'dob', 'email', 'address', 'husband_or_father_name',
  'id_proof_type', 'id_proof_number', 'dicom_patient_id', 'mrn',
];

/** Returns a list of human-readable validation errors ([] when valid). */
export function validatePatientForm(form: PatientForm): string[] {
  const errors: string[] = [];
  if (!form.full_name || form.full_name.trim() === '') {
    errors.push('Full name is required');
  }
  if (form.phone && form.phone.trim() !== '') {
    const digits = form.phone.replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 15) {
      errors.push('Phone number looks invalid');
    }
  }
  return errors;
}

/** Builds the API payload: trims values, drops empty optional fields, sets action/id. */
export function buildPatientPayload(
  form: PatientForm,
  opts: { action?: 'create' | 'update'; id?: number } = {}
): Record<string, unknown> {
  const out: Record<string, unknown> = { action: opts.action ?? 'create' };
  if (opts.id != null) {
    out.id = opts.id;
  }
  out.full_name = (form.full_name ?? '').trim();
  for (const field of OPTIONAL_STRING_FIELDS) {
    const value = form[field];
    if (value != null && String(value).trim() !== '') {
      out[field] = String(value).trim();
    }
  }
  if (form.age_years != null && String(form.age_years).trim() !== '') {
    out.age_years = Number(form.age_years);
  }
  return out;
}
