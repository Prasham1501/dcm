// BRIDGE PAGE — marketing for the tray auto-print companion app.
// Pitches Bridge as a standalone purchase (separate from Viewer):
//   - ₹3,000/month or ₹30,000/year
//   - Listens on DICOM ports, auto-routes per-printer per-modality
//   - Branded headers/footers, debounced by study UID
const BridgePage = () => (
  <div className="page-in">
    <PageHeader
      eyebrow="Mediview Bridge"
      title={<>Auto-print every study. <span className="italic text-grad-rose">Untouched by hands.</span></>}
      sub="A tray-only Windows companion that listens on DICOM, renders, and routes to the right printer — automatically. Separate product, separate license, ₹3,000/month."
    />

    {/* Hero card */}
    <Section>
      <FadeUp>
        <div className="rounded-3xl border border-amber-400/30 bg-gradient-to-br from-amber-50 via-white to-rose-soft dark:from-amber-500/[0.06] dark:via-white/[0.02] dark:to-rose/[0.06] p-8 md:p-10">
          <div className="grid lg:grid-cols-[1.1fr_1fr] gap-10 items-center">
            <div>
              <Eyebrow tone="gold">Standalone product · ₹3,000/month</Eyebrow>
              <h2 className="mt-5 font-display text-4xl md:text-5xl font-bold leading-[1.05]">Drop a study. <br/><span className="italic text-grad-rose">It prints. Done.</span></h2>
              <p className="mt-5 text-[var(--muted)] max-w-xl leading-relaxed">
                Mediview Bridge runs in the system tray. When your modality (CT, MR, USG, CR) sends a DICOM
                Storage SCU, Bridge receives it, renders to the layout you configured, and fires the print job
                — all without a doctor ever touching a keyboard.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Btn href="dashboard.html#/dashboard/licenses?product=bridge" variant="primary" size="lg" icon={<I.Key size={17}/>}>Buy Bridge — ₹3K/mo</Btn>
                <Btn href="#/download" variant="ghost" size="lg" icon={<I.Download size={16}/>}>Download trial</Btn>
              </div>
              <div className="mt-5 text-xs text-[var(--muted)]">
                30-day trial · No credit card · Separate license from Viewer · GST invoice on every payment.
              </div>
            </div>
            <div className="relative">
              <div className="rounded-2xl overflow-hidden border border-amber-400/30 bg-slate-950 p-5 shadow-[0_30px_80px_-20px_rgba(245,158,11,0.45)]">
                <div className="flex items-center gap-2 mb-3">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"/>
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-400">Listening · 4 slots active</span>
                </div>
                <div className="space-y-1.5 font-mono text-[11px]">
                  {[
                    ['CT-SCANNER-01','11112','HP LaserJet M404','active'],
                    ['USG-ROOM-3',   '11113','Canon iR-ADV 6275','active'],
                    ['MRI-PHILIPS',  '11114','Xerox AltaLink','idle'],
                    ['CR-FUJI',      '11115','Brother HL-L8360','active'],
                  ].map(([modality, port, printer, status], i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.04] text-slate-300">
                      <span className="text-amber-400">{modality}</span>
                      <span className="text-slate-500">:{port}</span>
                      <span className="text-slate-500">→</span>
                      <span className="text-slate-300 truncate flex-1">{printer}</span>
                      <span className={status === 'active' ? 'text-emerald-400' : 'text-slate-500'}>● {status}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-white/[0.04] text-[10px] font-mono text-slate-500">
                  Last printed: 14:23:01 · CT_20260520_AB12 · 8 pages · HP LaserJet M404
                </div>
              </div>
            </div>
          </div>
        </div>
      </FadeUp>
    </Section>

    {/* Why Bridge */}
    <Section>
      <SectionHead eyebrow="Why Bridge" title={<>Zero clicks. Zero training. <span className="italic text-grad-rose">Always on.</span></>} align="center"/>
      <Stagger className="mt-12 grid md:grid-cols-3 gap-5">
        {[
          { i: <I.Server size={22}/>, t: 'Multi-port DICOM listener', d: 'Up to 8 slots, one per modality / printer / location. Each slot is its own DICOM AE.' },
          { i: <I.Layers size={22}/>, t: 'Per-slot routing', d: 'CT goes to the radiology laser. USG goes to the OB-Gyn ink-tank. Mammo to the high-res. Routed once, runs forever.' },
          { i: <I.Clock size={22}/>, t: 'Study-debounced', d: 'Receives the whole study, waits for completion, then prints once — never one-page-at-a-time chaos.' },
          { i: <I.Image size={22}/>, t: 'Branded output', d: 'Hospital letterhead, patient banner, custom footer with GST/clinic info. Configured once per slot.' },
          { i: <I.Lock size={22}/>, t: 'Tray-only, auto-start', d: 'Installs as a Windows service-like tray app. Starts at login. Survives reboots. Out of the way.' },
          { i: <I.FileText size={22}/>, t: 'Logs everything', d: 'Rotating log file in %APPDATA% — every received study, every print job, every error. Audit-ready.' },
        ].map((c, i) => (
          <Item key={i}>
            <div className="lift rounded-2xl border border-[var(--line)] bg-white dark:bg-white/[0.03] p-6 h-full">
              <div className="h-12 w-12 grid place-items-center rounded-xl bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400">{c.i}</div>
              <div className="mt-5 font-display font-bold text-lg">{c.t}</div>
              <p className="mt-2 text-sm text-[var(--muted)]">{c.d}</p>
            </div>
          </Item>
        ))}
      </Stagger>
    </Section>

    {/* How it works */}
    <Section className="bg-paper2/40 dark:bg-white/[0.02] border-y border-[var(--line)]">
      <SectionHead eyebrow="How it works" title={<>From DICOM packet <span className="italic text-grad-rose">to paper</span> in under 5 seconds.</>} align="center"/>
      <Stagger className="mt-14 grid md:grid-cols-4 gap-4 relative">
        <div className="hidden md:block absolute top-12 left-[12%] right-[12%] h-px bg-gradient-to-r from-amber-400/40 via-amber-500 to-amber-400/40 -z-10"/>
        {[
          { n: 1, t: 'Modality sends', d: 'Your CT/USG/MR sends a DICOM Storage SCU to Bridge on the slot port you configured (e.g. :11112).' },
          { n: 2, t: 'Study assembled', d: 'Bridge buffers all images for the same Study UID. Once SCU finishes, the study is complete.' },
          { n: 3, t: 'Rendered + branded', d: 'Pages composed in your layout (2×2 / 3×3 etc.) with hospital header + patient banner + footer.' },
          { n: 4, t: 'Printed silently', d: 'Sent to the printer mapped to that slot. Job IDs logged. No popups, no spool dialogs.' },
        ].map(s => (
          <Item key={s.n}>
            <div className="lift rounded-2xl border border-[var(--line)] bg-white dark:bg-white/[0.03] p-6 h-full text-center">
              <div className="mx-auto h-14 w-14 rounded-full bg-amber-500 text-white grid place-items-center font-display font-bold text-xl shadow-[0_15px_40px_-10px_rgba(245,158,11,0.6)]">{s.n}</div>
              <div className="mt-5 font-display font-bold text-base">{s.t}</div>
              <p className="mt-2 text-sm text-[var(--muted)]">{s.d}</p>
            </div>
          </Item>
        ))}
      </Stagger>
    </Section>

    {/* Pricing — Bridge-only */}
    <Section>
      <SectionHead eyebrow="Bridge pricing" title={<>One installer. <span className="italic text-grad-rose">Per-machine licensing.</span></>} align="center"/>
      <Stagger className="mt-12 grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        <Item>
          <Spotlight className="h-full">
            <div className="relative h-full flex flex-col rounded-2xl border border-[var(--line)] bg-white dark:bg-white/[0.03] p-7 lift">
              <div className="text-[11px] uppercase tracking-[0.16em] font-bold text-[var(--muted)]">Monthly</div>
              <div className="mt-3 font-display text-5xl font-bold">₹3,000</div>
              <div className="text-xs text-[var(--muted)]">per machine / month</div>
              <p className="mt-4 text-sm text-ink/80 dark:text-paper/80 leading-relaxed">Bridge runs on a single PC. Cancel anytime. GST invoice each cycle.</p>
              <ul className="mt-6 space-y-2 border-t border-[var(--line)] pt-5 flex-1">
                {['Up to 8 DICOM listener slots','Auto-routes to mapped printers','Branded headers / footers','Auto-start at Windows login','Rotating log file'].map(f => (
                  <li key={f} className="flex items-start gap-2 text-[13px]"><I.Check size={14} className="mt-0.5 text-amber-500 shrink-0"/><span>{f}</span></li>
                ))}
              </ul>
              <Btn href="dashboard.html#/dashboard/licenses?product=bridge" variant="ghost" size="md" className="mt-6 w-full">Buy Monthly</Btn>
            </div>
          </Spotlight>
        </Item>
        <Item>
          <Spotlight className="h-full">
            <div className="relative h-full flex flex-col rounded-2xl border-2 border-amber-400 bg-gradient-to-br from-amber-50 via-white to-amber-50 dark:from-amber-500/15 dark:via-white/[0.03] dark:to-amber-500/10 p-7 lift shadow-[0_30px_70px_-30px_rgba(245,158,11,0.5)]">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3.5 py-1.5 rounded-full bg-amber-500 text-white text-[10px] font-bold uppercase tracking-[0.16em] shadow-lg whitespace-nowrap">Save ₹6,000</div>
              <div className="text-[11px] uppercase tracking-[0.16em] font-bold text-amber-700 dark:text-amber-400">Annual</div>
              <div className="mt-3 font-display text-5xl font-bold">₹30,000</div>
              <div className="text-xs text-[var(--muted)]">per machine / year</div>
              <p className="mt-4 text-sm text-ink/80 dark:text-paper/80 leading-relaxed">Equivalent to ₹2,500/mo — pay 12 months for the price of 10. Best for production deployments.</p>
              <ul className="mt-6 space-y-2 border-t border-[var(--line)] pt-5 flex-1">
                {['Everything in Monthly, plus:','Save ₹6,000 vs monthly','Priority email support (24h)','Free onboarding call'].map(f => (
                  <li key={f} className="flex items-start gap-2 text-[13px]"><I.Check size={14} className="mt-0.5 text-amber-500 shrink-0"/><span>{f}</span></li>
                ))}
              </ul>
              <Btn href="dashboard.html#/dashboard/licenses?product=bridge" variant="primary" size="md" className="mt-6 w-full">Buy Annual</Btn>
            </div>
          </Spotlight>
        </Item>
      </Stagger>
      <FadeUp delay={0.15}>
        <div className="mt-10 max-w-2xl mx-auto text-center text-xs text-[var(--muted)]">
          Bridge is a separate product from Mediview Viewer. A Bridge key won't activate Viewer, and a Viewer key won't activate Bridge.
          You can run both on the same PC with two keys, or just one.
        </div>
      </FadeUp>
    </Section>

    <SysReq />
    <Security />
    <FinalCTA />
  </div>
);
window.BridgePage = BridgePage;
