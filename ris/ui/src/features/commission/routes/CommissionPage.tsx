import { useEffect, useState } from 'react';
import { FileSpreadsheet, Percent, Wallet } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { Button, DateRange, EmptyState, ExportLink, SectionHeader, StatusChip } from '@/components/RisUi';
import { misExportUrl } from '@/features/dashboard/api/dashboardApi';
import { useCommissionStore } from '../stores/commissionStore';
import type { CommissionReportRow, Payout } from '../api/commissionApi';

const ADMIN_ROLES = ['admin', 'super_admin'];

export function CommissionPage() {
  const role = (useAuthStore((state) => state.user)?.role as string) || '';
  const { report, statement, enabled, error, loadReport, loadStatement, createPayout, payPayout, loadEnabled, setEnabled } =
    useCommissionStore();

  const monthStart = new Date().toISOString().slice(0, 8) + '01';
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [selected, setSelected] = useState<CommissionReportRow | null>(null);
  const [payout, setPayout] = useState<Payout | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!ADMIN_ROLES.includes(role)) return;
    loadEnabled();
    loadReport(from, to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  if (!ADMIN_ROLES.includes(role)) {
    return <EmptyState title="Commission management is admin-only" />;
  }

  const selectDoctor = async (row: CommissionReportRow) => {
    setSelected(row);
    setPayout(null);
    setMsg(null);
    await loadStatement(row.referring_doctor_id);
  };

  const onCreatePayout = async () => {
    if (!selected) return;
    const created = await createPayout(selected.referring_doctor_id, from, to);
    if (created) {
      setPayout(created);
      setMsg(`Payout #${created.id} created for Rs ${created.total_amount}`);
    }
  };

  const onPay = async () => {
    if (!payout || !selected) return;
    if (await payPayout(payout.id)) {
      setMsg(`Payout #${payout.id} marked paid.`);
      setPayout(null);
      await loadStatement(selected.referring_doctor_id);
      await loadReport(from, to);
    }
  };

  return (
    <div className="content-narrow">
      <div className="card card-pad">
        <SectionHeader icon={Percent} title="Referring-doctor commission" sub="Admin payout workflow">
          <label className="actions" style={{ gap: 6 }}>
            <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
            <span className="field-label">Commission enabled</span>
          </label>
        </SectionHeader>
        <div className="actions">
          <DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} />
          <Button variant="primary" onClick={() => loadReport(from, to)}>Show</Button>
          <ExportLink href={misExportUrl('commission', from, to)}>Commission Excel CSV</ExportLink>
        </div>
      </div>

      {error && <div className="banner banner-warning mt-4">{error}</div>}
      {msg && <div className="banner banner-success mt-4">{msg}</div>}

      <div className="grid-2 mt-5">
        <div className="card">
          <div className="card-head">
            <span className="ch-title">By doctor</span>
            <div className="ch-actions"><StatusChip status={enabled ? 'online' : 'offline'} label={enabled ? 'Enabled' : 'Disabled'} /></div>
          </div>
          {report.length === 0 ? <EmptyState title="No commission in this range" /> : (
            <div className="table-wrap" style={{ border: 0, borderRadius: 0 }}>
              <table className="dt">
                <thead><tr><th>Doctor</th><th>Tests</th><th className="num">Commission</th></tr></thead>
                <tbody>
                  {report.map((row) => (
                    <tr key={row.referring_doctor_id} onClick={() => selectDoctor(row)} className={selected?.referring_doctor_id === row.referring_doctor_id ? 'selected' : ''} style={{ cursor: 'pointer' }}>
                      <td className="strong">{row.name}</td>
                      <td>{row.entries}</td>
                      <td className="num">Rs {Number(row.total).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card card-pad">
          <SectionHeader icon={Wallet} title={selected ? `Statement - ${selected.name}` : 'Select a doctor'} />
          {selected && statement ? (
            <>
              <div className="between">
                <span className="muted">Unpaid total</span>
                <span className="strong accent">Rs {statement.total.toFixed(2)}</span>
              </div>
              <div className="table-wrap mt-4" style={{ maxHeight: 260, overflow: 'auto' }}>
                <table className="dt">
                  <thead><tr><th>Order</th><th>Base</th><th>Rate</th><th className="num">Amount</th></tr></thead>
                  <tbody>
                    {statement.entries.map((entry) => (
                      <tr key={entry.id}>
                        <td className="mono">#{entry.order_id}</td>
                        <td>Rs {entry.base_amount}</td>
                        <td>{entry.rate_type === 'percent' ? `${entry.rate_value}%` : `Rs ${entry.rate_value}`}</td>
                        <td className="num">Rs {entry.commission_amount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="actions mt-4">
                <Button variant="primary" icon={FileSpreadsheet} disabled={statement.total <= 0} onClick={onCreatePayout}>
                  Create payout
                </Button>
                {payout && <Button variant="success" onClick={onPay}>Mark payout #{payout.id} paid</Button>}
              </div>
            </>
          ) : <EmptyState title="Select a doctor" sub="Click a doctor row to load unpaid statement entries." />}
        </div>
      </div>
    </div>
  );
}
