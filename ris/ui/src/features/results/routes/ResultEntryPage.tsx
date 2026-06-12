import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, FileText, Image, Printer, Save, Search, ShieldCheck } from 'lucide-react';
import { Banner, Button, EmptyState, SectionHeader, StatusChip, TextareaInput, TextInput } from '@/components/RisUi';
import {
  apiResultSheet, apiSaveResults, apiSetResultStatus, apiResultGraphs, graphFileUrl, reportPrintUrl,
  type ResultSheet, type ResultOrder, type ResultStatus, type ResultAsset,
} from '../api/resultsApi';
import { apiReceptionVisits, type ReceptionVisitRow } from '@/features/reception/api/receptionApi';
import { formatRisDateTime } from '../../../lib/dateFormat';

function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }

const STATUS_CHIP: Record<ResultStatus, { status: any; label: string }> = {
  registered: { status: 'pending', label: 'Registered' },
  pending: { status: 'pending', label: 'Pending' },
  complete: { status: 'online', label: 'Complete' },
  authenticated: { status: 'online', label: 'Authenticated' },
  printed: { status: 'online', label: 'Printed' },
};

function statusChip(status: ResultStatus) {
  return STATUS_CHIP[status] || { status: 'pending', label: status || 'Registered' };
}

export function ResultEntryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [regNo, setRegNo] = useState('');
  const [sheet, setSheet] = useState<ResultSheet | null>(null);
  const [activeOrderId, setActiveOrderId] = useState<number | null>(null);
  const [values, setValues] = useState<Record<number, string>>({});
  const [remark, setRemark] = useState('');
  const [advice, setAdvice] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [graphs, setGraphs] = useState<ResultAsset[]>([]);
  const [worklist, setWorklist] = useState<ReceptionVisitRow[]>([]);
  const [worklistQuery, setWorklistQuery] = useState('');
  const [worklistFrom, setWorklistFrom] = useState(daysAgo(7));
  const [worklistTo, setWorklistTo] = useState(daysAgo(0));
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  const loadWorklist = async () => {
    try {
      const res = await apiReceptionVisits({ from: worklistFrom, to: worklistTo });
      setWorklist(res.rows);
    } catch { setWorklist([]); }
  };

  useEffect(() => {
    loadWorklist();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worklistFrom, worklistTo]);

  const filteredWorklist = worklistQuery.trim()
    ? worklist.filter((r) => `${r.visit_no} ${r.full_name} ${r.phone || ''}`.toLowerCase().includes(worklistQuery.trim().toLowerCase()))
    : worklist;

  const activeOrder = sheet?.orders.find((o) => o.id === activeOrderId) || null;

  const loadGraphs = async (orderId: number) => {
    try {
      const r = await apiResultGraphs(orderId, false);
      setGraphs(r.assets || []);
    } catch {
      setGraphs([]);
    }
  };

  useEffect(() => {
    if (!activeOrderId) {
      setGraphs([]);
      return;
    }
    loadGraphs(activeOrderId);
    const timer = window.setInterval(() => loadGraphs(activeOrderId), 10000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrderId]);

  const hydrateOrder = (order: ResultOrder | null) => {
    if (!order) { setValues({}); setRemark(''); setAdvice(''); setNote(''); return; }
    const v: Record<number, string> = {};
    order.parameters.forEach((p) => { v[p.id] = p.value || ''; });
    setValues(v);
    setRemark(order.result_remark || '');
    setAdvice(order.result_advice || '');
    setNote(order.result_note || '');
  };

  const loadSheet = async (params: { visitId?: number; visitNo?: string }) => {
    setBusy(true); setError(null); setMessage(null);
    try {
      const next = await apiResultSheet(params);
      setSheet(next);
      const first = next.orders[0] || null;
      setActiveOrderId(first ? first.id : null);
      hydrateOrder(first);
      if (next.visit) setRegNo(next.visit.visit_no);
    } catch (err: any) {
      setError(err?.message || 'Could not load result sheet');
      setSheet(null);
    } finally {
      setBusy(false);
    }
  };

  // Deep link from the reception grid: /results?visit=<id>
  useEffect(() => {
    const visitId = searchParams.get('visit');
    if (visitId) loadSheet({ visitId: Number(visitId) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectOrder = (order: ResultOrder) => {
    setActiveOrderId(order.id);
    hydrateOrder(order);
  };

  const save = async (afterStatus?: ResultStatus) => {
    if (!activeOrder) return;
    setBusy(true); setError(null); setMessage(null);
    try {
      const payload = {
        order_id: activeOrder.id,
        results: activeOrder.parameters
          .filter((p) => Number(p.is_heading) !== 1)
          .map((p) => ({ parameter_id: p.id, value: values[p.id] ?? '' })),
        remark, advice, note,
      };
      let next = await apiSaveResults(payload);
      if (afterStatus) {
        await apiSetResultStatus(activeOrder.id, afterStatus);
        next = await apiResultSheet({ visitId: next.visit!.id });
      }
      setSheet(next);
      const same = next.orders.find((o) => o.id === activeOrder.id) || next.orders[0] || null;
      setActiveOrderId(same ? same.id : null);
      hydrateOrder(same);
      setMessage(afterStatus ? `Saved and marked ${afterStatus}` : 'Results saved');
    } catch (err: any) {
      setError(err?.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const onValueKey = (event: React.KeyboardEvent, index: number) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      const next = inputsRef.current[index + 1];
      if (next) next.focus();
    }
  };

  const editableParams = activeOrder ? activeOrder.parameters : [];

  return (
    <div className="content-narrow">
      <SectionHeader icon={FileText} title="Result entry" sub="Enter, authenticate, and print lab results">
        <div className="actions" style={{ alignItems: 'flex-end' }}>
          {sheet?.visit && <Button variant="ghost" onClick={() => { setSheet(null); setActiveOrderId(null); loadWorklist(); }}>Back to list</Button>}
          <TextInput placeholder="Reg No (e.g. V000002)" value={regNo} onChange={(e) => setRegNo(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') loadSheet({ visitNo: regNo.trim() }); }} style={{ minWidth: 180 }} />
          <Button variant="secondary" icon={Search} disabled={busy || !regNo.trim()} onClick={() => loadSheet({ visitNo: regNo.trim() })}>Load</Button>
          <Button variant="ghost" icon={ChevronLeft} disabled={!sheet?.nav?.prev_visit_id} onClick={() => sheet?.nav?.prev_visit_id && loadSheet({ visitId: sheet.nav.prev_visit_id })}>Prev</Button>
          <Button variant="ghost" icon={ChevronRight} disabled={!sheet?.nav?.next_visit_id} onClick={() => sheet?.nav?.next_visit_id && loadSheet({ visitId: sheet.nav.next_visit_id })}>Next</Button>
        </div>
      </SectionHeader>

      {error && <Banner kind="warning">{error}</Banner>}
      {message && <div className="banner banner-success mt-3">{message}</div>}

      {!sheet?.visit ? (
        <div className="card card-pad mt-4">
          <SectionHeader icon={FileText} title="Registrations" sub="Click a registration to enter its results — no need to type the Reg No.">
            <div className="actions" style={{ alignItems: 'flex-end' }}>
              <TextInput label="From" type="date" value={worklistFrom} onChange={(e) => setWorklistFrom(e.target.value)} />
              <TextInput label="To" type="date" value={worklistTo} onChange={(e) => setWorklistTo(e.target.value)} />
            </div>
          </SectionHeader>
          <TextInput placeholder="Search by name, Reg No, or phone..." value={worklistQuery} onChange={(e) => setWorklistQuery(e.target.value)} className="mt-3" />
          {filteredWorklist.length === 0 ? (
            <EmptyState title="No registrations" sub="Adjust the date range, or register a visit in Reception first." />
          ) : (
            <div className="table-wrap mt-3">
              <table className="dt">
                <thead><tr><th>Reg No</th><th>Patient</th><th>Date / Time</th><th>Doctor</th><th /></tr></thead>
                <tbody>
                  {filteredWorklist.map((r) => (
                    <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => loadSheet({ visitId: r.id })}>
                      <td className="mono">{r.visit_no}</td>
                      <td className="strong">{r.full_name} <span className="field-hint">[{r.age_years || '-'} {r.sex || '-'}]</span></td>
                      <td>{formatRisDateTime(r.visit_datetime)}</td>
                      <td>{r.doctor_name || '-'}</td>
                      <td className="num"><Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); loadSheet({ visitId: r.id }); }}>Open</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="card card-pad mt-4">
            <div className="grid-3">
              <div><div className="field-label">Patient</div><div className="strong">{[sheet.visit.name_prefix, sheet.visit.full_name].filter(Boolean).join(' ')}</div><div className="field-hint">{sheet.visit.mrn} · {sheet.visit.age_years ?? '-'} / {sheet.visit.sex ?? '-'}</div></div>
              <div><div className="field-label">Reg No</div><div className="strong mono">{sheet.visit.visit_no}</div><div className="field-hint">{formatRisDateTime(sheet.visit.visit_datetime)}</div></div>
              <div><div className="field-label">Doctor</div><div className="strong">{sheet.visit.doctor_name || 'Self'}</div></div>
            </div>
          </div>

          <div className="grid-2 mt-4" style={{ gridTemplateColumns: '1fr 280px', alignItems: 'start' }}>
            <div className="card card-pad">
              {!activeOrder ? <EmptyState title="No tests on this visit" /> : (
                <>
                  <SectionHeader icon={FileText} title={activeOrder.service_name || 'Test'} sub={activeOrder.lab_name ? `Outsourced: ${activeOrder.lab_name}` : 'Enter values, press Enter to move down'}>
                    <StatusChip {...statusChip(activeOrder.result_status)} />
                  </SectionHeader>
                  {editableParams.length === 0 ? (
                    <EmptyState title="No parameters configured" sub="Add parameters for this test in Settings → Test parameters." />
                  ) : (
                    <div className="table-wrap mt-3">
                      <table className="dt">
                        <thead><tr><th style={{ width: '40%' }}>Parameter</th><th>Value</th><th>Unit</th><th>Reference</th></tr></thead>
                        <tbody>
                          {editableParams.map((p, idx) => Number(p.is_heading) === 1 ? (
                            <tr key={p.id}><td colSpan={4} className="strong" style={{ background: 'var(--app-hover)' }}>{p.name}</td></tr>
                          ) : (
                            <tr key={p.id}>
                              <td>{p.name}{p.formula ? <span className="field-hint"> (auto)</span> : null}</td>
                              <td>
                                <input
                                  ref={(el) => { inputsRef.current[idx] = el; }}
                                  className="input"
                                  type={p.input_type === 'numeric' ? 'number' : 'text'}
                                  inputMode={p.input_type === 'numeric' ? 'decimal' : undefined}
                                  step="any"
                                  style={{ maxWidth: 140, fontWeight: p.flag === 'H' || p.flag === 'L' ? 700 : 400, color: p.flag === 'H' ? 'var(--danger,#dc2626)' : p.flag === 'L' ? '#2563eb' : undefined }}
                                  value={values[p.id] ?? ''}
                                  disabled={activeOrder.result_status === 'authenticated' || activeOrder.result_status === 'printed'}
                                  placeholder={p.formula ? 'auto (or type to override)' : ''}
                                  onChange={(e) => setValues((v) => ({ ...v, [p.id]: e.target.value }))}
                                  onKeyDown={(e) => onValueKey(e, idx)}
                                />
                                {p.flag === 'H' ? <span title="High" style={{ color: 'var(--danger,#dc2626)' }}> ↑</span> : p.flag === 'L' ? <span title="Low" style={{ color: '#2563eb' }}> ↓</span> : null}
                              </td>
                              <td className="field-hint">{p.unit || ''}</td>
                              <td className="field-hint">{p.range_text || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <TextareaInput label="Remark" rows={2} className="mt-3" value={remark} onChange={(e) => setRemark(e.target.value)} />
                  <div className="grid-2 mt-3">
                    <TextareaInput label="Advice" rows={2} value={advice} onChange={(e) => setAdvice(e.target.value)} />
                    <TextareaInput label="Note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
                  </div>
                  <div className="actions mt-4">
                    <Button variant="primary" icon={Save} disabled={busy} onClick={() => save()}>Save</Button>
                    <Button variant="secondary" disabled={busy} onClick={() => save('complete')}>Complete</Button>
                    <Button variant="secondary" disabled={busy} onClick={() => save('pending')}>Pending</Button>
                    <Button variant="success" icon={ShieldCheck} disabled={busy} onClick={() => save('authenticated')}>Authenticate</Button>
                    <a className="btn btn-ghost" href={reportPrintUrl(activeOrder.id, { header: true, preview: true })} target="_blank" rel="noreferrer">Preview</a>
                    <a className="btn btn-secondary" href={reportPrintUrl(activeOrder.id, { header: true })} target="_blank" rel="noreferrer"><Printer size={16} /> Report (letterhead)</a>
                    <a className="btn btn-ghost" href={reportPrintUrl(activeOrder.id, { header: false })} target="_blank" rel="noreferrer">Report (blank header)</a>
                  </div>

                  <div className="divider" />
                  <div className="field-label"><Image size={14} /> Machine data received automatically</div>
                  {graphs.length === 0 ? (
                    <div className="field-hint mt-3">No machine files yet. They appear here automatically when the machine or reporting software sends them, and print on the report.</div>
                  ) : (
                    <div className="grid-auto mt-3">
                      {graphs.map((g) => (
                        <a key={g.id} href={graphFileUrl(g.id)} target="_blank" rel="noreferrer" className="card card-surface card-pad" style={{ textAlign: 'center', textDecoration: 'none' }}>
                          {g.asset_type === 'pdf'
                            ? <div className="strong">{g.title || 'PDF'} (PDF)</div>
                            : <img src={graphFileUrl(g.id)} alt={g.title || ''} style={{ maxWidth: '100%', maxHeight: 120, objectFit: 'contain' }} />}
                          <div className="field-hint mt-1">{g.title}</div>
                        </a>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="card card-pad">
              <div className="field-label">Tests on this visit ({sheet.orders.length})</div>
              <div className="stack-tight mt-3" style={{ display: 'grid', gap: 8 }}>
                {sheet.orders.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    className={`checkrow ${o.id === activeOrderId ? 'checked' : ''}`}
                    style={{ textAlign: 'left', cursor: 'pointer' }}
                    onClick={() => selectOrder(o)}
                  >
                    <span style={{ flex: 1 }}>
                      <span className="strong">{o.service_name || 'Test'}</span>
                      <div className="field-hint">Rs {o.price}</div>
                    </span>
                    <StatusChip {...statusChip(o.result_status)} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
