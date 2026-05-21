// Dashboard pages — Devices, Wallet, AI, Invoices, Tickets, Bugs, Team, Analytics, Audit, Admin, Referrals, Settings.
// All data comes from the live API — no dummy values.

// ─── Shared helpers ───────────────────────────────────────────────────────────
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' });
}
function fmtDateOnly(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function timeAgo(date) {
  if (!date) return '—';
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60)   return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400)return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
const EmptyState = ({ icon, title, subtitle, action }) => (
  <div className="py-16 text-center">
    <div className="mx-auto mb-3 opacity-25">{icon}</div>
    <div className="font-display font-bold text-lg">{title}</div>
    {subtitle && <div className="text-sm text-[var(--muted)] mt-1">{subtitle}</div>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);
const Spinner = () => (
  <div className="py-16 flex justify-center">
    <div className="h-8 w-8 rounded-full border-2 border-rose border-t-transparent animate-spin"/>
  </div>
);

// ─── PLAN_LABELS / STATUS_COLORS used in Licenses ─────────────────────────────
const PLAN_LABELS  = { trial: 'Trial', monthly: 'Monthly', annual: 'Annual' };
const PLAN_COLORS  = { trial: 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/15', monthly: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-500/15', annual: 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/15' };
const STATUS_COLORS= { active: 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/15', expired: 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-500/15', suspended: 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/15' };

// =============== Devices ===============
const PageDevices = () => {
  const [devices,     setDevices]     = React.useState([]);
  const [licenses,    setLicenses]    = React.useState([]);
  const [loading,     setLoading]     = React.useState(true);
  const [showRegister,setShowRegister]= React.useState(false);
  const [manageDev,   setManageDev]   = React.useState(null);
  const [working,     setWorking]     = React.useState(false);

  const load = () => {
    setLoading(true);
    Promise.allSettled([mvApi.devices(), mvApi.licenses()])
      .then(([devRes, licRes]) => {
        setDevices(devRes.status === 'fulfilled' && Array.isArray(devRes.value) ? devRes.value : []);
        setLicenses(licRes.status === 'fulfilled' && Array.isArray(licRes.value) ? licRes.value : []);
      })
      .catch(() => { setDevices([]); setLicenses([]); })
      .finally(() => setLoading(false));
  };
  React.useEffect(load, []);

  const deactivate = async (id) => {
    if (!confirm('Deactivate this device? This will free a license seat.')) return;
    setWorking(true);
    try {
      await mvApi.deactivateDevice(id);
      setManageDev(null);
      load();
    } catch (e) {
      alert(e.message || 'Could not deactivate device.');
    } finally { setWorking(false); }
  };

  const statusFor = (d) => {
    if (d.status !== 'active') return 'offline';
    const ms = d.last_heartbeat_at ? Date.now() - new Date(d.last_heartbeat_at).getTime() : Infinity;
    return ms < 5 * 60 * 1000 ? 'online' : ms < 2 * 60 * 60 * 1000 ? 'idle' : 'offline';
  };
  const statusCls = { online: 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400', idle: 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400', offline: 'bg-zinc-100 dark:bg-white/10 text-zinc-600 dark:text-zinc-400' };
  const dotCls    = { online: 'bg-emerald-500 animate-pulse', idle: 'bg-amber-500', offline: 'bg-zinc-400' };

  return (
    <DashShell activeId="devices" title="Devices" subtitle="Workstations licensed under your account."
      action={<DButton variant="primary" onClick={() => setShowRegister(true)}><I.Plus size={14}/> Register device</DButton>}>
      <div className="rounded-2xl border border-[var(--line)] bg-white dark:bg-mid2 overflow-hidden">
        {loading ? <Spinner/> : devices.length === 0 ? (
          <EmptyState icon={<I.Monitor size={40}/>} title="No devices yet" subtitle="Install Mediview on a workstation and register it here." action={<DButton variant="primary" onClick={() => setShowRegister(true)}>Register first device</DButton>}/>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-paper2 dark:bg-white/[0.04] text-xs uppercase tracking-wider text-[var(--muted)]">
              <tr>
                <th className="text-left px-5 py-3 font-bold">Device</th>
                <th className="text-left px-5 py-3 font-bold hidden md:table-cell">OS</th>
                <th className="text-left px-5 py-3 font-bold">Last seen</th>
                <th className="text-left px-5 py-3 font-bold">Status</th>
                <th className="px-5 py-3"/>
              </tr>
            </thead>
            <tbody>
              {devices.map(d => {
                const s = statusFor(d);
                return (
                  <tr key={d.id} className="border-t border-[var(--line)] hover:bg-paper2/60 dark:hover:bg-white/[0.03]">
                    <td className="px-5 py-4">
                      <div className="font-bold">{d.machine_name || d.name || d.id}</div>
                      <div className="text-xs font-mono text-[var(--muted)]">{d.fingerprint || d.id}</div>
                    </td>
                    <td className="px-5 py-4 hidden md:table-cell text-[var(--muted)]">{d.os || '—'}</td>
                    <td className="px-5 py-4 text-[var(--muted)]">{timeAgo(d.last_heartbeat_at)}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold ${statusCls[s]}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${dotCls[s]}`}/>
                        {s}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button onClick={() => setManageDev(d)} className="text-xs font-bold text-rose hover:underline">Manage</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Register modal */}
      <Modal open={showRegister} onClose={() => setShowRegister(false)} title="Register a new device">
        <div className="space-y-4">
          <p className="text-sm text-[var(--muted)]">The registration code is your license key. Install Mediview on the workstation, open Settings → License, paste one of the active keys below, and click Activate. The workstation will appear here after activation.</p>
          {licenses.filter(l => l.status === 'active').length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--line)] p-4 text-sm text-[var(--muted)]">
              No active license is available. <a href="#/dashboard/licenses" className="text-rose font-semibold hover:underline">Order a license</a> first.
            </div>
          ) : (
            <div className="space-y-2">
              {licenses.filter(l => l.status === 'active').map(lic => (
                <div key={lic.id} className="rounded-xl border border-[var(--line)] bg-paper2/60 dark:bg-white/[0.04] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider font-bold text-[var(--muted)]">{PLAN_LABELS[lic.plan] || lic.plan} · {lic.seats_used ?? 0}/{lic.seats} devices</div>
                      <code className="block mt-1 font-mono text-sm font-bold tracking-widest select-all">{lic.key_code}</code>
                    </div>
                    <DButton size="sm" variant="ghost" onClick={() => navigator.clipboard?.writeText(lic.key_code)}>Copy</DButton>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <DButton variant="primary" onClick={() => setShowRegister(false)}>Done</DButton>
          </div>
        </div>
      </Modal>

      {/* Manage device modal */}
      <Modal open={!!manageDev} onClose={() => setManageDev(null)} title={`Manage — ${manageDev?.machine_name || manageDev?.name || ''}`} size="lg">
        {manageDev && (
          <div className="space-y-5">
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-[var(--line)] p-3">
                <div className="text-[10px] uppercase font-bold text-[var(--muted)]">Device ID</div>
                <div className="font-mono text-xs mt-1">{manageDev.fingerprint || manageDev.id}</div>
              </div>
              <div className="rounded-xl border border-[var(--line)] p-3">
                <div className="text-[10px] uppercase font-bold text-[var(--muted)]">OS</div>
                <div className="font-semibold mt-1">{manageDev.os || '—'}</div>
              </div>
              <div className="rounded-xl border border-[var(--line)] p-3">
                <div className="text-[10px] uppercase font-bold text-[var(--muted)]">Activated</div>
                <div className="text-xs mt-1">{fmtDateOnly(manageDev.activated_at)}</div>
              </div>
              <div className="rounded-xl border border-[var(--line)] p-3">
                <div className="text-[10px] uppercase font-bold text-[var(--muted)]">Last seen</div>
                <div className="font-semibold mt-1">{timeAgo(manageDev.last_heartbeat_at)}</div>
              </div>
            </div>

            <div className="rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 p-3 text-xs flex items-start gap-2">
              <I.Lock size={14} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0"/>
              <div>Deactivating this device frees a license seat. The workstation can re-activate at any time.</div>
            </div>

            <div className="pt-3 border-t border-[var(--line)] flex items-center justify-between">
              <button onClick={() => deactivate(manageDev.id)} disabled={working}
                className="text-xs font-bold text-rose hover:underline inline-flex items-center gap-1 disabled:opacity-50">
                <I.Trash size={12}/> {working ? 'Deactivating…' : 'Deactivate device'}
              </button>
              <DButton variant="ghost" onClick={() => setManageDev(null)}>Close</DButton>
            </div>
          </div>
        )}
      </Modal>
    </DashShell>
  );
};

// =============== Print wallet ===============
const PageWallet = () => {
  const [wallet, setWallet] = React.useState(null);
  const [loading, setLoading]= React.useState(true);
  const [open, setOpen]      = React.useState(false);

  const load = () => {
    setLoading(true);
    mvApi.wallet('print')
      .then(d => setWallet(d))
      .catch(() => setWallet({ balance: 0, txns: [] }))
      .finally(() => setLoading(false));
  };
  React.useEffect(load, []);

  const balance = wallet?.balance ?? 0;
  const topups  = (wallet?.txns || []).filter(t => (t.credits_delta ?? 0) > 0);

  return (
    <DashShell activeId="wallet" title="Print wallet" subtitle="Manage credits and download invoices."
      action={<DButton variant="primary" onClick={() => setOpen(true)}>+ Top up</DButton>}>
      {loading ? <Spinner/> : (
        <>
          <div className="grid lg:grid-cols-2 gap-4 mb-6">
            <div className="rounded-2xl border border-[var(--line)] bg-white dark:bg-mid2 p-5">
              <div className="text-xs uppercase tracking-wider font-bold text-[var(--muted)]">Current balance</div>
              <div className="font-display text-4xl font-bold mt-2">{balance.toLocaleString('en-IN')}</div>
              <div className="text-xs text-[var(--muted)]">pages remaining</div>
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-white dark:bg-mid2 p-5">
              <div className="text-xs uppercase tracking-wider font-bold text-[var(--muted)]">Top-ups</div>
              <div className="font-display text-4xl font-bold mt-2">{topups.length}</div>
              <div className="text-xs text-[var(--muted)]">total purchases</div>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--line)] bg-white dark:bg-mid2 overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--line)]">
              <h3 className="font-display font-bold text-lg">Transactions</h3>
            </div>
            {topups.length === 0 ? (
              <EmptyState icon={<I.Printer size={36}/>} title="No transactions yet" subtitle="Your top-up history will appear here."/>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-paper2 dark:bg-white/[0.04] text-xs uppercase tracking-wider text-[var(--muted)]">
                  <tr>
                    <th className="text-left px-5 py-3 font-bold">Date</th>
                    <th className="text-left px-5 py-3 font-bold">Pages added</th>
                    <th className="text-left px-5 py-3 font-bold hidden md:table-cell">Invoice</th>
                    <th className="px-5 py-3"/>
                  </tr>
                </thead>
                <tbody>
                  {topups.map(t => (
                    <tr key={t.id} className="border-t border-[var(--line)]">
                      <td className="px-5 py-4 text-[var(--muted)]">{fmtDate(t.created_at)}</td>
                      <td className="px-5 py-4 font-mono">+{(t.credits_delta || 0).toLocaleString('en-IN')}</td>
                      <td className="px-5 py-4 hidden md:table-cell font-mono text-xs text-[var(--muted)]">{t.invoice_id || '—'}</td>
                      <td className="px-5 py-4 text-right">
                        {t.invoice_id && (
                          <button
                            onClick={() => mvApi.downloadInvoice(t.invoice_id).catch(e => alert(e.message))}
                            className="text-xs font-bold text-rose hover:underline inline-flex items-center gap-1">
                            <I.Download size={12}/> Download
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Top up print wallet">
        <PrintRecharge onSuccess={() => { setOpen(false); load(); }} onCancel={() => setOpen(false)} />
      </Modal>
    </DashShell>
  );
};

// =============== AI credits ===============
const PageAI = () => {
  const [wallet, setWallet] = React.useState(null);
  const [loading, setLoading]= React.useState(true);
  const [open, setOpen]      = React.useState(false);

  const load = () => {
    setLoading(true);
    mvApi.wallet('ai')
      .then(d => setWallet(d))
      .catch(() => setWallet({ balance: 0, txns: [] }))
      .finally(() => setLoading(false));
  };
  React.useEffect(load, []);

  const balance = wallet?.balance ?? 0;
  const txns    = (wallet?.txns || []);
  const topups  = txns.filter(t => (t.credits_delta ?? 0) > 0);
  const spends  = txns.filter(t => (t.credits_delta ?? 0) < 0);

  return (
    <DashShell activeId="ai" title="AI credits" subtitle="Findings drafts, follow-up suggestions, and report polishing."
      action={<DButton variant="primary" onClick={() => setOpen(true)}>+ Top up</DButton>}>
      {loading ? <Spinner/> : (
        <>
          <div className="grid lg:grid-cols-3 gap-4 mb-6">
            <div className="rounded-2xl border border-[var(--line)] bg-white dark:bg-mid2 p-5">
              <div className="text-xs uppercase tracking-wider font-bold text-amber-700 dark:text-amber-400">Balance</div>
              <div className="font-display text-5xl font-bold mt-2">{balance.toLocaleString('en-IN')}</div>
              <div className="text-xs text-[var(--muted)] mt-1">credits · 1 credit = 1 inference</div>
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-white dark:bg-mid2 p-5">
              <div className="text-xs uppercase tracking-wider font-bold text-[var(--muted)]">Top-ups</div>
              <div className="font-display text-5xl font-bold mt-2">{topups.length}</div>
              <div className="text-xs text-[var(--muted)]">total purchases</div>
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-white dark:bg-mid2 p-5">
              <div className="text-xs uppercase tracking-wider font-bold text-[var(--muted)]">Inferences used</div>
              <div className="font-display text-5xl font-bold mt-2">{spends.reduce((s, t) => s + Math.abs(t.credits_delta || 0), 0).toLocaleString('en-IN')}</div>
              <div className="text-xs text-[var(--muted)]">all time</div>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--line)] bg-white dark:bg-mid2 overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--line)]">
              <h3 className="font-display font-bold text-lg">Transaction history</h3>
            </div>
            {txns.length === 0 ? (
              <EmptyState icon={<I.Sparkles size={36}/>} title="No AI transactions yet" subtitle="Top up to start using AI-powered analysis."/>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-paper2 dark:bg-white/[0.04] text-xs uppercase tracking-wider text-[var(--muted)]">
                  <tr>
                    <th className="text-left px-5 py-3 font-bold">Date</th>
                    <th className="text-left px-5 py-3 font-bold">Type</th>
                    <th className="text-left px-5 py-3 font-bold">Credits</th>
                    <th className="text-left px-5 py-3 font-bold hidden md:table-cell">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {txns.map(t => (
                    <tr key={t.id} className="border-t border-[var(--line)]">
                      <td className="px-5 py-4 text-[var(--muted)]">{fmtDate(t.created_at)}</td>
                      <td className="px-5 py-4 capitalize">
                        <Pill tone={(t.credits_delta ?? 0) > 0 ? 'teal' : 'rose'}>{t.kind || ((t.credits_delta ?? 0) > 0 ? 'topup' : 'spend')}</Pill>
                      </td>
                      <td className={`px-5 py-4 font-mono font-bold ${(t.credits_delta ?? 0) > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose'}`}>
                        {(t.credits_delta ?? 0) > 0 ? '+' : ''}{(t.credits_delta || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="px-5 py-4 hidden md:table-cell text-xs text-[var(--muted)]">{t.meta || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Top up AI credits">
        <AIRecharge onSuccess={() => { setOpen(false); load(); }} onCancel={() => setOpen(false)} />
      </Modal>
    </DashShell>
  );
};

// =============== Invoices ===============
const PageInvoices = () => {
  const [result,  setResult]  = React.useState({ data: [], total: 0 });
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    mvApi.invoices()
      .then(d => setResult(d && d.data ? d : { data: Array.isArray(d) ? d : [], total: 0 }))
      .catch(() => setResult({ data: [], total: 0 }))
      .finally(() => setLoading(false));
  }, []);

  return (
    <DashShell activeId="invoices" title="Invoices" subtitle="Download GST invoices for accounting.">
      <div className="rounded-2xl border border-[var(--line)] bg-white dark:bg-mid2 overflow-hidden">
        {loading ? <Spinner/> : result.data.length === 0 ? (
          <EmptyState icon={<I.FileText size={36}/>} title="No invoices yet" subtitle="Invoices will appear here after your first payment."/>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-paper2 dark:bg-white/[0.04] text-xs uppercase tracking-wider text-[var(--muted)]">
              <tr>
                <th className="text-left px-5 py-3 font-bold">Invoice</th>
                <th className="text-left px-5 py-3 font-bold">Date</th>
                <th className="text-left px-5 py-3 font-bold">Amount</th>
                <th className="text-left px-5 py-3 font-bold">Status</th>
                <th className="px-5 py-3"/>
              </tr>
            </thead>
            <tbody>
              {result.data.map(inv => (
                <tr key={inv.id} className="border-t border-[var(--line)]">
                  <td className="px-5 py-4 font-mono text-xs">{inv.number || inv.id}</td>
                  <td className="px-5 py-4 text-[var(--muted)]">{fmtDateOnly(inv.created_at)}</td>
                  <td className="px-5 py-4 font-mono">{fmt.inr(inv.total_inr || inv.amount_inr || 0)}</td>
                  <td className="px-5 py-4">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                      <I.Check size={11}/> {inv.status || 'paid'}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button
                      onClick={() => mvApi.downloadInvoice(inv.id, inv.number).catch(e => alert(e.message))}
                      className="text-xs font-bold text-rose hover:underline inline-flex items-center gap-1">
                      <I.Download size={12}/> PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </DashShell>
  );
};

// =============== Tickets ===============
const PageTickets = () => {
  const [tickets, setTickets]   = React.useState([]);
  const [loading, setLoading]   = React.useState(true);
  const [showNew, setShowNew]   = React.useState(false);
  const [selectedTicket, setSelectedTicket] = React.useState(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [form, setForm]         = React.useState({ subject: '', category: 'how-to', body: '' });
  const [err, setErr]           = React.useState('');

  const load = () => {
    setLoading(true);
    mvApi.tickets()
      .then(d => setTickets(Array.isArray(d) ? d : []))
      .catch(() => setTickets([]))
      .finally(() => setLoading(false));
  };
  React.useEffect(load, []);

  const submit = async () => {
    if (!form.subject.trim() || !form.body.trim()) { setErr('Subject and description are required.'); return; }
    setSubmitting(true); setErr('');
    try {
      await mvApi.createTicket({ category: form.category, subject: form.subject, body: form.body });
      setShowNew(false);
      setForm({ subject: '', category: 'how-to', body: '' });
      load();
    } catch (e) {
      setErr(e.message || 'Could not submit ticket.');
    } finally { setSubmitting(false); }
  };

  const statusTone = (s) => s === 'open' ? 'amber' : s === 'answered' || s === 'waiting' ? 'teal' : 'emerald';

  return (
    <DashShell activeId="tickets" title="Support tickets" subtitle="Get help from our team or our AI agent."
      action={<DButton variant="primary" onClick={() => setShowNew(true)}><I.Plus size={14}/> New ticket</DButton>}>
      {loading ? <Spinner/> : tickets.length === 0 ? (
        <EmptyState icon={<I.MessageCircle size={40}/>} title="No tickets yet" subtitle="Need help? Open a ticket and our team will respond promptly."
          action={<DButton variant="primary" onClick={() => setShowNew(true)}>Open first ticket</DButton>}/>
      ) : (
        <div className="rounded-2xl border border-[var(--line)] bg-white dark:bg-mid2 overflow-hidden">
          {tickets.map((t, i) => (
            <button key={t.id} onClick={() => setSelectedTicket(t)} className={`w-full text-left px-5 py-4 hover:bg-paper2/60 dark:hover:bg-white/[0.03] ${i > 0 ? 'border-t border-[var(--line)]' : ''}`}>
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-[var(--muted)]">{t.id}</span>
                    <Pill tone={statusTone(t.status)}>{t.status}</Pill>
                    {t.category && <Pill tone="teal">{t.category}</Pill>}
                  </div>
                  <div className="font-display font-bold text-base mt-1.5">{t.subject}</div>
                  <div className="text-xs text-[var(--muted)] mt-1">
                    {t.message_count || 0} {t.message_count === 1 ? 'message' : 'messages'} · opened {fmtDateOnly(t.created_at)}
                  </div>
                </div>
                <I.ArrowRight size={16} className="text-[var(--muted)] shrink-0 mt-1"/>
              </div>
            </button>
          ))}
        </div>
      )}

      <Modal open={showNew} onClose={() => { setShowNew(false); setErr(''); }} title="New support ticket" size="lg">
        <div className="space-y-4">
          <div className="rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 p-3 text-xs flex items-start gap-2">
            <I.Sparkles size={14} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0"/>
            <div>Try asking <span className="font-bold">Medi</span> in chat first — most issues are resolved instantly.</div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <DLabel>Category</DLabel>
              <select className="h-10 w-full px-3 rounded-lg border border-[var(--line)] bg-white dark:bg-white/[0.04] text-sm"
                value={form.category} onChange={e => setForm(f => ({...f, category: e.target.value}))}>
                <option value="how-to">How-to / Usage</option>
                <option value="bug">Bug report</option>
                <option value="billing">Billing</option>
                <option value="feature">Feature request</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <DLabel>Subject</DLabel>
              <DInput placeholder="Briefly describe the issue" value={form.subject} onChange={e => setForm(f => ({...f, subject: e.target.value}))}/>
            </div>
          </div>
          <div>
            <DLabel>Description</DLabel>
            <textarea className="w-full px-3 py-2 rounded-lg border border-[var(--line)] bg-white dark:bg-white/[0.04] text-sm min-h-[120px]"
              placeholder="Steps to reproduce, error messages, what you expected to happen…"
              value={form.body} onChange={e => setForm(f => ({...f, body: e.target.value}))}/>
          </div>
          {err && <div className="text-xs text-rose font-semibold">{err}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <DButton variant="ghost" onClick={() => { setShowNew(false); setErr(''); }}>Cancel</DButton>
            <DButton variant="primary" onClick={submit} disabled={submitting}>{submitting ? 'Submitting…' : 'Submit ticket'}</DButton>
          </div>
        </div>
      </Modal>

      <Modal open={!!selectedTicket} onClose={() => setSelectedTicket(null)} title={selectedTicket?.subject || 'Support ticket'} size="lg">
        {selectedTicket && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs text-[var(--muted)]">{selectedTicket.id}</span>
              <Pill tone={statusTone(selectedTicket.status)}>{selectedTicket.status}</Pill>
              {selectedTicket.category && <Pill tone="teal">{selectedTicket.category}</Pill>}
            </div>
            <div className="space-y-3">
              {(selectedTicket.messages || []).map(m => (
                <div key={m.id} className={`rounded-xl border border-[var(--line)] p-3 ${m.sender_role === 'admin' ? 'bg-teal-soft/40 dark:bg-teal/10' : 'bg-paper2/60 dark:bg-white/[0.04]'}`}>
                  <div className="text-[10px] uppercase tracking-wider font-bold text-[var(--muted)] mb-1">{m.sender_role === 'admin' ? 'Support' : 'You'} · {fmtDate(m.created_at)}</div>
                  <div className="text-sm whitespace-pre-wrap">{m.body}</div>
                </div>
              ))}
            </div>
            {selectedTicket.status === 'closed' && (
              <div className="rounded-xl border border-emerald-300/40 bg-emerald-50 dark:bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300 font-semibold">
                This ticket has been resolved.
              </div>
            )}
            <div className="flex justify-end">
              <DButton variant="ghost" onClick={() => setSelectedTicket(null)}>Close</DButton>
            </div>
          </div>
        )}
      </Modal>
    </DashShell>
  );
};

// =============== Bugs & ideas ===============
const PageBugs = () => {
  const [bugs,   setBugs]   = React.useState([]);
  const [loading,setLoading]= React.useState(true);
  const [showNew,setShowNew]= React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [form, setForm]     = React.useState({ title: '', type: 'bug', description: '' });
  const [err,  setErr]      = React.useState('');

  const load = () => {
    setLoading(true);
    mvApi.bugs()
      .then(d => setBugs(Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : [])))
      .catch(() => setBugs([]))
      .finally(() => setLoading(false));
  };
  React.useEffect(load, []);

  const submit = async () => {
    if (!form.title.trim()) { setErr('Title is required.'); return; }
    if (form.description.trim().length < 10) { setErr('Description must be at least 10 characters.'); return; }
    setSubmitting(true); setErr('');
    try {
      await mvApi.createBug({ title: form.title, description: form.description, severity: form.type === 'bug' ? 'medium' : 'low', type: form.type });
      setShowNew(false);
      setForm({ title: '', type: 'bug', description: '' });
      load();
    } catch (e) {
      setErr(e.message || 'Could not submit report.');
    } finally { setSubmitting(false); }
  };

  return (
    <DashShell activeId="bugs" title="Bugs & ideas" subtitle="Help us improve. File a bug or suggest a feature."
      action={<DButton variant="primary" onClick={() => setShowNew(true)}><I.Plus size={14}/> Report</DButton>}>
      {loading ? <Spinner/> : bugs.length === 0 ? (
        <EmptyState icon={<I.Bug size={40}/>} title="No reports yet" subtitle="Found a bug or have an idea? File it here."
          action={<DButton variant="primary" onClick={() => setShowNew(true)}>File first report</DButton>}/>
      ) : (
        <div className="space-y-2">
          {bugs.map(b => (
            <div key={b.id} className="rounded-xl border border-[var(--line)] bg-white dark:bg-mid2 p-4 flex items-center gap-4 hover:border-rose/40 transition">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs text-[var(--muted)]">{b.id}</span>
                  <Pill tone={b.type === 'bug' || b.severity ? 'rose' : 'teal'}>{b.type || 'bug'}</Pill>
                  <Pill tone={b.status === 'fixed' || b.status === 'closed' ? 'emerald' : b.status === 'in-progress' ? 'amber' : 'teal'}>{b.status}</Pill>
                </div>
                <div className="font-semibold mt-1.5">{b.title}</div>
                {b.description && <div className="text-xs text-[var(--muted)] mt-0.5 truncate">{b.description}</div>}
              </div>
              <div className="text-xs text-[var(--muted)] shrink-0">{fmtDateOnly(b.created_at)}</div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showNew} onClose={() => { setShowNew(false); setErr(''); }} title="Report a bug or suggest a feature" size="lg">
        <div className="space-y-4">
          <div>
            <DLabel>Type</DLabel>
            <div className="flex gap-2">
              <button onClick={() => setForm(f => ({...f, type:'bug'}))}
                className={`flex-1 h-10 rounded-lg border-2 font-bold text-sm ${form.type==='bug' ? 'border-rose bg-rose-soft dark:bg-rose/15 text-rose' : 'border-[var(--line)] hover:border-rose/40'}`}>🐛 Bug</button>
              <button onClick={() => setForm(f => ({...f, type:'feature'}))}
                className={`flex-1 h-10 rounded-lg border-2 font-bold text-sm ${form.type==='feature' ? 'border-teal-500 bg-teal-50 dark:bg-teal-500/15 text-teal-600 dark:text-teal-400' : 'border-[var(--line)] hover:border-teal-400/50'}`}>💡 Feature idea</button>
            </div>
          </div>
          <div>
            <DLabel>Title</DLabel>
            <DInput placeholder="One-line summary" value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))}/>
          </div>
          <div>
            <DLabel>Details</DLabel>
            <textarea className="w-full px-3 py-2 rounded-lg border border-[var(--line)] bg-white dark:bg-white/[0.04] text-sm min-h-[120px]"
              placeholder="What happened? What did you expect? Screenshots welcome."
              value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))}/>
          </div>
          {err && <div className="text-xs text-rose font-semibold">{err}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <DButton variant="ghost" onClick={() => { setShowNew(false); setErr(''); }}>Cancel</DButton>
            <DButton variant="primary" onClick={submit} disabled={submitting}>{submitting ? 'Submitting…' : 'Submit'}</DButton>
          </div>
        </div>
      </Modal>
    </DashShell>
  );
};

// =============== Team ===============
const PageTeam = () => {
  const { user }                     = useAuth();
  const [team,     setTeam]          = React.useState({ members: [], invites: [] });
  const [loading,  setLoading]       = React.useState(true);
  const [showInvite,setShowInvite]   = React.useState(false);
  const [invForm,  setInvForm]       = React.useState({ email: '', role: 'member' });
  const [inviting, setInviting]      = React.useState(false);
  const [invErr,   setInvErr]        = React.useState('');
  const [removing, setRemoving]      = React.useState(null);

  const load = () => {
    setLoading(true);
    mvApi.team()
      .then(d => setTeam({ members: d.members || [], invites: d.invites || [] }))
      .catch(() => setTeam({ members: [], invites: [] }))
      .finally(() => setLoading(false));
  };
  React.useEffect(load, []);

  const sendInvite = async () => {
    if (!invForm.email.trim()) { setInvErr('Email is required.'); return; }
    setInviting(true); setInvErr('');
    try {
      await mvApi.inviteTeam({ email: invForm.email, role: invForm.role });
      setShowInvite(false);
      setInvForm({ email: '', role: 'member' });
      load();
    } catch (e) {
      setInvErr(e.message || 'Could not send invite.');
    } finally { setInviting(false); }
  };

  const removeMember = async (id, name) => {
    if (!confirm(`Remove ${name} from the team?`)) return;
    setRemoving(id);
    try {
      await mvApi.removeMember(id);
      load();
    } catch (e) {
      alert(e.message || 'Could not remove member.');
    } finally { setRemoving(null); }
  };

  const members = team.members;
  const invites = team.invites;

  return (
    <DashShell activeId="team" title="Team" subtitle="Invite colleagues and assign roles."
      action={<DButton variant="primary" onClick={() => setShowInvite(true)}><I.Plus size={14}/> Invite member</DButton>}>
      {loading ? <Spinner/> : (
        <>
          {members.length === 0 && invites.length === 0 ? (
            <EmptyState icon={<I.Users size={40}/>} title="Just you for now" subtitle="Invite colleagues to collaborate on patient studies."
              action={<DButton variant="primary" onClick={() => setShowInvite(true)}>Invite first member</DButton>}/>
          ) : (
            <>
              {/* Active members */}
              {members.length > 0 && (
                <div className="rounded-2xl border border-[var(--line)] bg-white dark:bg-mid2 overflow-hidden mb-4">
                  <table className="w-full text-sm">
                    <thead className="bg-paper2 dark:bg-white/[0.04] text-xs uppercase tracking-wider text-[var(--muted)]">
                      <tr>
                        <th className="text-left px-5 py-3 font-bold">Name</th>
                        <th className="text-left px-5 py-3 font-bold hidden md:table-cell">Email</th>
                        <th className="text-left px-5 py-3 font-bold">Role</th>
                        <th className="text-left px-5 py-3 font-bold hidden lg:table-cell">Joined</th>
                        <th className="px-5 py-3"/>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map(m => (
                        <tr key={m.id} className="border-t border-[var(--line)]">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-rose to-amber-500 text-white grid place-items-center text-xs font-bold shrink-0">
                                {(m.name || m.email || '?').charAt(0).toUpperCase()}
                              </div>
                              <span className="font-bold">{m.name || '—'}</span>
                              {m.id === user?.id && <span className="text-xs text-[var(--muted)] font-normal">(you)</span>}
                            </div>
                          </td>
                          <td className="px-5 py-4 hidden md:table-cell text-[var(--muted)] font-mono text-xs">{m.email}</td>
                          <td className="px-5 py-4"><Pill tone={m.role === 'admin' || m.role === 'super_admin' ? 'rose' : 'teal'}>{m.role}</Pill></td>
                          <td className="px-5 py-4 hidden lg:table-cell text-[var(--muted)]">{fmtDateOnly(m.created_at)}</td>
                          <td className="px-5 py-4 text-right">
                            {m.id !== user?.id && (
                              <button onClick={() => removeMember(m.id, m.name || m.email)} disabled={removing === m.id}
                                className="text-xs font-bold text-rose hover:underline disabled:opacity-50">
                                {removing === m.id ? '…' : 'Remove'}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pending invites */}
              {invites.length > 0 && (
                <div className="rounded-2xl border border-[var(--line)] bg-white dark:bg-mid2 overflow-hidden">
                  <div className="px-5 py-3 border-b border-[var(--line)] text-xs uppercase font-bold text-[var(--muted)]">Pending invites</div>
                  {invites.map(inv => (
                    <div key={inv.id} className="px-5 py-3 flex items-center justify-between border-t border-[var(--line)] first:border-0 text-sm">
                      <div>
                        <span className="font-mono">{inv.email}</span>
                        <Pill tone="amber" className="ml-2">{inv.role}</Pill>
                      </div>
                      <span className="text-xs text-[var(--muted)]">expires {fmtDateOnly(inv.expires_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      <Modal open={showInvite} onClose={() => { setShowInvite(false); setInvErr(''); }} title="Invite team member">
        <div className="space-y-4">
          <div>
            <DLabel>Email address</DLabel>
            <DInput placeholder="colleague@yourclinic.in" type="email"
              value={invForm.email} onChange={e => setInvForm(f => ({...f, email: e.target.value}))}/>
          </div>
          <div>
            <DLabel>Role</DLabel>
            <select className="h-10 w-full px-3 rounded-lg border border-[var(--line)] bg-white dark:bg-white/[0.04] text-sm"
              value={invForm.role} onChange={e => setInvForm(f => ({...f, role: e.target.value}))}>
              <option value="member">Member — view + print only</option>
              <option value="admin">Admin — full access incl. billing</option>
            </select>
          </div>
          {invErr && <div className="text-xs text-rose font-semibold">{invErr}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <DButton variant="ghost" onClick={() => { setShowInvite(false); setInvErr(''); }}>Cancel</DButton>
            <DButton variant="primary" onClick={sendInvite} disabled={inviting}>{inviting ? 'Sending…' : 'Send invite'}</DButton>
          </div>
        </div>
      </Modal>
    </DashShell>
  );
};

// =============== Analytics ===============
const PageAnalytics = () => {
  const [analytics, setAnalytics] = React.useState(null);
  const [loading,   setLoading]   = React.useState(true);

  React.useEffect(() => {
    mvApi.analytics()
      .then(d => setAnalytics(d))
      .catch(() => setAnalytics({ studies_30d: 0, ai_calls_30d: 0, pages_printed_30d: 0, daily: [], by_modality: [] }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <DashShell activeId="analytics" title="Analytics" subtitle="Usage trends across your team."><Spinner/></DashShell>;

  const a = analytics || {};
  const daily = a.daily || [];
  const maxV  = daily.length > 0 ? Math.max(...daily.map(d => d.v || d.value || 0), 1) : 1;

  return (
    <DashShell activeId="analytics" title="Analytics" subtitle="Usage trends across your team.">
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <StatTile icon={<I.FileText  size={16}/>} label="Studies (30d)"       value={(a.studies_30d       || 0).toLocaleString('en-IN')} delta="last 30 days"/>
        <StatTile icon={<I.Printer   size={16}/>} label="Pages printed (30d)" value={(a.pages_printed_30d || 0).toLocaleString('en-IN')} delta="last 30 days"/>
        <StatTile icon={<I.Sparkles  size={16}/>} label="AI calls (30d)"      value={(a.ai_calls_30d      || 0).toLocaleString('en-IN')} delta="last 30 days"/>
        <StatTile icon={<I.Printer   size={16}/>} label="Print credits added" value={(a.print_credits_added_30d || 0).toLocaleString('en-IN')} delta="top-ups in 30 days"/>
        <StatTile icon={<I.Key       size={16}/>} label="Licenses ordered"    value={(a.licenses_purchased_30d || 0).toLocaleString('en-IN')} delta="paid keys in 30 days"/>
        <StatTile icon={<I.MessageCircle size={16}/>} label="Support reports" value={((a.tickets_raised_30d || 0) + (a.bugs_raised_30d || 0)).toLocaleString('en-IN')} delta="tickets, bugs, and ideas"/>
      </div>

      {daily.length === 0 ? (
        <div className="rounded-2xl border border-[var(--line)] bg-white dark:bg-mid2 p-12 text-center">
          <I.BarChart size={40} className="mx-auto mb-3 opacity-20"/>
          <div className="text-sm text-[var(--muted)]">No activity data yet. Charts will appear as your team uses Mediview.</div>
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--line)] bg-white dark:bg-mid2 p-5">
          <h3 className="font-display font-bold text-lg mb-4">Daily activity (last 30 days)</h3>
          <div className="h-64 flex items-end gap-1">
            {daily.map((d, i) => {
              const h = Math.max(2, Math.round(((d.v || d.value || 0) / maxV) * 100));
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`Day ${i+1}: ${d.v || d.value || 0}`}>
                  <div className="w-full bg-gradient-to-t from-rose to-amber-400 rounded-t hover:opacity-80 transition" style={{ height: `${h}%` }}/>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-xs text-[var(--muted)] mt-2 font-mono">
            <span>30 days ago</span><span>Today</span>
          </div>
        </div>
      )}

      {(a.by_modality || []).length > 0 && (
        <div className="rounded-2xl border border-[var(--line)] bg-white dark:bg-mid2 p-5 mt-4">
          <h3 className="font-display font-bold text-lg mb-4">By modality</h3>
          <div className="space-y-3">
            {a.by_modality.map(m => {
              const total = a.by_modality.reduce((s, x) => s + (x.value || 0), 0) || 1;
              const pct   = Math.round(((m.value || 0) / total) * 100);
              return (
                <div key={m.name}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="font-semibold">{m.name}</span>
                    <span className="font-mono text-[var(--muted)]">{m.value} · {pct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-paper2 dark:bg-white/[0.06] overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-rose to-amber-400 transition-all" style={{ width: `${pct}%` }}/>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </DashShell>
  );
};

// =============== Audit log ===============
const PageAudit = () => {
  const [events,  setEvents]  = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    mvApi.audit()
      .then(d => setEvents(Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : [])))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <DashShell activeId="audit" title="Audit log" subtitle="Every privileged action, recorded.">
      <div className="rounded-2xl border border-[var(--line)] bg-white dark:bg-mid2 overflow-hidden">
        {loading ? <Spinner/> : events.length === 0 ? (
          <EmptyState icon={<I.FileText size={36}/>} title="No events yet" subtitle="Audit entries will appear as your team uses the platform."/>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-paper2 dark:bg-white/[0.04] text-xs uppercase tracking-wider text-[var(--muted)]">
              <tr>
                <th className="text-left px-5 py-3 font-bold">When</th>
                <th className="text-left px-5 py-3 font-bold">Who</th>
                <th className="text-left px-5 py-3 font-bold">Action</th>
                <th className="text-left px-5 py-3 font-bold hidden md:table-cell">Target</th>
                <th className="text-left px-5 py-3 font-bold hidden lg:table-cell">IP</th>
              </tr>
            </thead>
            <tbody>
              {events.map((a, i) => (
                <tr key={a.id || i} className="border-t border-[var(--line)]">
                  <td className="px-5 py-4 text-[var(--muted)] font-mono text-xs whitespace-nowrap">{fmtDate(a.created_at)}</td>
                  <td className="px-5 py-4 font-bold">{a.actor_name || a.actor || '—'}</td>
                  <td className="px-5 py-4">{a.action}</td>
                  <td className="px-5 py-4 hidden md:table-cell font-mono text-xs text-[var(--muted)]">{a.target || '—'}</td>
                  <td className="px-5 py-4 hidden lg:table-cell font-mono text-xs text-[var(--muted)]">{a.ip || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </DashShell>
  );
};

// =============== Admin console ===============
const PageAdmin = () => {
  const { user } = useAuth();

  // Super admin → redirect to the full admin panel
  if (user?.role === 'super_admin') {
    return (
      <DashShell activeId="admin" title="Admin panel" subtitle="Platform-level management.">
        <div className="rounded-2xl border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 p-6 flex items-start gap-4">
          <I.ArrowRight size={20} className="text-amber-700 dark:text-amber-400 mt-0.5 shrink-0"/>
          <div>
            <div className="font-display font-bold text-lg">Open Admin Panel</div>
            <p className="text-sm text-[var(--muted)] mt-1">The full platform admin panel is at a separate URL with more tools, user management, and system settings.</p>
            <a href="../admin.html" target="_blank" rel="noreferrer"
               className="inline-flex items-center gap-2 mt-4 px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm transition">
              <I.Shield size={15}/> Open Admin Panel <I.ArrowRight size={14}/>
            </a>
          </div>
        </div>
      </DashShell>
    );
  }

  // Account admin → point to team & settings
  if (user?.role === 'admin') {
    return (
      <DashShell activeId="admin" title="Account admin" subtitle="Manage your account, team, and billing.">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { href: '#/dashboard/team',     icon: <I.Users size={20}/>,       label: 'Team',     desc: 'Invite or remove members, manage roles.' },
            { href: '#/dashboard/settings', icon: <I.Settings size={20}/>,    label: 'Settings', desc: 'Profile, organisation details, billing.' },
            { href: '#/dashboard/devices',  icon: <I.Monitor size={20}/>,     label: 'Devices',  desc: 'Manage activated workstations.' },
            { href: '#/dashboard/invoices', icon: <I.FileText size={20}/>,    label: 'Invoices', desc: 'Download GST invoices.' },
            { href: '#/dashboard/licenses', icon: <I.Key size={20}/>,         label: 'Licenses', desc: 'View and manage software licenses.' },
          ].map(item => (
            <a key={item.label} href={item.href}
               className="rounded-2xl border border-[var(--line)] bg-white dark:bg-mid2 p-5 hover:border-rose/40 hover:shadow-sm transition group">
              <div className="text-rose group-hover:scale-110 transition">{item.icon}</div>
              <div className="font-display font-bold text-base mt-3">{item.label}</div>
              <div className="text-xs text-[var(--muted)] mt-1">{item.desc}</div>
            </a>
          ))}
        </div>
      </DashShell>
    );
  }

  // Non-admin
  return (
    <DashShell activeId="admin" title="Admin" subtitle="">
      <div className="rounded-2xl border border-rose/40 bg-rose-soft/40 dark:bg-rose/10 p-10 text-center">
        <I.Lock size={32} className="mx-auto text-rose"/>
        <div className="font-display font-bold text-xl mt-3">Admin access required</div>
        <div className="text-sm text-[var(--muted)] mt-1">Ask your account admin to give you admin role.</div>
      </div>
    </DashShell>
  );
};

// =============== Referrals ===============
const PageReferrals = () => {
  const [ref,     setRef]     = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [copied,  setCopied]  = React.useState(false);

  React.useEffect(() => {
    mvApi.referrals()
      .then(d => setRef(d))
      .catch(() => setRef(null))
      .finally(() => setLoading(false));
  }, []);

  // Prefer server-provided URL; fall back to constructing one from code
  const link = ref?.referral_url || (ref?.code ? (window.location.origin + '/mediview/?ref=' + ref.code) : '');
  const copy = () => { if (!link) return; navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  return (
    <DashShell activeId="referrals" title="Referrals" subtitle="Refer a clinic, earn ₹2,000 wallet credit each.">
      {loading ? <Spinner/> : !ref ? (
        <EmptyState icon={<I.Gift size={36}/>} title="Referral feature not available" subtitle="Contact support if you believe this is an error."/>
      ) : (
        <>
          <div className="rounded-2xl bg-gradient-to-br from-rose to-rose-dark text-white p-8 mb-4">
            <div className="text-[11px] uppercase tracking-[0.16em] font-bold opacity-80">Your referral link</div>
            {link ? (
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <code className="flex-1 min-w-0 px-4 py-3 rounded-lg bg-white/15 font-mono text-sm truncate">{link}</code>
                <button onClick={copy} className="h-12 px-5 rounded-lg bg-white text-rose font-bold text-sm hover:bg-paper transition shrink-0">
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            ) : (
              <div className="mt-3 text-sm opacity-80">Your referral code is being generated…</div>
            )}
            <div className="mt-6 grid sm:grid-cols-2 gap-4 text-center">
              <div><div className="font-display text-3xl font-bold">{ref.signups || 0}</div><div className="text-xs opacity-80">Clinics referred</div></div>
              <div><div className="font-display text-3xl font-bold">₹{(ref.credits_earned || 0).toLocaleString('en-IN')}</div><div className="text-xs opacity-80">Wallet credit earned</div></div>
            </div>
          </div>
          <div className="rounded-2xl border border-[var(--line)] bg-white dark:bg-mid2 p-5">
            <h3 className="font-display font-bold text-lg mb-3">How it works</h3>
            <ol className="space-y-2 text-sm">
              <li className="flex gap-3"><span className="h-6 w-6 rounded-full bg-rose-soft dark:bg-rose/20 text-rose font-bold grid place-items-center text-xs shrink-0">1</span><span>Share your link with another clinic.</span></li>
              <li className="flex gap-3"><span className="h-6 w-6 rounded-full bg-rose-soft dark:bg-rose/20 text-rose font-bold grid place-items-center text-xs shrink-0">2</span><span>They sign up and purchase any paid plan.</span></li>
              <li className="flex gap-3"><span className="h-6 w-6 rounded-full bg-rose-soft dark:bg-rose/20 text-rose font-bold grid place-items-center text-xs shrink-0">3</span><span>₹2,000 wallet credit lands in both accounts.</span></li>
            </ol>
          </div>
        </>
      )}
    </DashShell>
  );
};

// =============== Settings ===============
const SETTINGS_TABS = [
  { id: 'profile',  label: 'Profile' },
  { id: 'org',      label: 'Organisation' },
  { id: 'billing',  label: 'Billing & GST' },
  { id: 'security', label: 'Security' },
  { id: 'notifs',   label: 'Notifications' },
  { id: 'prefs',    label: 'Preferences' },
];

const settingsValue = (settings, key, fallback = '') => settings?.[key] ?? fallback;
const settingsBool = (settings, key, fallback = false) => {
  const v = settings?.[key];
  if (v == null) return fallback;
  return v === true || v === '1' || v === 1 || v === 'true';
};

const SettingsTabProfile = () => {
  const { user } = useAuth();
  const [form, setForm] = React.useState({ name: user?.name || '', email: user?.email || '', phone: '', specialty: '' });
  const [saving, setSaving]= React.useState(false);
  const [msg,    setMsg]   = React.useState('');
  const [licenses, setLicenses] = React.useState(null);
  const [copied, setCopied] = React.useState('');

  React.useEffect(() => {
    Promise.allSettled([mvApi.licenses(), mvApi.userSettings()])
      .then(([licRes, settingsRes]) => {
        setLicenses(licRes.status === 'fulfilled' && Array.isArray(licRes.value) ? licRes.value : []);
        const s = settingsRes.status === 'fulfilled' ? (settingsRes.value?.settings || {}) : {};
        setForm(f => ({
          ...f,
          phone: settingsValue(s, 'profile.phone', f.phone),
          specialty: settingsValue(s, 'profile.specialty', f.specialty),
        }));
      })
      .catch(() => setLicenses([]));
  }, []);

  const copyKey = (k) => {
    try { navigator.clipboard.writeText(k); setCopied(k); setTimeout(() => setCopied(''), 1500); } catch {}
  };

  const save = async () => {
    setSaving(true); setMsg('');
    try {
      await mvApi.saveUserSettings({ 'profile.name': form.name, 'profile.phone': form.phone, 'profile.specialty': form.specialty });
      setMsg('Profile updated.');
    } catch (e) {
      setMsg(e.message || 'Could not save profile.');
    } finally { setSaving(false); setTimeout(() => setMsg(''), 3000); }
  };

  return (
    <>
      <div>
        <h3 className="font-display font-bold text-xl">Profile</h3>
        <p className="text-sm text-[var(--muted)] mt-1">Update your personal details.</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-4 mt-5">
        <div><DLabel>Full name</DLabel><DInput value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))}/></div>
        <div><DLabel>Email</DLabel><DInput value={form.email} type="email" disabled className="opacity-60 cursor-not-allowed"/></div>
        <div><DLabel>Phone</DLabel><DInput placeholder="+91 98765 43210" value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))}/></div>
        <div><DLabel>Specialty</DLabel><DInput placeholder="e.g. Radiology" value={form.specialty} onChange={e => setForm(f => ({...f, specialty: e.target.value}))}/></div>
      </div>
      {msg && <p className="mt-3 text-sm font-semibold text-rose">{msg}</p>}
      <div className="pt-5 mt-5 border-t border-[var(--line)] flex justify-end gap-2">
        <DButton variant="primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</DButton>
      </div>

      <div className="mt-8 pt-6 border-t border-[var(--line)]">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <h3 className="font-display font-bold text-xl">Your licenses</h3>
            <p className="text-sm text-[var(--muted)] mt-1">License keys and entitlements tied to this account.</p>
          </div>
          <a href="#/dashboard/licenses" className="text-sm font-semibold text-rose hover:underline">Manage →</a>
        </div>
        {licenses === null ? (
          <div className="text-sm text-[var(--muted)]">Loading…</div>
        ) : licenses.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--line)] p-5 text-sm text-[var(--muted)]">
            No licenses yet. <a href="#/dashboard/licenses" className="text-rose font-semibold hover:underline">Order one</a> to activate Mediview on a machine.
          </div>
        ) : (
          <div className="space-y-3">
            {licenses.map(lic => (
              <div key={lic.id} className="rounded-xl border border-[var(--line)] bg-paper2/40 dark:bg-white/[0.03] p-4">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${PLAN_COLORS[lic.plan] || PLAN_COLORS.monthly}`}>{PLAN_LABELS[lic.plan] || lic.plan}</span>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${STATUS_COLORS[lic.status] || ''}`}>{lic.status}</span>
                  <span className="text-xs text-[var(--muted)]">{lic.seats} seat{lic.seats !== 1 ? 's' : ''}</span>
                  <span className="text-xs text-[var(--muted)] ml-auto">Activated: <b>{lic.seats_used ?? 0}/{lic.seats}</b></span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="font-mono text-sm font-bold tracking-widest bg-white dark:bg-black/30 border border-[var(--line)] rounded px-2 py-1 select-all">{lic.key_code}</code>
                  <button onClick={() => copyKey(lic.key_code)} className="text-xs font-semibold text-rose hover:underline">
                    {copied === lic.key_code ? '✓ Copied' : 'Copy key'}
                  </button>
                </div>
                {lic.expires_at && <div className="text-xs text-[var(--muted)] mt-2">Expires {fmtDateOnly(lic.expires_at)}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

const SettingsTabOrg = () => {
  const [form, setForm]  = React.useState({ name: '', address: '', phone: '', website: '', header: '' });
  const [saving, setSaving]= React.useState(false);
  const [msg, setMsg]    = React.useState('');

  React.useEffect(() => {
    mvApi.userSettings().then(d => {
      const s = d?.settings || {};
      setForm({
        name: settingsValue(s, 'org.name', s.account_name || ''),
        address: settingsValue(s, 'org.address'),
        phone: settingsValue(s, 'org.phone'),
        website: settingsValue(s, 'org.website'),
        header: settingsValue(s, 'org.print_header'),
      });
    }).catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true); setMsg('');
    try {
      await mvApi.saveUserSettings({ 'org.name': form.name, 'org.address': form.address, 'org.phone': form.phone, 'org.website': form.website, 'org.print_header': form.header });
      setMsg('Organisation details saved.');
    } catch (e) {
      setMsg(e.message || 'Could not save settings.');
    } finally { setSaving(false); setTimeout(() => setMsg(''), 3000); }
  };

  return (
    <>
      <div>
        <h3 className="font-display font-bold text-xl">Organisation</h3>
        <p className="text-sm text-[var(--muted)] mt-1">Used on invoices, reports, and PACS handshakes.</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-4 mt-5">
        <div className="sm:col-span-2"><DLabel>Clinic / hospital name</DLabel><DInput placeholder="e.g. City Diagnostics Pvt Ltd" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))}/></div>
        <div className="sm:col-span-2">
          <DLabel>Registered address</DLabel>
          <textarea className="w-full px-3 py-2 rounded-lg border border-[var(--line)] bg-white dark:bg-white/[0.04] text-sm min-h-[80px]"
            placeholder="Street, City, PIN" value={form.address} onChange={e => setForm(f => ({...f, address: e.target.value}))}/>
        </div>
        <div><DLabel>Contact phone</DLabel><DInput placeholder="+91 22 1234 5678" value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))}/></div>
        <div><DLabel>Website</DLabel><DInput placeholder="https://yourclinic.in" value={form.website} onChange={e => setForm(f => ({...f, website: e.target.value}))}/></div>
        <div><DLabel>Logo (PNG, 256×256)</DLabel><DInput type="file"/></div>
        <div><DLabel>Default print header</DLabel><DInput placeholder="Dr. Name — MD, DNB (Specialty)" value={form.header} onChange={e => setForm(f => ({...f, header: e.target.value}))}/></div>
      </div>
      {msg && <p className="mt-3 text-sm font-semibold text-rose">{msg}</p>}
      <div className="pt-5 mt-5 border-t border-[var(--line)] flex justify-end">
        <DButton variant="primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</DButton>
      </div>
    </>
  );
};

const SettingsTabBilling = () => {
  const [form, setForm]    = React.useState({ entity: '', gstin: '', state: 'MH', pan: '' });
  const [saving, setSaving]= React.useState(false);
  const [msg, setMsg]      = React.useState('');

  React.useEffect(() => {
    mvApi.userSettings().then(d => {
      const s = d?.settings || {};
      setForm({
        entity: settingsValue(s, 'billing.entity'),
        gstin: settingsValue(s, 'billing.gstin'),
        state: settingsValue(s, 'billing.state', 'MH'),
        pan: settingsValue(s, 'billing.pan'),
      });
    }).catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true); setMsg('');
    try {
      await mvApi.saveUserSettings({ 'billing.entity': form.entity, 'billing.gstin': form.gstin, 'billing.state': form.state, 'billing.pan': form.pan });
      setMsg('Billing details saved.');
    } catch (e) {
      setMsg(e.message || 'Could not save settings.');
    } finally { setSaving(false); setTimeout(() => setMsg(''), 3000); }
  };

  return (
    <>
      <div>
        <h3 className="font-display font-bold text-xl">Billing & GST</h3>
        <p className="text-sm text-[var(--muted)] mt-1">Used to generate compliant tax invoices.</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-4 mt-5">
        <div><DLabel>Legal entity name</DLabel><DInput placeholder="Your Clinic Pvt Ltd" value={form.entity} onChange={e => setForm(f => ({...f, entity: e.target.value}))}/></div>
        <div><DLabel>GSTIN</DLabel><DInput placeholder="27AABCS1234L1Z5" className="font-mono" value={form.gstin} onChange={e => setForm(f => ({...f, gstin: e.target.value}))}/></div>
        <div>
          <DLabel>State (place of supply)</DLabel>
          <select className="h-10 w-full px-3 rounded-lg border border-[var(--line)] bg-white dark:bg-white/[0.04] text-sm"
            value={form.state} onChange={e => setForm(f => ({...f, state: e.target.value}))}>
            <option value="MH">Maharashtra</option><option value="KA">Karnataka</option>
            <option value="DL">Delhi</option><option value="TN">Tamil Nadu</option><option value="GJ">Gujarat</option>
            <option value="RJ">Rajasthan</option><option value="UP">Uttar Pradesh</option><option value="WB">West Bengal</option>
          </select>
        </div>
        <div><DLabel>PAN</DLabel><DInput placeholder="AABCS1234L" className="font-mono" value={form.pan} onChange={e => setForm(f => ({...f, pan: e.target.value}))}/></div>
      </div>
      {msg && <p className="mt-3 text-sm font-semibold text-rose">{msg}</p>}
      <div className="pt-5 mt-5 border-t border-[var(--line)] flex justify-end">
        <DButton variant="primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</DButton>
      </div>
    </>
  );
};

const SettingsTabSecurity = () => {
  const [form,   setForm]   = React.useState({ current: '', newpw: '' });
  const [saving, setSaving] = React.useState(false);
  const [msg,    setMsg]    = React.useState('');

  const changePassword = async () => {
    if (!form.current || !form.newpw) { setMsg('Fill in both fields.'); return; }
    if (form.newpw.length < 8) { setMsg('New password must be at least 8 characters.'); return; }
    setSaving(true); setMsg('');
    try {
      await mvApi.changePassword({ current_password: form.current, new_password: form.newpw });
      setForm({ current: '', newpw: '' });
      setMsg('Password changed successfully.');
    } catch (e) {
      setMsg(e.message || 'Could not change password.');
    } finally { setSaving(false); setTimeout(() => setMsg(''), 4000); }
  };

  return (
    <>
      <div>
        <h3 className="font-display font-bold text-xl">Security</h3>
        <p className="text-sm text-[var(--muted)] mt-1">Change your password.</p>
      </div>
      <div className="mt-5 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <DLabel>Current password</DLabel>
            <DInput type="password" placeholder="••••••••" value={form.current} onChange={e => setForm(f => ({...f, current: e.target.value}))}/>
          </div>
          <div>
            <DLabel>New password</DLabel>
            <DInput type="password" placeholder="At least 8 characters" value={form.newpw} onChange={e => setForm(f => ({...f, newpw: e.target.value}))}/>
          </div>
        </div>
        {msg && <p className="text-sm font-semibold text-rose">{msg}</p>}
        <div className="flex justify-end">
          <DButton variant="primary" onClick={changePassword} disabled={saving}>{saving ? 'Saving…' : 'Change password'}</DButton>
        </div>

        <div className="rounded-xl border border-[var(--line)] p-4 flex items-center justify-between gap-4">
          <div>
            <div className="font-bold">Two-factor authentication</div>
            <div className="text-xs text-[var(--muted)]">Use an authenticator app for extra security</div>
          </div>
          <DButton variant="primary">Enable 2FA</DButton>
        </div>

        <div className="rounded-xl border border-[var(--line)] p-4">
          <div className="font-bold mb-2">Sessions</div>
          <div className="text-sm text-[var(--muted)]">You are currently logged in. Other session management will be available soon.</div>
        </div>
      </div>
    </>
  );
};

const SettingsTabNotifs = () => {
  const [v, setV] = React.useState({ low_print: true, low_ai: true, ticket: true, weekly: true, marketing: false });
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState('');

  React.useEffect(() => {
    mvApi.userSettings().then(d => {
      const s = d?.settings || {};
      setV({
        low_print: settingsBool(s, 'notifications.low_print', true),
        low_ai: settingsBool(s, 'notifications.low_ai', true),
        ticket: settingsBool(s, 'notifications.ticket', true),
        weekly: settingsBool(s, 'notifications.weekly', true),
        marketing: settingsBool(s, 'notifications.marketing', false),
      });
    }).catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true); setMsg('');
    try {
      await mvApi.saveUserSettings({
        'notifications.low_print': v.low_print,
        'notifications.low_ai': v.low_ai,
        'notifications.ticket': v.ticket,
        'notifications.weekly': v.weekly,
        'notifications.marketing': v.marketing,
      });
      setMsg('Notification settings saved.');
    } catch (e) {
      setMsg(e.message || 'Could not save notification settings.');
    } finally { setSaving(false); setTimeout(() => setMsg(''), 3000); }
  };
  const Row = ({ id, t, s }) => (
    <div className="flex items-center justify-between p-3 rounded-xl border border-[var(--line)]">
      <div><div className="font-semibold">{t}</div><div className="text-xs text-[var(--muted)]">{s}</div></div>
      <button onClick={() => setV(x => ({ ...x, [id]: !x[id] }))}
        className={`h-6 w-11 rounded-full transition relative ${v[id] ? 'bg-rose' : 'bg-zinc-300 dark:bg-white/15'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${v[id] ? 'left-5' : 'left-0.5'}`}/>
      </button>
    </div>
  );
  return (
    <>
      <div>
        <h3 className="font-display font-bold text-xl">Notifications</h3>
        <p className="text-sm text-[var(--muted)] mt-1">Choose what we email you about.</p>
      </div>
      <div className="mt-5 space-y-2">
        <Row id="low_print" t="Low print balance"  s="Email when print credits drop below 500 pages"/>
        <Row id="low_ai"    t="Low AI credits"      s="Email when AI credits drop below 100"/>
        <Row id="ticket"    t="Ticket replies"      s="Email when our team responds to your tickets"/>
        <Row id="weekly"    t="Weekly summary"      s="Studies, prints, AI usage every Monday"/>
        <Row id="marketing" t="Product updates"     s="New features, tips, and offers"/>
      </div>
      {msg && <p className="mt-3 text-sm font-semibold text-rose">{msg}</p>}
      <div className="pt-5 mt-5 border-t border-[var(--line)] flex justify-end">
        <DButton variant="primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</DButton>
      </div>
    </>
  );
};

const SettingsTabPrefsOld = () => (
  <>
    <div>
      <h3 className="font-display font-bold text-xl">Preferences</h3>
      <p className="text-sm text-[var(--muted)] mt-1">Defaults applied across the desktop app.</p>
    </div>
    <div className="grid sm:grid-cols-2 gap-4 mt-5">
      <div><DLabel>Default paper size</DLabel>
        <select className="h-10 w-full px-3 rounded-lg border border-[var(--line)] bg-white dark:bg-white/[0.04] text-sm" defaultValue="A4">
          <option>A3</option><option>A4</option><option>A5</option><option>Letter</option><option>S3 (Speciality)</option>
        </select>
      </div>
      <div><DLabel>Default modality</DLabel>
        <select className="h-10 w-full px-3 rounded-lg border border-[var(--line)] bg-white dark:bg-white/[0.04] text-sm" defaultValue="CT">
          <option>CT</option><option>MRI</option><option>X-Ray (CR/DR)</option><option>Ultrasound</option><option>Mammography</option>
        </select>
      </div>
      <div><DLabel>Date format</DLabel>
        <select className="h-10 w-full px-3 rounded-lg border border-[var(--line)] bg-white dark:bg-white/[0.04] text-sm" defaultValue="dmy">
          <option value="dmy">DD-MM-YYYY (Indian)</option><option value="iso">YYYY-MM-DD (ISO)</option><option value="mdy">MM/DD/YYYY</option>
        </select>
      </div>
      <div><DLabel>Language</DLabel>
        <select className="h-10 w-full px-3 rounded-lg border border-[var(--line)] bg-white dark:bg-white/[0.04] text-sm" defaultValue="en">
          <option value="en">English</option><option value="hi">हिन्दी (Hindi)</option><option value="mr">मराठी (Marathi)</option><option value="ta">தமிழ் (Tamil)</option>
        </select>
      </div>
    </div>
  </>
);

const SettingsTabPrefs = () => {
  const [form, setForm] = React.useState({ paper_size: 'A4', modality: 'CT', date_format: 'dmy', language: 'en' });
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState('');

  React.useEffect(() => {
    mvApi.userSettings().then(d => {
      const s = d?.settings || {};
      setForm({
        paper_size: settingsValue(s, 'prefs.paper_size', 'A4'),
        modality: settingsValue(s, 'prefs.modality', 'CT'),
        date_format: settingsValue(s, 'prefs.date_format', 'dmy'),
        language: settingsValue(s, 'prefs.language', 'en'),
      });
    }).catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true); setMsg('');
    try {
      await mvApi.saveUserSettings({
        'prefs.paper_size': form.paper_size,
        'prefs.modality': form.modality,
        'prefs.date_format': form.date_format,
        'prefs.language': form.language,
      });
      setMsg('Preferences saved.');
    } catch (e) {
      setMsg(e.message || 'Could not save preferences.');
    } finally { setSaving(false); setTimeout(() => setMsg(''), 3000); }
  };

  return (
    <>
      <div>
        <h3 className="font-display font-bold text-xl">Preferences</h3>
        <p className="text-sm text-[var(--muted)] mt-1">Defaults applied across the desktop app.</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-4 mt-5">
        <div><DLabel>Default paper size</DLabel>
          <select className="h-10 w-full px-3 rounded-lg border border-[var(--line)] bg-white dark:bg-white/[0.04] text-sm" value={form.paper_size} onChange={e => setForm(f => ({...f, paper_size: e.target.value}))}>
            <option>A3</option><option>A4</option><option>A5</option><option>Letter</option><option>S3 (Speciality)</option>
          </select>
        </div>
        <div><DLabel>Default modality</DLabel>
          <select className="h-10 w-full px-3 rounded-lg border border-[var(--line)] bg-white dark:bg-white/[0.04] text-sm" value={form.modality} onChange={e => setForm(f => ({...f, modality: e.target.value}))}>
            <option>CT</option><option>MRI</option><option>X-Ray (CR/DR)</option><option>Ultrasound</option><option>Mammography</option>
          </select>
        </div>
        <div><DLabel>Date format</DLabel>
          <select className="h-10 w-full px-3 rounded-lg border border-[var(--line)] bg-white dark:bg-white/[0.04] text-sm" value={form.date_format} onChange={e => setForm(f => ({...f, date_format: e.target.value}))}>
            <option value="dmy">DD-MM-YYYY (Indian)</option><option value="iso">YYYY-MM-DD (ISO)</option><option value="mdy">MM/DD/YYYY</option>
          </select>
        </div>
        <div><DLabel>Language</DLabel>
          <select className="h-10 w-full px-3 rounded-lg border border-[var(--line)] bg-white dark:bg-white/[0.04] text-sm" value={form.language} onChange={e => setForm(f => ({...f, language: e.target.value}))}>
            <option value="en">English</option><option value="hi">Hindi</option><option value="mr">Marathi</option><option value="ta">Tamil</option>
          </select>
        </div>
      </div>
      {msg && <p className="mt-3 text-sm font-semibold text-rose">{msg}</p>}
      <div className="pt-5 mt-5 border-t border-[var(--line)] flex justify-end">
        <DButton variant="primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</DButton>
      </div>
    </>
  );
};

const PageSettings = () => {
  const [tab, setTab] = React.useState('profile');
  return (
    <DashShell activeId="settings" title="Settings" subtitle="Account, organisation, and preferences.">
      <div className="grid lg:grid-cols-[220px_1fr] gap-5">
        <nav className="space-y-1">
          {SETTINGS_TABS.map(s => (
            <button key={s.id} onClick={() => setTab(s.id)}
              className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-semibold transition ${
                tab === s.id ? 'bg-rose-soft dark:bg-rose/15 text-rose' : 'hover:bg-paper2 dark:hover:bg-white/[0.04] text-ink/80 dark:text-paper/80'
              }`}>{s.label}
            </button>
          ))}
        </nav>
        <div className="rounded-2xl border border-[var(--line)] bg-white dark:bg-mid2 p-6">
          {tab === 'profile'  && <SettingsTabProfile/>}
          {tab === 'org'      && <SettingsTabOrg/>}
          {tab === 'billing'  && <SettingsTabBilling/>}
          {tab === 'security' && <SettingsTabSecurity/>}
          {tab === 'notifs'   && <SettingsTabNotifs/>}
          {tab === 'prefs'    && <SettingsTabPrefs/>}
          {!['profile','org','billing','security','notifs','prefs'].includes(tab) && (
            <div className="pt-5 mt-5 border-t border-[var(--line)] flex justify-end gap-2">
              <DButton variant="ghost">Cancel</DButton>
              <DButton variant="primary">Save changes</DButton>
            </div>
          )}
        </div>
      </div>
    </DashShell>
  );
};

// ─── Licenses page ────────────────────────────────────────────────────────────
const PageLicenses = () => {
  const [licenses,  setLicenses]  = React.useState([]);
  const [loading,   setLoading]   = React.useState(true);
  const [showOrder, setShowOrder] = React.useState(false);
  // Product is selected first, then plan. Bridge & Viewer are billed
  // separately and a key for one does NOT activate the other. The deep
  // link `#/dashboard/licenses?product=bridge` opens the modal pre-selected.
  const initialProduct = (() => {
    const h = (typeof window !== 'undefined' && window.location.hash) || '';
    return /[?&]product=bridge/.test(h) ? 'bridge' : 'viewer';
  })();
  const [selectedProduct, setSelectedProduct] = React.useState(initialProduct);
  const [selectedPlan, setSelectedPlan] = React.useState('monthly');
  const [ordering,  setOrdering]  = React.useState(false);
  const [orderError, setOrderError] = React.useState('');

  // If we landed via the marketing site's "Buy Bridge" CTA, pop the modal open.
  React.useEffect(() => {
    if (/[?&]product=bridge/.test(window.location.hash)) setShowOrder(true);
  }, []);
  const { addToast } = typeof useToast !== 'undefined' ? useToast() : { addToast: () => {} };

  const load = () => {
    setLoading(true);
    mvApi.licenses()
      .then(d => setLicenses(Array.isArray(d) ? d : []))
      .catch(() => setLicenses([]))
      .finally(() => setLoading(false));
  };
  React.useEffect(load, []);

  const handleOrder = async () => {
    setOrdering(true); setOrderError('');
    try {
      const orderResp = await mvApi.orderLicense({ plan: selectedPlan, product: selectedProduct });

      // Razorpay not configured on the backend → license was auto-provisioned.
      if (orderResp.auto_provisioned) {
        await load();
        setShowOrder(false);
        addToast && addToast(`License activated: ${orderResp.license_key}`, 'success');
        return;
      }

      const { order_id, rzp_key, amount } = orderResp;
      window.openRazorpay({
        key: rzp_key, amount, order_id,
        name: 'Mediview License',
        description: PLAN_LABELS[selectedPlan] + ' License',
        handler: async (resp) => {
          await mvApi.verifyLicense({ order_id, payment_id: resp.razorpay_payment_id, signature: resp.razorpay_signature, plan: selectedPlan, product: selectedProduct });
          await load();
          setShowOrder(false);
          addToast && addToast('License activated!', 'success');
        },
      });
    } catch (e) {
      const msg = e.message || 'Could not start order. Please try again.';
      setOrderError(msg);
      addToast && addToast(msg, 'error');
    } finally { setOrdering(false); }
  };

  return (
    <DashShell activeId="licenses" title="Licenses" subtitle="Manage your Mediview software licenses.">
      <div className="flex justify-end mb-6">
        <DButton variant="primary" onClick={() => setShowOrder(true)}>+ Order License</DButton>
      </div>

      {loading ? <Spinner/> : licenses.length === 0 ? (
        <div className="rounded-2xl border border-[var(--line)] bg-white dark:bg-mid2 p-12 text-center">
          <I.Key size={40} className="mx-auto mb-3 opacity-20"/>
          <p className="text-[var(--muted)] mb-4">No licenses yet. A trial license is issued automatically on signup.</p>
          <DButton variant="primary" onClick={() => setShowOrder(true)}>Order a License</DButton>
        </div>
      ) : (
        <div className="space-y-4">
          {licenses.map(lic => (
            <div key={lic.id} className="rounded-2xl border border-[var(--line)] bg-white dark:bg-mid2 p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${(lic.product || 'viewer') === 'bridge' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400' : 'bg-teal-soft text-teal dark:bg-teal/15 dark:text-teal'}`}>
                      {((lic.product || 'viewer') === 'bridge') ? 'BRIDGE' : 'VIEWER'}
                    </span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PLAN_COLORS[lic.plan] || PLAN_COLORS.monthly}`}>{PLAN_LABELS[lic.plan] || lic.plan}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[lic.status] || ''}`}>{lic.status}</span>
                    <span className="text-xs text-[var(--muted)]">{lic.seats} seat{lic.seats !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="font-mono text-base font-bold tracking-widest">{lic.key_code}</div>
                  {lic.expires_at && <div className="text-xs text-[var(--muted)] mt-1">Expires {fmtDateOnly(lic.expires_at)}</div>}
                </div>
                <div className="text-right">
                  <div className="text-sm text-[var(--muted)]">Devices activated</div>
                  <div className="text-2xl font-bold">{lic.seats_used ?? '—'}<span className="text-sm font-normal text-[var(--muted)]">/{lic.seats}</span></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-mid2 shadow-2xl p-6">
            <h2 className="font-display text-xl font-bold mb-1">Order a License</h2>
            <p className="text-sm text-[var(--muted)] mb-5">Pick a product, then a plan. Viewer and Bridge are billed separately and use different keys.</p>

            <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--muted)] font-bold mb-2">Product</div>
            <div className="grid grid-cols-2 gap-3 mb-5">
              {[
                { id: 'viewer', label: 'Viewer',  sub: 'DICOM workstation' },
                { id: 'bridge', label: 'Bridge',  sub: 'Auto-print tray app' },
              ].map(p => (
                <button key={p.id} type="button" onClick={() => setSelectedProduct(p.id)}
                  className={`text-left p-3 rounded-xl border-2 transition ${selectedProduct === p.id ? 'border-rose bg-rose/5' : 'border-[var(--line)] hover:border-rose/40'}`}>
                  <div className="font-semibold text-sm">{p.label}</div>
                  <div className="text-xs text-[var(--muted)] mt-0.5">{p.sub}</div>
                </button>
              ))}
            </div>

            <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--muted)] font-bold mb-2">Plan</div>
            <div className="space-y-3 mb-6">
              {(selectedProduct === 'bridge'
                ? [
                    { id: 'monthly', label: 'Monthly', price: '₹3,000/month',  desc: '1 seat · 30 days' },
                    { id: 'annual',  label: 'Annual',  price: '₹30,000/year',  desc: '1 seat · 365 days · Save ₹6,000' },
                  ]
                : [
                    { id: 'monthly', label: 'Monthly', price: '₹8,000/month',  desc: '1 seat · 30 days' },
                    { id: 'annual',  label: 'Annual',  price: '₹1,00,000/year',desc: '1 seat · 365 days · Save ~₹4k' },
                  ]
              ).map(plan => (
                <label key={plan.id} className={`flex items-center justify-between gap-4 p-4 rounded-xl border-2 cursor-pointer transition ${selectedPlan === plan.id ? 'border-rose bg-rose/5' : 'border-[var(--line)] hover:border-rose/40'}`}>
                  <div className="flex items-center gap-3">
                    <input type="radio" name="plan" value={plan.id} checked={selectedPlan === plan.id} onChange={() => setSelectedPlan(plan.id)} className="accent-rose"/>
                    <div>
                      <div className="font-semibold text-sm">{plan.label}</div>
                      <div className="text-xs text-[var(--muted)]">{plan.desc}</div>
                    </div>
                  </div>
                  <div className="text-sm font-bold text-rose">{plan.price}</div>
                </label>
              ))}
            </div>
            {orderError && (
              <div className="mb-4 p-3 rounded-lg border border-rose/40 bg-rose/10 text-rose-dark dark:text-rose text-sm">
                <div className="font-semibold mb-1">Payment couldn't start</div>
                <div className="text-xs">{orderError}</div>
              </div>
            )}
            <div className="flex gap-3">
              <DButton variant="ghost" onClick={() => { setShowOrder(false); setOrderError(''); }} className="flex-1">Cancel</DButton>
              <DButton variant="primary" onClick={handleOrder} disabled={ordering} className="flex-1">{ordering ? 'Processing…' : 'Pay & Activate'}</DButton>
            </div>
          </div>
        </div>
      )}
    </DashShell>
  );
};

Object.assign(window, {
  PageDevices, PageWallet, PageAI, PageInvoices, PageTickets, PageBugs,
  PageTeam, PageAnalytics, PageAudit, PageAdmin, PageReferrals, PageSettings,
  PageLicenses,
  // helpers exposed for reuse
  fmtDate, fmtDateOnly, timeAgo, EmptyState, Spinner,
});
