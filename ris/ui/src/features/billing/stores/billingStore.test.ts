import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useBillingStore } from './billingStore';

function mockFetch(json: unknown) {
  const fn = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: async () => JSON.stringify(json),
    json: async () => json,
  });
  (globalThis as any).fetch = fn;
  return fn;
}

beforeEach(() => {
  useBillingStore.setState({ daybook: null, lastReceipt: null, loading: false, error: null });
});

describe('billingStore', () => {
  it('takePayment returns the updated visit', async () => {
    mockFetch({ success: true, data: { payment: { id: 1 }, visit: { id: 5, status: 'paid', balance: '0.00' } } });
    const visit = await useBillingStore.getState().takePayment(5, 1500, 'cash');
    expect(visit?.status).toBe('paid');
  });

  it('takePayment surfaces errors and returns null', async () => {
    mockFetch({ success: false, error: 'bad amount' });
    const visit = await useBillingStore.getState().takePayment(5, -1, 'cash');
    expect(visit).toBeNull();
    expect(useBillingStore.getState().error).toContain('bad amount');
  });

  it('generateReceipt records lastReceipt', async () => {
    mockFetch({ success: true, data: { id: 1, receipt_no: 'RCP000001', total: '1500.00' } });
    const r = await useBillingStore.getState().generateReceipt(5);
    expect(r?.receipt_no).toBe('RCP000001');
    expect(useBillingStore.getState().lastReceipt?.receipt_no).toBe('RCP000001');
  });

  it('loadDaybook populates the summary', async () => {
    mockFetch({ success: true, data: { from: '2026-06-03', to: '2026-06-03', total: 500, count: 2, by_mode: { cash: 300, upi: 200 }, refunds: 0 } });
    await useBillingStore.getState().loadDaybook();
    expect(useBillingStore.getState().daybook?.total).toBe(500);
    expect(useBillingStore.getState().daybook?.by_mode.cash).toBe(300);
  });
});
