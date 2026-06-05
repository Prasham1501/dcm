import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useReceptionStore } from './receptionStore';

function mockFetch(json: unknown) {
  const fn = vi.fn().mockResolvedValue({ json: async () => json });
  (globalThis as any).fetch = fn;
  return fn;
}

beforeEach(() => {
  useReceptionStore.setState({
    patients: [], services: [], referringDoctors: [],
    loading: false, error: null, lastCreated: null, lastVisit: null,
  });
});

describe('receptionStore', () => {
  it('search() populates patients and clears loading', async () => {
    mockFetch({ success: true, data: [{ id: 1, mrn: 'P000001', full_name: 'Asha' }] });
    await useReceptionStore.getState().search('Asha');
    expect(useReceptionStore.getState().patients).toHaveLength(1);
    expect(useReceptionStore.getState().loading).toBe(false);
    expect(useReceptionStore.getState().error).toBeNull();
  });

  it('register() returns the created patient and records lastCreated', async () => {
    mockFetch({ success: true, data: { id: 2, mrn: 'P000002', full_name: 'Asha' } });
    const created = await useReceptionStore.getState().register({ full_name: 'Asha', phone: '9123456780' });
    expect(created?.mrn).toBe('P000002');
    expect(useReceptionStore.getState().lastCreated?.mrn).toBe('P000002');
  });

  it('register() with an invalid form sets an error and does not call the API', async () => {
    const fetchSpy = mockFetch({ success: true, data: {} });
    const created = await useReceptionStore.getState().register({ full_name: '   ' });
    expect(created).toBeNull();
    expect(useReceptionStore.getState().error).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('search() surfaces API errors', async () => {
    mockFetch({ success: false, error: 'boom' });
    await useReceptionStore.getState().search('x');
    expect(useReceptionStore.getState().error).toContain('boom');
    expect(useReceptionStore.getState().loading).toBe(false);
  });

  it('loadServices() populates the catalog', async () => {
    mockFetch({ success: true, data: [{ id: 1, code: 'USG-OBS', name: 'USG Obstetric', modality: 'US', price: '1500.00' }] });
    await useReceptionStore.getState().loadServices();
    expect(useReceptionStore.getState().services).toHaveLength(1);
    expect(useReceptionStore.getState().services[0].code).toBe('USG-OBS');
  });

  it('registerVisit() returns the visit + orders and records lastVisit', async () => {
    mockFetch({
      success: true,
      data: { visit: { id: 7, visit_no: 'V000007', net_amount: '1500.00' }, orders: [{ id: 1, accession_number: 'OCZ000001' }] },
    });
    const result = await useReceptionStore.getState().registerVisit({
      patient_id: 5,
      services: [{ service_id: 1 }],
    });
    expect(result?.visit.visit_no).toBe('V000007');
    expect(result?.orders[0].accession_number).toBe('OCZ000001');
    expect(useReceptionStore.getState().lastVisit?.visit.id).toBe(7);
  });

  it('registerVisit() with no patient sets an error and does not call the API', async () => {
    const fetchSpy = mockFetch({ success: true, data: {} });
    const result = await useReceptionStore.getState().registerVisit({ patient_id: null, services: [{ service_id: 1 }] });
    expect(result).toBeNull();
    expect(useReceptionStore.getState().error).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
