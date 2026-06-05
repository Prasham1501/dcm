/* Dashboard — operational overview. Mirrors DashboardPage.tsx
   (apiDashboardSummary + MIS CSV exports), restyled. */
const { useState: useStateDash } = React;

function Dashboard({ role, onNav }) {
  const canExport = ['admin', 'super_admin', 'receptionist'].includes(role);
  const [from, setFrom] = useStateDash('2026-06-01');
  const [to, setTo] = useStateDash('2026-06-03');
  const push = useToast();

  const stats = [
    { icon:'user-plus',  label:'Registrations today', value:'142', delta:'+12 vs yesterday', dir:'up' },
    { icon:'list-checks',label:'Pending worklist',    value:'4',   delta:'2 ultrasound · 2 CT' },
    { icon:'package-check',label:'Ready to collect',  value:'18',  delta:'3 waiting > 1h', dir:'down' },
    { icon:'indian-rupee',label:'Collections today',  value:'₹48,250', accent:true, delta:'23 payments' },
    { icon:'percent',    label:'Commission (MTD)',    value:'₹12,710', delta:'4 doctors' },
  ];

  const recent = MOCK.payments.slice(0, 6);

  return (
    <div className="content-narrow">
      <div className="grid" style={{ gridTemplateColumns:'repeat(5, 1fr)' }}>
        {stats.map((s) => <StatTile key={s.label} icon={s.icon} label={s.label} value={s.value} accent={s.accent} delta={s.delta} deltaDir={s.dir} />)}
      </div>

      <div className="grid mt-5" style={{ gridTemplateColumns:'1.4fr 1fr' }}>
        {/* Recent collections */}
        <div className="card">
          <div className="card-head">
            <span className="ch-title">Recent collections</span>
            <div className="ch-actions"><Button size="sm" variant="ghost" icon="arrow-right" iconRight="arrow-right" onClick={() => onNav('billing')}>Open Day Book</Button></div>
          </div>
          <DataTable
            columns={[
              { key:'time', header:'Time', render:(r)=> <span className="mono">{r.time}</span> },
              { key:'visit_no', header:'Visit', render:(r)=> <span className="mono">{r.visit_no}</span> },
              { key:'patient', header:'Patient', render:(r)=> <span className="strong">{r.patient}</span> },
              { key:'mode', header:'Mode', render:(r)=> <StatusChip label={r.mode.toUpperCase()} variant="neutral" /> },
              { key:'amount', header:'Amount', num:true, render:(r)=> <span style={{color:r.is_refund?'var(--danger)':'inherit'}}>{r.is_refund?'−':''}{money(r.amount)}</span> },
            ]}
            rows={recent}
          />
        </div>

        {/* Quick actions + exports */}
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div className="card card-pad">
            <SectionHeader icon="zap" title="Quick actions" />
            <div className="grid" style={{ gridTemplateColumns:'1fr 1fr', gap:8 }}>
              <Button icon="user-plus" onClick={() => onNav('reception')}>Register patient</Button>
              <Button icon="list-checks" onClick={() => onNav('worklist')}>Open worklist</Button>
              <Button icon="refresh-cw" onClick={() => push('Checked PACS — 1 new study matched')}>Check studies</Button>
              <Button icon="monitor-smartphone" onClick={() => onNav('settings')}>Network setup</Button>
            </div>
          </div>

          {canExport && (
            <div className="card card-pad">
              <SectionHeader icon="download" title="MIS exports" sub="CSV" />
              <DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} label="Period" />
              <div className="flex gap-2 mt-3">
                {['Visits', 'Payments', 'Commission'].map((t) => (
                  <Button key={t} size="sm" variant="secondary" icon="file-down" onClick={() => push(`Exported ${t.toLowerCase()} CSV (${from} → ${to})`)}>{t}</Button>
                ))}
              </div>
              <div className="field-hint mt-3"><span className="mono">/api/reports/export.php</span></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
window.Dashboard = Dashboard;
