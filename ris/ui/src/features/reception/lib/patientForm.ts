/**
 * Reception patient-form helpers (pure, unit-tested).
 * Mirrors server-side validation so the UI fails fast before calling the API.
 */
export interface PatientForm {
  name_prefix?: string;
  full_name?: string;
  last_name?: string;
  phone?: string;
  alt_phone?: string;
  sex?: string;
  dob?: string;
  age_years?: number | string;
  age_months?: number | string;
  age_days?: number | string;
  email?: string;
  patient_group?: string;
  address_line1?: string;
  address_line2?: string;
  address_line3?: string;
  city?: string;
  state?: string;
  husband_or_father_name?: string;
  id_proof_type?: string;
  id_proof_number?: string;
  dicom_patient_id?: string;
  mrn?: string;
}

const OPTIONAL_STRING_FIELDS: (keyof PatientForm)[] = [
  'name_prefix', 'last_name', 'phone', 'alt_phone', 'patient_group', 'sex', 'dob', 'email',
  'address_line1', 'address_line2', 'address_line3', 'city', 'state',
  'husband_or_father_name', 'id_proof_type', 'id_proof_number',
  'dicom_patient_id', 'mrn',
];

/** Returns a list of human-readable validation errors ([] when valid). */
export function validatePatientForm(form: PatientForm): string[] {
  const errors: string[] = [];
  if (!form.full_name || form.full_name.trim() === '') {
    errors.push('Full name is required');
  }
  if (form.phone && form.phone.trim() !== '') {
    const digits = form.phone.replace(/\D/g, '');
    if (!/^[6-9]\d{9}$/.test(digits)) {
      errors.push('Mobile number must be a valid 10 digit Indian number');
    }
  }
  if (form.alt_phone && form.alt_phone.trim() !== '') {
    const digits = form.alt_phone.replace(/\D/g, '');
    if (!/^[6-9]\d{9}$/.test(digits)) {
      errors.push('Alternate phone must be a valid 10 digit Indian number');
    }
  }
  const proof = (form.id_proof_type || '').toLowerCase();
  const proofNo = (form.id_proof_number || '').trim().toUpperCase();
  if (proof === 'aadhaar' && proofNo && !/^\d{12}$/.test(proofNo.replace(/\D/g, ''))) {
    errors.push('Aadhaar proof number must be 12 digits');
  }
  if (proof === 'pan' && proofNo && !/^[A-Z]{5}\d{4}[A-Z]$/.test(proofNo)) {
    errors.push('PAN number looks invalid');
  }
  if (form.email && form.email.trim() !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    errors.push('Email address looks invalid');
  }
  if (form.dob && form.dob.trim() !== '') {
    const dob = new Date(form.dob);
    if (Number.isNaN(dob.getTime()) || dob > new Date()) {
      errors.push('Birthdate must be a valid past date');
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
  for (const ageField of ['age_years', 'age_months', 'age_days'] as const) {
    if (form[ageField] != null && String(form[ageField]).trim() !== '') {
      out[ageField] = Number(form[ageField]);
    }
  }
  return out;
}
