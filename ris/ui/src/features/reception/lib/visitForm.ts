/** Pure helpers for the reception visit-registration form. */

export interface SelectedService {
  service_id: number;
  price?: number | string;
  modality?: string;
}

export interface VisitForm {
  patient_id: number | null;
  referring_doctor_id?: number | null;
  center_name?: string;
  consultant_doctor?: string;
  sample_collected_at?: string;
  ref_no?: string;
  urgent_report?: boolean;
  visit_comment?: string;
  phlebotomy_staff?: string;
  home_visit_area?: string;
  home_visit_amount?: number | string;
  home_visit_time?: string;
  dispatch_mode?: string;
  dispatch_note?: string;
  delivery_destination?: string;
  pro_name?: string;
  commission_amount?: number | string;
  regular_patient?: boolean;
  misc_charge?: number | string;
  print_barcode?: boolean;
  print_srs?: boolean;
  print_receipt?: boolean;
  print_bill_receipt?: boolean;
  send_to_printer?: boolean;
  services: SelectedService[];
  discount?: number | string;
  tax?: number | string;
  scheduled_station_ae?: string;
}

export interface VisitPayload {
  patient_id: number;
  services: { service_id: number; price?: number; modality?: string }[];
  referring_doctor_id?: number;
  center_name?: string;
  consultant_doctor?: string;
  sample_collected_at?: string;
  ref_no?: string;
  urgent_report?: boolean;
  visit_comment?: string;
  phlebotomy_staff?: string;
  home_visit_area?: string;
  home_visit_amount?: number;
  home_visit_time?: string;
  dispatch_mode?: string;
  dispatch_note?: string;
  delivery_destination?: string;
  pro_name?: string;
  commission_amount?: number;
  regular_patient?: boolean;
  misc_charge?: number;
  print_barcode?: boolean;
  print_srs?: boolean;
  print_receipt?: boolean;
  print_bill_receipt?: boolean;
  send_to_printer?: boolean;
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
  for (const key of ['center_name', 'consultant_doctor', 'sample_collected_at', 'ref_no', 'visit_comment', 'phlebotomy_staff', 'home_visit_area', 'home_visit_time', 'dispatch_mode', 'dispatch_note', 'delivery_destination', 'pro_name'] as const) {
    const value = form[key];
    if (value && String(value).trim() !== '') payload[key] = String(value).trim();
  }
  for (const key of ['urgent_report', 'regular_patient', 'print_barcode', 'print_srs', 'print_receipt', 'print_bill_receipt', 'send_to_printer'] as const) {
    if (form[key] !== undefined) payload[key] = !!form[key];
  }
  const discount = toNum(form.discount);
  if (discount !== undefined) payload.discount = discount;
  const homeVisitAmount = toNum(form.home_visit_amount);
  if (homeVisitAmount !== undefined) payload.home_visit_amount = homeVisitAmount;
  const commissionAmount = toNum(form.commission_amount);
  if (commissionAmount !== undefined) payload.commission_amount = commissionAmount;
  const miscCharge = toNum(form.misc_charge);
  if (miscCharge !== undefined) payload.misc_charge = miscCharge;
  const tax = toNum(form.tax);
  if (tax !== undefined) payload.tax = tax;
  if (form.scheduled_station_ae) payload.scheduled_station_ae = form.scheduled_station_ae;
  return payload;
}
