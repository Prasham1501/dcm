// Multi-page Nav + Footer + Floating powered-by badge.

// Warm the dashboard's HTML + script chunks on Sign-In hover so the click
// is instant. The dashboard is heavy (Tailwind CDN, Babel transformer, all
// jsx files), and on cold loads the user can feel the wait. Idempotent —
// only runs once per page session.
let _dashPrefetched = false;
function prefetchDashboard() {
  if (_dashPrefetched) return;
  _dashPrefetched = true;
  const urls = [
    'dashboard.html',
    'dashboard/api.js',
    'dashboard/auth-context.jsx',
    'dashboard/auth-pages.jsx',
    'dashboard/dash-shell.jsx',
  ];
  for (const u of urls) {
    const link = document.createElement('link');
    link.rel  = 'prefetch';
    link.href = u;
    document.head.appendChild(link);
  }
}

// Custom SVG logo — crosshair scope + signal pulse for "see more"
const Logo = ({ dark = false, large = false }) => {
  const size = large ? 36 : 30;
  return (
    <span className="inline-flex items-center gap-2.5 transition-transform group-hover:scale-[1.02]">
      <span className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
        <span className="absolute inset-0 rounded-[10px] bg-gradient-to-br from-rose to-rose-dark shadow-[0_8px_24px_-6px_rgba(220,38,38,0.55)]" />
        <span className="absolute inset-[2px] rounded-[8px] bg-gradient-to-br from-white/15 to-transparent" />
        <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="none" className="relative z-10">
          <circle cx="12" cy="12" r="8" stroke="white" strokeWidth="1.6" opacity="0.55" />
          <circle cx="12" cy="12" r="3.4" stroke="white" strokeWidth="1.6" />
          <path d="M12 1.5v3.5M12 19v3.5M1.5 12h3.5M19 12h3.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="12" cy="12" r="1.2" fill="white" />
        </svg>
      </span>
      <span className={`font-display font-bold tracking-tight ${large ? 'text-2xl' : 'text-xl'} text-ink dark:text-paper`}>
        Medi<span className="text-rose">view</span>
      </span>
    </span>
  );
};

const NAV_LINKS = [
  ['Home', '#/'],
  ['Features', '#/features'],
  ['AI', '#/ai'],
  ['Bridge', '#/bridge'],
  ['Pricing', '#/pricing'],
  ['Download', '#/download'],
  ['Contact', '#/contact'],
];

const Nav = ({ dark, setDark, route }) => {
  const [scrolled, setScrolled] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  React.useEffect(() => { setOpen(false); }, [route]);

  return (
    <header className={`fixed inset-x-0 top-0 z-50 transition-all ${scrolled ? 'backdrop-blur-xl bg-paper/75 dark:bg-midnight/75 border-b border-[var(--line)]' : 'bg-transparent'}`}>
      <div className="mx-auto max-w-7xl px-6 lg:px-10 h-16 flex items-center gap-6">
        <a href="#/" className="flex items-center gap-2.5 shrink-0 group">
          <Logo dark={dark} />
        </a>

        <nav className="hidden lg:flex items-center gap-1 ml-2">
          {NAV_LINKS.map(([label, href]) => {
            const active = route === href;
            return (
              <a key={href} href={href} className={`relative px-3.5 py-2 text-sm font-medium transition-colors rounded-full ${active ? 'text-rose' : 'text-ink/70 dark:text-paper/70 hover:text-rose'}`}>
                {label}
                {active && (
                  <M.span layoutId="navactive" className="absolute inset-0 rounded-full bg-rose-soft dark:bg-rose/10 -z-10" transition={{ type: 'spring', stiffness: 380, damping: 30 }} />
                )}
              </a>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setDark(!dark)}
            aria-label="Toggle theme"
            className="h-10 w-10 grid place-items-center rounded-full border border-[var(--line)] hover:border-rose/50 hover:text-rose transition-colors"
          >
            {dark ? <I.Sun size={16} /> : <I.Moon size={16} />}
          </button>
          <a
            href="dashboard.html#/dashboard/login"
            onMouseEnter={prefetchDashboard}
            onTouchStart={prefetchDashboard}
            onClick={() => { try { localStorage.removeItem('mv:user'); } catch(e){} }}
            className="hidden md:inline-flex items-center gap-1.5 px-3 h-9 rounded-full text-sm font-semibold text-ink/70 dark:text-paper/70 hover:text-rose transition-colors">
            <I.Key size={14}/> Sign in
          </a>

          <Btn href="#/pricing" variant="primary" size="sm" icon={<I.Key size={15} />} magnetic>Buy License</Btn>
          <button onClick={() => setOpen(o => !o)} className="lg:hidden h-10 w-10 grid place-items-center rounded-full border border-[var(--line)]">
            {open ? <I.X size={16}/> : <I.Menu size={16}/>}
          </button>
        </div>
      </div>

      {open && (
        <div className="lg:hidden border-t border-[var(--line)] bg-paper/95 dark:bg-midnight/95 backdrop-blur">
          <div className="px-6 py-4 grid gap-1">
            {NAV_LINKS.map(([label, href]) => (
              <a key={href} href={href} className={`px-3 py-2 text-sm font-medium ${route === href ? 'text-rose' : ''}`}>{label}</a>
            ))}
            <div className="h-px my-2 bg-[var(--line)]"/>
            <a href="dashboard.html#/dashboard/login" onTouchStart={prefetchDashboard} onClick={() => { try { localStorage.removeItem('mv:user'); } catch(e){} }} className="px-3 py-2 text-sm font-semibold flex items-center gap-2"><I.Key size={14}/> Sign in</a>
          </div>
        </div>
      )}
    </header>
  );
};

const Footer = () => {
  const cols = [
    { t: "Product", links: [["Features", "#/features"], ["AI", "#/ai"], ["MPR", "#/features"], ["Pricing", "#/pricing"], ["Download", "#/download"]] },
    { t: "Account", links: [["Sign in", "dashboard.html#/dashboard/login"], ["Sign up", "dashboard.html#/dashboard/signup"], ["Dashboard", "dashboard.html"], ["Top up wallet", "dashboard.html#/dashboard/wallet"], ["Support", "dashboard.html#/dashboard/tickets"], ["Invoices", "dashboard.html#/dashboard/invoices"]] },
    { t: "Resources", links: [["Setup Guide", "#/download"], ["Features", "#/features"], ["AI capabilities", "#/ai"], ["Pricing", "#/pricing"], ["Support", "dashboard.html#/dashboard/tickets"]] },
    { t: "Company", links: [["Contact", "#/contact"], ["Pricing", "#/pricing"], ["Privacy", "#/privacy"], ["Terms", "#/terms"], ["Refund Policy", "#/refund"]] },
  ];
  return (
    <footer className="relative border-t border-[var(--line)] bg-paper2/60 dark:bg-mid2/60">
      <div className="mx-auto max-w-7xl px-6 lg:px-10 py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-6 gap-10">
          <div className="lg:col-span-2">
            <Logo dark large />
            <p className="mt-5 font-display italic text-lg text-ink/80 dark:text-paper/80 max-w-xs">
              See more. Diagnose faster. Bill accurately.
            </p>
            <div className="mt-4 flex items-center gap-2 text-sm font-medium">
              <span>Made in India for Indian hospitals</span>
              <span>🇮🇳</span>
            </div>
            <div className="mt-6 space-y-2 text-sm text-[var(--muted)]">
              <a href="mailto:prashamk15@gmail.com" className="flex items-center gap-2 hover:text-rose transition-colors">
                <I.Mail size={14}/> prashamk15@gmail.com
              </a>
              <a href="tel:+919136335529" className="flex items-center gap-2 hover:text-rose transition-colors">
                <I.Phone size={14}/> +91 91363 35529
              </a>
            </div>
          </div>
          {cols.map(col => (
            <div key={col.t}>
              <div className="text-[11px] uppercase tracking-[0.16em] font-bold text-[var(--muted)]">{col.t}</div>
              <ul className="mt-4 space-y-2.5">
                {col.links.map(([l, h]) => (
                  <li key={l}><a href={h} className="text-sm text-ink/80 dark:text-paper/80 hover:text-rose transition-colors">{l}</a></li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 pt-6 border-t border-[var(--line)] flex flex-col md:flex-row gap-4 md:items-center md:justify-between text-xs text-[var(--muted)]">
          <div>© 2026 Mediview. All rights reserved.</div>
          <div className="flex items-center gap-3 font-mono">
            <span>Cornerstone.js</span>
            <span className="opacity-40">·</span>
            <span>Razorpay UPI</span>
            <span className="opacity-40">·</span>
            <span>Orthanc PACS</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

const FloatingBadge = () => (
  <div className="fixed bottom-5 right-5 z-40 hidden md:block">
    <div className="glass rounded-full pl-2 pr-4 py-2 flex items-center gap-2 shadow-lg text-xs font-medium">
      <span className="h-6 w-6 grid place-items-center rounded-full bg-gradient-to-br from-rose to-rose-dark text-white">
        <I.Sparkles size={12}/>
      </span>
      <span className="text-ink/80 dark:text-paper/80">
        Powered by <span className="font-mono font-bold text-ink dark:text-paper">Cornerstone.js</span>
      </span>
    </div>
  </div>
);

// Page header (smaller hero used on inner pages)
const PageHeader = ({ eyebrow, title, sub, tone = "rose" }) => (
  <section className="relative pt-32 md:pt-40 pb-16 md:pb-20 overflow-hidden">
    <div className="absolute inset-0 -z-10 dotgrid opacity-60"/>
    <Blobs tone={tone}/>
    <div className="mx-auto max-w-5xl px-6 lg:px-10 text-center relative">
      <FadeUp><Eyebrow tone={tone}>{eyebrow}</Eyebrow></FadeUp>
      <FadeUp delay={0.05}>
        <h1 className="font-display mt-6 text-5xl md:text-7xl font-bold leading-[1.08] tracking-tight pb-1">{title}</h1>
      </FadeUp>
      {sub && (
        <FadeUp delay={0.1}>
          <p className="mt-6 text-lg md:text-xl text-[var(--muted)] max-w-2xl mx-auto leading-relaxed">{sub}</p>
        </FadeUp>
      )}
    </div>
  </section>
);

Object.assign(window, { Nav, Footer, FloatingBadge, PageHeader, NAV_LINKS });
