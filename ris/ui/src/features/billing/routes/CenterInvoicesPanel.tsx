import { useEffect, useState } from 'react';
import { Building2, FileText, Printer, RefreshCw, Save } from 'lucide-react';
import { Banner, Button, EmptyState, SectionHeader, StatusChip, TextInput } from '@/components/RisUi';

interface CenterRow {
  center_id: number;
  center_name: string;
  billing_type: 'credit' | 'debit';
  visit_count: number | string;
  total: number | string;
  discount: number | string;
  net: number | string;
  paid: number | string;
  balance: number | string;
  invoice_id: number | null;
  invoice_status: string | null;
  invoice_paid: number | string | null;
  invoice_net: number | string | null;
  period: string;
}

const ENDPOINT = '/api/billing/center-invoices.php';

async function readJson(res: Response): Promise<any> {
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch {
    throw new Error(text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || `HTTP ${res.status}`);
  }
  if (!json || json.success === false) throw new Error((json && (json.error || json.message)) || 'Request failed');
  return json.data;
}

function thisMonth() { return new Date().toISOString().slice(0, 7); }

export function CenterInvoicesPanel() {
  const [period, setPeriod] = useState(thisMonth());
  const [rows, setRows] = useState<CenterRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async (p = period) => {
    setBusy(true); setError(null);
    try { setRows(await readJson(await fetch(`${ENDPOINT}?period=${p}`, { credentials: 'include' }))); }
    catch (e: any) { setError(e?.message || 'Failed to load'); }
    finally { setBusy(false); }
  };

  useEffect(() => { load(period); /* eslint-disable-next-line */ }, []);

  const post = async (body: Record<string, unknown>, ok: string) => {
    setBusy(true); setError(null); setMessage(null);
    try {
      const data = await readJson(await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) }));
      setRows(data);
      setMessage(ok);
    } catch (e: any) { setError(e?.message || 'Action failed'); }
    finally { setBusy(false); }
  };

  const generate = (r: CenterRow) => post({ action: 'generate', center_id: r.center_id, period }, `Invoice generated for ${r.center_name}`);
  const recordPayment = (r: CenterRow) => {
    if (!r.invoice_id) return;
    const amt = window.prompt(`Record center payment for ${r.center_name} (Rs)`, '');
    const n = Number(amt);
    if (!n || n <= 0) return;
    post({ action: 'pay', invoice_id: r.invoice_id, amount: n }, 'Center payment recorded');
  };

  const fmt = (v: any) => Number(v || 0).toFixed(2);

  return (
    <div className="card card-pad">
      <SectionHeader icon={Building2} title="Center invoices" sub="Monthly billing for referring centers. Generate a statement, print it, and record the center's payment.">
        <div className="actions" style={{ alignItems: 'flex-end' }}>
          <TextInput label="Month" type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
          <Button variant="secondary" icon={RefreshCw} disabled={busy} onClick={() => load(period)}>Show</Button>
        </div>
      </SectionHeader>

      {error && <Banner kind="warning">{error}</Banner>}
      {message && <div className="banner banner-success mt-3">{message}</div>}

      {rows.length === 0 ? (
        <EmptyState title="No centers" sub="Add centers in Settings → Masters → Centers. Credit centers are billed monthly here." />
      ) : (
        <div className="table-wrap mt-3">
          <table className="dt">
            <thead>
              <tr><th>Center</th><th>Type</th><th className="num">Visits</th><th className="num">Total</th><th className="num">Discount</th><th className="num">Net</th><th>Invoice</th><th className="num">Center paid</th><th className="num">Balance</th><th /></tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const net = Number(r.invoice_id ? r.invoice_net : r.net);
                const paid = Number(r.invoice_paid || 0);
                const bal = Math.max(0, net - paid);
                return (
                  <tr key={r.center_id}>
                    <td className="strong">{r.center_name}</td>
                    <td><StatusChip status={r.billing_type === 'credit' ? 'pending' : 'online'} label={r.billing_type === 'credit' ? 'Credit' : 'Debit'} /></td>
                    <td className="num">{r.visit_count}</td>
                    <td className="num">{fmt(r.total)}</td>
                    <td className="num">{fmt(r.discount)}</td>
                    <td className="num">{fmt(r.net)}</td>
                    <td>{r.invoice_id ? <StatusChip status={r.invoice_status === 'paid' ? 'online' : 'pending'} label={r.invoice_status || 'final'} /> : <span className="field-hint">Not generated</span>}</td>
                    <td className="num">{r.invoice_id ? fmt(paid) : '-'}</td>
                    <td className="num">{r.invoice_id ? fmt(bal) : '-'}</td>
                    <td>
                      <div className="actions" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                        <Button size="sm" variant="secondary" icon={Save} disabled={busy || Number(r.visit_count) === 0} onClick={() => generate(r)}>{r.invoice_id ? 'Regenerate' : 'Generate'}</Button>
                        {r.invoice_id ? <a className="btn btn-ghost btn-sm" href={`${ENDPOINT}?print=1&invoice_id=${r.invoice_id}`} target="_blank" rel="noreferrer"><Printer size={14} /> Print</a> : null}
                        {r.invoice_id ? <Button size="sm" variant="ghost" icon={FileText} disabled={busy} onClick={() => recordPayment(r)}>Pay</Button> : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="field-hint mt-3">Net is the amount the center owes for that month. "Center paid" tracks what the center has settled against the generated invoice.</div>
    </div>
  );
}
