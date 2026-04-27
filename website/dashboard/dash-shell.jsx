// Dashboard shell — top bar + sidebar + content area.
// Reads sub-route from window.location.hash (e.g. #/dashboard/wallet).

const DASH_NAV = [
  { id: 'home',      label: 'Overview',     icon: <I.Home size={16}/>, route: '#/dashboard' },
  { id: 'devices',   label: 'Devices',      icon: <I.Monitor size={16}/>, route: '#/dashboard/devices' },
  { id: 'licenses',  label: 'Licenses',     icon: <I.Key size={16}/>, route: '#/dashboard/licenses' },
  { id: 'wallet',    label: 'Print wallet', icon: <I.Printer size={16}/>, route: '#/dashboard/wallet' },
  { id: 'ai',        label: 'AI credits',   icon: <I.Sparkles size={16}/>, route: '#/dashboard/ai' },
  { id: 'invoices',  label: 'Invoices',     icon: <I.FileText size={16}/>, route: '#/dashboard/invoices' },
  { id: 'tickets',   label: 'Support',      icon: <I.MessageCircle size={16}/>, route: '#/dashboard/tickets' },
  { id: 'bugs',      label: 'Bugs & ideas', icon: <I.Bug size={16}/>, route: '#/dashboard/bugs' },
  { id: 'team',      label: 'Team',         icon: <I.Users size={16}/>, route: '#/dashboard/team' },
  { id: 'analytics', label: 'Analytics',    icon: <I.BarChart size={16}/>, route: '#/dashboard/analytics' },
  { id: 'audit',     label: 'Audit log',    icon: <I.Eye size={16}/>, route: '#/dashboard/audit' },
  { id: 'referrals', label: 'Referrals',    icon: <I.Gift size={16}/>, route: '#/dashboard/referrals' },
  { id: 'settings',  label: 'Settings',     icon: <I.Settings size={16}/>, route: '#/dashboard/settings' },
];

const ADMIN_NAV = [
  { id: 'admin',     label: 'Admin console', icon: <I.Lock size={16}/>, route: '#/dashboard/admin' },
];

const DashShell = ({ activeId, children, title, subtitle, action }) => {
  const { user, logout } = useAuth();
  const [navOpen, setNavOpen] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);

  return (
    <div className="min-h-screen bg-paper2 dark:bg-midnight">
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

          <button className="hidden md:grid h-9 w-9 place-items-center rounded-lg border border-[var(--line)] hover:bg-paper2 dark:hover:bg-white/[0.06] relative" title="Notifications">
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
                <div className="text-[10px] text-[var(--muted)] leading-tight">{user?.role?.replace('_', ' ')}</div>
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
          {user?.role === 'admin' && (
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
