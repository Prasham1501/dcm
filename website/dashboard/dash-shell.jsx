// Dashboard shell — top bar + sidebar + content area.
// Reads sub-route from window.location.hash (e.g. #/dashboard/wallet).

// User dashboard nav — stripped down to what a clinic operator actually
// needs day-to-day. Analytics / Bugs & ideas / Audit log moved to the
// super-admin console (they're operator/observer tools, not user tools).
const DASH_NAV = [
  { id: 'home',      label: 'Overview',     icon: <I.Home size={16}/>, route: '#/dashboard' },
  { id: 'devices',   label: 'Devices',      icon: <I.Monitor size={16}/>, route: '#/dashboard/devices' },
  { id: 'licenses',  label: 'Licenses',     icon: <I.Key size={16}/>, route: '#/dashboard/licenses' },
  { id: 'wallet',    label: 'Print wallet', icon: <I.Printer size={16}/>, route: '#/dashboard/wallet' },
  { id: 'ai',        label: 'AI credits',   icon: <I.Sparkles size={16}/>, route: '#/dashboard/ai' },
  { id: 'invoices',  label: 'Invoices',     icon: <I.FileText size={16}/>, route: '#/dashboard/invoices' },
  { id: 'tickets',   label: 'Support',      icon: <I.MessageCircle size={16}/>, route: '#/dashboard/tickets' },
  { id: 'team',      label: 'Team',         icon: <I.Users size={16}/>, route: '#/dashboard/team' },
  { id: 'referrals', label: 'Referrals',    icon: <I.Gift size={16}/>, route: '#/dashboard/referrals' },
  { id: 'settings',  label: 'Settings',     icon: <I.Settings size={16}/>, route: '#/dashboard/settings' },
];

const ADMIN_NAV = [
  { id: 'admin',     label: 'Admin console', icon: <I.Lock size={16}/>, route: '#/dashboard/admin' },
];

// All routes the search palette can jump to. Filtered by query.
const SEARCH_TARGETS = [
  { label: 'Overview',     hint: 'Wallet · devices · license',     route: '#/dashboard',          k: ['overview','home','dashboard','wallet','license'] },
  { label: 'Devices',      hint: 'Workstations on this account',    route: '#/dashboard/devices',  k: ['devices','workstation','pc','machine'] },
  { label: 'Licenses',     hint: 'Buy or manage license keys',      route: '#/dashboard/licenses', k: ['license','licenses','key','buy','plan','subscription'] },
  { label: 'Print wallet', hint: 'Top up print credits',            route: '#/dashboard/wallet',   k: ['print','wallet','credits','prints','topup','recharge','balance'] },
  { label: 'AI credits',   hint: 'Top up AI inference credits',     route: '#/dashboard/ai',       k: ['ai','credits','gemini','topup','recharge'] },
  { label: 'Invoices',     hint: 'Download GST invoices',           route: '#/dashboard/invoices', k: ['invoices','invoice','bill','gst','receipt','pdf'] },
  { label: 'Support',      hint: 'Open or reply to a ticket',       route: '#/dashboard/tickets',  k: ['support','tickets','help','contact','bug','feedback'] },
  { label: 'Team',         hint: 'Invite or manage members',        route: '#/dashboard/team',     k: ['team','members','invite','users'] },
  { label: 'Referrals',    hint: 'Refer a clinic, earn credit',     route: '#/dashboard/referrals',k: ['referrals','referral','share','invite'] },
  { label: 'Settings',     hint: 'Profile · org · billing · prefs', route: '#/dashboard/settings', k: ['settings','profile','account','organisation','billing','gst','security','password'] },
];

const SearchPalette = ({ open, onClose }) => {
  const [q, setQ] = React.useState('');
  const inputRef = React.useRef(null);
  React.useEffect(() => {
    if (open) { setQ(''); setTimeout(() => inputRef.current?.focus(), 10); }
  }, [open]);
  if (!open) return null;
  const needle = q.trim().toLowerCase();
  const results = needle
    ? SEARCH_TARGETS.filter(t =>
        t.label.toLowerCase().includes(needle) ||
        t.hint.toLowerCase().includes(needle) ||
        t.k.some(k => k.includes(needle)))
    : SEARCH_TARGETS.slice(0, 8);
  const go = (route) => { window.location.hash = route; onClose(); };
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-xl rounded-2xl border border-[var(--line)] bg-white dark:bg-mid2 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--line)]">
          <I.Search size={16} className="text-[var(--muted)]"/>
          <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'Enter'  && results[0]) go(results[0].route);
          }} placeholder="Jump to a page…" className="flex-1 bg-transparent outline-none text-sm placeholder:text-[var(--muted)]"/>
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-paper2 dark:bg-white/[0.06] border border-[var(--line)] text-[var(--muted)]">Esc</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto py-1.5">
          {results.length === 0 && (
            <div className="px-4 py-6 text-sm text-[var(--muted)] text-center">No matches for "{q}"</div>
          )}
          {results.map(r => (
            <button key={r.route} onClick={() => go(r.route)} className="w-full px-4 py-2.5 flex items-center gap-3 text-left hover:bg-paper2 dark:hover:bg-white/[0.06]">
              <I.ArrowRight size={14} className="text-rose"/>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{r.label}</div>
                <div className="text-xs text-[var(--muted)] truncate">{r.hint}</div>
              </div>
              <span className="text-[10px] font-mono text-[var(--muted)] truncate">{r.route.replace('#','')}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const NotificationsPanel = ({ open, onClose }) => {
  const [items, setItems] = React.useState(null);
  React.useEffect(() => {
    if (!open) return;
    let alive = true;
    Promise.allSettled([mvApi.audit(), mvApi.wallet('print'), mvApi.wallet('ai'), mvApi.licenses(), mvApi.tickets()])
      .then(([audit, wprint, wai, licenses, tickets]) => {
        if (!alive) return;
        const notifs = [];
        const printBal = wprint.status === 'fulfilled' ? (wprint.value.balance ?? 0) : 0;
        const aiBal    = wai.status    === 'fulfilled' ? (wai.value.balance    ?? 0) : 0;
        if (printBal === 0)         notifs.push({ icon: 'Printer',   tone: 'rose',   title: 'Print wallet empty',   body: 'Top up to keep printing.',          route: '#/dashboard/wallet' });
        else if (printBal < 100)    notifs.push({ icon: 'Printer',   tone: 'amber',  title: `Print credits low (${printBal})`, body: 'Consider topping up soon.', route: '#/dashboard/wallet' });
        if (aiBal === 0)            notifs.push({ icon: 'Sparkles',  tone: 'rose',   title: 'AI credits empty',    body: 'Top up to enable AI analysis.',     route: '#/dashboard/ai' });
        else if (aiBal < 50)        notifs.push({ icon: 'Sparkles',  tone: 'amber',  title: `AI credits low (${aiBal})`,     body: 'Consider topping up soon.', route: '#/dashboard/ai' });
        const lics = licenses.status === 'fulfilled' ? (Array.isArray(licenses.value) ? licenses.value : []) : [];
        lics.filter(l => l.status === 'active' && l.expires_at).forEach(l => {
          const days = Math.ceil((new Date(l.expires_at) - Date.now()) / 86400000);
          if (days >= 0 && days <= 14) {
            notifs.push({ icon: 'Key', tone: days <= 3 ? 'rose' : 'amber', title: `License expires in ${days} day${days !== 1 ? 's' : ''}`, body: l.key_code, route: '#/dashboard/licenses' });
          }
        });
        const openTickets = (tickets.status === 'fulfilled' ? (Array.isArray(tickets.value) ? tickets.value : []) : []).filter(t => t.status === 'open');
        openTickets.slice(0, 3).forEach(t => notifs.push({ icon: 'MessageCircle', tone: 'teal', title: `Open ticket: ${t.subject || 'Untitled'}`, body: t.account_name || '—', route: '#/dashboard/tickets' }));
        const audits = audit.status === 'fulfilled' ? (Array.isArray(audit.value) ? audit.value : (audit.value?.data || [])) : [];
        audits.slice(0, 3).forEach(a => notifs.push({ icon: 'Eye', tone: 'slate', title: a.action, body: `${a.actor_name || ''} · ${a.target || ''}`.trim(), route: '#/dashboard/audit', time: a.created_at }));
        setItems(notifs);
      });
    return () => { alive = false; };
  }, [open]);
  if (!open) return null;
  const toneClass = (t) => ({
    rose:  'bg-rose-soft text-rose dark:bg-rose/20 dark:text-rose',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
    teal:  'bg-teal-soft text-teal dark:bg-teal/20 dark:text-teal',
    slate: 'bg-paper2 text-ink/70 dark:bg-white/[0.06] dark:text-paper/70',
  })[t] || '';
  return (
    <div className="fixed inset-0 z-40" onClick={onClose}>
      <div className="absolute right-3 lg:right-6 top-14 w-80 rounded-xl border border-[var(--line)] bg-white dark:bg-mid2 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-[var(--line)] flex items-center justify-between">
          <div className="font-bold text-sm">Notifications</div>
          <button onClick={onClose} className="text-xs text-[var(--muted)] hover:text-rose">Close</button>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items === null && <div className="px-4 py-8 text-sm text-[var(--muted)] text-center">Loading…</div>}
          {items && items.length === 0 && <div className="px-4 py-8 text-sm text-[var(--muted)] text-center">All caught up ✓</div>}
          {items && items.map((n, i) => {
            const Icon = I[n.icon] || I.Bell;
            return (
              <a key={i} href={n.route} onClick={onClose} className="flex items-start gap-3 px-4 py-3 hover:bg-paper2 dark:hover:bg-white/[0.06] border-b border-[var(--line)] last:border-0">
                <div className={`h-8 w-8 grid place-items-center rounded-lg shrink-0 ${toneClass(n.tone)}`}>
                  <Icon size={14}/>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{n.title}</div>
                  {n.body && <div className="text-xs text-[var(--muted)] truncate">{n.body}</div>}
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const DashShell = ({ activeId, children, title, subtitle, action }) => {
  const { user, logout } = useAuth();
  const [navOpen, setNavOpen]       = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [notifOpen, setNotifOpen]   = React.useState(false);

  // ⌘K / Ctrl+K opens search anywhere on the dashboard.
  React.useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setSearchOpen(o => !o);
      } else if (e.key === 'Escape') {
        setSearchOpen(false); setNotifOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="min-h-screen bg-paper2 dark:bg-midnight">
      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)}/>
      <NotificationsPanel open={notifOpen} onClose={() => setNotifOpen(false)}/>
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-mid2/90 backdrop-blur border-b border-[var(--line)]">
        <div className="flex items-center gap-4 px-4 lg:px-6 h-14">
          <button onClick={() => setNavOpen(o => !o)} className="lg:hidden h-9 w-9 grid place-items-center rounded-lg border border-[var(--line)]">
            <I.Layers size={16}/>
          </button>
          <a href="#/" className="flex items-center gap-2 font-display font-bold">
            <div className="h-7 w-7 rounded-lg bg-rose text-white grid place-items-center text-xs font-bold">M</div>
            <span className="hidden sm:inline">Mediview</span>
            <span className="hidden sm:inline text-[var(--muted)] text-xs font-mono ml-2 px-2 py-0.5 rounded bg-paper2 dark:bg-white/[0.06] border border-[var(--line)]">Dashboard</span>
          </a>

          <div className="hidden md:flex flex-1 max-w-md ml-4">
            <button onClick={() => setSearchOpen(true)} className="w-full h-9 px-3 rounded-lg border border-[var(--line)] bg-paper2 dark:bg-white/[0.04] text-left text-sm text-[var(--muted)] flex items-center gap-2 hover:border-rose/40">
              <I.Search size={14}/> Search devices, invoices, tickets…
              <span className="ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded bg-white dark:bg-white/[0.06] border border-[var(--line)]">⌘K</span>
            </button>
          </div>

          <div className="flex-1 md:flex-initial md:ml-auto"/>

          <button onClick={() => setNotifOpen(o => !o)} className="hidden md:grid h-9 w-9 place-items-center rounded-lg border border-[var(--line)] hover:bg-paper2 dark:hover:bg-white/[0.06] relative" title="Notifications">
            <I.Bell size={16}/>
            <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-rose"/>
          </button>

          <div className="relative group">
            <button className="flex items-center gap-2 h-9 pl-1 pr-3 rounded-lg border border-[var(--line)] hover:bg-paper2 dark:hover:bg-white/[0.06]">
              <div className="h-7 w-7 rounded-md bg-gradient-to-br from-rose to-amber-500 text-white grid place-items-center text-xs font-bold">
                {user?.name?.charAt(0) || 'U'}
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-bold leading-tight">{user?.name}</div>
                <div className="text-[10px] text-[var(--muted)] leading-tight">{({admin:'Account owner',super_admin:'Super admin',radiologist:'Radiologist',clinic_owner:'Clinic owner',hospital_admin:'Hospital admin',viewer:'Viewer'})[user?.role] || (user?.role||'').replace('_',' ')}</div>
              </div>
            </button>
            <div className="absolute right-0 top-full mt-1 w-56 rounded-xl border border-[var(--line)] bg-white dark:bg-mid2 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition pointer-events-none group-hover:pointer-events-auto">
              <div className="px-4 py-3 border-b border-[var(--line)]">
                <div className="font-bold text-sm">{user?.name}</div>
                <div className="text-xs text-[var(--muted)] truncate">{user?.email}</div>
              </div>
              <div className="py-1.5">
                <a href="#/dashboard/settings" className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-paper2 dark:hover:bg-white/[0.06]"><I.Settings size={14}/> Account settings</a>
                <a href="#/dashboard/team" className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-paper2 dark:hover:bg-white/[0.06]"><I.Users size={14}/> Team</a>
                <a href="#/" className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-paper2 dark:hover:bg-white/[0.06]"><I.Globe size={14}/> Visit website</a>
                <button onClick={logout} className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-rose-soft dark:hover:bg-rose/15 text-rose border-t border-[var(--line)] mt-1.5"><I.LogOut size={14}/> Sign out</button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className={`fixed lg:sticky top-14 left-0 z-20 h-[calc(100vh-3.5rem)] w-64 bg-white dark:bg-mid2 border-r border-[var(--line)] overflow-y-auto transition-transform ${navOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
          <nav className="p-3 space-y-0.5">
            {DASH_NAV.map(item => {
              const active = item.id === activeId;
              return (
                <a key={item.id} href={item.route} onClick={() => setNavOpen(false)} className={`flex items-center gap-3 px-3 h-10 rounded-lg text-sm font-medium transition ${
                  active
                    ? 'bg-rose-soft dark:bg-rose/15 text-rose-dark dark:text-rose font-semibold'
                    : 'text-ink/80 dark:text-paper/80 hover:bg-paper2 dark:hover:bg-white/[0.06]'
                }`}>
                  <span className={active ? 'text-rose' : 'text-[var(--muted)]'}>{item.icon}</span>
                  {item.label}
                </a>
              );
            })}
          </nav>
          {user?.role === 'super_admin' && (
            <div className="p-3 mt-2 border-t border-[var(--line)]">
              <div className="text-[10px] uppercase tracking-[0.16em] font-bold text-[var(--muted)] px-3 mb-2">Admin</div>
              <nav className="space-y-0.5">
                {ADMIN_NAV.map(item => {
                  const active = item.id === activeId;
                  return (
                    <a key={item.id} href={item.route} onClick={() => setNavOpen(false)} className={`flex items-center gap-3 px-3 h-10 rounded-lg text-sm font-medium transition ${
                      active
                        ? 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 font-semibold'
                        : 'text-ink/80 dark:text-paper/80 hover:bg-paper2 dark:hover:bg-white/[0.06]'
                    }`}>
                      <span className={active ? 'text-amber-600 dark:text-amber-400' : 'text-[var(--muted)]'}>{item.icon}</span>
                      {item.label}
                    </a>
                  );
                })}
              </nav>
            </div>
          )}
        </aside>
        {navOpen && <div onClick={() => setNavOpen(false)} className="fixed inset-0 bg-black/40 z-10 lg:hidden top-14"/>}

        {/* Main */}
        <main className="flex-1 min-w-0">
          <div className="px-5 lg:px-8 py-6 lg:py-8 max-w-7xl mx-auto">
            {(title || action) && (
              <div className="flex items-start justify-between gap-4 flex-wrap mb-6 lg:mb-8">
                <div>
                  {title && <h1 className="font-display text-3xl lg:text-4xl font-bold tracking-tight">{title}</h1>}
                  {subtitle && <p className="mt-1.5 text-[var(--muted)]">{subtitle}</p>}
                </div>
                {action && <div className="shrink-0">{action}</div>}
              </div>
            )}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

window.DashShell = DashShell;
