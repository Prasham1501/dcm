// Dashboard pages — Devices, Wallet, AI, Invoices, Tickets, Bugs, Team, Analytics, Audit, API, Referrals, Settings.

// =============== Devices ===============
const PageDevices = () => {
  const [showRegister, setShowRegister] = React.useState(false);
  const [manageDev, setManageDev] = React.useState(null);
  return (
    <DashShell activeId="devices" title="Devices" subtitle="Workstations licensed under your account."
      action={<DButton variant="primary" onClick={() => setShowRegister(true)}><I.Plus size={14}/> Register device</DButton>}>
      <div className="rounded-2xl border border-[var(--line)] bg-white dark:bg-mid2 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-paper2 dark:bg-white/[0.04] text-xs uppercase tracking-wider text-[var(--muted)]">
            <tr>
              <th className="text-left px-5 py-3 font-bold">Device</th>
              <th className="text-left px-5 py-3 font-bold hidden md:table-cell">OS</th>
              <th className="text-left px-5 py-3 font-bold hidden lg:table-cell">Version</th>
              <th className="text-left px-5 py-3 font-bold">Last seen</th>
              <th className="text-left px-5 py-3 font-bold">Status</th>
              <th className="px-5 py-3"/>
            </tr>
          </thead>
          <tbody>
            {mockData.devices.map(d => (
              <tr key={d.id} className="border-t border-[var(--line)] hover:bg-paper2/60 dark:hover:bg-white/[0.03]">
                <td className="px-5 py-4">
                  <div className="font-bold">{d.name}</div>
                  <div className="text-xs font-mono text-[var(--muted)]">{d.id}</div>
                </td>
                <td className="px-5 py-4 hidden md:table-cell text-[var(--muted)]">{d.os}</td>
                <td className="px-5 py-4 hidden lg:table-cell font-mono text-xs text-[var(--muted)]">v{d.version}</td>
                <td className="px-5 py-4 text-[var(--muted)]">{d.lastSeen}</td>
                <td className="px-5 py-4">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold ${
                    d.status === 'online' ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' :
                    d.status === 'idle' ? 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400' :
                    'bg-zinc-100 dark:bg-white/10 text-zinc-600 dark:text-zinc-400'
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${d.status === 'online' ? 'bg-emerald-500 animate-pulse' : d.status === 'idle' ? 'bg-amber-500' : 'bg-zinc-400'}`}/>
                    {d.status}
                  </span>
                </td>
                <td className="px-5 py-4 text-right">
                  <button onClick={() => setManageDev(d)} className="text-xs font-bold text-rose hover:underline">Manage</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={showRegister} onClose={() => setShowRegister(false)} title="Register a new device">
        <div className="space-y-4">
          <p className="text-sm text-[var(--muted)]">Install Mediview on the new workstation, then enter the registration code shown on first launch.</p>
          <DLabel>Device name</DLabel>
          <DInput placeholder="e.g. Reporting Station 3"/>
          <DLabel>Registration code</DLabel>
          <DInput placeholder="XXXX-XXXX-XXXX" className="font-mono"/>
          <div className="flex justify-end gap-2 pt-2">
            <DButton variant="ghost" onClick={() => setShowRegister(false)}>Cancel</DButton>
            <DButton variant="primary" onClick={() => setShowRegister(false)}>Register</DButton>
          </div>
        </div>
      </Modal>

      <Modal open={!!manageDev} onClose={() => setManageDev(null)} title={`Manage — ${manageDev?.name || ''}`} size="lg">
        {manageDev && (
          <div className="space-y-5">
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-[var(--line)] p-3">
                <div className="text-[10px] uppercase font-bold text-[var(--muted)]">Device ID</div>
                <div className="font-mono text-xs mt-1">{manageDev.id}</div>
              </div>
              <div className="rounded-xl border border-[var(--line)] p-3">
                <div className="text-[10px] uppercase font-bold text-[var(--muted)]">Operating system</div>
                <div className="font-semibold mt-1">{manageDev.os}</div>
              </div>
              <div className="rounded-xl border border-[var(--line)] p-3">
                <div className="text-[10px] uppercase font-bold text-[var(--muted)]">Build</div>
                <div className="font-mono text-xs mt-1">v{manageDev.version}</div>
              </div>
              <div className="rounded-xl border border-[var(--line)] p-3">
                <div className="text-[10px] uppercase font-bold text-[var(--muted)]">Last seen</div>
                <div className="font-semibold mt-1">{manageDev.lastSeen}</div>
              </div>
            </div>

            <div>
              <DLabel>Rename device</DLabel>
              <DInput defaultValue={manageDev.name}/>
            </div>
            <div>
              <DLabel>Assigned to</DLabel>
              <select className="h-10 w-full px-3 rounded-lg border border-[var(--line)] bg-white dark:bg-white/[0.04] text-sm">
                <option>Unassigned</option>
                <option>Dr. Anjali Sharma</option>
                <option>Dr. Rohit Khanna</option>
                <option>Priya Singh</option>
              </select>
            </div>

            <div className="rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 p-3 text-xs flex items-start gap-2">
              <I.Lock size={14} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0"/>
              <div>Deactivating frees a license seat. The workstation can re-activate with a new code at any time.</div>
            </div>

            <div className="pt-3 border-t border-[var(--line)] flex flex-wrap items-center gap-2 justify-between">
              <button className="text-xs font-bold text-rose hover:underline inline-flex items-center gap-1">
                <I.Trash size={12}/> Deactivate device
              </button>
              <div className="flex gap-2">
                <DButton variant="ghost" onClick={() => setManageDev(null)}>Cancel</DButton>
                <DButton variant="primary" onClick={() => setManageDev(null)}>Save changes</DButton>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </DashShell>
  );
};

// =============== Wallet history ===============
const PageWallet = () => {
  const [open, setOpen] = React.useState(false);
  const printTxns = mockData.recentTransactions.filter(t => t.type === 'print');
  return (
    <DashShell activeId="wallet" title="Print wallet" subtitle="Manage credits and download invoices."
      action={<DButton variant="primary" onClick={() => setOpen(true)}>+ Top up</DButton>}>
      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <div className="rounded-2xl border border-[var(--line)] bg-white dark:bg-mid2 p-5">
          <div className="text-xs uppercase tracking-wider font-bold text-[var(--muted)]">Current balance</div>
          <div className="font-display text-4xl font-bold mt-2">{mockData.printBalance.toLocaleString('en-IN')}</div>
          <div className="text-xs text-[var(--muted)]">pages remaining</div>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-white dark:bg-mid2 p-5">
          <div className="text-xs uppercase tracking-wider font-bold text-[var(--muted)]">This month</div>
          <div className="font-display text-4xl font-bold mt-2">{mockData.monthlyPrints.toLocaleString('en-IN')}</div>
          <div className="text-xs text-[var(--muted)]">pages printed</div>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-white dark:bg-mid2 p-5">
          <div className="text-xs uppercase tracking-wider font-bold text-[var(--muted)]">Avg cost / page</div>
          <div className="font-display text-4xl font-bold mt-2">₹0.94</div>
          <div className="text-xs text-[var(--muted)]">across all paper sizes</div>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--line)] bg-white dark:bg-mid2 overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--line)] flex items-center justify-between">
          <h3 className="font-display font-bold text-lg">Transactions</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-paper2 dark:bg-white/[0.04] text-xs uppercase tracking-wider text-[var(--muted)]">
            <tr>
              <th className="text-left px-5 py-3 font-bold">Date</th>
              <th className="text-left px-5 py-3 font-bold">Pages</th>
              <th className="text-left px-5 py-3 font-bold">Amount</th>
              <th className="text-left px-5 py-3 font-bold hidden md:table-cell">Invoice</th>
              <th className="px-5 py-3"/>
            </tr>
          </thead>
          <tbody>
            {printTxns.map(t => (
              <tr key={t.id} className="border-t border-[var(--line)]">
                <td className="px-5 py-4 text-[var(--muted)]">{t.date}</td>
                <td className="px-5 py-4 font-mono">+{t.credits.toLocaleString('en-IN')}</td>
                <td className="px-5 py-4 font-mono">{fmt.inr(t.amount)}</td>
                <td className="px-5 py-4 hidden md:table-cell font-mono text-xs text-[var(--muted)]">{t.invoice}</td>
                <td className="px-5 py-4 text-right">
                  <button onClick={() => window.dispatchEvent(new CustomEvent('mv:download-invoice', { detail: t }))} className="text-xs font-bold text-rose hover:underline inline-flex items-center gap-1">
                    <I.Download size={12}/> Download
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Top up print wallet">
        <PrintRecharge onSuccess={() => setOpen(false)} onCancel={() => setOpen(false)} />
      </Modal>
    </DashShell>
  );
};

// =============== AI usage ===============
const PageAI = () => {
  const [open, setOpen] = React.useState(false);
  return (
    <DashShell activeId="ai" title="AI credits" subtitle="Findings drafts, follow-up suggestions, and report polishing."
      action={<DButton variant="primary" onClick={() => setOpen(true)}>+ Top up</DButton>}>
      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <div className="rounded-2xl border border-[var(--line)] bg-white dark:bg-mid2 p-5">
          <div className="text-xs uppercase tracking-wider font-bold text-amber-700 dark:text-amber-400">Balance</div>
          <div className="font-display text-5xl font-bold mt-2">{mockData.aiBalance.toLocaleString('en-IN')}</div>
          <div className="text-xs text-[var(--muted)] mt-1">credits · 1 credit = 1 inference</div>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-white dark:bg-mid2 p-5">
          <div className="text-xs uppercase tracking-wider font-bold text-[var(--muted)]">This month</div>
          <div className="font-display text-5xl font-bold mt-2">{mockData.monthlyAI}</div>
          <div className="text-xs text-[var(--muted)]">+22% vs March</div>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--line)] bg-white dark:bg-mid2 p-5">
        <h3 className="font-display font-bold text-lg mb-4">Usage breakdown</h3>
        <div className="space-y-3">
          {[
            { name: 'Findings drafting', count: 187, pct: 55 },
            { name: 'Report polishing',  count: 92,  pct: 27 },
            { name: 'Follow-up suggestions', count: 41, pct: 12 },
            { name: 'Translation',       count: 20,  pct: 6  },
          ].map(u => (
            <div key={u.name}>
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="font-semibold">{u.name}</span>
                <span className="font-mono text-[var(--muted)]">{u.count} · {u.pct}%</span>
              </div>
              <div className="h-2 rounded-full bg-paper2 dark:bg-white/[0.06] overflow-hidden">
                <div className="h-full bg-gradient-to-r from-amber-400 to-rose" style={{ width: `${u.pct}%` }}/>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Top up AI credits">
        <AIRecharge onSuccess={() => setOpen(false)} onCancel={() => setOpen(false)} />
      </Modal>
    </DashShell>
  );
};

// =============== Invoices ===============
const PageInvoices = () => (
  <DashShell activeId="invoices" title="Invoices" subtitle="Download GST invoices for accounting.">
    <div className="rounded-2xl border border-[var(--line)] bg-white dark:bg-mid2 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-paper2 dark:bg-white/[0.04] text-xs uppercase tracking-wider text-[var(--muted)]">
          <tr>
            <th className="text-left px-5 py-3 font-bold">Invoice</th>
            <th className="text-left px-5 py-3 font-bold">Date</th>
            <th className="text-left px-5 py-3 font-bold hidden md:table-cell">Type</th>
            <th className="text-left px-5 py-3 font-bold">Amount</th>
            <th className="text-left px-5 py-3 font-bold">Status</th>
            <th className="px-5 py-3"/>
          </tr>
        </thead>
        <tbody>
          {mockData.recentTransactions.map(t => (
            <tr key={t.id} className="border-t border-[var(--line)]">
              <td className="px-5 py-4 font-mono text-xs">{t.invoice}</td>
              <td className="px-5 py-4 text-[var(--muted)]">{t.date}</td>
              <td className="px-5 py-4 hidden md:table-cell capitalize">{t.type}</td>
              <td className="px-5 py-4 font-mono">{fmt.inr(t.amount)}</td>
              <td className="px-5 py-4">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                  <I.Check size={11}/> {t.status}
                </span>
              </td>
              <td className="px-5 py-4 text-right">
                <button onClick={() => window.dispatchEvent(new CustomEvent('mv:download-invoice', { detail: t }))} className="text-xs font-bold text-rose hover:underline inline-flex items-center gap-1">
                  <I.Download size={12}/> PDF
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </DashShell>
);

// =============== Tickets ===============
const PageTickets = () => {
  const [showNew, setShowNew] = React.useState(false);
  return (
    <DashShell activeId="tickets" title="Support tickets" subtitle="Get help from our team or our AI agent."
      action={<DButton variant="primary" onClick={() => setShowNew(true)}><I.Plus size={14}/> New ticket</DButton>}>
      <div className="rounded-2xl border border-[var(--line)] bg-white dark:bg-mid2 overflow-hidden">
        {mockData.tickets.map((t, i) => (
          <div key={t.id} className={`px-5 py-4 hover:bg-paper2/60 dark:hover:bg-white/[0.03] cursor-pointer ${i > 0 ? 'border-t border-[var(--line)]' : ''}`}>
            <div className="flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs text-[var(--muted)]">{t.id}</span>
                  <Pill tone={t.priority === 'high' ? 'rose' : 'teal'}>{t.priority}</Pill>
                  <Pill tone={t.status === 'open' ? 'amber' : t.status === 'answered' ? 'teal' : 'emerald'}>{t.status}</Pill>
                </div>
                <div className="font-display font-bold text-base mt-1.5">{t.subject}</div>
                <div className="text-xs text-[var(--muted)] mt-1">{t.replies} replies · updated {t.updated}</div>
              </div>
              <I.ArrowRight size={16} className="text-[var(--muted)] shrink-0 mt-1"/>
            </div>
          </div>
        ))}
      </div>

      <Modal open={showNew} onClose={() => setShowNew(false)} title="New support ticket" size="lg">
        <div className="space-y-4">
          <div className="rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 p-3 text-xs flex items-start gap-2">
            <I.Sparkles size={14} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0"/>
            <div>Try asking <span className="font-bold">Medi</span> in chat first — most issues are resolved instantly.</div>
          </div>
          <DLabel>Subject</DLabel>
          <DInput placeholder="Briefly describe the issue"/>
          <DLabel>Priority</DLabel>
          <select className="h-10 w-full px-3 rounded-lg border border-[var(--line)] bg-white dark:bg-white/[0.04] text-sm">
            <option>Normal</option><option>High — workflow blocked</option><option>Critical — system down</option>
          </select>
          <DLabel>Description</DLabel>
          <textarea className="w-full px-3 py-2 rounded-lg border border-[var(--line)] bg-white dark:bg-white/[0.04] text-sm min-h-[120px]" placeholder="Steps to reproduce, error messages, what you expected to happen…"/>
          <div className="flex justify-end gap-2 pt-2">
            <DButton variant="ghost" onClick={() => setShowNew(false)}>Cancel</DButton>
            <DButton variant="primary" onClick={() => setShowNew(false)}>Submit ticket</DButton>
          </div>
        </div>
      </Modal>
    </DashShell>
  );
};

// =============== Bugs & ideas ===============
const PageBugs = () => {
  const [showNew, setShowNew] = React.useState(false);
  return (
    <DashShell activeId="bugs" title="Bugs & ideas" subtitle="Help us improve. Vote on others' suggestions or file your own."
      action={<DButton variant="primary" onClick={() => setShowNew(true)}><I.Plus size={14}/> Report</DButton>}>
      <div className="space-y-2">
        {mockData.bugs.map(b => (
          <div key={b.id} className="rounded-xl border border-[var(--line)] bg-white dark:bg-mid2 p-4 flex items-center gap-4 hover:border-rose/40 transition cursor-pointer">
            <button className="flex flex-col items-center justify-center h-14 w-14 rounded-lg border border-[var(--line)] hover:border-rose hover:bg-rose-soft dark:hover:bg-rose/15 hover:text-rose transition shrink-0">
              <I.ArrowDown size={14} className="rotate-180"/>
              <span className="font-display font-bold text-sm mt-0.5">{b.votes}</span>
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs text-[var(--muted)]">{b.id}</span>
                <Pill tone={b.type === 'bug' ? 'rose' : 'teal'}>{b.type}</Pill>
                <Pill tone={b.status === 'fixed' ? 'emerald' : b.status === 'in-progress' ? 'amber' : 'teal'}>{b.status}</Pill>
              </div>
              <div className="font-semibold mt-1.5">{b.title}</div>
            </div>
          </div>
        ))}
      </div>

      <Modal open={showNew} onClose={() => setShowNew(false)} title="Report a bug or suggest a feature" size="lg">
        <div className="space-y-4">
          <DLabel>Type</DLabel>
          <div className="flex gap-2">
            <button className="flex-1 h-10 rounded-lg border-2 border-rose bg-rose-soft dark:bg-rose/15 text-rose font-bold text-sm">🐛 Bug</button>
            <button className="flex-1 h-10 rounded-lg border border-[var(--line)] hover:border-rose/40 text-sm font-bold">💡 Feature idea</button>
          </div>
          <DLabel>Title</DLabel>
          <DInput placeholder="One-line summary"/>
          <DLabel>Details</DLabel>
          <textarea className="w-full px-3 py-2 rounded-lg border border-[var(--line)] bg-white dark:bg-white/[0.04] text-sm min-h-[120px]" placeholder="What happened? What did you expect? Screenshots welcome."/>
          <div className="flex justify-end gap-2 pt-2">
            <DButton variant="ghost" onClick={() => setShowNew(false)}>Cancel</DButton>
            <DButton variant="primary" onClick={() => setShowNew(false)}>Submit</DButton>
          </div>
        </div>
      </Modal>
    </DashShell>
  );
};

// =============== Team ===============
const PageTeam = () => {
  const [showInvite, setShowInvite] = React.useState(false);
  return (
    <DashShell activeId="team" title="Team" subtitle="Invite colleagues and assign roles."
      action={<DButton variant="primary" onClick={() => setShowInvite(true)}><I.Plus size={14}/> Invite member</DButton>}>
      <div className="rounded-2xl border border-[var(--line)] bg-white dark:bg-mid2 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-paper2 dark:bg-white/[0.04] text-xs uppercase tracking-wider text-[var(--muted)]">
            <tr>
              <th className="text-left px-5 py-3 font-bold">Name</th>
              <th className="text-left px-5 py-3 font-bold hidden md:table-cell">Email</th>
              <th className="text-left px-5 py-3 font-bold">Role</th>
              <th className="text-left px-5 py-3 font-bold hidden lg:table-cell">Joined</th>
              <th className="text-left px-5 py-3 font-bold">Status</th>
              <th className="px-5 py-3"/>
            </tr>
          </thead>
          <tbody>
            {mockData.team.map((m, i) => (
              <tr key={i} className="border-t border-[var(--line)]">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-rose to-amber-500 text-white grid place-items-center text-xs font-bold shrink-0">{m.name.charAt(0)}</div>
                    <span className="font-bold">{m.name}</span>
                  </div>
                </td>
                <td className="px-5 py-4 hidden md:table-cell text-[var(--muted)] font-mono text-xs">{m.email}</td>
                <td className="px-5 py-4 capitalize"><Pill tone={m.role === 'admin' ? 'rose' : m.role === 'physician' ? 'teal' : 'amber'}>{m.role}</Pill></td>
                <td className="px-5 py-4 hidden lg:table-cell text-[var(--muted)]">{m.joined}</td>
                <td className="px-5 py-4">
                  <span className={`text-xs font-bold capitalize ${m.status === 'active' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>{m.status}</span>
                </td>
                <td className="px-5 py-4 text-right"><button className="text-xs font-bold text-rose hover:underline">Manage</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={showInvite} onClose={() => setShowInvite(false)} title="Invite team member">
        <div className="space-y-4">
          <DLabel>Email address</DLabel>
          <DInput placeholder="colleague@yourclinic.in" type="email"/>
          <DLabel>Role</DLabel>
          <select className="h-10 w-full px-3 rounded-lg border border-[var(--line)] bg-white dark:bg-white/[0.04] text-sm">
            <option>Physician — full clinical access</option>
            <option>Staff — view + print only</option>
            <option>Admin — full access incl. billing</option>
          </select>
          <div className="flex justify-end gap-2 pt-2">
            <DButton variant="ghost" onClick={() => setShowInvite(false)}>Cancel</DButton>
            <DButton variant="primary" onClick={() => setShowInvite(false)}>Send invite</DButton>
          </div>
        </div>
      </Modal>
    </DashShell>
  );
};

// =============== Analytics ===============
const PageAnalytics = () => (
  <DashShell activeId="analytics" title="Analytics" subtitle="Usage trends across your team.">
    <div className="grid lg:grid-cols-3 gap-4 mb-6">
      <StatTile icon={<I.FileText size={16}/>} label="Studies (30d)" value="2,341" delta="+18% vs prev"/>
      <StatTile icon={<I.Printer size={16}/>} label="Pages printed (30d)" value="8,420" delta="+12% vs prev"/>
      <StatTile icon={<I.Sparkles size={16}/>} label="AI calls (30d)" value="340" delta="+22% vs prev"/>
    </div>
    <div className="rounded-2xl border border-[var(--line)] bg-white dark:bg-mid2 p-5">
      <h3 className="font-display font-bold text-lg mb-4">Daily activity</h3>
      <div className="h-64 flex items-end gap-1.5">
        {Array.from({ length: 30 }).map((_, i) => {
          const h = 30 + Math.sin(i * 0.4) * 25 + Math.random() * 30;
          return <div key={i} className="flex-1 bg-gradient-to-t from-rose to-amber-400 rounded-t hover:opacity-80 transition" style={{ height: `${h}%` }} title={`Day ${i+1}`}/>;
        })}
      </div>
      <div className="flex justify-between text-xs text-[var(--muted)] mt-2 font-mono"><span>Mar 25</span><span>Apr 23</span></div>
    </div>
  </DashShell>
);

// =============== Audit log ===============
const PageAudit = () => (
  <DashShell activeId="audit" title="Audit log" subtitle="Every privileged action, recorded.">
    <div className="rounded-2xl border border-[var(--line)] bg-white dark:bg-mid2 overflow-hidden">
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
          {mockData.audit.map((a, i) => (
            <tr key={i} className="border-t border-[var(--line)]">
              <td className="px-5 py-4 text-[var(--muted)]"><div className="font-mono text-xs">{a.date}</div><div className="font-mono text-xs">{a.time}</div></td>
              <td className="px-5 py-4 font-bold">{a.actor}</td>
              <td className="px-5 py-4">{a.action}</td>
              <td className="px-5 py-4 hidden md:table-cell font-mono text-xs text-[var(--muted)]">{a.target}</td>
              <td className="px-5 py-4 hidden lg:table-cell font-mono text-xs text-[var(--muted)]">{a.ip}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </DashShell>
);

// =============== Admin console (admin role only) ===============
const PageAdmin = () => {
  const { user } = useAuth();
  const [tab, setTab] = React.useState('users');

  if (user?.role !== 'admin') {
    return (
      <DashShell activeId="admin" title="Admin console" subtitle="Restricted area.">
        <div className="rounded-2xl border border-rose/40 bg-rose-soft/40 dark:bg-rose/10 p-8 text-center">
          <I.Lock size={32} className="mx-auto text-rose"/>
          <div className="font-display font-bold text-xl mt-3">Admin access required</div>
          <div className="text-sm text-[var(--muted)] mt-1">Sign in with an admin account to view this page.</div>
        </div>
      </DashShell>
    );
  }

  const TABS = [
    { id: 'users',     label: 'All users',     icon: <I.Users size={14}/> },
    { id: 'orgs',      label: 'Organisations', icon: <I.Building size={14}/> },
    { id: 'payments',  label: 'Payments',      icon: <I.CreditCard size={14}/> },
    { id: 'tickets',   label: 'Support queue', icon: <I.MessageCircle size={14}/> },
    { id: 'feature',   label: 'Feature flags', icon: <I.ToggleRight size={14}/> },
    { id: 'health',    label: 'System health', icon: <I.Activity size={14}/> },
  ];

  return (
    <DashShell activeId="admin" title="Admin console" subtitle="Internal — Mediview team only.">
      <div className="rounded-2xl border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 p-4 mb-5 flex items-start gap-3 text-sm">
        <I.Lock size={16} className="text-amber-700 dark:text-amber-400 mt-0.5 shrink-0"/>
        <div>You're viewing the platform admin console. Every action here is logged with your name and IP.</div>
      </div>

      <div className="grid lg:grid-cols-[220px_1fr] gap-5">
        <nav className="space-y-1">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 transition ${
              tab === t.id ? 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400' : 'hover:bg-paper2 dark:hover:bg-white/[0.04] text-ink/80 dark:text-paper/80'
            }`}>{t.icon} {t.label}</button>
          ))}
        </nav>

        <div className="rounded-2xl border border-[var(--line)] bg-white dark:bg-mid2 p-6 min-h-[420px]">
          {tab === 'users' && (
            <>
              <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
                <div>
                  <h3 className="font-display font-bold text-xl">All users</h3>
                  <p className="text-sm text-[var(--muted)] mt-1">2,341 across 248 clinics</p>
                </div>
                <div className="flex gap-2">
                  <DInput placeholder="Search by email, clinic, GST…" className="w-64"/>
                  <DButton variant="ghost"><I.Filter size={14}/> Filter</DButton>
                </div>
              </div>
              <table className="w-full text-sm">
                <thead className="text-xs uppercase tracking-wider text-[var(--muted)]">
                  <tr><th className="text-left py-2 font-bold">Name</th><th className="text-left py-2 font-bold hidden md:table-cell">Clinic</th><th className="text-left py-2 font-bold">Plan</th><th className="text-left py-2 font-bold">Status</th><th/></tr>
                </thead>
                <tbody>
                  {[
                    ['Dr. Anjali Sharma', 'Sharma Diagnostics, Mumbai', 'Annual Pro', 'active'],
                    ['Dr. Rohit Khanna',  'Apollo Vasanth, Chennai',    'Annual Pro', 'active'],
                    ['Dr. Priya Reddy',   'Reddy Imaging, Hyderabad',   'Monthly',    'active'],
                    ['Dr. Vikram Joshi',  'Joshi MRI Centre, Pune',     'Trial',      'trial'],
                    ['Dr. Neha Iyer',     'Iyer Path Lab, Coimbatore',  'Monthly',    'past_due'],
                  ].map((r, i) => (
                    <tr key={i} className="border-t border-[var(--line)]">
                      <td className="py-3 font-bold">{r[0]}</td>
                      <td className="py-3 hidden md:table-cell text-[var(--muted)]">{r[1]}</td>
                      <td className="py-3"><Pill tone={r[2].includes('Annual') ? 'rose' : r[2] === 'Trial' ? 'amber' : 'teal'}>{r[2]}</Pill></td>
                      <td className="py-3"><span className={`text-xs font-bold ${r[3] === 'active' ? 'text-emerald-600 dark:text-emerald-400' : r[3] === 'past_due' ? 'text-rose' : 'text-amber-600'}`}>{r[3]}</span></td>
                      <td className="py-3 text-right"><button className="text-xs font-bold text-rose hover:underline">View</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {tab === 'orgs' && (
            <>
              <h3 className="font-display font-bold text-xl mb-4">Organisations</h3>
              <div className="grid sm:grid-cols-3 gap-3 mb-5">
                <StatTile label="Active clinics" value="248" delta="+12 this month"/>
                <StatTile label="On annual plan" value="187" delta="75% of base"/>
                <StatTile label="Avg seats / clinic" value="3.4" delta="up from 2.8"/>
              </div>
              <p className="text-sm text-[var(--muted)]">Drill-down view coming soon — for now use the Users tab to find members.</p>
            </>
          )}

          {tab === 'payments' && (
            <>
              <h3 className="font-display font-bold text-xl mb-4">Payments</h3>
              <div className="grid sm:grid-cols-3 gap-3 mb-5">
                <StatTile label="MRR" value="₹14.2L" delta="+18% MoM"/>
                <StatTile label="Razorpay success rate" value="97.4%" delta="last 7 days"/>
                <StatTile label="Pending refunds" value="3" delta="oldest 2 days"/>
              </div>
              <table className="w-full text-sm">
                <thead className="text-xs uppercase tracking-wider text-[var(--muted)]">
                  <tr><th className="text-left py-2 font-bold">Time</th><th className="text-left py-2 font-bold">User</th><th className="text-left py-2 font-bold">Amount</th><th className="text-left py-2 font-bold">Method</th><th className="text-left py-2 font-bold">Status</th></tr>
                </thead>
                <tbody>
                  {[
                    ['14:32', 'Dr. Anjali Sharma', '₹49,800', 'Card · Visa **8421', 'success'],
                    ['13:18', 'Dr. Rohit Khanna',  '₹4,720',  'UPI · @okhdfc',      'success'],
                    ['12:55', 'Dr. Priya Reddy',   '₹2,360',  'UPI · @ybl',         'success'],
                    ['11:40', 'Dr. Neha Iyer',     '₹4,720',  'Card · Mastercard **2210', 'failed'],
                  ].map((r, i) => (
                    <tr key={i} className="border-t border-[var(--line)]">
                      <td className="py-3 font-mono text-xs text-[var(--muted)]">{r[0]}</td>
                      <td className="py-3 font-bold">{r[1]}</td>
                      <td className="py-3 font-mono">{r[2]}</td>
                      <td className="py-3 text-[var(--muted)]">{r[3]}</td>
                      <td className="py-3"><span className={`text-xs font-bold ${r[4] === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose'}`}>{r[4]}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {tab === 'tickets' && (
            <>
              <h3 className="font-display font-bold text-xl mb-4">Support queue</h3>
              <div className="grid sm:grid-cols-4 gap-3 mb-5">
                <StatTile label="Open" value="14"/>
                <StatTile label="High priority" value="3"/>
                <StatTile label="Avg response" value="38m"/>
                <StatTile label="CSAT (30d)" value="4.7/5"/>
              </div>
              <p className="text-sm text-[var(--muted)]">Connect to your helpdesk inbox to triage tickets directly here.</p>
            </>
          )}

          {tab === 'feature' && (
            <>
              <h3 className="font-display font-bold text-xl mb-4">Feature flags</h3>
              <div className="space-y-2">
                {[
                  ['ai_findings_v2',     'AI findings drafting v2',          true],
                  ['mpr_curved',         'Curved MPR (orthopaedics)',        true],
                  ['voice_dictation',    'Voice dictation in reports',       false],
                  ['referral_2x',        'Double referral credit campaign',  true],
                  ['hindi_ui',           'Hindi UI strings',                 false],
                ].map(([id, label, on]) => (
                  <div key={id} className="flex items-center justify-between p-3 rounded-xl border border-[var(--line)]">
                    <div>
                      <div className="font-semibold">{label}</div>
                      <div className="text-xs font-mono text-[var(--muted)]">{id}</div>
                    </div>
                    <button className={`h-6 w-11 rounded-full transition relative ${on ? 'bg-rose' : 'bg-zinc-300 dark:bg-white/15'}`}>
                      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${on ? 'left-5' : 'left-0.5'}`}/>
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {tab === 'health' && (
            <>
              <h3 className="font-display font-bold text-xl mb-4">System health</h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
                <StatTile label="API uptime (30d)" value="99.98%"/>
                <StatTile label="P95 latency" value="142ms"/>
                <StatTile label="DB connections" value="34/200"/>
                <StatTile label="Razorpay webhook lag" value="0.4s"/>
              </div>
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 p-3 text-sm flex items-center gap-2">
                <I.Check size={14} className="text-emerald-600 dark:text-emerald-400"/>
                <span>All systems operational.</span>
              </div>
            </>
          )}
        </div>
      </div>
    </DashShell>
  );
};

// =============== Referrals ===============
const PageReferrals = () => {
  const link = 'https://mediview.app/r/ANJALI-7K2N';
  const [copied, setCopied] = React.useState(false);
  const copy = () => { navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <DashShell activeId="referrals" title="Referrals" subtitle="Refer a clinic, earn ₹2,000 wallet credit each.">
      <div className="rounded-2xl bg-gradient-to-br from-rose to-rose-dark text-white p-8 mb-4">
        <div className="text-[11px] uppercase tracking-[0.16em] font-bold opacity-80">Your referral link</div>
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <code className="flex-1 min-w-0 px-4 py-3 rounded-lg bg-white/15 font-mono text-sm truncate">{link}</code>
          <button onClick={copy} className="h-12 px-5 rounded-lg bg-white text-rose font-bold text-sm hover:bg-paper transition shrink-0">{copied ? '✓ Copied' : 'Copy'}</button>
        </div>
        <div className="mt-6 grid sm:grid-cols-3 gap-4 text-center">
          <div><div className="font-display text-3xl font-bold">3</div><div className="text-xs opacity-80">Clinics referred</div></div>
          <div><div className="font-display text-3xl font-bold">2</div><div className="text-xs opacity-80">Active subscriptions</div></div>
          <div><div className="font-display text-3xl font-bold">₹4,000</div><div className="text-xs opacity-80">Earned</div></div>
        </div>
      </div>
      <div className="rounded-2xl border border-[var(--line)] bg-white dark:bg-mid2 p-5">
        <h3 className="font-display font-bold text-lg mb-3">How it works</h3>
        <ol className="space-y-2 text-sm">
          <li className="flex gap-3"><span className="h-6 w-6 rounded-full bg-rose-soft dark:bg-rose/20 text-rose font-bold grid place-items-center text-xs shrink-0">1</span><span>Share your link with another clinic.</span></li>
          <li className="flex gap-3"><span className="h-6 w-6 rounded-full bg-rose-soft dark:bg-rose/20 text-rose font-bold grid place-items-center text-xs shrink-0">2</span><span>They sign up & purchase any paid plan.</span></li>
          <li className="flex gap-3"><span className="h-6 w-6 rounded-full bg-rose-soft dark:bg-rose/20 text-rose font-bold grid place-items-center text-xs shrink-0">3</span><span>₹2,000 wallet credit lands in both accounts.</span></li>
        </ol>
      </div>
    </DashShell>
  );
};

// =============== Settings ===============
const SETTINGS_TABS = [
  { id: 'profile',     label: 'Profile' },
  { id: 'org',         label: 'Organisation' },
  { id: 'billing',     label: 'Billing & GST' },
  { id: 'security',    label: 'Security' },
  { id: 'notifs',      label: 'Notifications' },
  { id: 'prefs',       label: 'Preferences' },
];

const SettingsTabProfile = () => {
  const { user } = useAuth();
  return (
    <>
      <div>
        <h3 className="font-display font-bold text-xl">Profile</h3>
        <p className="text-sm text-[var(--muted)] mt-1">Update your personal details.</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-4 mt-5">
        <div><DLabel>Full name</DLabel><DInput defaultValue={user?.name}/></div>
        <div><DLabel>Email</DLabel><DInput defaultValue={user?.email} type="email"/></div>
        <div><DLabel>Phone</DLabel><DInput defaultValue="+91 98765 43210"/></div>
        <div><DLabel>Specialty</DLabel><DInput defaultValue="Radiology"/></div>
      </div>
    </>
  );
};

const SettingsTabOrg = () => (
  <>
    <div>
      <h3 className="font-display font-bold text-xl">Organisation</h3>
      <p className="text-sm text-[var(--muted)] mt-1">Used on invoices, reports, and PACS handshakes.</p>
    </div>
    <div className="grid sm:grid-cols-2 gap-4 mt-5">
      <div className="sm:col-span-2"><DLabel>Clinic / hospital name</DLabel><DInput defaultValue="Sharma Diagnostics Pvt Ltd"/></div>
      <div className="sm:col-span-2"><DLabel>Registered address</DLabel>
        <textarea className="w-full px-3 py-2 rounded-lg border border-[var(--line)] bg-white dark:bg-white/[0.04] text-sm min-h-[80px]" defaultValue={'Plot 12, Linking Road\nBandra West, Mumbai 400050'}/>
      </div>
      <div><DLabel>Contact phone</DLabel><DInput defaultValue="+91 22 2640 1234"/></div>
      <div><DLabel>Website</DLabel><DInput defaultValue="https://sharmadiagnostics.in"/></div>
      <div><DLabel>Logo (PNG, 256×256)</DLabel><DInput type="file"/></div>
      <div><DLabel>Default print header</DLabel><DInput defaultValue="Dr. A. Sharma — MD, DNB (Radiology)"/></div>
    </div>
  </>
);

const SettingsTabBilling = () => (
  <>
    <div>
      <h3 className="font-display font-bold text-xl">Billing & GST</h3>
      <p className="text-sm text-[var(--muted)] mt-1">Used to generate compliant tax invoices.</p>
    </div>
    <div className="grid sm:grid-cols-2 gap-4 mt-5">
      <div><DLabel>Legal entity name</DLabel><DInput defaultValue="Sharma Diagnostics Pvt Ltd"/></div>
      <div><DLabel>GSTIN</DLabel><DInput defaultValue="27AABCS1234L1Z5" className="font-mono"/></div>
      <div><DLabel>State (place of supply)</DLabel>
        <select className="h-10 w-full px-3 rounded-lg border border-[var(--line)] bg-white dark:bg-white/[0.04] text-sm" defaultValue="MH">
          <option value="MH">Maharashtra</option><option value="KA">Karnataka</option><option value="DL">Delhi</option><option value="TN">Tamil Nadu</option><option value="GJ">Gujarat</option>
        </select>
      </div>
      <div><DLabel>PAN</DLabel><DInput defaultValue="AABCS1234L" className="font-mono"/></div>
    </div>
    <div className="mt-5 rounded-xl border border-[var(--line)] p-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="font-bold">Saved card · Visa ending 8421</div>
          <div className="text-xs text-[var(--muted)]">Expires 09/27 · auto-charge enabled</div>
        </div>
        <DButton variant="ghost">Update card</DButton>
      </div>
    </div>
  </>
);

const SettingsTabSecurity = () => (
  <>
    <div>
      <h3 className="font-display font-bold text-xl">Security</h3>
      <p className="text-sm text-[var(--muted)] mt-1">Password, two-factor, and active sessions.</p>
    </div>
    <div className="mt-5 space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div><DLabel>Current password</DLabel><DInput type="password" placeholder="••••••••"/></div>
        <div><DLabel>New password</DLabel><DInput type="password" placeholder="At least 12 characters"/></div>
      </div>
      <div className="rounded-xl border border-[var(--line)] p-4 flex items-center justify-between gap-4">
        <div>
          <div className="font-bold">Two-factor authentication</div>
          <div className="text-xs text-[var(--muted)]">Use an authenticator app (Google, Authy)</div>
        </div>
        <DButton variant="primary">Enable 2FA</DButton>
      </div>
      <div className="rounded-xl border border-[var(--line)] p-4">
        <div className="font-bold mb-2">Active sessions</div>
        <ul className="text-sm space-y-2">
          <li className="flex items-center justify-between"><span>Chrome · Windows · Mumbai · <span className="font-mono text-xs text-[var(--muted)]">this device</span></span><span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">Now</span></li>
          <li className="flex items-center justify-between"><span>Safari · macOS · Pune</span><button className="text-xs font-bold text-rose hover:underline">Revoke</button></li>
          <li className="flex items-center justify-between"><span>Mediview Desktop · Workstation 02</span><button className="text-xs font-bold text-rose hover:underline">Revoke</button></li>
        </ul>
      </div>
    </div>
  </>
);

const SettingsTabNotifs = () => {
  const [v, setV] = React.useState({ low_print: true, low_ai: true, ticket: true, weekly: true, marketing: false });
  const Row = ({ id, t, s }) => (
    <div className="flex items-center justify-between p-3 rounded-xl border border-[var(--line)]">
      <div><div className="font-semibold">{t}</div><div className="text-xs text-[var(--muted)]">{s}</div></div>
      <button onClick={() => setV(x => ({ ...x, [id]: !x[id] }))} className={`h-6 w-11 rounded-full transition relative ${v[id] ? 'bg-rose' : 'bg-zinc-300 dark:bg-white/15'}`}>
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
        <Row id="low_print" t="Low print balance" s="Email when print credits drop below 500 pages"/>
        <Row id="low_ai"    t="Low AI credits"    s="Email when AI credits drop below 100"/>
        <Row id="ticket"    t="Ticket replies"    s="Email when our team responds to your tickets"/>
        <Row id="weekly"    t="Weekly summary"    s="Studies, prints, AI usage every Monday"/>
        <Row id="marketing" t="Product updates"   s="New features, tips, and offers"/>
      </div>
    </>
  );
};

const SettingsTabPrefs = () => (
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

const PageSettings = () => {
  const [tab, setTab] = React.useState('profile');
  return (
    <DashShell activeId="settings" title="Settings" subtitle="Account, organisation, and preferences.">
      <div className="grid lg:grid-cols-[220px_1fr] gap-5">
        <nav className="space-y-1">
          {SETTINGS_TABS.map(s => (
            <button key={s.id} onClick={() => setTab(s.id)} className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-semibold transition ${
              tab === s.id ? 'bg-rose-soft dark:bg-rose/15 text-rose' : 'hover:bg-paper2 dark:hover:bg-white/[0.04] text-ink/80 dark:text-paper/80'
            }`}>{s.label}</button>
          ))}
        </nav>
        <div className="rounded-2xl border border-[var(--line)] bg-white dark:bg-mid2 p-6">
          {tab === 'profile'  && <SettingsTabProfile/>}
          {tab === 'org'      && <SettingsTabOrg/>}
          {tab === 'billing'  && <SettingsTabBilling/>}
          {tab === 'security' && <SettingsTabSecurity/>}
          {tab === 'notifs'   && <SettingsTabNotifs/>}
          {tab === 'prefs'    && <SettingsTabPrefs/>}
          <div className="pt-5 mt-5 border-t border-[var(--line)] flex justify-end gap-2">
            <DButton variant="ghost">Cancel</DButton>
            <DButton variant="primary">Save changes</DButton>
          </div>
        </div>
      </div>
    </DashShell>
  );
};

// ─── Licenses page ───────────────────────────────────────────────────────────
const PLAN_LABELS = { trial: 'Trial', monthly: 'Monthly', annual: 'Annual' };
const PLAN_COLORS = { trial: 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/15', monthly: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-500/15', annual: 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/15' };
const STATUS_COLORS = { active: 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/15', expired: 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-500/15', suspended: 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/15' };

const PageLicenses = () => {
  const [licenses, setLicenses] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [showOrder, setShowOrder] = React.useState(false);
  const [selectedPlan, setSelectedPlan] = React.useState('monthly');
  const [ordering, setOrdering] = React.useState(false);
  const { addToast } = useToast ? useToast() : { addToast: () => {} };

  React.useEffect(() => {
    mvApi.licenses().then(d => { setLicenses(Array.isArray(d) ? d : []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const handleOrder = async () => {
    setOrdering(true);
    try {
      const { order_id, rzp_key, amount } = await mvApi.orderLicense({ plan: selectedPlan });
      window.openRazorpay({
        key: rzp_key, amount, order_id,
        name: 'Mediview License',
        description: PLAN_LABELS[selectedPlan] + ' License',
        handler: async (resp) => {
          await mvApi.verifyLicense({ order_id, payment_id: resp.razorpay_payment_id, signature: resp.razorpay_signature, plan: selectedPlan });
          const updated = await mvApi.licenses();
          setLicenses(Array.isArray(updated) ? updated : []);
          setShowOrder(false);
          addToast && addToast('License activated!', 'success');
        },
      });
    } catch (e) {
      addToast && addToast(e.message || 'Could not start order', 'error');
    } finally { setOrdering(false); }
  };

  return (
    <DashShell activeId="licenses" title="Licenses" subtitle="Manage your Mediview software licenses.">
      <div className="flex justify-end mb-6">
        <DButton variant="primary" onClick={() => setShowOrder(true)}>+ Order License</DButton>
      </div>

      {loading ? (
        <div className="space-y-3">{[0,1].map(i => <div key={i} className="h-28 rounded-2xl bg-white dark:bg-mid2 animate-pulse border border-[var(--line)]"/>)}</div>
      ) : licenses.length === 0 ? (
        <div className="rounded-2xl border border-[var(--line)] bg-white dark:bg-mid2 p-12 text-center">
          <p className="text-[var(--muted)] mb-4">No licenses yet. Your trial license is automatically issued on signup.</p>
          <DButton variant="primary" onClick={() => setShowOrder(true)}>Order a License</DButton>
        </div>
      ) : (
        <div className="space-y-4">
          {licenses.map(lic => (
            <div key={lic.id} className="rounded-2xl border border-[var(--line)] bg-white dark:bg-mid2 p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PLAN_COLORS[lic.plan] || PLAN_COLORS.monthly}`}>{PLAN_LABELS[lic.plan] || lic.plan}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[lic.status] || ''}`}>{lic.status}</span>
                    <span className="text-xs text-[var(--muted)]">{lic.seats} seat{lic.seats !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="font-mono text-base font-bold tracking-widest text-ink dark:text-paper">{lic.key_code}</div>
                  {lic.expires_at && <div className="text-xs text-[var(--muted)] mt-1">Expires {new Date(lic.expires_at).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}</div>}
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

      {/* Order modal */}
      {showOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-mid2 shadow-2xl p-6">
            <h2 className="font-display text-xl font-bold mb-1">Order a License</h2>
            <p className="text-sm text-[var(--muted)] mb-5">Credits are deducted from your wallet.</p>
            <div className="space-y-3 mb-6">
              {[
                { id: 'monthly', label: 'Monthly', price: '₹8,000/month', desc: '1 seat · 30 days' },
                { id: 'annual',  label: 'Annual',  price: '₹1,00,000/year', desc: '1 seat · 365 days · Save ~₹4k' },
              ].map(plan => (
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
            <div className="flex gap-3">
              <DButton variant="ghost" onClick={() => setShowOrder(false)} className="flex-1">Cancel</DButton>
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
});
