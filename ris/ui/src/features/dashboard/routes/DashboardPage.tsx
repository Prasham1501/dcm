import { useEffect, useState } from 'react';
import { AlertTriangle, ClipboardList, FileSpreadsheet, ListChecks, PackageCheck, Receipt, X } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { DateRange, EmptyState, ExportLink, IconButton, SectionHeader, StatTile } from '@/components/RisUi';
import { apiDashboardSummary, misExportUrl, type DashboardSummary } from '../api/dashboardApi';
import { apiReceptionVisits, type ReceptionVisitRow } from '@/features/reception/api/receptionApi';
import { formatRisDateTime } from '../../../lib/dateFormat';

const ROLES = ['receptionist'];
const EXPORT_ROLES = ['receptionist'];
const dashboardCache: { key: string; summary: DashboardSummary | null } = { key: '', summary: null };

export function DashboardPage() {
  const role = (useAuthStore((state) => state.user)?.role as string) || '';
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ title: string; rows: ReceptionVisitRow[]; loading: boolean } | null>(null);
  const monthStart = new Date().toISOString().slice(0, 8) + '01';
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);

  useEffect(() => {
    if (!ROLES.includes(role)) return;
    const key = `${from}|${to}`;
    if (dashboardCache.key === key && dashboardCache.summary) {
      setSummary(dashboardCache.summary);
    }
    apiDashboardSummary(from, to)
      .then((next) => {
        dashboardCache.key = key;
        dashboardCache.summary = next;
        setSummary(next);
      })
      .catch((err) => setError(err?.message || 'Failed to load'));
  }, [role, from, to]);

  if (!ROLES.includes(role)) {
    return <EmptyState title="No dashboard access" sub="RIS is configured for reception access only." />;
  }

  const canExport = EXPORT_ROLES.includes(role);
  const openDetails = async (kind: 'registrations' | 'pending' | 'ready' | 'collections' | 'balance', title: string) => {
    setDetail({ title, rows: [], loading: true });
    try {
      const filters: Record<string, string | boolean | number> = { from, to, page: 1, page_size: 100, include_totals: 0 };
      if (kind === 'balance') filters.outstanding = true;
      const data = await apiReceptionVisits(filters);
      let rows = data.rows;
      if (kind === 'collections') rows = rows.filter((row) => Number(row.paid_amount || 0) > 0);
      if (kind === 'ready') rows = rows.filter((row) => Number(row.order_count || 0) > 0 && Number(row.results_ready_count || 0) >= Number(row.order_count || 0));
      if (kind === 'pending') rows = rows.filter((row) => Number(row.order_count || 0) > 0 && Number(row.results_ready_count || 0) < Number(row.order_count || 0));
      setDetail({ title, rows, loading: false });
    } catch (err: any) {
      setDetail({ title: `${title}: ${err?.message || 'Failed to load'}`, rows: [], loading: false });
    }
  };

  return (
    <div className="content-narrow">
      {error && <div className="banner banner-warning">{error}</div>}
      {detail && (
        <div className="modal-backdrop" onClick={() => setDetail(null)}>
          <div className="modal-panel modal-panel-wide" onClick={(event) => event.stopPropagation()}>
            <IconButton className="modal-x" sm bordered icon={X} title="Close" aria-label="Close" onClick={() => setDetail(null)} />
            <SectionHeader icon={ClipboardList} title={detail.title} sub={`${from} to ${to}`} />
            {detail.loading ? <div className="field-hint">Loading details...</div> : detail.rows.length === 0 ? (
              <EmptyState title="No matching visits" sub="No registrations matched this badge." />
            ) : (
              <div className="table-wrap mt-3">
                <table className="dt">
                  <thead><tr><th>Reg No</th><th>Date / Time</th><th>Patient</th><th>Tests</th><th className="num">Net</th><th className="num">Paid</th><th className="num">Balance</th><th>Status</th></tr></thead>
                  <tbody>
                    {detail.rows.map((row) => (
                      <tr key={row.id}>
                        <td className="mono">{row.visit_no}</td>
                        <td>{formatRisDateTime(row.visit_datetime)}</td>
                        <td className="strong">{row.full_name}</td>
                        <td>{row.test_names || '-'}</td>
                        <td className="num">{Number(row.net_amount || 0).toFixed(2)}</td>
                        <td className="num">{Number(row.paid_amount || 0).toFixed(2)}</td>
                        <td className="num">{Number(row.balance || 0).toFixed(2)}</td>
                        <td>{row.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="card card-pad mt-4">
        <SectionHeader icon={Receipt} title="Dashboard date range" sub="Updates registrations and collections shown below" />
        <DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} />
      </div>

      <div className="grid-5 mt-4">
        <StatTile icon={ClipboardList} label="Registrations" value={summary?.registrations_range ?? '-'} onClick={() => openDetails('registrations', 'Registrations')} />
        <StatTile icon={ListChecks} label="Pending studies" value={summary?.pending_worklist ?? '-'} onClick={() => openDetails('pending', 'Pending studies')} />
        <StatTile icon={PackageCheck} label="Ready to collect" value={summary?.ready_to_collect ?? '-'} onClick={() => openDetails('ready', 'Ready to collect')} />
        <StatTile icon={Receipt} label="Collections" value={summary ? `Rs ${Number(summary.collections_range).toFixed(0)}` : '-'} accent onClick={() => openDetails('collections', 'Collections')} />
        <StatTile
          icon={AlertTriangle}
          label="Balance due"
          value={summary ? `Rs ${Number(summary.balance_due).toFixed(0)}` : '-'}
          sub={summary ? `${summary.balance_due_count} pending bill(s)` : undefined}
          onClick={() => openDetails('balance', 'Balance due')}
        />
      </div>

      {canExport && (
        <div className="card card-pad mt-5">
          <SectionHeader icon={FileSpreadsheet} title="MIS exports" sub="CSV downloads open directly in Excel">
            <div className="actions">
              {(['visits', 'payments'] as const).map((type) => (
                <ExportLink key={type} href={misExportUrl(type, from, to)} size="sm">
                  {type}
                </ExportLink>
              ))}
            </div>
          </SectionHeader>
          <div className="field-hint">Use the buttons in the top-right of this panel.</div>
        </div>
      )}
    </div>
  );
}
