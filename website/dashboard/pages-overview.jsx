// Dashboard — Overview page. Fetches all data from the real API; no dummy values.

// =============== Overview ===============
const PageOverview = () => {
  const { user } = useAuth();
  const [openModal, setOpenModal] = React.useState(null); // 'print' | 'ai' | null
  const [data, setData]           = React.useState(null);
  const [loading, setLoading]     = React.useState(true);

  const load = () => {
    setLoading(true);
    Promise.allSettled([
      mvApi.wallet('print'),
      mvApi.wallet('ai'),
      mvApi.devices(),
      mvApi.team(),
      mvApi.audit(),
      mvApi.tickets(),
      mvApi.licenses(),
    ]).then(([print, ai, devs, teamRes, auditRes, ticketsRes, licRes]) => {
      setData({
        printWallet: print.status    === 'fulfilled' ? print.value    : { balance: 0, txns: [] },
        aiWallet:    ai.status       === 'fulfilled' ? ai.value       : { balance: 0, txns: [] },
        devices:     devs.status     === 'fulfilled' && Array.isArray(devs.value) ? devs.value : [],
        team:        teamRes.status  === 'fulfilled' ? teamRes.value  : { members: [], invites: [] },
        audit:   auditRes.status   === 'fulfilled' ? (Array.isArray(auditRes.value)   ? auditRes.value   : (auditRes.value?.data   || [])) : [],
        tickets: ticketsRes.status === 'fulfilled' ? (Array.isArray(ticketsRes.value) ? ticketsRes.value : (ticketsRes.value?.data || [])) : [],
        licenses: licRes.status === 'fulfilled' ? (Array.isArray(licRes.value) ? licRes.value : []) : [],
      });
      setLoading(false);
    });
  };

  React.useEffect(load, []);

  if (loading) {
    return (
      <DashShell activeId="home" title={`Welcome back, ${user?.name?.split(' ')[0] || 'Doctor'}`} subtitle="Loading your dashboard…">
        <div className="grid lg:grid-cols-2 gap-4 mb-6">
          <div className="h-44 rounded-2xl bg-white dark:bg-mid2 animate-pulse border border-[var(--line)]"/>
          <div className="h-44 rounded-2xl bg-white dark:bg-mid2 animate-pulse border border-[var(--line)]"/>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[0,1,2,3].map(i => <div key={i} className="h-24 rounded-xl bg-white dark:bg-mid2 animate-pulse border border-[var(--line)]"/>)}
        </div>
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 h-72 rounded-2xl bg-white dark:bg-mid2 animate-pulse border border-[var(--line)]"/>
          <div className="h-72 rounded-2xl bg-white dark:bg-mid2 animate-pulse border border-[var(--line)]"/>
        </div>
      </DashShell>
    );
  }

  const { printWallet, aiWallet, devices, team, audit, tickets, licenses } = data;
  const printBalance  = printWallet.balance ?? 0;
  const aiBalance     = aiWallet.balance ?? 0;
  const isLow         = printBalance > 0 && printBalance < 500;
  const openTickets   = tickets.filter(t => t.status === 'open');
  const activeDevices = devices.filter(d => d.status === 'active');
  const members       = team.members || [];
  const pendingInvites= (team.invites || []).length;
  // Only paid licenses get the headline card. Free / trial users see a
  // "Free plan" callout instead — no license key is needed for the free tier.
  const activeLicense = licenses.find(l => l.status === 'active' && l.plan !== 'trial');
  const isTrialActive = false;

  return (
    <DashShell activeId="home" title={`Welcome back, ${user?.name?.split(' ')[0] || 'Doctor'}`} subtitle="Here's what matters today.">
      {/* Wallet hero cards */}
      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        {/* Print wallet */}
        <div className="rounded-2xl border-2 border-rose/20 bg-gradient-to-br from-white to-rose-soft/30 dark:from-mid2 dark:to-rose/[0.08] p-6 relative overflow-hidden">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-rose/10 blur-3xl"/>
          <div className="relative">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] font-bold text-rose">
              <I.Printer size={14}/> Print wallet
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-display text-5xl font-bold tracking-tight">{printBalance.toLocaleString('en-IN')}</span>
              <span className="text-[var(--muted)] text-sm">pages</span>
            </div>
            {printBalance === 0 ? (
              <div className="mt-2 text-xs text-[var(--muted)]">No print credits yet — top up to start printing.</div>
            ) : isLow ? (
              <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-bold">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse"/> Running low
              </div>
            ) : null}
            <div className="mt-5 flex gap-2">
              <DButton variant="primary" onClick={() => setOpenModal('print')}>+ Top up prints</DButton>
              <DButton variant="ghost" onClick={() => location.hash = '#/dashboard/wallet'}>History</DButton>
            </div>
          </div>
        </div>

        {/* AI wallet */}
        <div className="rounded-2xl border-2 border-amber-400/30 bg-gradient-to-br from-white to-amber-100/40 dark:from-mid2 dark:to-amber-500/[0.08] p-6 relative overflow-hidden">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-amber-300/20 blur-3xl"/>
          <div className="relative">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] font-bold text-amber-700 dark:text-amber-400">
              <I.Sparkles size={14}/> AI credits
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-display text-5xl font-bold tracking-tight">{aiBalance.toLocaleString('en-IN')}</span>
              <span className="text-[var(--muted)] text-sm">calls</span>
            </div>
            {aiBalance === 0 ? (
              <div className="mt-2 text-xs text-[var(--muted)]">No AI credits yet — top up to enable AI analysis.</div>
            ) : (
              <div className="mt-2 text-xs text-[var(--muted)]">Credits don't expire</div>
            )}
            <div className="mt-7 flex gap-2">
              <DButton variant="primary" onClick={() => setOpenModal('ai')}>+ Top up AI</DButton>
              <DButton variant="ghost" onClick={() => location.hash = '#/dashboard/ai'}>Usage</DButton>
            </div>
          </div>
        </div>
      </div>

      {/* License card */}
      {activeLicense && (
        <div className={`rounded-2xl border-2 p-6 mb-6 relative overflow-hidden ${
          isTrialActive
            ? 'border-amber-400/30 bg-gradient-to-br from-white to-amber-100/40 dark:from-mid2 dark:to-amber-500/[0.08]'
            : 'border-teal/30 bg-gradient-to-br from-white to-teal-soft/30 dark:from-mid2 dark:to-teal/[0.08]'
        }`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className={`flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] font-bold ${isTrialActive ? 'text-amber-700 dark:text-amber-400' : 'text-teal dark:text-teal'}`}>
                <I.Key size={14}/> {isTrialActive ? 'Trial License' : 'Software License'}
              </div>
              <div className="mt-2 font-mono text-lg font-bold tracking-widest">{activeLicense.key_code}</div>
              <div className="mt-1 flex items-center gap-3 flex-wrap">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  isTrialActive
                    ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300'
                    : 'bg-teal-soft dark:bg-teal/20 text-teal dark:text-teal'
                }`}>{(activeLicense.plan || 'trial').charAt(0).toUpperCase() + (activeLicense.plan || 'trial').slice(1)}</span>
                <span className="text-xs text-[var(--muted)]">{activeLicense.seats} seat{activeLicense.seats !== 1 ? 's' : ''} · Works with Viewer & Bridge</span>
              </div>
              {activeLicense.expires_at && (() => {
                const days = Math.ceil((new Date(activeLicense.expires_at) - Date.now()) / 86400000);
                return (
                  <div className={`mt-2 text-xs font-semibold ${days <= 7 ? 'text-rose' : days <= 14 ? 'text-amber-600 dark:text-amber-400' : 'text-[var(--muted)]'}`}>
                    {days > 0 ? `${days} day${days !== 1 ? 's' : ''} remaining` : 'Expired'}
                  </div>
                );
              })()}
            </div>
            <div className="text-right">
              <div className="text-sm text-[var(--muted)]">Devices activated</div>
              <div className="text-2xl font-bold">{activeLicense.seats_used ?? 0}<span className="text-sm font-normal text-[var(--muted)]">/{activeLicense.seats}</span></div>
              <a href="#/dashboard/licenses" className="inline-flex items-center gap-1 mt-2 text-xs font-bold text-rose hover:underline">Manage <I.ArrowRight size={11}/></a>
            </div>
          </div>
          <div className="mt-4 p-3 rounded-xl bg-white/60 dark:bg-white/[0.04] border border-[var(--line)] text-xs text-[var(--muted)]">
            <span className="font-semibold text-ink dark:text-paper">How to activate:</span> Open Mediview Viewer or Bridge → Settings → License → paste the key above and click Activate.
          </div>
        </div>
      )}

      {!activeLicense && (
        <div className="rounded-2xl border-2 border-rose/20 bg-gradient-to-br from-white to-rose-soft/30 dark:from-mid2 dark:to-rose/[0.06] p-6 mb-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-xl">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] font-bold text-rose">
                <I.Gift size={14}/> Free plan
              </div>
              <div className="mt-2 font-display text-xl font-bold">You're on Mediview Free.</div>
              <p className="mt-1.5 text-sm text-[var(--muted)]">
                Free viewer, measurements, and reporting — no key required. Buy a license to unlock print billing, PACS sync, and multi-PC seats.
              </p>
            </div>
            <a href="#/dashboard/licenses" className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg bg-rose text-white text-sm font-semibold hover:bg-rose-dark transition">
              Buy a license <I.ArrowRight size={14}/>
            </a>
          </div>
        </div>
      )}

      {/* Quick stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatTile icon={<I.Monitor size={16}/>}   label="Active devices"  value={`${activeDevices.length}/${devices.length}`} delta={devices.length === 0 ? 'None registered yet' : null}/>
        <StatTile icon={<I.MessageCircle size={16}/>} label="Open tickets" value={openTickets.length} delta={openTickets.length === 0 ? 'All clear ✓' : `${openTickets.length} need attention`}/>
        <StatTile icon={<I.Sparkles size={16}/>}  label="AI balance"      value={aiBalance.toLocaleString('en-IN')} delta="credits remaining"/>
        <StatTile icon={<I.Users size={16}/>}     label="Team members"    value={members.length} delta={pendingInvites > 0 ? `${pendingInvites} invite pending` : 'Active'}/>
      </div>

      {/* Two-column section */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Recent activity */}
        <div className="lg:col-span-2 rounded-2xl border border-[var(--line)] bg-white dark:bg-mid2 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold text-lg">Recent activity</h3>
          </div>
          {audit.length === 0 ? (
            <div className="py-10 text-center text-sm text-[var(--muted)]">
              <I.Activity size={24} className="mx-auto mb-2 opacity-30"/>
              No activity recorded yet.
            </div>
          ) : (
            <div className="space-y-2">
              {audit.slice(0, 5).map((a, i) => (
                <div key={a.id || i} className="flex items-center gap-3 py-2 border-b border-[var(--line)] last:border-0 text-sm">
                  <div className="h-8 w-8 rounded-full bg-paper2 dark:bg-white/[0.06] grid place-items-center shrink-0">
                    <I.Activity size={13} className="text-[var(--muted)]"/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="truncate">
                      <span className="font-semibold">{a.actor_name || a.actor || 'System'}</span>
                      {' '}<span className="text-[var(--muted)]">·</span>{' '}
                      {a.action}
                      {a.target ? <span className="font-mono text-[var(--muted)]"> {a.target}</span> : null}
                    </div>
                    <div className="text-xs text-[var(--muted)]">
                      {a.created_at ? new Date(a.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : ''}
                      {a.ip ? ` · ${a.ip}` : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar — open tickets + referral promo */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-[var(--line)] bg-white dark:bg-mid2 p-5">
            <h3 className="font-display font-bold text-base mb-3">Open tickets</h3>
            {openTickets.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">All clear ✓</p>
            ) : (
              openTickets.slice(0, 3).map(t => (
                <a key={t.id} href="#/dashboard/tickets"
                   className="block py-2 border-b border-[var(--line)] last:border-0 hover:bg-paper2 dark:hover:bg-white/[0.04] -mx-1 px-1 rounded">
                  <div className="text-sm font-semibold truncate">{t.subject}</div>
                  <div className="text-xs text-[var(--muted)] mt-0.5 font-mono">{t.id}</div>
                </a>
              ))
            )}
            <a href="#/dashboard/tickets" className="block mt-3 text-xs font-bold text-rose hover:underline">All tickets →</a>
          </div>

          <div className="rounded-2xl border-2 border-dashed border-rose/30 bg-rose-soft/20 dark:bg-rose/[0.06] p-5">
            <div className="font-display font-bold text-base">Refer & earn</div>
            <p className="text-xs text-[var(--muted)] mt-1.5">₹2,000 wallet credit for every clinic that signs up.</p>
            <a href="#/dashboard/referrals" className="inline-flex items-center gap-1 mt-3 text-sm font-bold text-rose hover:underline">
              Get your link <I.ArrowRight size={13}/>
            </a>
          </div>
        </div>
      </div>

      {/* Recharge modals */}
      <Modal open={openModal === 'print'} onClose={() => setOpenModal(null)} title="Top up print wallet">
        <PrintRecharge onSuccess={() => { setOpenModal(null); load(); }} onCancel={() => setOpenModal(null)} />
      </Modal>
      <Modal open={openModal === 'ai'} onClose={() => setOpenModal(null)} title="Top up AI credits">
        <AIRecharge onSuccess={() => { setOpenModal(null); load(); }} onCancel={() => setOpenModal(null)} />
      </Modal>
    </DashShell>
  );
};

const StatTile = ({ icon, label, value, delta }) => (
  <div className="rounded-xl border border-[var(--line)] bg-white dark:bg-mid2 p-4">
    <div className="flex items-center gap-2 text-xs font-semibold text-[var(--muted)]">{icon} {label}</div>
    <div className="mt-2 font-display text-2xl font-bold">{value}</div>
    {delta && <div className="text-xs text-[var(--muted)] mt-0.5">{delta}</div>}
  </div>
);

window.PageOverview = PageOverview;
window.StatTile    = StatTile;
