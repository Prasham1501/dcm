import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCommissionStore } from './commissionStore';

function mockFetch(json: unknown) {
  const fn = vi.fn().mockResolvedValue({ json: async () => json });
  (globalThis as any).fetch = fn;
  return fn;
}

beforeEach(() => {
  useCommissionStore.setState({ report: [], statement: null, payouts: [], enabled: true, loading: false, error: null });
});

describe('commissionStore', () => {
  it('loadReport populates the by-doctor rows', async () => {
    mockFetch({ success: true, data: { from: '2026-06-01', to: '2026-06-03', rows: [{ referring_doctor_id: 1, name: 'Dr A', total: '150.00', entries: 1 }] } });
    await useCommissionStore.getState().loadReport();
    expect(useCommissionStore.getState().report).toHaveLength(1);
    expect(useCommissionStore.getState().report[0].total).toBe('150.00');
  });

  it('loadStatement populates the statement', async () => {
    mockFetch({ success: true, data: { entries: [{ id: 1, commission_amount: '150.00' }], total: 150 } });
    await useCommissionStore.getState().loadStatement(1);
    expect(useCommissionStore.getState().statement?.total).toBe(150);
  });

  it('createPayout returns the payout', async () => {
    mockFetch({ success: true, data: { id: 9, total_amount: '150.00', status: 'draft' } });
    const p = await useCommissionStore.getState().createPayout(1, '2026-06-01', '2026-06-30');
    expect(p?.id).toBe(9);
  });

  it('setEnabled updates the toggle', async () => {
    mockFetch({ success: true, data: { enabled: false } });
    await useCommissionStore.getState().setEnabled(false);
    expect(useCommissionStore.getState().enabled).toBe(false);
  });
});
