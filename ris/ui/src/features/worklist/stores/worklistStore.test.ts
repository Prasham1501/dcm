import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useWorklistStore } from './worklistStore';

function mockFetch(json: unknown) {
  const fn = vi.fn().mockResolvedValue({ json: async () => json });
  (globalThis as any).fetch = fn;
  return fn;
}

beforeEach(() => {
  useWorklistStore.setState({ orders: [], collection: [], loading: false, error: null, lastMatch: null });
});

describe('worklistStore', () => {
  it('load() populates orders', async () => {
    mockFetch({ success: true, data: [{ id: 1, accession_number: 'OCZ000001', status: 'acquired', patient_name: 'Asha' }] });
    await useWorklistStore.getState().load();
    expect(useWorklistStore.getState().orders).toHaveLength(1);
    expect(useWorklistStore.getState().orders[0].accession_number).toBe('OCZ000001');
  });

  it('load() surfaces API errors', async () => {
    mockFetch({ success: false, error: 'nope' });
    await useWorklistStore.getState().load();
    expect(useWorklistStore.getState().error).toContain('nope');
  });

  it('deliver() returns true on success', async () => {
    mockFetch({ success: true, data: { order_id: 1, action: 'deliver' } });
    const ok = await useWorklistStore.getState().deliver(1);
    expect(ok).toBe(true);
  });

  it('claim() returns false and sets error on failure', async () => {
    mockFetch({ success: false, error: 'bad transition' });
    const ok = await useWorklistStore.getState().claim(1);
    expect(ok).toBe(false);
    expect(useWorklistStore.getState().error).toContain('bad transition');
  });

  it('runMatch() records the matched count', async () => {
    mockFetch({ success: true, data: { matched: 3, orders: [] } });
    const r = await useWorklistStore.getState().runMatch();
    expect(r?.matched).toBe(3);
    expect(useWorklistStore.getState().lastMatch?.matched).toBe(3);
  });
});
