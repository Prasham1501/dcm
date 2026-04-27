// Dashboard pages — Overview, Devices, Wallet, AI, Invoices, Tickets, Bugs, Team, Analytics, Audit, API, Referrals, Settings.
// Each page is a function component taking no props; reads data from useAuth() / DB hooks if needed.

// =============== Mock data store ===============
const mockData = {
  printBalance: 2847,
  aiBalance: 1250,
  monthlyPrints: 8420,
  monthlyAI: 340,
  recentTransactions: [
    { id: 't1', type: 'print', amount: 5000, credits: 5000, date: '2026-04-22', status: 'paid', invoice: 'INV-2026-0142' },
    { id: 't2', type: 'ai',    amount: 6499, credits: 2500, date: '2026-04-15', status: 'paid', invoice: 'INV-2026-0128' },
    { id: 't3', type: 'print', amount: 2500, credits: 2500, date: '2026-04-08', status: 'paid', invoice: 'INV-2026-0119' },
    { id: 't4', type: 'license',amount:14999,credits: null, date: '2026-04-01', status: 'paid', invoice: 'INV-2026-0101' },
  ],
  devices: [
    { id: 'D-7K2N9', name: 'Reporting Station 1', os: 'Windows 11 Pro',  lastSeen: '2 min ago',  status: 'online',  version: '4.2.1' },
    { id: 'D-3F8P1', name: 'Radiology Console',   os: 'Windows 11 Pro',  lastSeen: '14 min ago', status: 'online',  version: '4.2.1' },
    { id: 'D-9X4M2', name: 'OPD Workstation',     os: 'Windows 10 Pro',  lastSeen: '3 hours ago',status: 'idle',    version: '4.1.8' },
    { id: 'D-1B6L7', name: 'Mobile MacBook Pro',  os: 'macOS 14.4',      lastSeen: '2 days ago', status: 'offline', version: '4.2.0' },
  ],
  tickets: [
    { id: 'T-2026-089', subject: 'PACS sync failing for CT studies',  status: 'open',     priority: 'high',   created: '2026-04-23', updated: '4 hr ago',   replies: 2 },
    { id: 'T-2026-072', subject: 'How to add custom report template', status: 'answered', priority: 'normal', created: '2026-04-18', updated: '2 days ago', replies: 4 },
    { id: 'T-2026-061', subject: 'Print spooler timing out on A4',    status: 'closed',   priority: 'normal', created: '2026-04-10', updated: '1 week ago', replies: 6 },
  ],
  bugs: [
    { id: 'B-141', title: 'Measurement tool ruler offset by 2px on retina displays', status: 'in-progress', votes: 12, type: 'bug' },
    { id: 'B-138', title: 'Add bulk-export to PDF for series of studies',            status: 'planned',     votes: 47, type: 'feature' },
    { id: 'B-129', title: 'Crash when opening DICOM with malformed header',         status: 'fixed',       votes: 8,  type: 'bug' },
  ],
  team: [
    { name: 'Dr. Anjali Sharma', email: 'anjali@yourclinic.in',  role: 'admin',     joined: '2025-08-12', status: 'active' },
    { name: 'Dr. Rohit Khanna',  email: 'rohit@yourclinic.in',   role: 'physician', joined: '2025-09-03', status: 'active' },
    { name: 'Priya Singh',       email: 'priya@yourclinic.in',   role: 'staff',     joined: '2026-01-15', status: 'active' },
    { name: 'Karan Mehta',       email: 'karan@yourclinic.in',   role: 'physician', joined: '2026-03-22', status: 'pending' },
  ],
  audit: [
    { time: '14:32', date: 'Today',     actor: 'Dr. Anjali',  action: 'Opened study',     target: 'CT-CHEST-99821', ip: '192.168.1.42' },
    { time: '13:18', date: 'Today',     actor: 'Dr. Rohit',   action: 'Generated report', target: 'CT-CHEST-99821', ip: '192.168.1.55' },
    { time: '11:04', date: 'Today',     actor: 'System',      action: 'Auto-backup',      target: 'PACS index',     ip: 'localhost' },
    { time: '17:42', date: 'Yesterday', actor: 'Priya Singh', action: 'Added user',       target: 'karan@…',        ip: '192.168.1.31' },
    { time: '10:15', date: 'Yesterday', actor: 'Dr. Anjali',  action: 'Recharged wallet', target: '5,000 prints',   ip: '192.168.1.42' },
  ],
};

// =============== Overview ===============
const PageOverview = () => {
  const { user } = useAuth();
  const [openModal, setOpenModal] = React.useState(null); // 'print' | 'ai' | null
  const isLow = mockData.printBalance < 5000;

  return (
    <DashShell activeId="home" title={`Welcome back, ${user?.name?.split(' ')[0] || 'Doctor'}`} subtitle="Everything's running smoothly. Here's what matters today.">
      {/* Wallet hero cards */}
      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        {/* Print wallet */}
        <div className="rounded-2xl border-2 border-rose/20 bg-gradient-to-br from-white to-rose-soft/30 dark:from-mid2 dark:to-rose/[0.08] p-6 relative overflow-hidden">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-rose/10 blur-3xl"/>
          <div className="relative">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] font-bold text-rose"><I.Printer size={14}/> Print wallet</div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-display text-5xl font-bold tracking-tight">{mockData.printBalance.toLocaleString('en-IN')}</span>
              <span className="text-[var(--muted)] text-sm">pages</span>
            </div>
            {isLow && (
              <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-bold">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse"/> Running low
              </div>
            )}
            <div className="mt-1 text-xs text-[var(--muted)]">≈ {Math.round(mockData.printBalance / (mockData.monthlyPrints / 30))} days at current usage</div>
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
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] font-bold text-amber-700 dark:text-amber-400"><I.Sparkles size={14}/> AI credits</div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-display text-5xl font-bold tracking-tight">{mockData.aiBalance.toLocaleString('en-IN')}</span>
              <span className="text-[var(--muted)] text-sm">calls</span>
            </div>
            <div className="mt-2 text-xs text-[var(--muted)]">Used {mockData.monthlyAI} this month · resets never (credits don't expire)</div>
            <div className="mt-7 flex gap-2">
              <DButton variant="primary" onClick={() => setOpenModal('ai')}>+ Top up AI</DButton>
              <DButton variant="ghost" onClick={() => location.hash = '#/dashboard/ai'}>Usage</DButton>
            </div>
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatTile icon={<I.Monitor size={16}/>} label="Active devices" value={`${mockData.devices.filter(d => d.status === 'online').length}/${mockData.devices.length}`} delta="+1 this month" />
        <StatTile icon={<I.FileText size={16}/>} label="Studies this month" value="2,341" delta="+18% vs Mar" />
        <StatTile icon={<I.Sparkles size={16}/>} label="AI inferences" value={mockData.monthlyAI} delta="+22% vs Mar" />
        <StatTile icon={<I.Users size={16}/>} label="Team members" value={mockData.team.length} delta={`${mockData.team.filter(t => t.status === 'pending').length} pending`} />
      </div>

      {/* Two-column section */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Recent activity */}
        <div className="lg:col-span-2 rounded-2xl border border-[var(--line)] bg-white dark:bg-mid2 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold text-lg">Recent activity</h3>
            <a href="#/dashboard/audit" className="text-xs font-bold text-rose hover:underline">View all →</a>
          </div>
          <div className="space-y-2">
            {mockData.audit.slice(0, 5).map((a, i) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b border-[var(--line)] last:border-0 text-sm">
                <div className="h-8 w-8 rounded-full bg-paper2 dark:bg-white/[0.06] grid place-items-center shrink-0">
                  <I.Activity size={13} className="text-[var(--muted)]"/>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="truncate"><span className="font-semibold">{a.actor}</span> <span className="text-[var(--muted)]">·</span> {a.action} <span className="font-mono text-[var(--muted)]">{a.target}</span></div>
                  <div className="text-xs text-[var(--muted)]">{a.date}, {a.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar — links + ticket summary */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-[var(--line)] bg-white dark:bg-mid2 p-5">
            <h3 className="font-display font-bold text-base mb-3">Open tickets</h3>
            {mockData.tickets.filter(t => t.status === 'open').length === 0 ? (
              <p className="text-sm text-[var(--muted)]">All clear ✓</p>
            ) : (
              mockData.tickets.filter(t => t.status === 'open').map(t => (
                <a key={t.id} href="#/dashboard/tickets" className="block py-2 border-b border-[var(--line)] last:border-0 hover:bg-paper2 dark:hover:bg-white/[0.04] -mx-1 px-1 rounded">
                  <div className="text-sm font-semibold truncate">{t.subject}</div>
                  <div className="text-xs text-[var(--muted)] mt-0.5 flex items-center gap-1.5">
                    <span className="font-mono">{t.id}</span> · <Pill tone={t.priority === 'high' ? 'rose' : 'teal'}>{t.priority}</Pill>
                  </div>
                </a>
              ))
            )}
            <a href="#/dashboard/tickets" className="block mt-3 text-xs font-bold text-rose hover:underline">All tickets →</a>
          </div>

          <div className="rounded-2xl border-2 border-dashed border-rose/30 bg-rose-soft/20 dark:bg-rose/[0.06] p-5">
            <div className="font-display font-bold text-base">Refer & earn</div>
            <p className="text-xs text-[var(--muted)] mt-1.5">₹2,000 wallet credit for every clinic that signs up.</p>
            <a href="#/dashboard/referrals" className="inline-flex items-center gap-1 mt-3 text-sm font-bold text-rose hover:underline">Get your link <I.ArrowRight size={13}/></a>
          </div>
        </div>
      </div>

      {/* Recharge modals */}
      <Modal open={openModal === 'print'} onClose={() => setOpenModal(null)} title="Top up print wallet">
        <PrintRecharge onSuccess={() => setOpenModal(null)} onCancel={() => setOpenModal(null)} />
      </Modal>
      <Modal open={openModal === 'ai'} onClose={() => setOpenModal(null)} title="Top up AI credits">
        <AIRecharge onSuccess={() => setOpenModal(null)} onCancel={() => setOpenModal(null)} />
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
window.mockData = mockData;
