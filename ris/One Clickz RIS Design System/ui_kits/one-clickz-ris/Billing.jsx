/* Billing — Day Book. Mirrors DayBookPage + billingApi (daybook):
   date range, total/count/refunds, by-mode totals, payment list. */
const { useState: useStateBill } = React;

function Billing({ role }) {
  const push = useToast();
  const [from, setFrom] = useStateBill('2026-06-03');
  const [to, setTo] = useStateBill('2026-06-03');
  const d = MOCK.daybook;
  const modes = [
    { key:'cash', label:'Cash', icon:'banknote' },
    { key:'upi',  label:'UPI',  icon:'smartphone' },
    { key:'card', label:'Card', icon:'credit-card' },
    { key:'other',label:'Other',icon:'ellipsis' },
  ];

  return (
    <div className="content-narrow">
      <div className="between" style={{ marginBottom:16, alignItems:'flex-end' }}>
        <DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} label="Day Book period" />
        <div className="flex gap-2">
          <Button variant="secondary" icon="search" onClick={() => push(`Loaded day book ${from} → ${to}`)}>Apply</Button>
          <Button variant="secondary" icon="file-down" onClick={() => push('Exported payments CSV')}>Export CSV</Button>
        </div>
      </div>

      {/* totals */}
      <div className="grid" style={{ gridTemplateColumns:'repeat(4, 1fr)' }}>
        <StatTile icon="indian-rupee" label="Total collection" value={money(d.total)} accent delta={`${d.count} payments`} />
        <StatTile icon="hash" label="Payment count" value={d.count} />
        <StatTile icon="rotate-ccw" label="Refunds" value={money(d.refunds)} delta="1 refund" deltaDir="down" />
        <StatTile icon="wallet" label="Net of refunds" value={money(d.total - d.refunds)} />
      </div>

      {/* by mode */}
      <div className="grid mt-5" style={{ gridTemplateColumns:'repeat(4, 1fr)' }}>
        {modes.map((m) => (
          <div key={m.key} className="card card-pad" style={{ display:'flex', alignItems:'center', gap:12 }}>
            <span className="stat-ico"><Icon name={m.icon} size={16} /></span>
            <div>
              <div className="muted" style={{ fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'.04em' }}>{m.label}</div>
              <div style={{ fontSize:18, fontWeight:700 }}>{money(d.by_mode[m.key] || 0)}</div>
            </div>
          </div>
        ))}
      </div>

      {/* payments list */}
      <div className="card mt-5">
        <div className="card-head">
          <span className="ch-title">Payments</span>
          <span className="ch-actions muted" style={{ fontSize:12 }}>{from === to ? from : `${from} → ${to}`}</span>
        </div>
        <DataTable
          columns={[
            { key:'time', header:'Time', render:(r)=> <span className="mono">{r.time}</span> },
            { key:'visit_no', header:'Visit', render:(r)=> <span className="mono">{r.visit_no}</span> },
            { key:'patient', header:'Patient', render:(r)=> <span className="strong">{r.patient}</span> },
            { key:'mode', header:'Mode', render:(r)=> <StatusChip label={r.mode.toUpperCase()} variant="neutral" /> },
            { key:'ref', header:'Reference', render:(r)=> <span className="mono muted">{r.ref || '—'}</span> },
            { key:'amount', header:'Amount', num:true, render:(r)=> <span style={{ color:r.is_refund?'var(--danger)':'inherit', fontWeight:600 }}>{r.is_refund?'−':''}{money(r.amount)}</span> },
            { key:'rcp', header:'', width:60, render:(r)=> <IconButton sm bordered icon="printer" title="Receipt" onClick={() => push(`Receipt for ${r.visit_no}`)} /> },
          ]}
          rows={MOCK.payments}
          foot={<><span>Showing {MOCK.payments.length} payments</span><span style={{ marginLeft:'auto', fontWeight:600, color:'var(--app-text)' }}>Total {money(d.total)}</span></>}
        />
      </div>
      <div className="field-hint mt-3"><span className="mono">/api/billing/daybook.php</span> · receipts via <span className="mono">/api/billing/receipt.php</span></div>
    </div>
  );
}
window.Billing = Billing;
