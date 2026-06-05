/** Pure helpers for the reception visit-registration form. */

export interface SelectedService {
  service_id: number;
  price?: number | string;
  modality?: string;
}

export interface VisitForm {
  patient_id: number | null;
  referring_doctor_id?: number | null;
  services: SelectedService[];
  discount?: number | string;
  tax?: number | string;
  scheduled_station_ae?: string;
}

export interface VisitPayload {
  patient_id: number;
  services: { service_id: number; price?: number; modality?: string }[];
  referring_doctor_id?: number;
  discount?: number;
  tax?: number;
  scheduled_station_ae?: string;
}

export function validateVisitForm(form: VisitForm): string[] {
  const errors: string[] = [];
  if (!form.patient_id || form.patient_id <= 0) {
    errors.push('Select a patient before registering.');
  }
  if (!form.services || form.services.length === 0) {
    errors.push('Add at least one service.');
  }
  return errors;
}

function toNum(v: unknown): number | undefined {
  if (v === '' || v === null || v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export function buildVisitPayload(form: VisitForm): VisitPayload {
  const payload: VisitPayload = {
    patient_id: Number(form.patient_id),
    services: form.services.map((s) => {
      const out: { service_id: number; price?: number; modality?: string } = {
        service_id: Number(s.service_id),
      };
      const price = toNum(s.price);
      if (price !== undefined) out.price = price;
      if (s.modality) out.modality = s.modality;
      return out;
    }),
  };
  if (form.referring_doctor_id) payload.referring_doctor_id = Number(form.referring_doctor_id);
  const discount = toNum(form.discount);
  if (discount !== undefined) payload.discount = discount;
  const tax = toNum(form.tax);
  if (tax !== undefined) payload.tax = tax;
  if (form.scheduled_station_ae) payload.scheduled_station_ae = form.scheduled_station_ae;
  return payload;
}
