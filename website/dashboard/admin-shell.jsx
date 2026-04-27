// Admin Shell — super_admin only
// Handles all /admin/* routes: overview, accounts, licenses, payments, tickets, settings

const AdminShell = ({ route = '#/admin' }) => {
  const { user } = useAuth();
  const [section, setSection] = React.useState('overview');

  React.useEffect(() => {
    const path = (route || '').replace('#/admin', '').replace(/^\//, '') || 'overview';
    setSection(path || 'overview');
  }, [route]);

  const nav = [
    { id: 'overview',  label: 'Overview',  icon: '📊' },
    { id: 'accounts',  label: 'Accounts',  icon: '🏥' },
    { id: 'licenses',  label: 'Licenses',  icon: '🔑' },
    { id: 'payments',  label: 'Payments',  icon: '💳' },
    { id: 'tickets',   label: 'Tickets',   icon: '🎫' },
    { id: 'audit',     label: 'Audit Log', icon: '📋' },
    { id: 'settings',  label: 'Settings',  icon: '⚙️' },
  ];

  return (
    <div className="flex min-h-screen bg-midnight">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r border-white/8 flex flex-col">
        <div className="px-5 py-5 border-b border-white/8">
          <div className="text-rose-500 font-bold text-lg">Mediview</div>
          <div className="text-xs text-slate-500 mt-0.5">Admin Panel</div>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          {nav.map(n => (
            <button
              key={n.id}
              onClick={() => {
                setSection(n.id);
                window.location.hash = '#/admin/' + n.id;
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                section === n.id
                  ? 'bg-rose-600/20 text-rose-400'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <span>{n.icon}</span>
              {n.label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-white/8 text-xs text-slate-500">
          <div className="font-medium text-slate-300">{user?.name}</div>
          <div>{user?.email}</div>
          <a href="dashboard.html" className="mt-2 block text-rose-400 hover:underline">← User dashboard</a>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        {section === 'overview'  && <AdminOverview />}
        {section === 'accounts'  && <AdminAccounts />}
        {section === 'licenses'  && <AdminLicenses />}
        {section === 'payments'  && <AdminPayments />}
        {section === 'tickets'   && <AdminTickets />}
        {section === 'audit'     && <AdminAudit />}
        {section === 'settings'  && <AdminSettings />}
      </main>
    </div>
  );
};

// ── Shared admin components ──────────────────────────────────────────────────

const AdminPage = ({ title, children }) => (
  <div className="p-8">
    <h1 className="text-2xl font-bold text-white mb-6">{title}</h1>
    {children}
  </div>
);

const StatCard = ({ label, value, sub }) => (
  <div className="bg-white/5 border border-white/8 rounded-xl p-5">
    <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">{label}</p>
    <p className="text-3xl font-bold text-white">{value}</p>
    {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
  </div>
);

const useAdminFetch = (fn) => {
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  React.useEffect(() => {
    setLoading(true);
    fn().then(setData).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);
  return { data, loading, error };
};

// ── Overview ────────────────────────────────────────────────────────────────

const AdminOverview = () => {
  const { data, loading } = useAdminFetch(() => mvApi.adminOverview());
  if (loading) return <AdminPage title="Overview"><p className="text-slate-400">Loading…</p></AdminPage>;
  return (
    <AdminPage title="Overview">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Accounts"   value={data?.total_accounts ?? '—'} />
        <StatCard label="Active Licenses"  value={data?.active_licenses ?? '—'} />
        <StatCard label="Active Devices"   value={data?.total_devices ?? '—'} />
        <StatCard label="Open Tickets"     value={data?.open_tickets ?? '—'} />
        <StatCard label="Total Revenue"    value={data?.total_revenue != null ? '₹' + Number(data.total_revenue).toLocaleString('en-IN') : '—'} />
        <StatCard label="Revenue (30d)"    value={data?.revenue_30d != null ? '₹' + Number(data.revenue_30d).toLocaleString('en-IN') : '—'} />
        <StatCard label="New Accounts (30d)" value={data?.new_accounts_30d ?? '—'} />
        <StatCard label="Total Licenses"   value={data?.total_licenses ?? '—'} />
      </div>
    </AdminPage>
  );
};

// ── Accounts ────────────────────────────────────────────────────────────────

const AdminAccounts = () => {
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [q, setQ] = React.useState('');

  const load = (p = 1, query = q) => {
    setLoading(true);
    mvApi.adminAccounts(p).then(setData).finally(() => setLoading(false));
  };

  React.useEffect(() => { load(); }, []);

  return (
    <AdminPage title="Accounts">
      <input
        className="mb-4 w-full max-w-xs bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-white placeholder-slate-500"
        placeholder="Search name / email…" value={q}
        onChange={e => setQ(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && load(1, q)}
      />
      {loading ? <p className="text-slate-400">Loading…</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-slate-500 border-b border-white/8">
              <th className="pb-3 pr-4">Account</th>
              <th className="pb-3 pr-4">Owner Email</th>
              <th className="pb-3 pr-4">Plan</th>
              <th className="pb-3 pr-4">Licenses</th>
              <th className="pb-3">Devices</th>
            </tr></thead>
            <tbody>
              {(data?.data || []).map(a => (
                <tr key={a.id} className="border-b border-white/5 hover:bg-white/3">
                  <td className="py-3 pr-4 text-white font-medium">{a.name}<br/><span className="text-xs text-slate-500 font-mono">{a.id}</span></td>
                  <td className="py-3 pr-4 text-slate-300">{a.owner_email || '—'}</td>
                  <td className="py-3 pr-4"><span className="px-2 py-0.5 bg-rose-600/20 text-rose-400 rounded text-xs">{a.plan}</span></td>
                  <td className="py-3 pr-4 text-slate-300">{a.licenses}</td>
                  <td className="py-3 text-slate-300">{a.active_devices}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 flex gap-2 text-sm">
            {page > 1 && <button onClick={() => { setPage(p => p-1); load(page-1); }} className="text-rose-400 hover:underline">← Prev</button>}
            <span className="text-slate-500">Page {page} of {Math.ceil((data?.total||0)/25) || 1}</span>
            {(data?.total||0) > page*25 && <button onClick={() => { setPage(p => p+1); load(page+1); }} className="text-rose-400 hover:underline">Next →</button>}
          </div>
        </div>
      )}
    </AdminPage>
  );
};

// ── Licenses ────────────────────────────────────────────────────────────────

const AdminLicenses = () => {
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const { showToast } = useToast();

  const load = (p=1) => { setLoading(true); mvApi.adminLicenses(p).then(setData).finally(() => setLoading(false)); };
  React.useEffect(() => { load(); }, []);

  const revoke = async (id) => {
    if (!confirm('Revoke this license?')) return;
    await mvApi.revokeAdminLicense(id);
    showToast('License revoked', 'success');
    load(page);
  };

  return (
    <AdminPage title="Licenses">
      {loading ? <p className="text-slate-400">Loading…</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-slate-500 border-b border-white/8">
              <th className="pb-3 pr-4">Key</th>
              <th className="pb-3 pr-4">Account</th>
              <th className="pb-3 pr-4">Plan</th>
              <th className="pb-3 pr-4">Seats</th>
              <th className="pb-3 pr-4">Status</th>
              <th className="pb-3 pr-4">Expires</th>
              <th className="pb-3">Action</th>
            </tr></thead>
            <tbody>
              {(data?.data || []).map(l => (
                <tr key={l.id} className="border-b border-white/5 hover:bg-white/3">
                  <td className="py-3 pr-4 font-mono text-xs text-rose-400">{l.key_code}</td>
                  <td className="py-3 pr-4 text-slate-300">{l.account_name}<br/><span className="text-xs text-slate-500">{l.owner_email}</span></td>
                  <td className="py-3 pr-4 text-slate-300">{l.plan}</td>
                  <td className="py-3 pr-4 text-slate-300">{l.seats_used}/{l.seats}</td>
                  <td className="py-3 pr-4">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${l.status==='active' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                      {l.status}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-slate-400 text-xs">{l.expires_at ? new Date(l.expires_at).toLocaleDateString() : 'Perpetual'}</td>
                  <td className="py-3">
                    {l.status === 'active' && (
                      <button onClick={() => revoke(l.id)} className="text-xs text-red-400 hover:underline">Revoke</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminPage>
  );
};

// ── Payments ────────────────────────────────────────────────────────────────

const AdminPayments = () => {
  const { data, loading } = useAdminFetch(() => mvApi.adminPayments());
  return (
    <AdminPage title="Payments">
      {loading ? <p className="text-slate-400">Loading…</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-slate-500 border-b border-white/8">
              <th className="pb-3 pr-4">Order ID</th>
              <th className="pb-3 pr-4">Account</th>
              <th className="pb-3 pr-4">Purpose</th>
              <th className="pb-3 pr-4">Amount</th>
              <th className="pb-3 pr-4">Status</th>
              <th className="pb-3">Date</th>
            </tr></thead>
            <tbody>
              {(data?.data || []).map(p => (
                <tr key={p.id} className="border-b border-white/5">
                  <td className="py-3 pr-4 font-mono text-xs text-slate-400">{p.rzp_order_id}</td>
                  <td className="py-3 pr-4 text-slate-300">{p.account_name}<br/><span className="text-xs text-slate-500">{p.owner_email}</span></td>
                  <td className="py-3 pr-4 text-slate-300">{p.purpose}</td>
                  <td className="py-3 pr-4 text-white font-medium">₹{Number(p.amount_inr).toLocaleString('en-IN')}</td>
                  <td className="py-3 pr-4">
                    <span className={`px-2 py-0.5 rounded text-xs ${p.status==='captured' ? 'bg-green-500/20 text-green-400' : p.status==='failed' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="py-3 text-slate-400 text-xs">{new Date(p.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
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

  React.useEffect(() => {
    mvApi.adminTickets().then(d => setTickets(d?.data || [])).finally(() => setLoading(false));
  }, []);

  const sendReply = async (id) => {
    if (!reply.trim()) return;
    await mvApi.adminReplyTicket(id, { body: reply });
    showToast('Reply sent', 'success');
    setReply(''); setSelected(null);
  };

  return (
    <AdminPage title="Support Tickets">
      {loading ? <p className="text-slate-400">Loading…</p> : (
        <div className="space-y-3">
          {tickets.map(t => (
            <div key={t.id} className="bg-white/5 border border-white/8 rounded-xl p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-white">{t.subject}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{t.account_name} · {t.user_email} · {t.message_count} msg(s)</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`px-2 py-0.5 rounded text-xs ${t.status==='open' ? 'bg-green-500/20 text-green-400' : t.status==='waiting' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-slate-500/20 text-slate-400'}`}>
                    {t.status}
                  </span>
                  <button onClick={() => setSelected(selected === t.id ? null : t.id)} className="text-xs text-rose-400 hover:underline">
                    {selected === t.id ? 'Cancel' : 'Reply'}
                  </button>
                </div>
              </div>
              {selected === t.id && (
                <div className="mt-3 flex gap-2">
                  <textarea
                    value={reply} onChange={e => setReply(e.target.value)}
                    rows={3} placeholder="Type your reply…"
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white resize-none"
                  />
                  <button onClick={() => sendReply(t.id)} className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-lg text-sm font-medium self-end">
                    Send
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </AdminPage>
  );
};

// ── Audit ────────────────────────────────────────────────────────────────────

const AdminAudit = () => {
  const { data, loading } = useAdminFetch(() => mvApi.adminAudit());
  return (
    <AdminPage title="Audit Log">
      {loading ? <p className="text-slate-400">Loading…</p> : (
        <div className="space-y-1">
          {(data?.data || []).map(e => (
            <div key={e.id} className="flex items-center gap-4 py-2 border-b border-white/5 text-sm">
              <span className="text-slate-500 text-xs w-36 shrink-0">{new Date(e.created_at).toLocaleString()}</span>
              <span className="text-slate-300 w-32 shrink-0 truncate">{e.actor_name}</span>
              <span className="font-mono text-rose-400 w-40 shrink-0 truncate">{e.action}</span>
              <span className="text-slate-400 truncate">{e.target}</span>
              <span className="text-slate-500 text-xs ml-auto shrink-0">{e.ip}</span>
            </div>
          ))}
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
  const { showToast } = useToast();

  React.useEffect(() => {
    mvApi.adminSettings().then(d => { setSettings(d || {}); setLoading(false); });
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

  const F = ({ label, k, type='text', placeholder='' }) => (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      <input
        type={type} value={settings[k] ?? ''} placeholder={placeholder}
        onChange={e => setSettings(s => ({ ...s, [k]: e.target.value }))}
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
      />
    </div>
  );

  if (loading) return <AdminPage title="Settings"><p className="text-slate-400">Loading…</p></AdminPage>;

  return (
    <AdminPage title="Settings">
      <div className="grid gap-8 max-w-2xl">

        {/* Brand */}
        <section>
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-widest mb-4">Brand</h3>
          <div className="grid gap-3">
            <F label="Brand Name"     k="brand.name" />
            <F label="Support Email"  k="brand.support_email" type="email" />
            <F label="Phone"          k="brand.phone" />
            <F label="Address"        k="brand.address" />
          </div>
        </section>

        {/* SMTP */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-widest">SMTP (Email)</h3>
            <button onClick={() => test('smtp')} disabled={!!testing}
              className="text-xs bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
              {testing==='smtp' ? 'Sending…' : 'Send test email'}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <F label="SMTP Host"     k="smtp.host"      placeholder="smtp.gmail.com" />
            <F label="Port"          k="smtp.port"      placeholder="587" />
            <F label="Username"      k="smtp.username"  placeholder="you@gmail.com" />
            <F label="Password"      k="smtp.password"  type="password" placeholder="••••••••" />
            <F label="From Email"    k="smtp.from_email" />
            <F label="Encryption"    k="smtp.encryption" placeholder="tls" />
          </div>
        </section>

        {/* Razorpay */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-widest">Razorpay</h3>
            <button onClick={() => test('razorpay')} disabled={!!testing}
              className="text-xs bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
              {testing==='razorpay' ? 'Testing…' : 'Test connection'}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <F label="Key ID"        k="razorpay.key_id"       placeholder="rzp_test_..." />
            <F label="Key Secret"    k="razorpay.key_secret"   type="password" placeholder="••••••••" />
            <F label="Webhook Secret" k="razorpay.webhook_secret" type="password" />
            <div>
              <label className="block text-xs text-slate-400 mb-1">Mode</label>
              <select value={settings['razorpay.mode'] || 'test'} onChange={e => setSettings(s => ({...s,'razorpay.mode':e.target.value}))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white">
                <option value="test">Test</option>
                <option value="live">Live</option>
              </select>
            </div>
          </div>
        </section>

        {/* Google OAuth */}
        <section>
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-widest mb-4">Google OAuth</h3>
          <F label="Google Client ID" k="google.client_id" placeholder="xxxxxx.apps.googleusercontent.com" />
          <p className="text-xs text-slate-500 mt-2">
            Get this from <a href="https://console.cloud.google.com/" target="_blank" className="text-rose-400 underline">Google Cloud Console</a> → APIs &amp; Services → Credentials.
          </p>
        </section>

        {/* Gemini */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-widest">Gemini AI</h3>
            <button onClick={() => test('gemini')} disabled={!!testing}
              className="text-xs bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
              {testing==='gemini' ? 'Testing…' : 'Test Gemini'}
            </button>
          </div>
          <div className="grid gap-3">
            <F label="API Key" k="gemini.api_key" type="password" placeholder="AIzaSy..." />
            <F label="Model"   k="gemini.model"  placeholder="gemini-1.5-flash" />
            <div>
              <label className="block text-xs text-slate-400 mb-1">System Prompt</label>
              <textarea value={settings['gemini.system_prompt'] ?? ''} rows={4}
                onChange={e => setSettings(s => ({...s,'gemini.system_prompt':e.target.value}))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white resize-y"
              />
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Free API key: <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-rose-400 underline">aistudio.google.com/app/apikey</a>
          </p>
        </section>

        {/* Pricing */}
        <section>
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-widest mb-4">Pricing (₹)</h3>
          <div className="grid grid-cols-2 gap-3">
            <F label="Monthly Plan (₹)" k="pricing.monthly_inr" placeholder="8000" />
            <F label="Annual Plan (₹)"  k="pricing.annual_inr"  placeholder="100000" />
            <F label="Trial Days"        k="pricing.trial_days"  placeholder="30" />
            <F label="Trial Seats"       k="pricing.trial_seats" placeholder="1" />
          </div>
        </section>

        {/* Business / Invoice */}
        <section>
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-widest mb-4">Business &amp; Invoice</h3>
          <div className="grid grid-cols-2 gap-3">
            <F label="UPI ID"         k="business.upi_id"      placeholder="you@upi" />
            <F label="Bank Name"      k="business.bank_name"   placeholder="HDFC Bank" />
            <F label="Account No."    k="business.bank_account" />
            <F label="IFSC Code"      k="business.bank_ifsc"   placeholder="HDFC0001234" />
          </div>
        </section>

        {/* App download */}
        <section>
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-widest mb-4">App Download</h3>
          <div className="grid gap-3">
            <F label="EXE URL (or local path)" k="app.exe_url" placeholder="https://github.com/yourorg/releases/v1.0.0/Mediview-Setup.exe" />
            <F label="App Version"             k="app.exe_version" placeholder="1.0.0" />
            <div>
              <label className="block text-xs text-slate-400 mb-1">Changelog</label>
              <textarea value={settings['app.exe_changelog'] ?? ''} rows={3}
                onChange={e => setSettings(s => ({...s,'app.exe_changelog':e.target.value}))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white resize-y"
              />
            </div>
          </div>
        </section>

        <div className="pt-2">
          <button onClick={save} disabled={saving}
            className="bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white px-8 py-3 rounded-lg font-semibold transition-colors">
            {saving ? 'Saving…' : 'Save All Settings'}
          </button>
        </div>
      </div>
    </AdminPage>
  );
};
