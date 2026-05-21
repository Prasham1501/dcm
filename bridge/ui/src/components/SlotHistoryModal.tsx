/**
 * SlotHistoryModal — per-slot print history with daily / monthly / yearly
 * filter buttons. Loads the per-slot JSONL log from the main process
 * (bridge:get-slot-history) and renders a table with full detail:
 * timestamp, kind (received/printed/failed), patient name, modality,
 * printer, paper size, study UID, error.
 */
import { useEffect, useMemo, useState } from 'react';
import { X, RefreshCw, FileText, Printer, AlertTriangle, Inbox, Wifi } from 'lucide-react';
import type { PrinterSlot, SlotHistoryEvent } from '@/types/bridge';

type Range = 'today' | 'month' | 'year';

function rangeBounds(r: Range): { fromTs: number; toTs: number; label: string } {
  const now = new Date();
  if (r === 'today') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return { fromTs: start.getTime(), toTs: end.getTime(), label: 'Today' };
  }
  if (r === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { fromTs: start.getTime(), toTs: end.getTime(), label: now.toLocaleString(undefined, { month: 'long', year: 'numeric' }) };
  }
  const start = new Date(now.getFullYear(), 0, 1);
  const end   = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
  return { fromTs: start.getTime(), toTs: end.getTime(), label: String(now.getFullYear()) };
}

function fmtTs(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString();
}

export function SlotHistoryModal({ slot, onClose }: { slot: PrinterSlot; onClose: () => void }) {
  const [range, setRange] = useState<Range>('today');
  const [events, setEvents] = useState<SlotHistoryEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const { fromTs, toTs, label } = useMemo(() => rangeBounds(range), [range]);

  async function load() {
    setLoading(true);
    try {
      const list = await window.bridgeAPI.getSlotHistory({ slotId: slot.id, fromTs, toTs, limit: 2000 });
      setEvents(list || []);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-line */ }, [slot.id, fromTs, toTs]);

  const stats = useMemo(() => {
    const printed  = events.filter((e) => e.kind === 'printed').length;
    const failed   = events.filter((e) => e.kind === 'failed').length;
    const received = events.filter((e) => e.kind === 'received').length;
    const echos    = events.filter((e) => e.kind === 'echo').length;
    return { printed, failed, received, echos };
  }, [events]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-app-bg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-app-border bg-app-header-bg px-4 py-2">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-app-accent" />
            <h3 className="text-sm font-bold text-app-text">{slot.name} · Print History</h3>
            <span className="rounded bg-app-accent/10 px-2 py-0.5 font-mono text-2xs text-app-accent">
              {slot.aeTitle} : {slot.port}
            </span>
          </div>
          <button onClick={onClose} title="Close"
            className="rounded p-1 text-app-text-secondary hover:bg-app-hover hover:text-app-text">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Range toggle + stats */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-app-border bg-app-surface px-4 py-2">
          <div className="flex items-center gap-1 rounded border border-app-border bg-app-bg p-0.5">
            {(['today', 'month', 'year'] as Range[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`rounded px-3 py-1 text-xs font-semibold transition ${
                  range === r ? 'bg-app-accent text-white' : 'text-app-text-secondary hover:text-app-text'
                }`}
              >
                {r === 'today' ? 'Daily' : r === 'month' ? 'Monthly' : 'Yearly'}
              </button>
            ))}
            <span className="ml-2 mr-1 text-2xs text-app-text-muted">· {label}</span>
          </div>

          <div className="flex items-center gap-3 text-2xs">
            <span className="flex items-center gap-1 text-app-text-secondary">
              <Printer className="h-3 w-3 text-green-500" /> <b className="text-app-text">{stats.printed}</b> printed
            </span>
            <span className="flex items-center gap-1 text-app-text-secondary">
              <AlertTriangle className="h-3 w-3 text-red-500" /> <b className="text-app-text">{stats.failed}</b> failed
            </span>
            <span className="flex items-center gap-1 text-app-text-secondary">
              <Inbox className="h-3 w-3 text-app-accent" /> <b className="text-app-text">{stats.received}</b> studies received
            </span>
            <span className="flex items-center gap-1 text-app-text-secondary">
              <Wifi className="h-3 w-3 text-sky-500" /> <b className="text-app-text">{stats.echos}</b> pings
            </span>
            <button onClick={load} title="Refresh"
              className="rounded p-1 text-app-text-secondary hover:bg-app-hover hover:text-app-text">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {events.length === 0 ? (
            <div className="flex h-full items-center justify-center p-10 text-sm text-app-text-muted">
              {loading ? 'Loading…' : `No activity in ${label.toLowerCase()}.`}
            </div>
          ) : (
            <table className="w-full text-2xs">
              <thead className="sticky top-0 bg-app-header-bg text-app-text-muted">
                <tr>
                  <th className="px-3 py-1.5 text-left font-semibold uppercase tracking-wide">When</th>
                  <th className="px-3 py-1.5 text-left font-semibold uppercase tracking-wide">Event</th>
                  <th className="px-3 py-1.5 text-left font-semibold uppercase tracking-wide">Patient</th>
                  <th className="px-3 py-1.5 text-left font-semibold uppercase tracking-wide">Modality</th>
                  <th className="px-3 py-1.5 text-left font-semibold uppercase tracking-wide">Printer</th>
                  <th className="px-3 py-1.5 text-left font-semibold uppercase tracking-wide">Paper</th>
                  <th className="px-3 py-1.5 text-left font-semibold uppercase tracking-wide">Pages</th>
                  <th className="px-3 py-1.5 text-left font-semibold uppercase tracking-wide">Detail</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e, i) => (
                  <tr key={i} className="border-t border-app-border hover:bg-app-hover">
                    <td className="px-3 py-1.5 text-app-text" title={new Date(e.ts).toISOString()}>{fmtTs(e.ts)}</td>
                    <td className="px-3 py-1.5">
                      <KindBadge kind={e.kind} />
                    </td>
                    <td className="px-3 py-1.5 text-app-text">
                      {e.patientName || '—'}
                      {e.patientId ? <span className="ml-1 text-app-text-muted">({e.patientId})</span> : null}
                    </td>
                    <td className="px-3 py-1.5 text-app-text-secondary">{e.modality || '—'}</td>
                    <td className="px-3 py-1.5 text-app-text-secondary truncate max-w-[180px]" title={e.printer}>{e.printer || '—'}</td>
                    <td className="px-3 py-1.5 text-app-text-secondary">{e.paperSize || '—'}</td>
                    <td className="px-3 py-1.5 text-app-text">{e.pages ?? '—'}</td>
                    <td className="px-3 py-1.5 text-app-text-muted">
                      {e.kind === 'failed'
                        ? <span className="text-red-500">{e.error || 'error'}</span>
                        : e.kind === 'received'
                          ? <span>from {e.callingAE || 'unknown AE'}</span>
                          : e.kind === 'echo'
                            ? <span>ping from <b>{e.callingAE || 'unknown AE'}</b>{e.remoteAddress ? ` @ ${e.remoteAddress}` : ''}</span>
                            : e.layoutId
                              ? <span>{e.layoutId}</span>
                              : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="border-t border-app-border bg-app-header-bg px-4 py-1.5 text-[10px] text-app-text-muted">
          Capped at 2,000 rows per view. Older entries remain on disk at
          <span className="ml-1 font-mono">%APPDATA%\MediviewBridge\history\{slot.id}\YYYY-MM-DD.jsonl</span>.
        </div>
      </div>
    </div>
  );
}

function KindBadge({ kind }: { kind: SlotHistoryEvent['kind'] }) {
  const styles =
    kind === 'printed'  ? 'bg-green-500/10 text-green-500' :
    kind === 'failed'   ? 'bg-red-500/10 text-red-500' :
    kind === 'echo'     ? 'bg-sky-500/10 text-sky-500' :
                          'bg-app-accent/10 text-app-accent';
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 font-bold uppercase tracking-wide ${styles}`}>
      {kind === 'echo' ? 'PING' : kind}
    </span>
  );
}
