// SECTIONS C — Print wallet, PACS, Pricing, Personas

const PrintWallet = () => {
  const rates = [
    ["A4", "₹5", "₹2"],
    ["A3", "₹10", "₹4"],
    ["Letter", "₹5", "₹2"],
    ["Legal", "₹6", "₹3"],
  ];
  const tiers = [
    { amt: "₹500", sub: "50 colour A4", popular: false },
    { amt: "₹2,000", sub: "Most popular", popular: true },
    { amt: "₹5,000", sub: "Best value", popular: false },
    { amt: "Custom", sub: "Choose amount", popular: false },
  ];
  return (
    <Section id="recharge" className="bg-paper2/40 dark:bg-white/[0.02] border-y border-[var(--line)]">
      <SectionHead layout="stack" eyebrow="Print wallet" title={<>Pay only for what <span className="italic text-grad-rose">you print.</span></>} sub="Top up your print wallet. Mediview meters every page. No surprises." />
      <div className="mt-14 grid lg:grid-cols-2 gap-10 items-start">
        <FadeUp>
          <div className="relative">
            <Parallax speed={-25}>
              <div className="rounded-2xl overflow-hidden border border-[var(--line)] bg-white dark:bg-white/[0.03] p-6">
                <img src="assets/wallet.png" alt="wallet" className="w-full block rounded-xl"/>
              </div>
            </Parallax>
            <div className="mt-6 rounded-2xl overflow-hidden border border-[var(--line)] bg-slate-950">
              <LazyVideo src="assets/print-meter.mp4" aspect="16/9" className="w-full block"/>
            </div>
          </div>
        </FadeUp>

        <FadeUp delay={0.15}>
          <div className="rounded-2xl border border-[var(--line)] bg-white dark:bg-white/[0.03] p-6 md:p-7">
            <div className="font-display font-bold text-xl">Per-page rates</div>
            <div className="mt-4 overflow-hidden rounded-xl border border-[var(--line)]">
              <table className="w-full text-sm">
                <thead className="bg-paper2 dark:bg-white/[0.04] text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">
                  <tr><th className="text-left px-4 py-2.5">Paper</th><th className="text-right px-4 py-2.5">Colour</th><th className="text-right px-4 py-2.5">B&W</th></tr>
                </thead>
                <tbody>
                  {rates.map(([p, c, b]) => (
                    <tr key={p} className="border-t border-[var(--line)]">
                      <td className="px-4 py-3 font-semibold">{p}</td>
                      <td className="px-4 py-3 text-right font-mono">{c}</td>
                      <td className="px-4 py-3 text-right font-mono">{b}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <Stagger className="mt-6 grid grid-cols-2 gap-3">
            {tiers.map((t, i) => (
              <Item key={i}>
                <button className={`w-full text-left lift rounded-xl border p-4 transition-colors ${t.popular ? 'border-rose bg-gradient-to-br from-rose-soft to-white dark:from-rose/15 dark:to-rose/5' : 'border-[var(--line)] bg-white dark:bg-white/[0.03]'}`}>
                  <div className="font-display font-bold text-2xl">{t.amt}</div>
                  <div className={`text-xs mt-1 ${t.popular ? 'text-rose font-semibold' : 'text-[var(--muted)]'}`}>{t.sub}</div>
                  {t.popular && <span className="absolute -top-2 right-3 px-2 py-0.5 rounded-full bg-rose text-white text-[10px] font-bold tracking-wider uppercase">Popular</span>}
                </button>
              </Item>
            ))}
          </Stagger>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Btn variant="primary" size="lg" icon={<I.Sparkles size={16}/>} magnetic>Recharge Now — UPI</Btn>
            <div className="flex items-center gap-2 text-xs text-[var(--muted)] font-mono">
              <span className="px-2 py-1 rounded bg-paper2 dark:bg-white/5 border border-[var(--line)]">BHIM</span>
              <span className="px-2 py-1 rounded bg-paper2 dark:bg-white/5 border border-[var(--line)]">PhonePe</span>
              <span className="px-2 py-1 rounded bg-paper2 dark:bg-white/5 border border-[var(--line)]">GPay</span>
              <span className="px-2 py-1 rounded bg-paper2 dark:bg-white/5 border border-[var(--line)]">Paytm</span>
            </div>
          </div>
          <p className="mt-4 text-xs text-[var(--muted)]">Instant credit after UPI confirmation. GST invoice auto-generated.</p>
        </FadeUp>
      </div>
    </Section>
  );
};

const PACS = () => {
  const cards = [
    { i: <I.Server size={20}/>, t: "Orthanc PACS integration", d: "Any DICOM-compliant PACS supported." },
    { i: <I.FolderOpen size={20}/>, t: "Auto-import folder watcher", d: "Drop a study, it appears in your worklist." },
    { i: <I.Send size={20}/>, t: "DICOM Send-To across the network", d: "DIMSE / STOW-RS to any node." },
  ];
  const bonus = ["Google Drive scheduled backups", "Multi-location sync", "Offline-first with 7-day grace"];
  return (
    <Section>
      <SectionHead eyebrow="Integrations" title={<>Plays nicely with <span className="italic text-grad-rose">your hospital.</span></>} align="center"/>
      <Stagger className="mt-12 grid md:grid-cols-3 gap-5">
        {cards.map((c, i) => (
          <Item key={i}>
            <Spotlight>
              <div className="lift rounded-2xl border border-[var(--line)] bg-white dark:bg-white/[0.03] p-6 h-full">
                <div className="h-10 w-10 grid place-items-center rounded-lg bg-rose-soft dark:bg-rose/15 text-rose">{c.i}</div>
                <div className="mt-4 font-display font-bold text-lg">{c.t}</div>
                <p className="mt-1 text-sm text-[var(--muted)]">{c.d}</p>
              </div>
            </Spotlight>
          </Item>
        ))}
      </Stagger>
      <FadeUp delay={0.1}>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {bonus.map(b => (
            <span key={b} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full border border-[var(--line)] bg-white dark:bg-white/[0.03] text-sm">
              <I.Check size={14} className="text-rose"/>{b}
            </span>
          ))}
        </div>
      </FadeUp>
    </Section>
  );
};

const Pricing = () => {
  const [usd, setUsd] = React.useState(false);
  const fmt = (inr, dollars) => usd ? dollars : inr;
  const cards = [
    {
      name: "Free Forever",
      price: "FREE",
      period: "no card required",
      desc: "Full DICOM viewer, measurements & reporting — yours to keep, on every machine.",
      cta: "Download Free",
      features: [
        "Full DICOM viewer (2D / MPR / 3D)",
        "All measurement tools",
        "Structured reporting & export",
        "Unlimited studies, unlimited users",
        "Free updates forever",
      ],
    },
    {
      name: "Monthly",
      price: fmt("₹8,000", "$96"),
      period: "per machine / month",
      desc: "Unlocks print metering, PACS sync, and team features. Cancel anytime.",
      cta: "Subscribe Monthly",
      features: [
        "Everything in Free, plus:",
        "Print wallet & metering",
        "PACS / HL7 / DICOMweb sync",
        "Multi-user & multi-PC sync",
        "Email support (48h SLA)",
      ],
    },
    {
      name: "Annual",
      price: fmt("₹90,000", "$1,080"),
      period: "per machine / year",
      desc: "Equivalent to ₹7,500/mo — but get 12 months for ₹90K flat. Best for working radiologists.",
      cta: "Buy Annual License",
      popular: true,
      features: [
        "Everything in Monthly, plus:",
        "Save ₹6,000 vs monthly",
        "Priority email support (24h)",
        "1,000 free A4 B&W print credits",
        "Free onboarding call",
      ],
    },
    {
      name: "Enterprise",
      price: "Custom",
      period: "multi-PC site license",
      desc: "Hospitals, chains and teleradiology groups. Perpetual licenses, on-prem, white-label.",
      cta: "Talk to Sales",
      features: [
        "Perpetual or volume licensing",
        "On-premise / air-gapped deploy",
        "White-label & SSO",
        "Dedicated CSM + 1h phone SLA",
        "Custom AI model integration",
      ],
    },
  ];

  // AI credit recharge packs — pay only for what you use.
  const aiPacks = [
    { name: "Starter",  credits: "500",   price: fmt("₹1,499",  "$18"),  per: fmt("₹3.00 / call",  "$0.036 / call"), badge: null },
    { name: "Practice", credits: "2,500", price: fmt("₹6,499",  "$78"),  per: fmt("₹2.60 / call",  "$0.031 / call"), badge: "Save 13%" },
    { name: "Clinic",   credits: "10,000",price: fmt("₹22,999", "$276"), per: fmt("₹2.30 / call",  "$0.028 / call"), badge: "Save 23%" },
    { name: "Hospital", credits: "50,000",price: fmt("₹99,999", "$1,200"),per:fmt("₹2.00 / call",  "$0.024 / call"), badge: "Save 33%" },
  ];

  return (
    <Section id="pricing" className="bg-paper2/40 dark:bg-white/[0.02] border-y border-[var(--line)]">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
        <SectionHead layout="stack" eyebrow="Pricing" title={<>Free to view & report. <span className="italic text-grad-rose">Pay only for power.</span></>} sub="Measurements and structured reporting are free, forever. Unlock advanced workflow with a license — top up AI credits as you go."/>
        <FadeUp delay={0.15}>
          <div className="inline-flex items-center gap-1 p-1 rounded-full border border-[var(--line)] bg-white dark:bg-white/[0.03]">
            <button onClick={() => setUsd(false)} className={`px-4 h-9 rounded-full text-sm font-semibold ${!usd ? 'bg-rose text-white' : 'text-ink/70 dark:text-paper/70'}`}>INR ₹</button>
            <button onClick={() => setUsd(true)} className={`px-4 h-9 rounded-full text-sm font-semibold ${usd ? 'bg-rose text-white' : 'text-ink/70 dark:text-paper/70'}`}>USD $</button>
          </div>
        </FadeUp>
      </div>

      {/* License tiers — equal-height flex cards */}
      <Stagger className="mt-12 pt-3 grid md:grid-cols-2 lg:grid-cols-4 gap-5 items-stretch" stagger={0.1}>
        {cards.map((c, i) => (
          <Item key={i} className="h-full">
            <Spotlight className="h-full">
              <div className={`relative h-full flex flex-col rounded-2xl border p-6 lift transition-all ${c.popular ? 'border-rose bg-gradient-to-br from-rose-soft via-white to-rose-soft dark:from-rose/15 dark:via-white/[0.03] dark:to-rose/10 shadow-[0_30px_70px_-30px_rgba(225,29,72,0.5)]' : 'border-[var(--line)] bg-white dark:bg-white/[0.03]'}`}>
                {c.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3.5 py-1.5 rounded-full bg-rose text-white text-[10px] font-bold uppercase tracking-[0.16em] shadow-lg whitespace-nowrap">Most popular</div>
                )}
                <div className="text-[11px] uppercase tracking-[0.16em] font-bold text-[var(--muted)]">{c.name}</div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="font-display text-4xl font-bold">{c.price}</span>
                </div>
                <div className="text-xs text-[var(--muted)]">{c.period}</div>
                <p className="mt-4 text-sm text-ink/80 dark:text-paper/80 leading-relaxed">{c.desc}</p>
                <ul className="mt-5 space-y-2 border-t border-[var(--line)] pt-5 flex-1">
                  {c.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-[13px]">
                      <I.Check size={14} className={`mt-0.5 shrink-0 ${c.popular ? 'text-rose' : 'text-ink/60 dark:text-paper/60'}`} /><span>{f}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6">
                  <Btn variant={c.popular ? "primary" : "ghost"} size="md" className="w-full">{c.cta}</Btn>
                </div>
              </div>
            </Spotlight>
          </Item>
        ))}
      </Stagger>

      {/* AI credits — pay-as-you-go recharge */}
      <FadeUp delay={0.1}>
        <div className="mt-16 rounded-3xl border border-[var(--line)] bg-gradient-to-br from-white via-amber-50/40 to-rose-soft/30 dark:from-white/[0.04] dark:via-amber-500/[0.04] dark:to-rose/[0.06] p-8 md:p-10 overflow-hidden relative">
          <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-amber-300/30 dark:bg-amber-400/15 blur-3xl pointer-events-none"/>
          <div className="relative grid md:grid-cols-[auto_1fr] gap-8 md:items-end mb-8">
            <div>
              <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] font-bold text-amber-700 dark:text-amber-300">
                <I.Sparkles size={14}/> AI Credits · Pay-as-you-go
              </div>
              <h3 className="mt-3 font-display text-3xl md:text-4xl font-bold leading-tight max-w-2xl">
                Recharge first. Then spend credits only when AI runs.
              </h3>
              <p className="mt-3 text-[15px] text-ink/80 dark:text-paper/80 max-w-2xl leading-relaxed">
                One credit = one AI inference (e.g. lung-nodule scan, fracture triage, report draft).
                Buy a pack, your balance never expires. Bigger packs cost less per call.
              </p>
            </div>
            <div className="md:justify-self-end flex items-center gap-3 text-sm">
              <div className="font-mono text-[var(--muted)]">No subscription · No expiry</div>
            </div>
          </div>

          <div className="relative grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {aiPacks.map((p, i) => (
              <div key={i} className="relative rounded-2xl border border-[var(--line)] bg-white dark:bg-white/[0.04] p-5 flex flex-col lift">
                {p.badge && (
                  <div className="absolute -top-2.5 right-4 px-2.5 py-1 rounded-full bg-amber-400 text-ink text-[10px] font-bold uppercase tracking-wider shadow">{p.badge}</div>
                )}
                <div className="text-[11px] uppercase tracking-[0.16em] font-bold text-[var(--muted)]">{p.name}</div>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="font-display text-3xl font-bold">{p.credits}</span>
                  <span className="text-xs text-[var(--muted)]">credits</span>
                </div>
                <div className="mt-3 font-display text-xl font-semibold text-rose">{p.price}</div>
                <div className="text-[12px] font-mono text-[var(--muted)] mt-0.5">{p.per}</div>
                <Btn variant="ghost" size="sm" className="mt-5 w-full">Recharge</Btn>
              </div>
            ))}
          </div>

          <div className="relative mt-7 flex flex-wrap gap-x-6 gap-y-2 text-[12px] text-[var(--muted)]">
            <span className="inline-flex items-center gap-1.5"><I.Check size={12} className="text-emerald-600"/> Credits never expire</span>
            <span className="inline-flex items-center gap-1.5"><I.Check size={12} className="text-emerald-600"/> Works with any plan, including Free</span>
            <span className="inline-flex items-center gap-1.5"><I.Check size={12} className="text-emerald-600"/> Auto-recharge optional</span>
            <span className="inline-flex items-center gap-1.5"><I.Check size={12} className="text-emerald-600"/> GST invoice on every top-up</span>
          </div>
        </div>
      </FadeUp>

      <p className="mt-8 text-center text-xs text-[var(--muted)]">Print credits & AI credits sold separately — top up anytime from your dashboard.</p>

      <FadeUp delay={0.1}>
        <div className="mt-10 overflow-x-auto rounded-2xl border border-[var(--line)] bg-white dark:bg-white/[0.03]">
          <table className="w-full text-sm min-w-[680px]">
            <thead className="bg-paper2 dark:bg-white/[0.04] text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">
              <tr>
                <th className="text-left px-5 py-3"></th>
                <th className="px-5 py-3">Free</th>
                <th className="px-5 py-3">Monthly</th>
                <th className="px-5 py-3 text-rose">Annual</th>
                <th className="px-5 py-3">Enterprise</th>
              </tr>
            </thead>
            <tbody className="text-center">
              {[
                ["DICOM viewer & MPR / 3D", "✓", "✓", "✓", "✓"],
                ["Measurements & reporting", "✓", "✓", "✓", "✓"],
                ["Print metering & wallet", "—", "✓", "✓", "✓"],
                ["PACS / HL7 / DICOMweb", "—", "✓", "✓", "✓"],
                ["AI analysis", "Pay-per-credit", "Pay-per-credit", "Pay-per-credit", "Pay-per-credit or unlimited"],
                ["Printers", "1", "1", "2", "Unlimited"],
                ["Users", "1", "1", "1", "Unlimited"],
                ["Locations", "1", "1", "1", "Unlimited"],
                ["Support SLA", "Community", "48h email", "24h email", "1h phone"],
              ].map(row => (
                <tr key={row[0]} className="border-t border-[var(--line)]">
                  <td className="text-left px-5 py-3 font-semibold">{row[0]}</td>
                  {row.slice(1).map((v, j) => <td key={j} className="px-5 py-3 font-mono">{v}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </FadeUp>
    </Section>
  );
};

const Personas = () => {
  const ppl = [
    { t: "Solo radiologist", q: "Read 80 USG/day from home.", icon: <I.User size={20}/> },
    { t: "2-5 PC sonography clinic", q: "Share studies, share license server.", icon: <I.Users size={20}/> },
    { t: "Multi-location hospital chain", q: "Centralized billing, distributed workstations.", icon: <I.Building size={20}/> },
  ];
  return (
    <Section>
      <SectionHead eyebrow="Who it's for" title={<>From a single PC to a <span className="italic text-grad-rose">50-machine hospital network.</span></>} align="center"/>
      <FadeUp delay={0.1}>
        <div className="mt-12 mx-auto max-w-5xl rounded-2xl overflow-hidden border border-[var(--line)] bg-slate-950">
          <LazyVideo src="assets/hospital-network-build.mp4" poster="assets/hospital-network.png" aspect="16/9" className="w-full block"/>
        </div>
      </FadeUp>
      <Stagger className="mt-10 grid md:grid-cols-3 gap-5">
        {ppl.map((p, i) => (
          <Item key={i}>
            <Spotlight>
              <div className="lift rounded-2xl border border-[var(--line)] bg-white dark:bg-white/[0.03] p-6 h-full">
                <div className="h-10 w-10 grid place-items-center rounded-lg bg-rose-soft dark:bg-rose/15 text-rose">{p.icon}</div>
                <div className="mt-4 font-display font-bold text-lg">{p.t}</div>
                <p className="mt-3 font-display italic text-xl text-ink dark:text-paper">"{p.q}"</p>
              </div>
            </Spotlight>
          </Item>
        ))}
      </Stagger>
    </Section>
  );
};

Object.assign(window, { PrintWallet, PACS, Pricing, Personas });
