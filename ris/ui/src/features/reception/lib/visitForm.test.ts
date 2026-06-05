import { describe, it, expect } from 'vitest';
import { validateVisitForm, buildVisitPayload, type VisitForm } from './visitForm';

const base: VisitForm = {
  patient_id: 5,
  referring_doctor_id: null,
  services: [{ service_id: 1, price: 1500, modality: 'US' }],
  discount: '',
  tax: '',
};

describe('visitForm', () => {
  it('accepts a valid form', () => {
    expect(validateVisitForm(base)).toEqual([]);
  });

  it('requires a patient', () => {
    expect(validateVisitForm({ ...base, patient_id: null }).join(' ')).toMatch(/patient/i);
  });

  it('requires at least one service', () => {
    expect(validateVisitForm({ ...base, services: [] }).join(' ')).toMatch(/service/i);
  });

  it('buildVisitPayload includes patient + services and numeric discount/tax', () => {
    const p = buildVisitPayload({ ...base, discount: '100', tax: '0' });
    expect(p.patient_id).toBe(5);
    expect(p.services).toHaveLength(1);
    expect(p.services[0].service_id).toBe(1);
    expect(p.discount).toBe(100);
  });

  it('buildVisitPayload omits referring_doctor_id when not chosen', () => {
    const p = buildVisitPayload(base);
    expect('referring_doctor_id' in p).toBe(false);
  });

  it('buildVisitPayload includes referring_doctor_id when chosen', () => {
    const p = buildVisitPayload({ ...base, referring_doctor_id: 9 });
    expect(p.referring_doctor_id).toBe(9);
  });
});
