import { useEffect, useState } from 'react';
import { CalendarClock, MapPin, RefreshCw } from 'lucide-react';
import { Banner, Button, EmptyState, SectionHeader, StatusChip, TextInput } from '@/components/RisUi';
import { formatRisDateTime } from '../../../lib/dateFormat';
import { apiScheduleAgenda, type ScheduleRow } from '../api/scheduleApi';

const todayInput = () => new Date().toISOString().slice(0, 10);

/** Show the actual collection time if recorded, else the planned home-visit time. */
function timeLabel(row: ScheduleRow): string {
  if (row.sample_collected_at) return formatRisDateTime(row.sample_collected_at);
  if (row.home_visit_time) return String(row.home_visit_time).slice(0, 5);
  return formatRisDateTime(row.visit_datetime);
}

export function SchedulePage() {
  const [from, setFrom] = useState(todayInput());
  const [to, setTo] = useState(todayInput());
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (f = from, t = to) => {
    setBusy(true); setError(null);
    try { setRows(await apiScheduleAgenda(f, t)); }
    catch (e: any) { setError(e?.message || 'Failed to load schedule'); }
    finally { setBusy(false); }
  };

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  return (
    <div className="card card-pad">
      <SectionHeader icon={CalendarClock} title="Home-visit schedule" sub="Where to go and which tests to collect, ordered by collection time.">
        <div className="actions" style={{ alignItems: 'flex-end' }}>
          <TextInput label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <TextInput label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <Button variant="secondary" icon={RefreshCw} disabled={busy} onClick={() => load()}>Show</Button>
        </div>
      </SectionHeader>

      {error && <Banner kind="warning">{error}</Banner>}

      {rows.length === 0 ? (
        <EmptyState
          title="No home visits scheduled"
          sub="Register a patient as a home visit (set area / time / staff) in Reception and it will appear here."
        />
      ) : (
        <div className="table-wrap mt-3">
          <table className="dt">
            <thead>
              <tr>
                <th>Time</th>
                <th>Patient</th>
                <th>Area / Address</th>
                <th>Tests</th>
                <th>Staff</th>
                <th>Status</th>
                <th className="num">Balance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  style={{ borderLeft: Number(row.urgent_report || 0) === 1 ? '3px solid var(--warning, #d97706)' : '3px solid transparent' }}
                >
                  <td className="mono">{timeLabel(row)}</td>
                  <td className="strong">
                    {row.full_name}{' '}
                    <span className="field-hint">[{row.age_years || '-'} {row.sex || '-'}]{row.phone ? ` · ${row.phone}` : ''}</span>
                  </td>
                  <td>
                    <div className="strong">{row.home_visit_area || '-'}</div>
                    {row.address ? <div className="field-hint"><MapPin size={12} /> {row.address}</div> : null}
                  </td>
                  <td>{row.test_names || '-'}</td>
                  <td>{row.phlebotomy_staff || '-'}</td>
                  <td><StatusChip status={row.status === 'paid' ? 'paid' : 'pending'} label={row.status || '-'} /></td>
                  <td className="num">{row.balance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="field-hint mt-3">{rows.length} home visit(s) in range.</div>
    </div>
  );
}
