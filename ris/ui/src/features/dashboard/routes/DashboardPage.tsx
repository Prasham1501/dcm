import { useEffect, useState } from 'react';
import { ClipboardList, FileSpreadsheet, ListChecks, PackageCheck, Percent, Receipt } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { DateRange, EmptyState, ExportLink, SectionHeader, StatTile } from '@/components/RisUi';
import { apiDashboardSummary, misExportUrl, type DashboardSummary } from '../api/dashboardApi';

const ROLES = ['receptionist'];
const EXPORT_ROLES = ['receptionist'];

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
    apiDashboardSummary().then(setSummary).catch((err) => setError(err?.message || 'Failed to load'));
  }, [role]);

  if (!ROLES.includes(role)) {
    return <EmptyState title="No dashboard access" sub="RIS is configured for reception access only." />;
  }

  const canExport = EXPORT_ROLES.includes(role);

  return (
    <div className="content-narrow">
      {error && <div className="banner banner-warning">{error}</div>}

      <div className="grid-5">
        <StatTile icon={ClipboardList} label="Registrations today" value={summary?.registrations_today ?? '-'} />
        <StatTile icon={ListChecks} label="Pending worklist" value={summary?.pending_worklist ?? '-'} />
        <StatTile icon={PackageCheck} label="Ready to collect" value={summary?.ready_to_collect ?? '-'} />
        <StatTile icon={Receipt} label="Collections today" value={summary ? `Rs ${Number(summary.collections_today).toFixed(0)}` : '-'} accent />
        <StatTile icon={Percent} label="Commission MTD" value={summary ? `Rs ${Number(summary.mtd_commission).toFixed(0)}` : '-'} />
      </div>

      {canExport && (
        <div className="card card-pad mt-5">
          <SectionHeader icon={FileSpreadsheet} title="MIS exports" sub="CSV downloads open directly in Excel" />
          <DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} />
          <div className="actions mt-4">
            {(['visits', 'payments', 'commission'] as const).map((type) => (
              <ExportLink key={type} href={misExportUrl(type, from, to)}>
                {type} Excel CSV
              </ExportLink>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
