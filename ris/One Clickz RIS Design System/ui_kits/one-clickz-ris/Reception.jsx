/* Reception — registration · patient search · visit/order creation · payment.
   Mirrors ReceptionPage.tsx + receptionApi + billingApi flow, restyled into a
   guided two-pane workspace. */
const { useState: useStateRec } = React;

function Reception({ role, onNav }) {
  const isAdmin = ['admin', 'super_admin'].includes(role);
  const push = useToast();

  const [query, setQuery] = useStateRec('');
  const [results, setResults] = useStateRec(MOCK.patients);
  const [selected, setSelected] = useStateRec(null);
  const [showRegister, setShowRegister] = useStateRec(false);

  // visit builder
  const [serviceIds, setServiceIds] = useStateRec([]);
  const [refDoc, setRefDoc] = useStateRec('');
  const [discount, setDiscount] = useStateRec('');
  const [registered, setRegistered] = useStateRec(null); // {visit_no, accessions, net}
  const [showNetwork, setShowNetwork] = useStateRec(false);

  const services = MOCK.services;
  const subtotal = services.filter((s) => serviceIds.includes(s.id)).reduce((a, s) => a + Number(s.price), 0);
  const net = Math.max(0, subtotal - Number(discount || 0));

  const search = () => {
    const q = query.trim().toLowerCase();
    setResults(!q ? MOCK.patients : MOCK.patients.filter((p) => (p.full_name + p.mrn + p.phone).toLowerCase().includes(q)));
  };
  const toggleService = (id) => setServiceIds((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);

  const registerVisit = () => {
    const accs = serviceIds.map((_, i) => `ACC-2026-00${4820 + i}`);
    setRegistered({ visit_no: 'V-1044', accessions: accs, net });
    push(`Registered visit V-1044 · net ${money(net)}`, 'success');
  };
  const reset = () => { setSelected(null); setServiceIds([]); setRefDoc(''); setDiscount(''); setRegistered(null); };

  return (
    <div>
      {/* step indicator */}
      <div className="flex gap-2" style={{ marginBottom:16, alignItems:'center', fontSize:12, color:'var(--app-text-muted)' }}>
        {['Find / register patient', 'Build visit', 'Payment'].map((s, i) => {
          const done = (i === 0 && selected) || (i === 1 && registered);
          const active = (i === 0 && !selected) || (i === 1 && selected && !registered) || (i === 2 && registered);
          return (
            <React.Fragment key={s}>
              <span style={{ display:'flex', alignItems:'center', gap:7, fontWeight: active ? 600 : 500, color: active ? 'var(--app-accent)' : done ? 'var(--success)' : 'var(--app-text-muted)' }}>
                <span style={{ width:20, height:20, borderRadius:999, display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:'#fff', background: active ? 'var(--app-accent)' : done ? 'var(--success)' : 'var(--app-border)' }}>{done ? '✓' : i + 1}</span>
                {s}
              </span>
              {i < 2 && <Icon name="chevron-right" size={14} />}
            </React.Fragment>
          );
        })}
        <div style={{ marginLeft:'auto' }}>
          {isAdmin && <Button size="sm" variant="ghost" icon="monitor-smartphone" onClick={() => setShowNetwork(true)}>Network setup</Button>}
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns:'1fr 1.25fr', alignItems:'start' }}>
        {/* LEFT — patient */}
        <div className="card">
          <div className="card-head">
            <span className="ch-title">Find patient</span>
            <div className="ch-actions"><Button size="sm" variant="primary" icon="user-plus" onClick={() => setShowRegister(true)}>New patient</Button></div>
          </div>
          <div className="card-pad" style={{ paddingBottom:0 }}>
            <div className="flex gap-2">
              <Input placeholder="MRN, name, or phone" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} />
              <Button variant="secondary" icon="search" onClick={search}>Search</Button>
            </div>
          </div>
          <div style={{ padding:'12px 16px 16px' }}>
            <DataTable
              columns={[
                { key:'mrn', header:'MRN', render:(r)=> <span className="mono">{r.mrn}</span> },
                { key:'full_name', header:'Name', render:(r)=> <div><div className="strong">{r.full_name}</div><div className="muted" style={{fontSize:11}}>{r.sex==='female'?'F':'M'} · {r.age_years}y · {r.phone}</div></div> },
                { key:'pick', header:'', width:70, render:(r)=> <Button size="sm" variant={selected&&selected.id===r.id?'primary':'secondary'} onClick={() => { setSelected(r); setRegistered(null); }}>{selected&&selected.id===r.id?'Selected':'Select'}</Button> },
              ]}
              rows={results}
              selectedKey={selected?.id}
              empty={<EmptyState icon="user-search" title="No patients found" sub="Try a different MRN, name, or phone — or register a new patient." />}
            />
          </div>
        </div>

        {/* RIGHT — visit builder / payment */}
        {!selected ? (
          <div className="card" style={{ minHeight:300, display:'flex', alignItems:'center' }}>
            <EmptyState icon="clipboard-list" title="Select a patient to start a visit" sub="Search on the left and choose a patient, or register a new one to begin a new visit and order." />
          </div>
        ) : registered ? (
          <PaymentPane patient={selected} registered={registered} onDone={reset} push={push} />
        ) : (
          <div className="card card-pad">
            <SectionHeader icon="clipboard-plus" title={`New visit — ${selected.full_name}`} sub={selected.mrn}>
              <Button size="sm" variant="ghost" icon="x" onClick={() => setSelected(null)}>Change</Button>
            </SectionHeader>

            <div className="field-label" style={{ marginBottom:7 }}>Services</div>
            <div className="grid" style={{ gridTemplateColumns:'1fr 1fr', gap:7 }}>
              {services.map((s) => {
                const on = serviceIds.includes(s.id);
                return (
                  <label key={s.id} className={`checkrow ${on ? 'checked' : ''}`}>
                    <input type="checkbox" checked={on} onChange={() => toggleService(s.id)} />
                    <span style={{ flex:1, display:'flex', alignItems:'center', gap:6 }}>
                      <ModalityTag modality={s.modality} />
                      <span>{s.name}</span>
                    </span>
                    <span className="muted mono" style={{ fontSize:12 }}>{money(s.price)}</span>
                  </label>
                );
              })}
            </div>

            <div className="grid mt-4" style={{ gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <Select label="Referring doctor" placeholder="— none —" value={refDoc} onChange={(e) => setRefDoc(e.target.value)}
                options={MOCK.referringDoctors.map((d) => ({ value:String(d.id), label:`${d.name} · ${d.clinic_name}` }))} />
              <Input label="Discount (₹)" type="number" placeholder="0" value={discount} onChange={(e) => setDiscount(e.target.value)} />
            </div>

            <div className="divider" />
            <div className="between">
              <div style={{ fontSize:13, color:'var(--app-text-secondary)' }}>
                Subtotal <strong style={{ color:'var(--app-text)' }}>{money(subtotal)}</strong>
                {Number(discount) > 0 && <> · Discount <strong style={{ color:'var(--danger)' }}>−{money(discount)}</strong></>}
                <> · Net <strong style={{ color:'var(--app-text)' }}>{money(net)}</strong></>
              </div>
              <Button variant="primary" icon="check" disabled={serviceIds.length === 0} onClick={registerVisit}>Register visit & generate accession</Button>
            </div>
            <div className="field-hint mt-3"><span className="mono">/api/reception/register.php</span> · generates accession numbers + study UIDs</div>
          </div>
        )}
      </div>

      {showRegister && <RegisterPatientModal onClose={() => setShowRegister(false)} onSaved={(p) => { setShowRegister(false); setSelected(p); setRegistered(null); push(`Registered patient ${p.full_name} · ${p.mrn}`); }} />}
      {showNetwork && <NetworkModal onClose={() => setShowNetwork(false)} />}
    </div>
  );
}

function PaymentPane({ patient, registered, onDone, push }) {
  const [amount, setAmount] = useStateRec(String(registered.net));
  const [mode, setMode] = useStateRec('cash');
  const [paid, setPaid] = useStateRec(false);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <Banner kind="success" icon="check-circle">
        Registered visit <strong>&nbsp;{registered.visit_no}</strong>&nbsp;— net {money(registered.net)}. Accession: <span className="mono">&nbsp;{registered.accessions.join(', ')}</span>
      </Banner>
      <div className="card card-pad">
        <SectionHeader icon="banknote" title="Take payment" sub={`${patient.full_name} · ${registered.visit_no}`} />
        <div className="grid" style={{ gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <Input label="Amount (₹)" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Select label="Mode" value={mode} onChange={(e) => setMode(e.target.value)} options={[{value:'cash',label:'Cash'},{value:'upi',label:'UPI'},{value:'card',label:'Card'},{value:'other',label:'Other'}]} />
        </div>
        <div className="flex gap-2 mt-4">
          <Button variant="success" icon="check" onClick={() => { setPaid(true); push(`Payment of ${money(amount)} (${mode.toUpperCase()}) recorded`); }}>Take payment</Button>
          <Button variant="secondary" icon="printer" disabled={!paid} onClick={() => push('Receipt RCP-2026-0912 generated')}>Generate receipt</Button>
          <div style={{ marginLeft:'auto' }}><Button variant="ghost" icon="plus" onClick={onDone}>New registration</Button></div>
        </div>
        {paid && <div className="mt-3"><StatusChip status="paid" /> <span className="muted" style={{ fontSize:12 }}>Balance ₹0 · receipt ready</span></div>}
        <div className="field-hint mt-3"><span className="mono">/api/billing/take-payment.php</span> · <span className="mono">/api/billing/receipt.php</span></div>
      </div>
    </div>
  );
}

function RegisterPatientModal({ onClose, onSaved }) {
  const [f, setF] = useStateRec({ full_name:'', phone:'', sex:'', age_years:'', husband_or_father_name:'', address:'', id_proof_type:'', id_proof_number:'' });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const save = () => onSaved({ id: Date.now(), mrn: 'MRN-100' + Math.floor(852 + Math.random() * 90), ...f, age_years: f.age_years || 0 });
  return (
    <Modal title="Register patient" sub="Creates a new MRN" icon="user-plus" wide onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="primary" icon="check" disabled={!f.full_name} onClick={save}>Register patient</Button></>}>
      <div className="grid" style={{ gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <Input label="Full name" required value={f.full_name} onChange={(e) => set('full_name', e.target.value)} />
        <Input label="Phone" value={f.phone} onChange={(e) => set('phone', e.target.value)} />
        <Select label="Sex" placeholder="—" value={f.sex} onChange={(e) => set('sex', e.target.value)} options={['female','male','other']} />
        <Input label="Age (yrs)" type="number" value={f.age_years} onChange={(e) => set('age_years', e.target.value)} />
        <Input label="Husband / Father name" value={f.husband_or_father_name} onChange={(e) => set('husband_or_father_name', e.target.value)} />
        <Select label="ID proof type" placeholder="—" value={f.id_proof_type} onChange={(e) => set('id_proof_type', e.target.value)} options={['Aadhaar','PAN','Voter ID','Passport','Driving license']} />
        <Input label="ID proof number" value={f.id_proof_number} onChange={(e) => set('id_proof_number', e.target.value)} />
        <div style={{ gridColumn:'1 / -1' }}><Textarea label="Address" rows={2} value={f.address} onChange={(e) => set('address', e.target.value)} /></div>
      </div>
      <div className="field-hint mt-3"><span className="mono">/api/reception/patients.php</span> (POST)</div>
    </Modal>
  );
}

function NetworkModal({ onClose }) {
  const n = MOCK.network;
  return (
    <Modal title="Connect your devices" sub="Network setup — admins only" icon="network" wide onClose={onClose}
      footer={<Button variant="primary" onClick={onClose}>Done</Button>}>
      <Banner kind="info" icon="info">Open these URLs on other PCs / consoles on the clinic network, and enter the DICOM settings into each machine.</Banner>
      <div className="grid mt-4" style={{ gridTemplateColumns:'1fr 1fr', gap:16 }}>
        <div>
          <div className="field-label" style={{ marginBottom:6 }}>Client access URLs</div>
          <div className="card card-surface card-pad mono" style={{ fontSize:13, lineHeight:1.9 }}>
            {n.client_urls.map((u) => <div key={u} style={{ color:'var(--success)' }}>{u}</div>)}
          </div>
        </div>
        <div>
          <div className="field-label" style={{ marginBottom:6 }}>DICOM modality settings</div>
          <div className="card card-surface card-pad mono" style={{ fontSize:13, lineHeight:1.9 }}>
            <div>Server IP&nbsp; <strong>{n.modality.server_ip}</strong></div>
            <div>AE Title&nbsp;&nbsp; <strong>{n.modality.ae_title}</strong></div>
            <div>DICOM port <strong>{n.modality.dicom_port}</strong></div>
            <div>REST port&nbsp; <strong>{n.modality.rest_port}</strong></div>
          </div>
        </div>
      </div>
      <div className="field-hint mt-3"><span className="mono">/api/system/network-info.php</span></div>
    </Modal>
  );
}
window.Reception = Reception;
