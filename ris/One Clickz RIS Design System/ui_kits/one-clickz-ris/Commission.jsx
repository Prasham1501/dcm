/* Commission — admin only. Mirrors CommissionPage + commissionApi:
   enable/disable, date range, doctor-wise table, statement view, create &
   pay payouts. */
const { useState: useStateComm } = React;

function Commission({ role }) {
  const push = useToast();
  const isAdmin = ['admin', 'super_admin'].includes(role);
  const [enabled, setEnabled] = useStateComm(true);
  const [from, setFrom] = useStateComm('2026-06-01');
  const [to, setTo] = useStateComm('2026-06-30');
  const [rows, setRows] = useStateComm(MOCK.commissionRows);
  const [open, setOpen] = useStateComm(null); // doctor row for statement

  if (!isAdmin) {
    return <div className="card" style={{ display:'flex', minHeight:280, alignItems:'center' }}>
      <EmptyState icon="lock" title="Admin only" sub="Commission reporting and payouts are restricted to admin and super-admin accounts." />
    </div>;
  }

  const total = rows.reduce((a, r) => a + Number(r.total), 0);
  const pending = rows.filter((r) => r.status === 'pending').reduce((a, r) => a + Number(r.total), 0);
  const pay = (id) => { setRows((rs) => rs.map((r) => r.referring_doctor_id === id ? { ...r, status:'paid' } : r)); push('Payout marked paid'); };

  return (
    <div className="content-narrow">
      <div className="between" style={{ marginBottom:16, alignItems:'flex-end' }}>
        <DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} label="Commission period" />
        <div className="flex gap-3" style={{ alignItems:'center' }}>
          <div className="flex gap-2" style={{ alignItems:'center', fontSize:13 }}>
            <span className="secondary">Commission</span>
            <Toggle on={enabled} onChange={(v) => { setEnabled(v); push(v ? 'Commission enabled' : 'Commission disabled', v ? 'success' : 'info'); }} />
            <StatusChip status={enabled ? 'paid' : 'unpaid'} label={enabled ? 'Enabled' : 'Disabled'} />
          </div>
          <Button variant="secondary" icon="file-down" onClick={() => push('Exported commission CSV')}>Export</Button>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns:'repeat(3, 1fr)' }}>
        <StatTile icon="percent" label="Total commission" value={money(total)} accent />
        <StatTile icon="clock" label="Pending payout" value={money(pending)} delta={`${rows.filter((r)=>r.status==='pending').length} doctors`} />
        <StatTile icon="users" label="Referring doctors" value={rows.length} />
      </div>

      <div className="card mt-5">
        <div className="card-head">
          <span className="ch-title">Doctor-wise commission</span>
          <span className="ch-actions muted" style={{ fontSize:12 }}>{from} → {to}</span>
        </div>
        <DataTable
          columns={[
            { key:'name', header:'Referring doctor', render:(r)=> <div><div className="strong">{r.name}</div><div className="muted" style={{fontSize:11}}>{r.clinic}</div></div> },
            { key:'entries', header:'Entries', num:true },
            { key:'total', header:'Commission', num:true, render:(r)=> <span style={{ fontWeight:600 }}>{money(r.total)}</span> },
            { key:'status', header:'Status', render:(r)=> <StatusChip status={r.status === 'paid' ? 'paid' : 'pending'} label={r.status === 'paid' ? 'Paid' : 'Pending'} /> },
            { key:'act', header:'', width:200, render:(r)=> (
              <div className="flex gap-2" style={{ justifyContent:'flex-end' }}>
                <Button size="sm" variant="secondary" icon="file-text" onClick={() => setOpen(r)}>Statement</Button>
                {r.status === 'pending'
                  ? <Button size="sm" variant="success" icon="check" onClick={() => pay(r.referring_doctor_id)}>Mark paid</Button>
                  : <Button size="sm" variant="ghost" icon="check-check" disabled>Paid</Button>}
              </div>
            ) },
          ]}
          rows={rows}
          onRowClick={setOpen}
          selectedKey={open?.referring_doctor_id}
          rowKey={(r) => r.referring_doctor_id}
          foot={<><span>{rows.length} doctors</span><span style={{ marginLeft:'auto', fontWeight:600, color:'var(--app-text)' }}>Total {money(total)}</span></>}
        />
      </div>
      <div className="field-hint mt-3"><span className="mono">/api/commission/report.php</span> · <span className="mono">/statement.php</span> · <span className="mono">/payouts.php</span> · <span className="mono">/settings.php</span></div>

      {open && <StatementModal row={open} onClose={() => setOpen(null)} onPayout={() => { push(`Payout created for ${open.name}`); setOpen(null); }} />}
    </div>
  );
}

function StatementModal({ row, onClose, onPayout }) {
  const lines = MOCK.statement;
  const total = lines.reduce((a, l) => a + Number(l.commission_amount), 0);
  return (
    <Modal title={`Statement — ${row.name}`} sub={row.clinic} icon="file-text" wide onClose={onClose}
      footer={<>
        <Button variant="secondary" icon="printer" onClick={() => {}}>Print</Button>
        <div style={{ marginLeft:'auto' }} />
        <Button variant="secondary" onClick={onClose}>Close</Button>
        {row.status === 'pending' && <Button variant="primary" icon="banknote" onClick={onPayout}>Create payout</Button>}
      </>}>
      <DataTable
        columns={[
          { key:'accession', header:'Accession', render:(r)=> <span className="mono">{r.accession}</span> },
          { key:'service', header:'Service' },
          { key:'base_amount', header:'Base', num:true, render:(r)=> money(r.base_amount) },
          { key:'rate', header:'Rate', render:(r)=> <span className="muted">{r.rate_type === 'percent' ? `${r.rate_value}%` : money(r.rate_value)}</span> },
          { key:'commission_amount', header:'Commission', num:true, render:(r)=> <span style={{fontWeight:600}}>{money(r.commission_amount)}</span> },
        ]}
        rows={lines}
        foot={<><span>{lines.length} entries · period {lines[0].period_ym}</span><span style={{ marginLeft:'auto', fontWeight:600, color:'var(--app-text)' }}>Total {money(total)}</span></>}
      />
    </Modal>
  );
}
window.Commission = Commission;
