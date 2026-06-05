/* Worklist — doctor & collection console. Mirrors WorklistPage.tsx:
   acquired / in_progress / reported columns + ready-to-collect, plus
   "check for new studies" (match-studies) and transitions. Restyled to a
   board with a toolbar; doctors get open/report/deliver actions. */
const { useState: useStateWl } = React;

function Worklist({ role, onNav }) {
  const isDoctor = ['admin', 'super_admin', 'doctor'].includes(role);
  const push = useToast();
  const [orders, setOrders] = useStateWl(MOCK.worklist);
  const [collection, setCollection] = useStateWl(MOCK.collection);
  const [modality, setModality] = useStateWl('');
  const [matching, setMatching] = useStateWl(false);

  const filtered = modality ? orders.filter((o) => o.modality === modality) : orders;
  const byStatus = (s) => filtered.filter((o) => o.status === s);

  const transition = (id, to, msg) => {
    setOrders((os) => os.map((o) => o.id === id ? { ...o, status: to, doctor: to === 'in_progress' ? 'Dr. Rao' : o.doctor } : o));
    push(msg);
  };
  const deliver = (id) => { setCollection((c) => c.filter((x) => x.id !== id)); setOrders((os) => os.map((o)=> o.id===id?{...o,status:'delivered'}:o)); push('Marked delivered / collected'); };
  const runMatch = () => { setMatching(true); setTimeout(() => { setMatching(false); push('Checked PACS — 1 new study matched to worklist'); }, 700); };

  const cols = [
    { status:'acquired',    title:'Pending (acquired)', tint:'var(--warning)' },
    { status:'in_progress', title:'In progress',        tint:'var(--warning)' },
    { status:'reported',    title:'Reported',           tint:'var(--success)' },
  ];

  return (
    <div>
      {/* toolbar */}
      <div className="between" style={{ marginBottom:16 }}>
        <div className="flex gap-2" style={{ alignItems:'center' }}>
          <Select value={modality} onChange={(e) => setModality(e.target.value)} placeholder="All modalities"
            options={['US','CT','MR','XR','MG']} className="" />
          <span className="muted" style={{ fontSize:12 }}>{filtered.length} orders · auto-refresh 20s</span>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon="refresh-cw" onClick={runMatch} disabled={matching}>{matching ? 'Checking…' : 'Check for new studies'}</Button>
          <Button variant="ghost" icon="rotate-cw" onClick={() => push('Worklist refreshed')}>Refresh</Button>
        </div>
      </div>

      {/* board */}
      <div className="grid" style={{ gridTemplateColumns:'repeat(3, 1fr)', alignItems:'start' }}>
        {cols.map((c) => {
          const rows = byStatus(c.status);
          return (
            <div key={c.status} className="card card-surface" style={{ background:'var(--app-surface)' }}>
              <div className="card-head" style={{ background:'transparent' }}>
                <span className="mod-dot" style={{ background:c.tint, width:8, height:8 }} />
                <span className="ch-title">{c.title}</span>
                <span className="ch-actions"><span className="chip chip-neutral">{rows.length}</span></span>
              </div>
              <div style={{ padding:10, display:'flex', flexDirection:'column', gap:8, minHeight:80 }}>
                {rows.length === 0 ? <div className="muted" style={{ fontSize:12, padding:'14px 6px', textAlign:'center' }}>Empty</div> :
                  rows.map((o) => (
                    <div key={o.id} className="card card-pad" style={{ padding:'11px 12px' }}>
                      <div className="between">
                        <div className="strong" style={{ fontSize:13 }}>{o.patient_name} <span className="muted" style={{ fontWeight:400 }}>{o.sex} · {o.age_years}y</span></div>
                        <ModalityTag modality={o.modality} />
                      </div>
                      <div className="mono muted" style={{ fontSize:11, marginTop:3 }}>{o.accession_number} · {o.scheduled}</div>
                      <div style={{ fontSize:12, color:'var(--app-text-secondary)', marginTop:2 }}>{o.service_name}</div>
                      <div className="flex gap-2 mt-3" style={{ flexWrap:'wrap' }}>
                        {c.status === 'acquired' && (isDoctor
                          ? <Button size="sm" variant="primary" icon="play" onClick={() => transition(o.id, 'in_progress', `Opened ${o.accession_number} in viewer`)}>Open & start</Button>
                          : <span className="muted" style={{ fontSize:11 }}>waiting for doctor</span>)}
                        {c.status === 'in_progress' && <>
                          <Button size="sm" variant="secondary" icon="external-link" onClick={() => push('Opening study in One Clickz Viewer…')}>Open</Button>
                          {isDoctor && <Button size="sm" variant="success" icon="check" onClick={() => transition(o.id, 'reported', `${o.accession_number} marked reported`)}>Mark reported</Button>}
                        </>}
                        {c.status === 'reported' && <>
                          <Button size="sm" variant="secondary" icon="external-link" onClick={() => push('Opening study in One Clickz Viewer…')}>Open</Button>
                          <Button size="sm" variant="success" icon="package-check" onClick={() => deliver(o.id)}>Mark delivered</Button>
                        </>}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* ready to collect */}
      <div className="card mt-5">
        <div className="card-head">
          <Icon name="package-check" size={16} style={{ color:'var(--success)' }} />
          <span className="ch-title">Ready to collect</span>
          <span className="ch-actions"><span className="chip chip-success">{collection.length}</span></span>
        </div>
        <DataTable
          columns={[
            { key:'accession_number', header:'Accession', render:(r)=> <span className="mono">{r.accession_number}</span> },
            { key:'patient_name', header:'Patient', render:(r)=> <span className="strong">{r.patient_name}</span> },
            { key:'mrn', header:'MRN', render:(r)=> <span className="mono">{r.mrn}</span> },
            { key:'service_name', header:'Service' },
            { key:'act', header:'', width:120, render:(r)=> <Button size="sm" variant="success" icon="check" onClick={() => deliver(r.id)}>Collected</Button> },
          ]}
          rows={collection}
          empty={<EmptyState icon="package-check" title="Nothing waiting for collection" />}
        />
      </div>
      <div className="field-hint mt-3"><span className="mono">/api/worklist/doctor-list.php</span> · <span className="mono">/api/worklist/transition.php</span> · <span className="mono">/api/worklist/match-studies.php</span></div>
    </div>
  );
}
window.Worklist = Worklist;
