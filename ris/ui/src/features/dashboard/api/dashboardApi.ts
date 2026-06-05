/** Dashboard summary + MIS export helpers. */

export interface DashboardSummary {
  date: string;
  from: string;
  to: string;
  registrations_today: number;
  registrations_range: number;
  pending_worklist: number;
  ready_to_collect: number;
  collections_today: number;
  collections_range: number;
  balance_due: number;
  balance_due_count: number;
}

export async function apiDashboardSummary(from?: string, to?: string): Promise<DashboardSummary> {
  const params = new URLSearchParams();
  const today = new Date().toISOString().slice(0, 10);
  params.set('date', today);
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const url = `/api/dashboard/summary.php?${params}`;
  const res = await fetch(url, { credentials: 'include' });
  const json = await res.json();
  if (!json || json.success === false) {
    throw new Error((json && (json.error || json.message)) || 'Request failed');
  }
  return json.data as DashboardSummary;
}

export function misExportUrl(type: 'visits' | 'payments' | 'commission', from: string, to: string): string {
  return `/api/reports/export.php?type=${type}&from=${from}&to=${to}`;
}
