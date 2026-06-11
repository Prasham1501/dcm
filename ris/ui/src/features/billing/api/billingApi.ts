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
  balance_due: number;
  balance_due_count: number;
}

const TAKE = '/api/billing/take-payment.php';
const RECEIPT = '/api/billing/receipt.php';
const DAYBOOK = '/api/billing/daybook.php';
const PRINT_ASSETS = '/api/billing/print-assets.php';

async function readJson(res: Response): Promise<any> {
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    const cleaned = text
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    throw new Error(cleaned || `Request failed with HTTP ${res.status}`);
  }
  if (!json || json.success === false) {
    throw new Error((json && (json.error || json.message)) || 'Request failed');
  }
  return json.data;
}

export async function apiTakePayment(payload: {
  visit_id: number;
  amount: number;
  mode: string;
  reference?: string;
  is_refund?: boolean;
  payer_name?: string;
  payer_relation?: string;
  payer_mobile?: string;
  notes?: string;
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

export type PrintAssetType = 'barcode' | 'srs' | 'bill_receipt';

export function printAssetUrl(visitId: number, type: PrintAssetType): string {
  return `${PRINT_ASSETS}?visit_id=${visitId}&type=${type}`;
}
