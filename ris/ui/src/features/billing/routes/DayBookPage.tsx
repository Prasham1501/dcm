import { useEffect, useState } from 'react';
import { AlertTriangle, Banknote, FileSpreadsheet, Receipt } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { DateRange, EmptyState, ExportLink, SectionHeader, StatTile } from '@/components/RisUi';
import { misExportUrl } from '@/features/dashboard/api/dashboardApi';
import { useBillingStore } from '../stores/billingStore';
import { CenterInvoicesPanel } from './CenterInvoicesPanel';

const ROLES = ['admin', 'super_admin', 'receptionist'];

export function DayBookPage() {
  const role = (useAuthStore((state) => state.user)?.role as string) || '';
  const { daybook, loading, error, loadDaybook } = useBillingStore();
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [tab, setTab] = useState<'daybook' | 'centers'>('daybook');

  useEffect(() => {
    if (ROLES.includes(role)) loadDaybook(from, to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  if (!ROLES.includes(role)) {
    return <EmptyState title="No billing report access" sub="Day Book is available to admin and receptionist roles." />;
  }

  return (
    <div className="content-narrow">
      <div className="visit-tabs" style={{ marginBottom: 16 }}>
        <button type="button" className={tab === 'daybook' ? 'active' : ''} onClick={() => setTab('daybook')}>Day Book</button>
        <button type="button" className={tab === 'centers' ? 'active' : ''} onClick={() => setTab('centers')}>Center Invoices</button>
      </div>

      {tab === 'centers' ? <CenterInvoicesPanel /> : (
      <>
      <div className="card card-pad">
        <SectionHeader icon={Receipt} title="Day book collections" sub="Live payment aggregates from billing/daybook.php">
          <div className="actions">
            <ExportLink href={misExportUrl('payments', from, to)} size="sm">Payments</ExportLink>
            <ExportLink href={misExportUrl('visits', from, to)} size="sm">Visits</ExportLink>
          </div>
        </SectionHeader>
        <div className="actions">
          <DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} />
          <button onClick={() => loadDaybook(from, to)} className="btn btn-primary">
            {loading ? 'Loading...' : 'Show'}
          </button>
        </div>
      </div>

      {error && <div className="banner banner-warning mt-4">{error}</div>}

      {daybook && (
        <>
          <div className="grid-3 mt-5">
            <StatTile icon={Banknote} label="Total collected" value={`Rs ${daybook.total.toFixed(2)}`} accent />
            <StatTile icon={Receipt} label="Payment count" value={daybook.count} />
            <StatTile icon={AlertTriangle} label="Balance due" value={`Rs ${daybook.balance_due.toFixed(2)}`} sub={`${daybook.balance_due_count} bill(s)`} />
          </div>
          <div className="grid-3 mt-4">
            <StatTile icon={FileSpreadsheet} label="Refunds" value={`Rs ${daybook.refunds.toFixed(2)}`} />
          </div>

          <div className="card mt-5">
            <div className="card-head"><span className="ch-title">Collections by mode</span></div>
            {Object.keys(daybook.by_mode).length === 0 ? <EmptyState title="No collections in this range" /> : (
              <div className="table-wrap" style={{ border: 0, borderRadius: 0 }}>
                <table className="dt">
                  <thead><tr><th>Mode</th><th className="num">Amount</th></tr></thead>
                  <tbody>
                    {Object.entries(daybook.by_mode).map(([mode, amount]) => (
                      <tr key={mode}>
                        <td className="strong" style={{ textTransform: 'capitalize' }}>{mode}</td>
                        <td className="num">Rs {Number(amount).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
      </>
      )}
    </div>
  );
}
