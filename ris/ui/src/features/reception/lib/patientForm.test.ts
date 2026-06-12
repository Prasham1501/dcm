import { describe, it, expect } from 'vitest';
import { validatePatientForm, buildPatientPayload } from './patientForm';

describe('validatePatientForm', () => {
  it('requires a full name', () => {
    expect(validatePatientForm({ full_name: '   ' })).toContain('Full name is required');
  });

  it('passes with a name', () => {
    expect(validatePatientForm({ full_name: 'Asha Devi' })).toEqual([]);
  });

  it('rejects an implausible phone', () => {
    expect(validatePatientForm({ full_name: 'Asha', phone: '12' })).toContain(
      'Mobile number must be a valid 10 digit Indian number'
    );
  });

  it('uses WhatsApp wording for the secondary number', () => {
    expect(validatePatientForm({ full_name: 'Asha', alt_phone: '12' })).toContain(
      'WhatsApp number must be a valid 10 digit Indian number'
    );
  });
});

describe('buildPatientPayload', () => {
  it('trims values and drops empty optional fields', () => {
    const p = buildPatientPayload({ full_name: '  Asha Devi  ', phone: '', sex: 'female' });
    expect(p.full_name).toBe('Asha Devi');
    expect('phone' in p).toBe(false);
    expect(p.sex).toBe('female');
  });

  it('includes the action and id for updates', () => {
    const p = buildPatientPayload({ full_name: 'Asha' }, { action: 'update', id: 7 });
    expect(p.action).toBe('update');
    expect(p.id).toBe(7);
  });

  it('defaults the action to create', () => {
    expect(buildPatientPayload({ full_name: 'Asha' }).action).toBe('create');
  });
});
