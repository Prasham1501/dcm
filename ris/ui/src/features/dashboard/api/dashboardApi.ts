/** Dashboard summary + MIS export helpers. */

export interface DashboardSummary {
  date: string;
  registrations_today: number;
  pending_worklist: number;
  ready_to_collect: number;
  collections_today: number;
  mtd_commission: number;
}

export async function apiDashboardSummary(date?: string): Promise<DashboardSummary> {
  const url = date ? `/api/dashboard/summary.php?date=${date}` : '/api/dashboard/summary.php';
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
