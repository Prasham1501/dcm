// Admin Shell — super_admin only
// Polished dark-themed admin panel with full functionality

const AdminShell = ({ route }) => {
  const { user } = useAuth();
  const deriveSection = (hash) => {
    const h = hash || window.location.hash || '#/dashboard/admin';
    const m = h.match(/^#\/dashboard\/admin\/?(\w+)?/);
    return (m && m[1]) || 'overview';
  };
  const [section, setSection] = React.useState(() => deriveSection(route));

  React.useEffect(() => { setSection(deriveSection(route)); }, [route]);
  React.useEffect(() => {
    const onHash = () => setSection(deriveSection(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // ── Operator-focused nav. No user-mirror sections. ──────────────────────
  // Settings + Audit live behind the gear icon to keep the sidebar focused
  // on what the admin needs to *do* in a workday, not "look at config".
  const nav = [
    { id: 'overview',  label: 'Command center',icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
    { id: 'devices',   label: 'Fleet',         icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
    { id: 'accounts',  label: 'Accounts',      icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
    { id: 'licenses',  label: 'License keys',  icon: 'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z' },
    { id: 'wallets',   label: 'Wallets',       icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
    { id: 'revenue',   label: 'Revenue',       icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
    { id: 'tickets',   label: 'Support inbox', icon: 'M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z' },
    { id: 'releases',  label: 'Releases',      icon: 'M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3' },
  ];

  // Secondary nav — config/observability tucked away.
  const navSecondary = [
    { id: 'audit',     label: 'Audit log', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
    { id: 'settings',  label: 'Settings',  icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
  ];

  const NavIcon = ({ d }) => (
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );

  return (
    <div className="flex min-h-screen bg-[#0a0f1a]">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 border-r border-white/[0.06] flex flex-col bg-[#0d1321]">
        <div className="px-5 py-5 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-500 to-rose-700 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0z"/></svg>
            </div>
            <div>
              <div className="text-white font-bold text-sm tracking-tight">Mediview</div>
              <div className="text-[10px] text-slate-500 font-medium">Admin Console</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {nav.map(n => (
            <button
              key={n.id}
              onClick={() => { setSection(n.id); window.location.hash = '#/dashboard/admin/' + n.id; }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all text-left ${
                section === n.id
                  ? 'bg-rose-500/15 text-rose-400 shadow-sm shadow-rose-500/5'
                  : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
              }`}
            >
              <NavIcon d={n.icon} />
              {n.label}
            </button>
          ))}

          {/* Secondary nav (config / observability) */}
          <div className="pt-3 mt-3 border-t border-white/[0.06] space-y-0.5">
            {navSecondary.map(n => (
              <button
                key={n.id}
                onClick={() => { setSection(n.id); window.location.hash = '#/dashboard/admin/' + n.id; }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all text-left ${
                  section === n.id
                    ? 'bg-rose-500/15 text-rose-400'
                    : 'text-slate-500 hover:bg-white/[0.04] hover:text-slate-200'
                }`}
              >
                <NavIcon d={n.icon} />
                {n.label}
              </button>
            ))}
          </div>
        </nav>
        <div className="p-4 border-t border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-[10px] font-bold text-white">
              {(user?.name || 'A')[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-medium text-slate-200 truncate">{user?.name}</div>
              <div className="text-[10px] text-slate-500 truncate">{user?.email}</div>
            </div>
          </div>
          <a href="dashboard.html" className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-rose-400 transition-colors">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
            User Dashboard
          </a>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        {section === 'overview'  && <AdminOverview />}
        {section === 'devices'   && <AdminDevices />}
        {section === 'accounts'  && <AdminAccounts />}
        {section === 'licenses'  && <AdminLicenses />}
        {section === 'wallets'   && <AdminWallets />}
        {section === 'revenue'   && <AdminRevenue />}
        {section === 'tickets'   && <AdminTickets />}
        {section === 'releases'  && <AdminReleases />}
        {section === 'audit'     && <AdminAudit />}
        {section === 'settings'  && <AdminSettings />}
      </main>
    </div>
  );
};

// ── Shared admin components ──────────────────────────────────────────────────

const AdminPage = ({ title, subtitle, actions, children }) => (
  <div className="p-8 max-w-[1400px]">
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-xl font-bold text-white">{title}</h1>
        {subtitle && <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
    {children}
  </div>
);

const StatCard = ({ label, value, sub, trend, color = 'rose' }) => (
  <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 hover:border-white/[0.1] transition-colors">
    <p className="text-[11px] text-slate-500 uppercase tracking-wider font-medium mb-2">{label}</p>
    <div className="flex items-end justify-between">
      <p className="text-2xl font-bold text-white">{value}</p>
      {trend != null && <span className={`text-[11px] font-medium ${trend > 0 ? 'text-emerald-400' : trend < 0 ? 'text-red-400' : 'text-slate-500'}`}>
        {trend > 0 ? '↑' : trend < 0 ? '↓' : '·'} {Math.abs(trend)}%
      </span>}
    </div>
    {sub && <p className="text-[11px] text-slate-500 mt-1.5">{sub}</p>}
  </div>
);

const Badge = ({ children, color = 'slate' }) => {
  const colors = {
    green: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    red: 'bg-red-500/15 text-red-400 border-red-500/20',
    yellow: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
    blue: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
    rose: 'bg-rose-500/15 text-rose-400 border-rose-500/20',
    slate: 'bg-slate-500/15 text-slate-300 border-slate-500/20',
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border ${colors[color] || colors.slate}`}>{children}</span>;
};

const AdminBtn = ({ children, onClick, variant = 'ghost', disabled, size = 'sm' }) => {
  const base = 'inline-flex items-center gap-1.5 font-medium rounded-lg transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer';
  const sizes = { xs: 'px-2 py-1 text-[11px]', sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm' };
  const variants = {
    ghost: 'text-slate-400 hover:text-white hover:bg-white/[0.06]',
    primary: 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm',
    danger: 'text-red-400 hover:text-red-300 hover:bg-red-500/10',
    success: 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10',
  };
  return <button onClick={onClick} disabled={disabled} className={`${base} ${sizes[size]} ${variants[variant]}`}>{children}</button>;
};

const Modal = ({ open, onClose, title, width = 'max-w-2xl', children }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className={`relative bg-[#111827] border border-white/[0.08] rounded-2xl shadow-2xl ${width} w-full max-h-[85vh] flex flex-col`} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <h2 className="text-base font-bold text-white">{title}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white p-1 rounded-lg hover:bg-white/[0.06] transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
};

const useAdminFetch = (fn, deps = []) => {
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const load = React.useCallback(() => {
    setLoading(true); setError(null);
    fn().then(setData).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, deps);
  React.useEffect(load, [load]);
  return { data, loading, error, reload: load };
};

const Pagination = ({ page, total, perPage, onPage }) => {
  const pages = Math.max(1, Math.ceil(total / perPage));
  if (pages <= 1) return null;
  return (
    <div className="flex items-center gap-3 text-xs">
      <AdminBtn onClick={() => onPage(page - 1)} disabled={page <= 1} size="xs">← Prev</AdminBtn>
      <span className="text-slate-500">Page {page} of {pages}</span>
      <AdminBtn onClick={() => onPage(page + 1)} disabled={page >= pages} size="xs">Next →</AdminBtn>
    </div>
  );
};

const TableEmpty = ({ cols, message }) => (
  <tr><td colSpan={cols} className="py-12 text-center text-slate-500 text-sm">{message || 'No data found.'}</td></tr>
);

const fmtAgo = (ts) => {
  if (!ts) return 'never';
  const d = ts.endsWith && ts.endsWith('Z') ? ts : (ts + 'Z');
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 0)        return 'just now';
  if (s < 60)       return s + 's ago';
  if (s < 3600)     return Math.floor(s / 60) + 'm ago';
  if (s < 86400)    return Math.floor(s / 3600) + 'h ago';
  if (s < 604800)   return Math.floor(s / 86400) + 'd ago';
  return new Date(ts).toLocaleDateString();
};

const fmtDate = (ts) => ts ? new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const fmtINR = (n) => n != null ? '₹' + Number(n).toLocaleString('en-IN') : '—';

// ── Fleet overview ──────────────────────────────────────────────────────────

const AdminOverview = () => {
  const { data, loading } = useAdminFetch(() => mvApi.adminOverview());
  const { data: chartData } = useAdminFetch(() => mvApi.adminRevenueChart(6));

  if (loading) return <AdminPage title="Overview"><div className="text-slate-500">Loading dashboard…</div></AdminPage>;

  return (
    <AdminPage title="Overview" subtitle="Fleet status & business metrics">
      {/* Fleet status */}
      <div className="mb-2">
        <h3 className="text-[11px] uppercase tracking-widest text-slate-500 font-medium mb-3">Fleet Status</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Online Now"         value={data?.devices_online ?? 0}      sub="Heartbeat ≤ 5 min" />
          <StatCard label="Active (24h)"       value={data?.devices_active_24h ?? 0}  sub="Phoned home today" />
          <StatCard label="Dormant (7d+)"      value={data?.devices_dormant_7d ?? 0}  sub="Silent over a week" />
          <StatCard label="Total Seats"        value={data?.total_devices ?? 0}       sub="Active installations" />
        </div>
      </div>

      {/* Business KPIs */}
      <div className="mt-6 mb-2">
        <h3 className="text-[11px] uppercase tracking-widest text-slate-500 font-medium mb-3">Business</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Total Accounts"     value={data?.total_accounts ?? 0} />
          <StatCard label="New (30d)"          value={data?.new_accounts_30d ?? 0} />
          <StatCard label="Active Licenses"    value={data?.active_licenses ?? 0} sub={`of ${data?.total_licenses ?? 0} total`} />
          <StatCard label="Expiring ≤ 7d"      value={data?.licenses_expiring_7d ?? 0} />
          <StatCard label="Total Revenue"      value={fmtINR(data?.total_revenue)} />
          <StatCard label="Revenue (30d)"      value={fmtINR(data?.revenue_30d)} />
          <StatCard label="Open Tickets"       value={data?.open_tickets ?? 0} />
          <StatCard label="Seat Utilization"   value={`${data?.total_devices ?? 0}/${data?.active_licenses ?? 0}`} sub="Devices per license" />
        </div>
      </div>

      {/* Revenue Mini Chart */}
      {chartData?.data && chartData.data.length > 0 && (
        <div className="mt-6">
          <h3 className="text-[11px] uppercase tracking-widest text-slate-500 font-medium mb-3">Revenue Trend (6 months)</h3>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
            <div className="flex items-end gap-2 h-32">
              {chartData.data.map((m, i) => {
                const max = Math.max(...chartData.data.map(d => d.revenue), 1);
                const pct = (m.revenue / max) * 100;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                    <span className="text-[10px] text-slate-500 font-medium">{fmtINR(m.revenue)}</span>
                    <div className="w-full rounded-t-md bg-gradient-to-t from-rose-600 to-rose-400 transition-all" style={{ height: `${Math.max(pct, 4)}%` }} />
                    <span className="text-[9px] text-slate-600 font-medium">{m.month.split(' ')[0]}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Distributions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
          <h3 className="text-[11px] uppercase tracking-widest text-slate-500 font-medium mb-3">App Versions</h3>
          {(!data?.version_distribution || data.version_distribution.length === 0)
            ? <p className="text-slate-500 text-sm">No data yet.</p>
            : <div className="space-y-2.5">
                {data.version_distribution.map(v => {
                  const pct = Math.round((v.count / (data.total_devices || 1)) * 100);
                  return (
                    <div key={v.version} className="flex items-center gap-3">
                      <span className="text-xs font-mono text-rose-400 w-16 shrink-0">{v.version}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                        <div className="h-full bg-rose-500 rounded-full transition-all" style={{ width: pct + '%' }} />
                      </div>
                      <span className="text-[11px] text-slate-500 w-14 text-right">{v.count} ({pct}%)</span>
                    </div>
                  );
                })}
              </div>
          }
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
          <h3 className="text-[11px] uppercase tracking-widest text-slate-500 font-medium mb-3">Operating Systems</h3>
          {(!data?.os_distribution || data.os_distribution.length === 0)
            ? <p className="text-slate-500 text-sm">No data yet.</p>
            : <div className="space-y-2.5">
                {data.os_distribution.map(v => {
                  const pct = Math.round((v.count / (data.total_devices || 1)) * 100);
                  return (
                    <div key={v.os} className="flex items-center gap-3">
                      <span className="text-xs text-slate-300 w-36 shrink-0 truncate">{v.os}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                        <div className="h-full bg-teal-500 rounded-full transition-all" style={{ width: pct + '%' }} />
                      </div>
                      <span className="text-[11px] text-slate-500 w-14 text-right">{v.count} ({pct}%)</span>
                    </div>
                  );
                })}
              </div>
          }
        </div>
      </div>

      {/* Top accounts */}
      {data?.top_accounts?.length > 0 && (
        <div className="mt-6">
          <h3 className="text-[11px] uppercase tracking-widest text-slate-500 font-medium mb-3">Top Deployments</h3>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-white/[0.06]">
                <th className="text-left px-4 py-3 text-[11px] text-slate-500 font-medium uppercase tracking-wider">Account</th>
                <th className="text-left px-4 py-3 text-[11px] text-slate-500 font-medium uppercase tracking-wider">Owner</th>
                <th className="text-right px-4 py-3 text-[11px] text-slate-500 font-medium uppercase tracking-wider">Devices</th>
              </tr></thead>
              <tbody>
                {data.top_accounts.map(a => (
                  <tr key={a.id} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-white font-medium">{a.name || '—'}</td>
                    <td className="px-4 py-3 text-slate-400">{a.owner_email || '—'}</td>
                    <td className="px-4 py-3 text-right font-mono text-rose-400 font-semibold">{a.active_devices}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AdminPage>
  );
};

// ── Devices ─────────────────────────────────────────────────────────────────

const AdminDevices = () => {
  const [page, setPage] = React.useState(1);
  const [online, setOnline] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [q, setQ] = React.useState('');
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [busyId, setBusyId] = React.useState(null);
  const { showToast } = useToast();

  const load = React.useCallback((opts = {}) => {
    // Silent reload (no spinner flash) for the auto-poll loop.
    if (!opts.silent) setLoading(true);
    mvApi.adminDevices({ page, online, status, q })
      .then(setData).catch(e => { if (!opts.silent) showToast(e.message, 'error'); }).finally(() => setLoading(false));
  }, [page, online, status, q]);
  React.useEffect(load, [load]);

  // Real-time-ish poll: refresh every 15s while the admin is looking at the
  // fleet so online/offline indicators stay live.
  React.useEffect(() => {
    const id = window.setInterval(() => load({ silent: true }), 15_000);
    return () => window.clearInterval(id);
  }, [load]);

  const deactivate = async (id) => {
    if (!confirm('Deactivate this device? The user will need to re-activate.')) return;
    setBusyId(id);
    try { await mvApi.deactivateAdminDevice(id); showToast('Device deactivated', 'success'); load(); }
    catch (e) { showToast(e.message, 'error'); }
    finally { setBusyId(null); }
  };

  return (
    <AdminPage title="Devices" subtitle={data ? `${data.total} total device${data.total !== 1 ? 's' : ''}` : ''}>
      <div className="flex flex-wrap gap-2 mb-5">
        <input className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 w-64 focus:outline-none focus:border-rose-500/50"
          placeholder="Search machine / IP / account…" value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { setPage(1); load(); } }} />
        <select value={online} onChange={e => { setOnline(e.target.value); setPage(1); }}
          className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white">
          <option value="">All connectivity</option>
          <option value="1">Online (≤5m)</option>
          <option value="0">Offline</option>
        </select>
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}
          className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white">
          <option value="">All status</option>
          <option value="active">Active</option>
          <option value="deactivated">Deactivated</option>
        </select>
      </div>

      {loading ? <div className="text-slate-500 py-8">Loading…</div> : (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-white/[0.06]">
                <th className="text-left px-4 py-3 text-[11px] text-slate-500 font-medium uppercase tracking-wider">Machine</th>
                <th className="text-left px-4 py-3 text-[11px] text-slate-500 font-medium uppercase tracking-wider">Account</th>
                <th className="text-left px-4 py-3 text-[11px] text-slate-500 font-medium uppercase tracking-wider">License</th>
                <th className="text-left px-4 py-3 text-[11px] text-slate-500 font-medium uppercase tracking-wider">Version</th>
                <th className="text-left px-4 py-3 text-[11px] text-slate-500 font-medium uppercase tracking-wider">Last Seen</th>
                <th className="text-left px-4 py-3 text-[11px] text-slate-500 font-medium uppercase tracking-wider">Status</th>
                <th className="text-right px-4 py-3 text-[11px] text-slate-500 font-medium uppercase tracking-wider">Action</th>
              </tr></thead>
              <tbody>
                {(data?.data || []).length === 0 && <TableEmpty cols={7} message="No devices match these filters." />}
                {(data?.data || []).map(d => (
                  <tr key={d.id} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] align-top">
                    <td className="px-4 py-3">
                      <div className="text-white font-medium text-[13px]">{d.machine_name || '—'}</div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5 truncate max-w-[160px]">{d.fingerprint}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-slate-200 text-[13px]">{d.account_name || '—'}</div>
                      <div className="text-[10px] text-slate-500">{d.owner_email || ''}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-mono text-rose-400 text-[11px]">{d.key_code || '—'}</div>
                      {d.license_plan && <div className="text-[10px] text-slate-500 mt-0.5">{d.license_plan}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-slate-300 text-[13px]">v{d.app_version || '?'}</div>
                      <div className="text-[10px] text-slate-500 truncate max-w-[120px]">{d.os || '—'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-[12px] ${d.is_online == 1 ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {d.is_online == 1 && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/>}
                        {fmtAgo(d.last_heartbeat_at)}
                      </span>
                    </td>
                    <td className="px-4 py-3"><Badge color={d.status === 'active' ? 'green' : 'red'}>{d.status}</Badge></td>
                    <td className="px-4 py-3 text-right">
                      {d.status === 'active'
                        ? <AdminBtn variant="danger" size="xs" onClick={() => deactivate(d.id)} disabled={busyId === d.id}>
                            {busyId === d.id ? '…' : 'Kill'}
                          </AdminBtn>
                        : <span className="text-[10px] text-slate-600">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-white/[0.06]">
            <Pagination page={page} total={data?.total || 0} perPage={data?.per_page || 50} onPage={setPage} />
          </div>
        </div>
      )}
    </AdminPage>
  );
};

// ── Accounts ────────────────────────────────────────────────────────────────

const AdminAccounts = () => {
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [q, setQ] = React.useState('');
  const { showToast } = useToast();

  const load = (p = page) => {
    setLoading(true);
    mvApi.adminAccounts(p).then(setData).catch(e => showToast(e.message, 'error')).finally(() => setLoading(false));
  };
  React.useEffect(() => { load(1); }, []);

  return (
    <AdminPage title="Accounts" subtitle="All customer accounts">
      <div className="mb-5">
        <input className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 w-72 focus:outline-none focus:border-rose-500/50"
          placeholder="Search name / email…" value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { setPage(1); load(1); } }} />
      </div>
      {loading ? <div className="text-slate-500 py-8">Loading…</div> : (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-white/[0.06]">
              <th className="text-left px-4 py-3 text-[11px] text-slate-500 font-medium uppercase tracking-wider">Account</th>
              <th className="text-left px-4 py-3 text-[11px] text-slate-500 font-medium uppercase tracking-wider">Owner</th>
              <th className="text-left px-4 py-3 text-[11px] text-slate-500 font-medium uppercase tracking-wider">Plan</th>
              <th className="text-left px-4 py-3 text-[11px] text-slate-500 font-medium uppercase tracking-wider">Status</th>
              <th className="text-center px-4 py-3 text-[11px] text-slate-500 font-medium uppercase tracking-wider">Licenses</th>
              <th className="text-center px-4 py-3 text-[11px] text-slate-500 font-medium uppercase tracking-wider">Devices</th>
              <th className="text-right px-4 py-3 text-[11px] text-slate-500 font-medium uppercase tracking-wider">Actions</th>
            </tr></thead>
            <tbody>
              {(data?.data || []).length === 0 && <TableEmpty cols={7} />}
              {(data?.data || []).map(a => {
                const suspended = a.status === 'suspended';
                return (
                <tr key={a.id} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <div className="text-white font-medium text-[13px]">{a.name || '—'}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{a.id}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-300 text-[13px]">{a.owner_email || '—'}</td>
                  <td className="px-4 py-3"><Badge color="rose">{a.plan || 'free'}</Badge></td>
                  <td className="px-4 py-3"><Badge color={suspended ? 'red' : 'green'}>{a.status || 'active'}</Badge></td>
                  <td className="px-4 py-3 text-center text-slate-300">{a.licenses ?? 0}</td>
                  <td className="px-4 py-3 text-center text-slate-300">{a.active_devices ?? 0}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1.5 whitespace-nowrap">
                      <button onClick={async () => {
                        try {
                          const r = await mvApi.impersonate(a.id);
                          const tok = r?.token || r?.access_token;
                          if (!tok) throw new Error('Impersonate endpoint returned no token.');
                          const url = `dashboard.html?imp=${encodeURIComponent(tok)}#/dashboard`;
                          window.open(url, '_blank', 'noopener');
                        } catch (e) { showToast(e.message || 'Impersonate failed', 'error'); }
                      }} className="text-[11px] text-amber-400 hover:underline" title="Open this user's dashboard in a new tab (you keep your own session)">Impersonate</button>
                      <span className="text-slate-700">·</span>
                      {suspended
                        ? <button onClick={async () => { try { await mvApi.adminResumeAccount(a.id); showToast('Resumed', 'success'); load(page); } catch (e) { showToast(e.message, 'error'); } }} className="text-[11px] text-green-400 hover:underline">Resume</button>
                        : <button onClick={async () => { if (!confirm(`Suspend ${a.name}? Licenses + devices freeze.`)) return; try { await mvApi.adminSuspendAccount(a.id); showToast('Suspended', 'success'); load(page); } catch (e) { showToast(e.message, 'error'); } }} className="text-[11px] text-yellow-400 hover:underline">Suspend</button>}
                      <span className="text-slate-700">·</span>
                      <button onClick={async () => { if (!confirm(`Permanently DELETE ${a.name} and ALL their data? This cannot be undone.`)) return; try { await mvApi.adminDeleteAccount(a.id); showToast('Deleted', 'success'); load(page); } catch (e) { showToast(e.message, 'error'); } }} className="text-[11px] text-red-400 hover:underline">Delete</button>
                    </div>
                  </td>
                </tr>
              );})}
            </tbody>
          </table>
          <div className="px-4 py-3 border-t border-white/[0.06]">
            <Pagination page={page} total={data?.total || 0} perPage={25} onPage={p => { setPage(p); load(p); }} />
          </div>
        </div>
      )}
    </AdminPage>
  );
};

// ── Licenses (with detail modal) ────────────────────────────────────────────

const AdminLicenses = () => {
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [selectedId, setSelectedId] = React.useState(null);
  const [showIssue, setShowIssue] = React.useState(false);
  const { showToast } = useToast();

  const load = (p = page) => {
    setLoading(true);
    mvApi.adminLicenses(p).then(setData).catch(e => showToast(e.message, 'error')).finally(() => setLoading(false));
  };
  React.useEffect(() => { load(1); }, []);

  const revoke = async (id) => {
    if (!confirm('Revoke this license and deactivate all devices?')) return;
    try { await mvApi.revokeAdminLicense(id); showToast('License revoked', 'success'); load(page); }
    catch (e) { showToast(e.message, 'error'); }
  };

  return (
    <AdminPage title="Licenses" subtitle="All license keys across accounts"
      actions={<AdminBtn variant="primary" size="sm" onClick={() => setShowIssue(true)}>+ Issue Key</AdminBtn>}>

      {loading ? <div className="text-slate-500 py-8">Loading…</div> : (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-white/[0.06]">
              <th className="text-left px-4 py-3 text-[11px] text-slate-500 font-medium uppercase tracking-wider">Key</th>
              <th className="text-left px-4 py-3 text-[11px] text-slate-500 font-medium uppercase tracking-wider">Account</th>
              <th className="text-left px-4 py-3 text-[11px] text-slate-500 font-medium uppercase tracking-wider">Plan</th>
              <th className="text-center px-4 py-3 text-[11px] text-slate-500 font-medium uppercase tracking-wider">Seats</th>
              <th className="text-left px-4 py-3 text-[11px] text-slate-500 font-medium uppercase tracking-wider">Status</th>
              <th className="text-left px-4 py-3 text-[11px] text-slate-500 font-medium uppercase tracking-wider">Expires</th>
              <th className="text-left px-4 py-3 text-[11px] text-slate-500 font-medium uppercase tracking-wider">Quota</th>
              <th className="text-right px-4 py-3 text-[11px] text-slate-500 font-medium uppercase tracking-wider">Actions</th>
            </tr></thead>
            <tbody>
              {(data?.data || []).length === 0 && <TableEmpty cols={8} />}
              {(data?.data || []).map(l => (
                <tr key={l.id} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] cursor-pointer" onClick={() => setSelectedId(l.id)}>
                  <td className="px-4 py-3">
                    <span className="font-mono text-[12px] text-rose-400 hover:text-rose-300 transition-colors">{l.key_code}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-slate-200 text-[13px]">{l.account_name || '—'}</div>
                    <div className="text-[10px] text-slate-500">{l.owner_email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge color={(l.product || 'viewer') === 'bridge' ? 'amber' : 'teal'}>{(l.product || 'viewer').toUpperCase()}</Badge>
                      <Badge color="blue">{l.plan}</Badge>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-slate-300">{l.seats_used || 0}</span>
                    <span className="text-slate-600">/{l.seats}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge color={l.status === 'active' ? 'green' : l.status === 'revoked' ? 'red' : 'yellow'}>{l.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{l.expires_at ? fmtDate(l.expires_at) : 'Perpetual'}</td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <QuotaCell license={l} onChanged={() => load(page)} />
                  </td>
                  <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                    {l.status === 'active' && <AdminBtn variant="danger" size="xs" onClick={() => revoke(l.id)}>Revoke</AdminBtn>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-3 border-t border-white/[0.06]">
            <Pagination page={page} total={data?.total || 0} perPage={25} onPage={p => { setPage(p); load(p); }} />
          </div>
        </div>
      )}

      {selectedId && <LicenseDetailModal id={selectedId} onClose={() => { setSelectedId(null); load(page); }} />}
      {showIssue && <IssueLicenseModal onClose={() => { setShowIssue(false); load(page); }} />}
    </AdminPage>
  );
};

// License Detail Modal — full info when clicking a key
const LicenseDetailModal = ({ id, onClose }) => {
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [extendDays, setExtendDays] = React.useState(30);
  const [extending, setExtending] = React.useState(false);
  const { showToast } = useToast();

  const load = () => { setLoading(true); mvApi.adminLicenseDetail(id).then(setData).catch(e => showToast(e.message, 'error')).finally(() => setLoading(false)); };
  React.useEffect(load, [id]);

  const extend = async () => {
    setExtending(true);
    try { await mvApi.adminExtendLicense(id, extendDays); showToast(`Extended by ${extendDays} days`, 'success'); load(); }
    catch (e) { showToast(e.message, 'error'); }
    finally { setExtending(false); }
  };

  const lic = data?.license;

  return (
    <Modal open={true} onClose={onClose} title="License Details" width="max-w-3xl">
      {loading ? <div className="text-slate-500 py-8 text-center">Loading…</div> : !lic ? <div className="text-red-400">Not found</div> : (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <div className="font-mono text-lg text-rose-400 font-bold">{lic.key_code}</div>
              <div className="text-sm text-slate-400 mt-1">{lic.account_name} · {lic.owner_email}</div>
            </div>
            <div className="flex items-center gap-2">
              <Badge color={(lic.product || 'viewer') === 'bridge' ? 'amber' : 'teal'}>{(lic.product || 'viewer').toUpperCase()}</Badge>
              <Badge color={lic.status === 'active' ? 'green' : lic.status === 'revoked' ? 'red' : 'yellow'}>{lic.status}</Badge>
            </div>
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white/[0.04] rounded-lg px-3 py-2.5">
              <div className="text-[10px] text-slate-500 uppercase">Plan</div>
              <div className="text-sm text-white font-semibold mt-0.5 capitalize">{lic.plan}</div>
            </div>
            <div className="bg-white/[0.04] rounded-lg px-3 py-2.5">
              <div className="text-[10px] text-slate-500 uppercase">Seats</div>
              <div className="text-sm text-white font-semibold mt-0.5">{data.devices?.length || 0} / {lic.seats}</div>
            </div>
            <div className="bg-white/[0.04] rounded-lg px-3 py-2.5">
              <div className="text-[10px] text-slate-500 uppercase">Created</div>
              <div className="text-sm text-white mt-0.5">{fmtDate(lic.created_at)}</div>
            </div>
            <div className="bg-white/[0.04] rounded-lg px-3 py-2.5">
              <div className="text-[10px] text-slate-500 uppercase">Expires</div>
              <div className="text-sm text-white mt-0.5">{lic.expires_at ? fmtDate(lic.expires_at) : 'Never'}</div>
            </div>
          </div>

          {/* Wallet */}
          {data.wallets && (
            <div>
              <h4 className="text-[11px] uppercase tracking-widest text-slate-500 font-medium mb-2">Account Wallet</h4>
              <div className="flex gap-3">
                <div className="bg-white/[0.04] rounded-lg px-3 py-2 flex items-center gap-2">
                  <span className="text-[11px] text-slate-400">Print:</span>
                  <span className="text-sm font-bold text-white">{data.wallets.print ?? 0}</span>
                </div>
                <div className="bg-white/[0.04] rounded-lg px-3 py-2 flex items-center gap-2">
                  <span className="text-[11px] text-slate-400">AI:</span>
                  <span className="text-sm font-bold text-white">{data.wallets.ai ?? 0}</span>
                </div>
              </div>
            </div>
          )}

          {/* Quick Actions — all license superpowers */}
          {lic.status === 'active' && (
            <div>
              <h4 className="text-[11px] uppercase tracking-widest text-slate-500 font-medium mb-2">Quick Actions</h4>
              <div className="flex items-center gap-2 flex-wrap">
                <input type="number" value={extendDays} onChange={e => setExtendDays(Math.max(-3650, +e.target.value))}
                  className="w-20 bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-rose-500/50" />
                <AdminBtn variant="primary" size="sm" onClick={extend} disabled={extending}>
                  {extending ? '…' : (extendDays >= 0 ? `Extend ${extendDays}d` : `Shrink ${Math.abs(extendDays)}d`)}
                </AdminBtn>
                <AdminBtn variant="ghost" size="sm" onClick={async () => {
                  const acc = prompt('Transfer to which account ID?');
                  if (!acc) return;
                  try { await mvApi.adminTransferLicense(id, acc.trim()); showToast('License transferred', 'success'); load(); }
                  catch (e) { showToast(e.message, 'error'); }
                }}>Transfer →</AdminBtn>
                <AdminBtn variant="ghost" size="sm" onClick={async () => {
                  if (!confirm('Regenerate the key? This rotates to a new code and deactivates all current devices.')) return;
                  try { const r = await mvApi.adminRegenerateLicense(id); showToast('New key: ' + r.key_code, 'success'); load(); }
                  catch (e) { showToast(e.message, 'error'); }
                }}>Regenerate</AdminBtn>
              </div>
            </div>
          )}

          {/* Devices */}
          <div>
            <h4 className="text-[11px] uppercase tracking-widest text-slate-500 font-medium mb-2">Devices ({data.devices?.length || 0})</h4>
            {(!data.devices || data.devices.length === 0) ? <p className="text-slate-500 text-sm">No devices activated.</p> : (
              <div className="bg-white/[0.04] rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-white/[0.06]">
                    <th className="text-left px-3 py-2 text-slate-500">Machine</th>
                    <th className="text-left px-3 py-2 text-slate-500">OS / Version</th>
                    <th className="text-left px-3 py-2 text-slate-500">Last Seen</th>
                    <th className="text-left px-3 py-2 text-slate-500">Status</th>
                    <th className="text-right px-3 py-2 text-slate-500">Seat</th>
                  </tr></thead>
                  <tbody>
                    {data.devices.map(d => (
                      <tr key={d.id} className="border-b border-white/[0.04] last:border-0">
                        <td className="px-3 py-2"><div className="text-white">{d.machine_name || '—'}</div><div className="text-[10px] text-slate-500 font-mono">{d.last_ip || ''}</div></td>
                        <td className="px-3 py-2 text-slate-400">{d.os || '—'} · v{d.app_version || '?'}</td>
                        <td className="px-3 py-2 text-slate-400">{fmtAgo(d.last_heartbeat_at)}</td>
                        <td className="px-3 py-2"><Badge color={d.status === 'active' ? 'green' : 'red'}>{d.status}</Badge></td>
                        <td className="px-3 py-2 text-right">
                          {d.status === 'active'
                            ? <button onClick={async () => {
                                if (!confirm('Free this seat? The device will need to re-activate.')) return;
                                try { await mvApi.adminUnbindSeat(d.id); showToast('Seat freed', 'success'); load(); }
                                catch (e) { showToast(e.message, 'error'); }
                              }} className="text-[11px] text-red-400 hover:underline">Unbind</button>
                            : <span className="text-slate-600 text-[11px]">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Activity */}
          {data.audit?.length > 0 && (
            <div>
              <h4 className="text-[11px] uppercase tracking-widest text-slate-500 font-medium mb-2">Activity Log</h4>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {data.audit.map(a => (
                  <div key={a.id} className="flex items-center gap-3 text-xs py-1.5 border-b border-white/[0.04] last:border-0">
                    <span className="text-slate-500 w-24 shrink-0">{fmtDate(a.created_at)}</span>
                    <span className="font-mono text-rose-400">{a.action}</span>
                    <span className="text-slate-400 truncate">{a.target}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Payments */}
          {data.payments?.length > 0 && (
            <div>
              <h4 className="text-[11px] uppercase tracking-widest text-slate-500 font-medium mb-2">Related Payments</h4>
              <div className="space-y-1">
                {data.payments.map(p => (
                  <div key={p.id} className="flex items-center gap-3 text-xs py-1.5 border-b border-white/[0.04] last:border-0">
                    <span className="text-slate-500 w-24 shrink-0">{fmtDate(p.created_at)}</span>
                    <span className="text-white font-medium">{fmtINR(p.amount_inr)}</span>
                    <Badge color={p.status === 'captured' ? 'green' : 'yellow'}>{p.status}</Badge>
                    <span className="text-slate-500 font-mono text-[10px] truncate">{p.rzp_order_id || ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};

// Issue License Modal
// Inline quota toggle + top-up control on each license row.
// Off (default) = unlimited (software licence). On = sell-by-print; the
// counter decrements every print and the desktop apps stop at 0.
const QuotaCell = ({ license, onChanged }) => {
  const enabled   = !!license.quota_enabled;
  const remaining = license.quota_remaining || 0;
  const total     = license.quota_total || 0;
  const { showToast } = useToast();
  const [busy, setBusy]     = React.useState(false);
  const [topUp, setTopUp]   = React.useState('');

  const setEnabled = async (v) => {
    setBusy(true);
    try {
      await mvApi.adminSetLicenseQuota(license.id, { enabled: v });
      showToast('Quota mode ' + (v ? 'enabled' : 'disabled'), 'success');
      onChanged?.();
    } catch (e) { showToast(e.message, 'error'); }
    finally { setBusy(false); }
  };
  const addPrints = async () => {
    const n = Math.max(0, parseInt(topUp, 10) || 0);
    if (!n) return;
    setBusy(true);
    try {
      await mvApi.adminSetLicenseQuota(license.id, { add: n, enabled: true });
      showToast(`Added ${n} prints`, 'success');
      setTopUp('');
      onChanged?.();
    } catch (e) { showToast(e.message, 'error'); }
    finally { setBusy(false); }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setEnabled(!enabled)}
        disabled={busy}
        title={enabled ? 'Sell-by-print mode' : 'Unlimited (software) mode'}
        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
          enabled ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-white/[0.04] text-slate-400 border border-white/[0.08]'
        }`}
      >
        {enabled ? 'On' : 'Off'}
      </button>
      {enabled && (
        <>
          <span className={`text-[11px] font-mono ${remaining <= 0 ? 'text-red-400' : remaining <= 50 ? 'text-amber-300' : 'text-emerald-300'}`}>
            {remaining}{total > 0 ? `/${total}` : ''}
          </span>
          <input
            type="number"
            min="0"
            placeholder="+ add"
            value={topUp}
            onChange={(e) => setTopUp(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addPrints()}
            className="w-16 bg-white/[0.04] border border-white/[0.08] rounded px-1.5 py-0.5 text-[11px] text-white focus:outline-none focus:border-rose-500/50"
          />
          <AdminBtn size="xs" variant="ghost" onClick={addPrints} disabled={busy || !topUp}>+</AdminBtn>
        </>
      )}
    </div>
  );
};

const IssueLicenseModal = ({ onClose }) => {
  const [product, setProduct] = React.useState('viewer');
  const [plan, setPlan] = React.useState('monthly');
  const [seats, setSeats] = React.useState(1);
  const [days, setDays] = React.useState(30);
  const [accountId, setAccountId] = React.useState('');
  // Manual revenue capture — operator logs the actual amount + method so it
  // flows into the dashboard alongside Razorpay payments.
  const [payAmount, setPayAmount] = React.useState('');
  const [payMethod, setPayMethod] = React.useState('cash');
  const [payNote, setPayNote] = React.useState('');
  const [issuing, setIssuing] = React.useState(false);
  const [result, setResult] = React.useState(null);
  const { showToast } = useToast();

  const issue = async () => {
    if (!accountId.trim()) { showToast('Account ID is required', 'error'); return; }
    setIssuing(true);
    try {
      const r = await mvApi.adminIssueLicense({
        product, plan, seats, days,
        account_id: accountId.trim(),
        payment_amount: Math.max(0, parseInt(payAmount, 10) || 0),
        payment_method: payMethod,
        payment_note:   payNote.trim(),
      });
      setResult(r);
      showToast('License issued' + (r.payment_amount ? ` · ₹${r.payment_amount} recorded` : '') + '!', 'success');
    }
    catch (e) { showToast(e.message, 'error'); }
    finally { setIssuing(false); }
  };

  return (
    <Modal open={true} onClose={onClose} title="Issue New License">
      {result ? (
        <div className="text-center py-4">
          <div className="text-emerald-400 text-lg font-bold mb-2">License Created!</div>
          <div className="font-mono text-xl text-rose-400 bg-white/[0.04] rounded-lg px-4 py-3 mb-3 select-all">{result.key_code}</div>
          <div className="text-sm text-slate-400 space-y-1">
            <div>Plan: <span className="text-white capitalize">{result.plan}</span></div>
            <div>Seats: <span className="text-white">{result.seats}</span></div>
            <div>Expires: <span className="text-white">{fmtDate(result.expires_at)}</span></div>
          </div>
          <div className="mt-4"><AdminBtn variant="primary" size="md" onClick={onClose}>Done</AdminBtn></div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Account name or ID</label>
            <input type="text" value={accountId} onChange={e => setAccountId(e.target.value)} placeholder="Hospital / clinic name, or acc_xxxxxxxx"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-rose-500/50" />
            <p className="mt-1 text-[10px] text-slate-500">If no matching account exists, one will be created automatically.</p>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Product</label>
            <div className="grid grid-cols-2 gap-2">
              {['viewer','bridge'].map(p => (
                <button key={p} type="button" onClick={() => setProduct(p)}
                  className={`px-3 py-2 rounded-lg text-sm font-semibold border ${product === p ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' : 'bg-white/[0.04] text-slate-300 border-white/[0.08]'}`}>
                  {p === 'viewer' ? 'Viewer (DICOM viewer)' : 'Bridge (auto-print tray)'}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Plan</label>
              <select value={plan} onChange={e => setPlan(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white">
                <option value="trial">Trial</option>
                <option value="monthly">Monthly</option>
                <option value="annual">Annual</option>
                <option value="lifetime">Lifetime</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Seats</label>
              <input type="number" value={seats} onChange={e => setSeats(Math.max(1, +e.target.value))} min="1"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500/50" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Days</label>
              <input type="number" value={days} onChange={e => setDays(Math.max(1, +e.target.value))} min="1"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500/50" />
            </div>
          </div>

          {/* Manual payment capture — adds to revenue dashboard */}
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-3">
            <div className="text-xs font-semibold text-emerald-300 uppercase tracking-wide">Payment received (optional)</div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Amount (₹)</label>
                <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} min="0" placeholder="0"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Method</label>
                <select value={payMethod} onChange={e => setPayMethod(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white">
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cheque">Cheque</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Note</label>
                <input type="text" value={payNote} onChange={e => setPayNote(e.target.value)} placeholder="Ref / receipt #"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50" />
              </div>
            </div>
            <p className="text-[10px] text-slate-500">Leave amount at 0 if no money was collected (e.g. trial). Amounts above 0 are added to the payments table and revenue charts.</p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <AdminBtn variant="ghost" onClick={onClose}>Cancel</AdminBtn>
            <AdminBtn variant="primary" onClick={issue} disabled={issuing}>{issuing ? 'Issuing…' : 'Issue License'}</AdminBtn>
          </div>
        </div>
      )}
    </Modal>
  );
};

// ── Wallets ─────────────────────────────────────────────────────────────────

const AdminWallets = () => {
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [adjusting, setAdjusting] = React.useState(null);
  const [amount, setAmount] = React.useState('');
  const [reason, setReason] = React.useState('');
  const { showToast } = useToast();

  const load = (p = page) => { setLoading(true); mvApi.adminWallets(p).then(setData).catch(e => showToast(e.message, 'error')).finally(() => setLoading(false)); };
  React.useEffect(() => { load(1); }, []);

  const doAdjust = async () => {
    const amt = parseInt(amount);
    if (!amt) { showToast('Enter a valid amount', 'error'); return; }
    try {
      const r = await mvApi.adminAdjustWallet({ account_id: adjusting.account_id, type: adjusting.type, amount: amt, reason: reason || 'Admin adjustment' });
      showToast(`Balance: ${r.previous} → ${r.balance}`, 'success');
      setAdjusting(null); setAmount(''); setReason(''); load(page);
    } catch (e) { showToast(e.message, 'error'); }
  };

  return (
    <AdminPage title="Wallets" subtitle="Print & AI credit balances">
      {loading ? <div className="text-slate-500 py-8">Loading…</div> : (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-white/[0.06]">
              <th className="text-left px-4 py-3 text-[11px] text-slate-500 font-medium uppercase tracking-wider">Account</th>
              <th className="text-left px-4 py-3 text-[11px] text-slate-500 font-medium uppercase tracking-wider">Owner</th>
              <th className="text-left px-4 py-3 text-[11px] text-slate-500 font-medium uppercase tracking-wider">Type</th>
              <th className="text-right px-4 py-3 text-[11px] text-slate-500 font-medium uppercase tracking-wider">Balance</th>
              <th className="text-right px-4 py-3 text-[11px] text-slate-500 font-medium uppercase tracking-wider">Action</th>
            </tr></thead>
            <tbody>
              {(data?.data || []).length === 0 && <TableEmpty cols={5} />}
              {(data?.data || []).map((w, i) => (
                <tr key={i} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-white font-medium text-[13px]">{w.account_name || '—'}</td>
                  <td className="px-4 py-3 text-slate-400 text-[13px]">{w.owner_email || '—'}</td>
                  <td className="px-4 py-3"><Badge color={w.type === 'print' ? 'blue' : 'rose'}>{w.type}</Badge></td>
                  <td className="px-4 py-3 text-right font-mono text-white font-bold">{Number(w.balance).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">
                    <AdminBtn size="xs" onClick={() => setAdjusting({ account_id: w.account_id, account_name: w.account_name, type: w.type })}>Adjust</AdminBtn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-3 border-t border-white/[0.06]">
            <Pagination page={page} total={data?.total || 0} perPage={25} onPage={p => { setPage(p); load(p); }} />
          </div>
        </div>
      )}

      <Modal open={!!adjusting} onClose={() => setAdjusting(null)} title={`Adjust ${adjusting?.type} wallet`}>
        {adjusting && (
          <div className="space-y-4">
            <p className="text-sm text-slate-400">Account: <span className="text-white font-medium">{adjusting.account_name}</span></p>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Amount (+add / −subtract)</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="+100 or -50"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500/50" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Reason</label>
              <input type="text" value={reason} onChange={e => setReason(e.target.value)} placeholder="Refund / Bonus / Correction"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500/50" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <AdminBtn variant="ghost" onClick={() => setAdjusting(null)}>Cancel</AdminBtn>
              <AdminBtn variant="primary" onClick={doAdjust}>Apply</AdminBtn>
            </div>
          </div>
        )}
      </Modal>
    </AdminPage>
  );
};

// ── Payments ────────────────────────────────────────────────────────────────

const AdminPayments = () => {
  const [page, setPage] = React.useState(1);
  const { data, loading } = useAdminFetch(() => mvApi.adminPayments(page), [page]);

  return (
    <AdminPage title="Payments" subtitle="All Razorpay transactions">
      {loading ? <div className="text-slate-500 py-8">Loading…</div> : (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-white/[0.06]">
              <th className="text-left px-4 py-3 text-[11px] text-slate-500 font-medium uppercase tracking-wider">Order ID</th>
              <th className="text-left px-4 py-3 text-[11px] text-slate-500 font-medium uppercase tracking-wider">Account</th>
              <th className="text-left px-4 py-3 text-[11px] text-slate-500 font-medium uppercase tracking-wider">Purpose</th>
              <th className="text-right px-4 py-3 text-[11px] text-slate-500 font-medium uppercase tracking-wider">Amount</th>
              <th className="text-left px-4 py-3 text-[11px] text-slate-500 font-medium uppercase tracking-wider">Status</th>
              <th className="text-left px-4 py-3 text-[11px] text-slate-500 font-medium uppercase tracking-wider">Date</th>
            </tr></thead>
            <tbody>
              {(data?.data || []).length === 0 && <TableEmpty cols={6} />}
              {(data?.data || []).map(p => (
                <tr key={p.id} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
                  <td className="px-4 py-3 font-mono text-[11px] text-slate-400">{p.rzp_order_id || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="text-slate-200 text-[13px]">{p.account_name || '—'}</div>
                    <div className="text-[10px] text-slate-500">{p.owner_email}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-300 text-[13px]">{p.purpose || '—'}</td>
                  <td className="px-4 py-3 text-right text-white font-semibold">{fmtINR(p.amount_inr)}</td>
                  <td className="px-4 py-3"><Badge color={p.status === 'captured' ? 'green' : p.status === 'failed' ? 'red' : 'yellow'}>{p.status}</Badge></td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{fmtDate(p.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-3 border-t border-white/[0.06]">
            <Pagination page={page} total={data?.total || 0} perPage={25} onPage={setPage} />
          </div>
        </div>
      )}
    </AdminPage>
  );
};

// ── Tickets ─────────────────────────────────────────────────────────────────

const AdminTickets = () => {
  const [tickets, setTickets] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [selected, setSelected] = React.useState(null);
  const [reply, setReply] = React.useState('');
  const { showToast } = useToast();

  const load = () => { setLoading(true); mvApi.adminTickets().then(d => setTickets(d?.data || [])).catch(e => showToast(e.message, 'error')).finally(() => setLoading(false)); };
  React.useEffect(load, []);

  const sendReply = async (id) => {
    if (!reply.trim()) return;
    try { await mvApi.adminReplyTicket(id, { body: reply }); showToast('Reply sent', 'success'); setReply(''); setSelected(null); load(); }
    catch (e) { showToast(e.message, 'error'); }
  };

  const resolve = async (id) => {
    try { await mvApi.adminResolveTicket(id); showToast('Resolved', 'success'); setSelected(null); load(); }
    catch (e) { showToast(e.message, 'error'); }
  };

  return (
    <AdminPage title="Support Tickets" subtitle={`${tickets.filter(t => t.status === 'open').length} open`}>
      {loading ? <div className="text-slate-500 py-8">Loading…</div> : (
        <div className="space-y-3">
          {tickets.length === 0 && <p className="text-slate-500 text-sm py-8">No tickets.</p>}
          {tickets.map(t => (
            <div key={t.id} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 hover:border-white/[0.1] transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium text-white text-[14px]">{t.subject}</p>
                  <p className="text-[12px] text-slate-500 mt-0.5">{t.account_name} · {t.user_email} · {t.message_count} msg · {fmtAgo(t.created_at)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge color={t.status === 'open' ? 'green' : t.status === 'waiting' ? 'yellow' : 'slate'}>{t.status}</Badge>
                  <AdminBtn size="xs" onClick={() => setSelected(selected === t.id ? null : t.id)}>{selected === t.id ? 'Cancel' : 'Reply'}</AdminBtn>
                  {t.status !== 'closed' && <AdminBtn variant="success" size="xs" onClick={() => resolve(t.id)}>Resolve</AdminBtn>}
                </div>
              </div>
              {selected === t.id && (
                <div className="mt-3 flex gap-2">
                  <textarea value={reply} onChange={e => setReply(e.target.value)} rows={3} placeholder="Type your reply…"
                    className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white resize-none focus:outline-none focus:border-rose-500/50" />
                  <AdminBtn variant="primary" size="sm" onClick={() => sendReply(t.id)}>Send</AdminBtn>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </AdminPage>
  );
};

// ── Bugs ─────────────────────────────────────────────────────────────────────

const AdminBugs = () => {
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const { showToast } = useToast();

  const load = () => { setLoading(true); mvApi.adminBugs().then(d => setItems(d?.data || [])).catch(e => showToast(e.message, 'error')).finally(() => setLoading(false)); };
  React.useEffect(load, []);

  const update = async (id, status) => {
    try { await mvApi.adminUpdateBug(id, status); showToast('Updated', 'success'); load(); }
    catch (e) { showToast(e.message, 'error'); }
  };

  return (
    <AdminPage title="Bugs & Ideas" subtitle="User-reported issues">
      {loading ? <div className="text-slate-500 py-8">Loading…</div> : (
        <div className="space-y-3">
          {items.length === 0 && <p className="text-slate-500 text-sm py-8">No reports.</p>}
          {items.map(b => (
            <div key={b.id} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 hover:border-white/[0.1] transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium text-white text-[14px]">{b.title}</p>
                  <p className="text-[12px] text-slate-500 mt-0.5">{b.account_name} · {b.user_email} · {b.severity} · {fmtAgo(b.created_at)}</p>
                  {b.description && <p className="text-sm text-slate-300 mt-2 whitespace-pre-wrap line-clamp-3">{b.description}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge color={b.status === 'resolved' ? 'green' : b.status === 'in_progress' ? 'yellow' : 'slate'}>{b.status}</Badge>
                  {b.status !== 'in_progress' && <AdminBtn size="xs" onClick={() => update(b.id, 'in_progress')}>In Progress</AdminBtn>}
                  {b.status !== 'resolved' && <AdminBtn variant="success" size="xs" onClick={() => update(b.id, 'resolved')}>Resolve</AdminBtn>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminPage>
  );
};

// ── Audit ────────────────────────────────────────────────────────────────────

const AdminAudit = () => {
  const [page, setPage] = React.useState(1);
  const { data, loading } = useAdminFetch(() => mvApi.adminAudit(page), [page]);

  return (
    <AdminPage title="Audit Log" subtitle="All actions">
      {loading ? <div className="text-slate-500 py-8">Loading…</div> : (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead><tr className="border-b border-white/[0.06]">
              <th className="text-left px-4 py-3 text-[11px] text-slate-500 font-medium uppercase tracking-wider">Time</th>
              <th className="text-left px-4 py-3 text-[11px] text-slate-500 font-medium uppercase tracking-wider">Actor</th>
              <th className="text-left px-4 py-3 text-[11px] text-slate-500 font-medium uppercase tracking-wider">Action</th>
              <th className="text-left px-4 py-3 text-[11px] text-slate-500 font-medium uppercase tracking-wider">Target</th>
              <th className="text-right px-4 py-3 text-[11px] text-slate-500 font-medium uppercase tracking-wider">IP</th>
            </tr></thead>
            <tbody>
              {(data?.data || []).length === 0 && <TableEmpty cols={5} />}
              {(data?.data || []).map(e => (
                <tr key={e.id} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
                  <td className="px-4 py-2.5 text-slate-500">{new Date(e.created_at).toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-slate-300">{e.actor_name || '—'}</td>
                  <td className="px-4 py-2.5 font-mono text-rose-400">{e.action}</td>
                  <td className="px-4 py-2.5 text-slate-400 truncate max-w-[300px]">{e.target || '—'}</td>
                  <td className="px-4 py-2.5 text-slate-600 text-right font-mono">{e.ip || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-3 border-t border-white/[0.06]">
            <Pagination page={page} total={data?.total || 0} perPage={50} onPage={setPage} />
          </div>
        </div>
      )}
    </AdminPage>
  );
};

// ── Settings ─────────────────────────────────────────────────────────────────

const AdminSettings = () => {
  const [settings, setSettings] = React.useState({});
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [testing, setTesting] = React.useState('');
  const [activeSection, setActiveSection] = React.useState('brand');
  const { showToast } = useToast();

  React.useEffect(() => {
    mvApi.adminSettings().then(d => { setSettings(d || {}); setLoading(false); }).catch(e => showToast(e.message, 'error'));
  }, []);

  const save = async () => {
    setSaving(true);
    try { await mvApi.saveAdminSettings(settings); showToast('Settings saved!', 'success'); }
    catch (e) { showToast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  const test = async (type) => {
    setTesting(type);
    try {
      const fn = { smtp: mvApi.testSmtp, razorpay: mvApi.testRazorpay, gemini: mvApi.testGemini }[type];
      const r = await fn({ to: settings['brand.support_email'] });
      showToast(r.message || 'Test passed!', 'success');
    } catch (e) { showToast(e.message, 'error'); }
    finally { setTesting(''); }
  };

  const F = ({ label, k, type = 'text', placeholder = '' }) => (
    <div>
      <label className="block text-[11px] text-slate-500 uppercase tracking-wider mb-1.5 font-medium">{label}</label>
      <input type={type} value={settings[k] ?? ''} placeholder={placeholder}
        onChange={e => setSettings(s => ({ ...s, [k]: e.target.value }))}
        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500/50 placeholder-slate-600" />
    </div>
  );

  const sections = [
    { id: 'brand', label: 'Brand' },
    { id: 'smtp', label: 'Email (SMTP)' },
    { id: 'razorpay', label: 'Razorpay' },
    { id: 'google', label: 'Google OAuth' },
    { id: 'gemini', label: 'Gemini AI' },
    { id: 'pricing', label: 'Pricing' },
    { id: 'business', label: 'Business' },
    { id: 'app', label: 'App Download' },
  ];

  if (loading) return <AdminPage title="Settings"><div className="text-slate-500 py-8">Loading…</div></AdminPage>;

  return (
    <AdminPage title="Settings" subtitle="Platform configuration">
      <div className="flex gap-6">
        <div className="w-40 shrink-0">
          <nav className="space-y-0.5 sticky top-8">
            {sections.map(s => (
              <button key={s.id} onClick={() => setActiveSection(s.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  activeSection === s.id ? 'bg-rose-500/15 text-rose-400' : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                }`}>{s.label}</button>
            ))}
          </nav>
        </div>

        <div className="flex-1 max-w-xl space-y-4">
          {activeSection === 'brand' && <div className="space-y-3"><F label="Brand Name" k="brand.name" /><F label="Support Email" k="brand.support_email" type="email" /><F label="Phone" k="brand.phone" /><F label="Address" k="brand.address" /></div>}

          {activeSection === 'smtp' && (
            <div className="space-y-3">
              <div className="flex justify-end"><AdminBtn size="xs" onClick={() => test('smtp')} disabled={!!testing}>{testing === 'smtp' ? 'Sending…' : 'Test SMTP'}</AdminBtn></div>
              <div className="grid grid-cols-2 gap-3">
                <F label="Host" k="smtp.host" placeholder="smtp.gmail.com" />
                <F label="Port" k="smtp.port" placeholder="587" />
                <F label="Username" k="smtp.username" />
                <F label="Password" k="smtp.password" type="password" />
                <F label="From Email" k="smtp.from_email" />
                <F label="Encryption" k="smtp.encryption" placeholder="tls" />
              </div>
            </div>
          )}

          {activeSection === 'razorpay' && (
            <div className="space-y-3">
              <div className="flex justify-end"><AdminBtn size="xs" onClick={() => test('razorpay')} disabled={!!testing}>{testing === 'razorpay' ? 'Testing…' : 'Test Connection'}</AdminBtn></div>
              <div className="grid grid-cols-2 gap-3">
                <F label="Key ID" k="razorpay.key_id" placeholder="rzp_test_..." />
                <F label="Key Secret" k="razorpay.key_secret" type="password" />
                <F label="Webhook Secret" k="razorpay.webhook_secret" type="password" />
                <div>
                  <label className="block text-[11px] text-slate-500 uppercase tracking-wider mb-1.5 font-medium">Mode</label>
                  <select value={settings['razorpay.mode'] || 'test'} onChange={e => setSettings(s => ({ ...s, 'razorpay.mode': e.target.value }))}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white">
                    <option value="test">Test</option><option value="live">Live</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'google' && <div className="space-y-3"><F label="Google Client ID" k="google.client_id" placeholder="xxxxx.apps.googleusercontent.com" /><p className="text-[11px] text-slate-500">Get from <a href="https://console.cloud.google.com/" target="_blank" className="text-rose-400 underline">Google Cloud Console</a></p></div>}

          {activeSection === 'gemini' && (
            <div className="space-y-3">
              <div className="flex justify-end"><AdminBtn size="xs" onClick={() => test('gemini')} disabled={!!testing}>{testing === 'gemini' ? 'Testing…' : 'Test Gemini'}</AdminBtn></div>
              <F label="API Key" k="gemini.api_key" type="password" placeholder="AIzaSy..." />
              <F label="Model" k="gemini.model" placeholder="gemini-1.5-flash" />
              <div>
                <label className="block text-[11px] text-slate-500 uppercase tracking-wider mb-1.5 font-medium">System Prompt</label>
                <textarea value={settings['gemini.system_prompt'] ?? ''} rows={4}
                  onChange={e => setSettings(s => ({ ...s, 'gemini.system_prompt': e.target.value }))}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white resize-y focus:outline-none focus:border-rose-500/50" />
              </div>
            </div>
          )}

          {activeSection === 'pricing' && <div className="grid grid-cols-2 gap-3"><F label="Monthly (₹)" k="pricing.monthly_inr" placeholder="8000" /><F label="Annual (₹)" k="pricing.annual_inr" placeholder="100000" /><F label="Trial Days" k="pricing.trial_days" placeholder="30" /><F label="Trial Seats" k="pricing.trial_seats" placeholder="1" /></div>}

          {activeSection === 'business' && <div className="grid grid-cols-2 gap-3"><F label="UPI ID" k="business.upi_id" placeholder="you@upi" /><F label="Bank Name" k="business.bank_name" /><F label="Account No." k="business.bank_account" /><F label="IFSC" k="business.bank_ifsc" /></div>}

          {activeSection === 'app' && (
            <div className="space-y-3">
              <F label="EXE URL" k="app.exe_url" placeholder="https://..." />
              <F label="Version" k="app.exe_version" placeholder="1.0.0" />
              <div>
                <label className="block text-[11px] text-slate-500 uppercase tracking-wider mb-1.5 font-medium">Changelog</label>
                <textarea value={settings['app.exe_changelog'] ?? ''} rows={3}
                  onChange={e => setSettings(s => ({ ...s, 'app.exe_changelog': e.target.value }))}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white resize-y focus:outline-none focus:border-rose-500/50" />
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-white/[0.06]">
            <AdminBtn variant="primary" size="md" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save All Settings'}</AdminBtn>
          </div>
        </div>
      </div>
    </AdminPage>
  );
};

// ── Revenue ─────────────────────────────────────────────────────────────────
// Sales-oriented view: total paid (real Razorpay captures), range filter,
// breakdown by purpose (license vs print_topup vs ai_topup), daily chart,
// last 50 payments with one-click CSV export.

const AdminRevenue = () => {
  const [range, setRange] = React.useState('30d');
  const [data, setData]   = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const { showToast } = useToast();

  React.useEffect(() => {
    setLoading(true);
    mvApi.adminRevenue(range).then(setData).catch(e => showToast(e.message, 'error')).finally(() => setLoading(false));
  }, [range]);

  const inr = (n) => n != null ? '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '—';

  // CSV export of the recent payments table.
  const exportCsv = () => {
    if (!data?.recent?.length) return;
    const header = ['date','account','owner_email','purpose','amount_inr','status'];
    const rows = data.recent.map(p => [
      (p.captured_at || p.created_at || '').replace('T',' '),
      JSON.stringify(p.account_name || ''),
      p.owner_email || '',
      p.purpose || '',
      p.amount_inr || 0,
      p.status || '',
    ].join(','));
    const blob = new Blob([header.join(',') + '\n' + rows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `mediview-revenue-${range}-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  };

  // Daily chart — pure SVG, no chart library.
  const Sparkline = ({ rows }) => {
    if (!rows || rows.length === 0) return <p className="text-slate-500 text-sm">No payments in this range.</p>;
    const w = 760, h = 120, pad = 8;
    const max = Math.max(1, ...rows.map(r => r.total));
    const stepX = (w - pad * 2) / Math.max(1, rows.length - 1);
    const pts = rows.map((r, i) => [pad + i * stepX, h - pad - (r.total / max) * (h - pad * 2)]);
    const path = pts.map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`)).join(' ');
    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-32">
        <path d={`${path} L${pts[pts.length-1][0]},${h} L${pts[0][0]},${h} Z`} fill="rgba(244,63,94,0.12)"/>
        <path d={path} fill="none" stroke="#f43f5e" strokeWidth="2"/>
      </svg>
    );
  };

  return (
    <AdminPage title="Revenue" subtitle="Real money in (Razorpay captures). Manual provisioning is tracked separately."
      actions={
        <div className="flex items-center gap-2">
          <select value={range} onChange={e => setRange(e.target.value)}
            className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-white">
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="12mo">Last 12 months</option>
          </select>
          <AdminBtn size="sm" variant="ghost" onClick={exportCsv} disabled={!data?.recent?.length}>Export CSV</AdminBtn>
        </div>
      }>
      {loading ? <div className="text-slate-500 py-8">Loading…</div> : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard label="Paid (range)"   value={inr(data?.range_total)}    sub={`Razorpay captures, ${range}`}/>
            <StatCard label="Paid (all-time)" value={inr(data?.total_paid)}    sub="Captured" />
            <StatCard label="Manual (all-time)" value={inr(data?.total_manual)} sub="Auto-provisioned (no gateway)" />
            <StatCard label="Range size"     value={range} />
          </div>

          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 mb-6">
            <h3 className="text-[11px] uppercase tracking-widest text-slate-500 font-medium mb-3">Daily revenue (captured)</h3>
            <Sparkline rows={data?.daily}/>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
              <h3 className="text-[11px] uppercase tracking-widest text-slate-500 font-medium mb-3">Revenue by purpose</h3>
              {(data?.by_purpose || []).length === 0
                ? <p className="text-slate-500 text-sm">No captured payments yet.</p>
                : (
                  <table className="w-full text-sm">
                    <tbody>
                      {data.by_purpose.map((r) => (
                        <tr key={r.purpose} className="border-b border-white/[0.04] last:border-0">
                          <td className="py-2 pr-3 text-slate-300">{r.purpose}</td>
                          <td className="py-2 pr-3 text-slate-500 text-right w-20">{r.n}</td>
                          <td className="py-2 text-white font-mono text-right">{inr(r.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
            </div>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 lg:col-span-1">
              <h3 className="text-[11px] uppercase tracking-widest text-slate-500 font-medium mb-3">Recent payments</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-white/[0.06] text-slate-500">
                    <th className="py-2 pr-2 text-left">When</th>
                    <th className="py-2 pr-2 text-left">Account</th>
                    <th className="py-2 pr-2 text-left">Purpose</th>
                    <th className="py-2 text-right">Amount</th>
                  </tr></thead>
                  <tbody>
                    {(data?.recent || []).slice(0, 10).map(p => (
                      <tr key={p.id} className="border-b border-white/[0.04] last:border-0">
                        <td className="py-2 pr-2 text-slate-400 text-[11px]">{fmtAgo(p.captured_at || p.created_at)}</td>
                        <td className="py-2 pr-2 text-slate-200 truncate max-w-[140px]">{p.account_name || '—'}</td>
                        <td className="py-2 pr-2 text-slate-400">{p.purpose}</td>
                        <td className="py-2 text-right font-mono text-white">{inr(p.amount_inr)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </AdminPage>
  );
};

// ── Releases (force-update) ─────────────────────────────────────────────────
// Upload installer.exe for `viewer` or `bridge`, set version + changelog,
// toggle force-update. The desktop apps poll /release/check on launch and
// every 30 min — when force_update is on for the newest release, they
// show a non-dismissible install prompt.

const AdminReleases = () => {
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [showUpload, setShowUpload] = React.useState(false);
  const { showToast } = useToast();

  const load = () => {
    setLoading(true);
    mvApi.adminReleases().then(setData).catch(e => showToast(e.message, 'error')).finally(() => setLoading(false));
  };
  React.useEffect(load, []);

  const del = async (id) => {
    if (!confirm('Delete this release? Desktops on older versions will stop being prompted to upgrade until a newer release exists.')) return;
    try { await mvApi.adminDeleteRelease(id); showToast('Release deleted', 'success'); load(); }
    catch (e) { showToast(e.message, 'error'); }
  };

  const grouped = { viewer: [], bridge: [] };
  (data?.data || []).forEach(r => { if (grouped[r.app]) grouped[r.app].push(r); });

  return (
    <AdminPage title="Releases" subtitle="Ship a new installer; desktops auto-check on launch + every 30 min"
      actions={<AdminBtn variant="primary" size="sm" onClick={() => setShowUpload(true)}>+ Upload release</AdminBtn>}>

      {loading ? <div className="text-slate-500 py-8">Loading…</div> : (
        <div className="space-y-8">
          {['viewer','bridge'].map(app => (
            <div key={app}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white uppercase tracking-wider">{app === 'viewer' ? 'Mediview Viewer (desktop)' : 'Mediview Bridge (tray)'}</h3>
                <span className="text-[11px] text-slate-500">Newest at top — desktops always pull the top row.</span>
              </div>
              {grouped[app].length === 0 ? (
                <p className="text-slate-500 text-sm bg-white/[0.02] border border-white/[0.04] rounded-lg p-4">No releases uploaded for {app} yet.</p>
              ) : (
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-white/[0.06] text-slate-500">
                      <th className="text-left px-4 py-2 text-[11px] uppercase">Version</th>
                      <th className="text-left px-4 py-2 text-[11px] uppercase">Released</th>
                      <th className="text-left px-4 py-2 text-[11px] uppercase">Size</th>
                      <th className="text-left px-4 py-2 text-[11px] uppercase">Force?</th>
                      <th className="text-left px-4 py-2 text-[11px] uppercase">Changelog</th>
                      <th className="text-right px-4 py-2 text-[11px] uppercase">Action</th>
                    </tr></thead>
                    <tbody>
                      {grouped[app].map((r, i) => (
                        <tr key={r.id} className="border-b border-white/[0.04] last:border-0">
                          <td className="px-4 py-3">
                            <div className="font-mono text-white font-semibold">{r.version}</div>
                            {i === 0 && <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 font-medium">LATEST</span>}
                          </td>
                          <td className="px-4 py-3 text-slate-400 text-xs">{fmtAgo(r.created_at)}</td>
                          <td className="px-4 py-3 text-slate-400 text-xs">{(r.file_size / 1024 / 1024).toFixed(1)} MB</td>
                          <td className="px-4 py-3">
                            {r.force_update == 1
                              ? <span className="text-red-400 font-semibold text-xs">FORCED</span>
                              : <span className="text-slate-500 text-xs">optional</span>}
                          </td>
                          <td className="px-4 py-3 text-slate-300 text-xs max-w-md whitespace-pre-wrap">{r.changelog || '—'}</td>
                          <td className="px-4 py-3 text-right">
                            <button onClick={() => del(r.id)} className="text-[11px] text-red-400 hover:underline">Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showUpload && <UploadReleaseModal onClose={() => { setShowUpload(false); load(); }} />}
    </AdminPage>
  );
};

const UploadReleaseModal = ({ onClose }) => {
  const [app, setApp]           = React.useState('viewer');
  const [version, setVersion]   = React.useState('1.0.1');
  const [changelog, setChange]  = React.useState('');
  const [force, setForce]       = React.useState(true);
  const [file, setFile]         = React.useState(null);
  const [busy, setBusy]         = React.useState(false);
  const { showToast } = useToast();

  const upload = async () => {
    if (!file) { showToast('Pick an installer file first', 'error'); return; }
    if (!/^\d+\.\d+\.\d+/.test(version)) { showToast('Version must be semver (1.2.3)', 'error'); return; }
    setBusy(true);
    try {
      await mvApi.adminUploadRelease({ app, version, changelog, force_update: force, file });
      showToast(`Release ${app} ${version} uploaded`, 'success');
      onClose();
    } catch (e) { showToast(e.message || 'Upload failed', 'error'); }
    finally { setBusy(false); }
  };

  return (
    <Modal open={true} onClose={onClose} title="Upload new release" width="max-w-lg">
      <div className="space-y-4">
        <div>
          <label className="block text-[11px] uppercase tracking-widest text-slate-500 font-medium mb-1.5">App</label>
          <div className="flex gap-2">
            {['viewer','bridge'].map(a => (
              <button key={a} onClick={() => setApp(a)}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold border ${app === a ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' : 'bg-white/[0.04] text-slate-300 border-white/[0.08]'}`}>
                {a === 'viewer' ? 'Viewer (desktop)' : 'Bridge (tray)'}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-[11px] uppercase tracking-widest text-slate-500 font-medium mb-1.5">Version (semver)</label>
          <input type="text" value={version} onChange={e => setVersion(e.target.value)} placeholder="1.0.1"
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white font-mono"/>
        </div>
        <div>
          <label className="block text-[11px] uppercase tracking-widest text-slate-500 font-medium mb-1.5">Installer (.exe)</label>
          <input type="file" accept=".exe,application/octet-stream"
            onChange={e => setFile(e.target.files?.[0] || null)}
            className="w-full text-sm text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-rose-500/20 file:text-rose-300 hover:file:bg-rose-500/30"/>
          {file && <div className="text-[11px] text-slate-500 mt-1">{file.name} · {(file.size/1024/1024).toFixed(1)} MB</div>}
        </div>
        <div>
          <label className="block text-[11px] uppercase tracking-widest text-slate-500 font-medium mb-1.5">Changelog (markdown ok)</label>
          <textarea value={changelog} onChange={e => setChange(e.target.value)} rows={4}
            placeholder="• Fixed crash when printing CT scans&#10;• Added Hindi locale&#10;• Critical security fix"
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white"/>
        </div>
        <label className="flex items-center gap-2 select-none cursor-pointer">
          <input type="checkbox" checked={force} onChange={e => setForce(e.target.checked)} className="accent-rose-500"/>
          <span className="text-sm text-slate-200">Force update</span>
          <span className="text-[11px] text-slate-500">Desktops on older versions will be required to install before continuing.</span>
        </label>
        <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.06]">
          <AdminBtn variant="ghost" onClick={onClose}>Cancel</AdminBtn>
          <AdminBtn variant="primary" onClick={upload} disabled={busy || !file}>{busy ? 'Uploading…' : 'Upload'}</AdminBtn>
        </div>
      </div>
    </Modal>
  );
};
