import { useEffect, useState } from 'react';
import { AlertTriangle, ClipboardList, FileSpreadsheet, ListChecks, PackageCheck, Receipt } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { DateRange, EmptyState, ExportLink, SectionHeader, StatTile } from '@/components/RisUi';
import { apiDashboardSummary, misExportUrl, type DashboardSummary } from '../api/dashboardApi';

const ROLES = ['receptionist'];
const EXPORT_ROLES = ['receptionist'];
const dashboardCache: { key: string; summary: DashboardSummary | null } = { key: '', summary: null };

export function DashboardPage() {
  const role = (useAuthStore((state) => state.user)?.role as string) || '';
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
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

  return (
    <div className="content-narrow">
      {error && <div className="banner banner-warning">{error}</div>}

      <div className="card card-pad mt-4">
        <SectionHeader icon={Receipt} title="Dashboard date range" sub="Updates registrations and collections shown below" />
        <DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} />
      </div>

      <div className="grid-5 mt-4">
        <StatTile icon={ClipboardList} label="Registrations" value={summary?.registrations_range ?? '-'} />
        <StatTile icon={ListChecks} label="Console pending" value={summary?.pending_worklist ?? '-'} />
        <StatTile icon={PackageCheck} label="Ready to collect" value={summary?.ready_to_collect ?? '-'} />
        <StatTile icon={Receipt} label="Collections" value={summary ? `Rs ${Number(summary.collections_range).toFixed(0)}` : '-'} accent />
        <StatTile
          icon={AlertTriangle}
          label="Balance due"
          value={summary ? `Rs ${Number(summary.balance_due).toFixed(0)}` : '-'}
          sub={summary ? `${summary.balance_due_count} pending bill(s)` : undefined}
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
