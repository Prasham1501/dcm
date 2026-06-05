/** Thin fetch wrappers for the billing endpoints. */

export interface VisitBalance {
  id: number;
  visit_no: string;
  net_amount: string;
  paid_amount: string;
  balance: string;
  status: string;
}

export interface Receipt {
  id: number;
  receipt_no: string;
  print_url?: string;
  subtotal: string;
  discount: string;
  tax_amount: string;
  total: string;
}

export interface DayBook {
  from: string;
  to: string;
  total: number;
  count: number;
  by_mode: Record<string, number>;
  refunds: number;
}

const TAKE = '/api/billing/take-payment.php';
const RECEIPT = '/api/billing/receipt.php';
const DAYBOOK = '/api/billing/daybook.php';

async function readJson(res: Response): Promise<any> {
  const json = await res.json();
  if (!json || json.success === false) {
    throw new Error((json && (json.error || json.message)) || 'Request failed');
  }
  return json.data;
}

export async function apiTakePayment(payload: {
  visit_id: number; amount: number; mode: string; reference?: string; is_refund?: boolean;
}): Promise<{ payment: any; visit: VisitBalance }> {
  const res = await fetch(TAKE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  return (await readJson(res)) as { payment: any; visit: VisitBalance };
}

export async function apiGenerateReceipt(visitId: number): Promise<Receipt> {
  const res = await fetch(RECEIPT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ visit_id: visitId }),
  });
  return (await readJson(res)) as Receipt;
}

export async function apiGetDaybook(from?: string, to?: string): Promise<DayBook> {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const url = params.toString() ? `${DAYBOOK}?${params}` : DAYBOOK;
  return (await readJson(await fetch(url, { credentials: 'include' }))) as DayBook;
}
