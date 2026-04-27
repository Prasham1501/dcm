// SECTIONS A — Problem/Solution, Core Viewer, Measurements, MPR (refreshed palette)

const ProblemSolution = () => {
  const pain = [
    { t: "40% of the day, gone.", d: "Radiologists waste it on layouts and re-typing measurements." },
    { t: "₹3-8 lakh per seat.", d: "Existing viewers cost a fortune — and break the moment your internet drops." },
    { t: "Print billing leaks.", d: "Manual logs, missing receipts. Hospitals lose lakhs every quarter." },
  ];
  const fix = [
    { t: "AI reads the screen.", d: "Extracts FL, AC, BPD, HC, EFW directly from the ultrasound machine's display." },
    { t: "Offline-first.", d: "7-day grace. Diagnose during outages. Syncs the moment you're back online." },
    { t: "Per-print metering.", d: "Every page billed automatically. UPI top-ups. GST invoices auto-generated." },
  ];

  return (
    <Section id="why" className="border-y border-[var(--line)] bg-paper2/40 dark:bg-white/[0.02]">
      <div className="grid md:grid-cols-2 gap-12 lg:gap-20">
        <div>
          <FadeUp><Eyebrow tone="slate">The pain</Eyebrow></FadeUp>
          <FadeUp delay={0.05}>
            <h3 className="font-display mt-5 text-3xl md:text-5xl font-bold leading-[1.05]">
              Indian radiology runs on <span className="italic text-rose">workarounds.</span>
            </h3>
          </FadeUp>
          <Stagger className="mt-8 space-y-4">
            {pain.map((p, i) => (
              <Item key={i}>
                <div className="flex gap-4 p-5 rounded-2xl border border-[var(--line)] bg-white dark:bg-white/[0.03]">
                  <div className="h-10 w-10 shrink-0 grid place-items-center rounded-lg bg-rose-soft dark:bg-rose/15 text-rose">
                    <I.X size={18} />
                  </div>
                  <div>
                    <div className="font-display font-bold text-lg">{p.t}</div>
                    <div className="mt-1 text-sm text-[var(--muted)]">{p.d}</div>
                  </div>
                </div>
              </Item>
            ))}
          </Stagger>
        </div>
        <div>
          <FadeUp><Eyebrow tone="rose">Mediview fixes it</Eyebrow></FadeUp>
          <FadeUp delay={0.05}>
            <h3 className="font-display mt-5 text-3xl md:text-5xl font-bold leading-[1.05]">
              One installer. <span className="italic text-grad-rose">Three problems solved.</span>
            </h3>
          </FadeUp>
          <Stagger className="mt-8 space-y-4">
            {fix.map((p, i) => (
              <Item key={i}>
                <div className="flex gap-4 p-5 rounded-2xl border border-rose/25 bg-gradient-to-br from-rose-soft/60 to-white dark:from-rose/8 dark:to-white/[0.02]">
                  <div className="h-10 w-10 shrink-0 grid place-items-center rounded-lg bg-rose text-white shadow-[0_10px_30px_-10px_rgba(225,29,72,0.7)]">
                    <I.Check size={18} />
                  </div>
                  <div>
                    <div className="font-display font-bold text-lg">{p.t}</div>
                    <div className="mt-1 text-sm text-[var(--muted)]">{p.d}</div>
                  </div>
                </div>
              </Item>
            ))}
          </Stagger>
        </div>
      </div>
    </Section>
  );
};

const CoreViewer = () => {
  const pills = [
    { i: <I.Layers size={18} />, t: "60+ layouts", d: "Predefined hanging protocols" },
    { i: <I.Network size={18} />, t: "Sync viewports", d: "Ctrl+click to link scroll & W/L" },
    { i: <I.PlayCircle size={18} />, t: "Cine playback", d: "Frame-rate control on every series" },
    { i: <I.Filter size={18} />, t: "W/L presets", d: "Lung · Bone · Brain · Abdomen" },
    { i: <I.Maximize size={18} />, t: "Pan · Zoom · Rotate", d: "Flip & invert with single keys" },
    { i: <I.Search size={18} />, t: "Magnify + Probe", d: "HU readout in real time" },
    { i: <I.Sparkles size={18} />, t: "Image filters", d: "Sharpen / Smooth / Edge" },
    { i: <I.Eye size={18} />, t: "Dual viewer", d: "Cross-study comparison side-by-side" },
  ];
  const stats = [
    { v: "60+", l: "Hanging protocols" },
    { v: "412ms", l: "Median study load" },
    { v: "8", l: "Synced viewports" },
    { v: "v2", l: "Cornerstone.js engine" },
  ];

  return (
    <Section id="features" className="overflow-hidden">
      {/* Magazine-style header: title left, stats right */}
      <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-end">
        <div className="lg:col-span-7">
          <FadeUp><Eyebrow tone="rose">Core viewer</Eyebrow></FadeUp>
          <FadeUp delay={0.05}>
            <h2 className="font-display mt-5 text-5xl md:text-[68px] xl:text-[80px] font-bold leading-[1.02] tracking-tight">
              A workstation
              <br/>
              built <span className="italic text-grad-rose">by radiologists.</span>
            </h2>
          </FadeUp>
          <FadeUp delay={0.1}>
            <p className="mt-6 text-lg md:text-xl text-[var(--muted)] leading-relaxed max-w-xl">
              Sub-second study load. Multi-viewport sync. Sixty pre-built hanging protocols. Cornerstone.js v2 under the hood — desktop performance, browser-grade flexibility.
            </p>
          </FadeUp>
        </div>
        <div className="lg:col-span-5">
          <FadeUp delay={0.15}>
            <div className="grid grid-cols-2 gap-px bg-[var(--line)] border border-[var(--line)] rounded-2xl overflow-hidden">
              {stats.map(s => (
                <div key={s.l} className="bg-white dark:bg-white/[0.03] p-5">
                  <div className="font-display text-3xl md:text-4xl font-bold tracking-tight text-rose">{s.v}</div>
                  <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted)] mt-1.5 font-semibold">{s.l}</div>
                </div>
              ))}
            </div>
          </FadeUp>
        </div>
      </div>

      {/* Hero workstation screenshot — full bleed inside container */}
      <FadeUp delay={0.15}>
        <div className="mt-20 relative" style={{ perspective: '2200px' }}>
          {/* Decorative number marker */}
          <div className="hidden lg:block absolute -top-8 -left-2 font-display text-[180px] font-black leading-none text-ink/[0.04] dark:text-white/[0.06] select-none pointer-events-none">01</div>

          <HoverTilt max={6} scale={1.01}>
            <div className="relative rounded-3xl overflow-hidden shadow-[0_60px_120px_-40px_rgba(0,0,0,0.5)] border border-[var(--line)] bg-slate-900">
              <div className="flex items-center gap-1.5 px-5 py-2.5 bg-paper2 dark:bg-slate-800 border-b border-[var(--line)]">
                <span className="h-2.5 w-2.5 rounded-full bg-rose" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                <span className="ml-3 text-[11px] font-mono text-[var(--muted)] truncate">mediview · workstation · CHEST PA / MRI BRAIN / CT ABD / OB-USG</span>
                <span className="hidden md:inline ml-auto text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--muted)]">2×2 layout</span>
              </div>
              <img src="assets/viewer-2x2.png" alt="2x2 viewer" className="w-full block" />
            </div>
          </HoverTilt>

          {/* Floating telemetry chips */}
          <div className="hidden lg:flex absolute -left-6 top-24 bob z-10">
            <div className="glass rounded-2xl px-4 py-3 text-xs font-mono shadow-xl">
              <div className="flex items-center gap-2 text-[var(--muted)] uppercase tracking-[0.14em] text-[10px] font-bold">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"/> Load time
              </div>
              <div className="font-display font-bold text-2xl mt-1.5">412<span className="text-sm text-[var(--muted)] ml-0.5">ms</span></div>
              <div className="text-[10px] text-[var(--muted)] mt-0.5">128-slice CT · 0.625mm</div>
            </div>
          </div>
          <div className="hidden lg:flex absolute -right-6 bottom-28 bob-2 z-10">
            <div className="glass rounded-2xl px-4 py-3 text-xs font-mono shadow-xl">
              <div className="flex items-center gap-2 text-[var(--muted)] uppercase tracking-[0.14em] text-[10px] font-bold">
                <I.Network size={11}/> Multi-viewport
              </div>
              <div className="font-bold text-emerald-600 text-base mt-1.5 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500"/> 4 linked
              </div>
              <div className="text-[10px] text-[var(--muted)] mt-0.5">Scroll · W/L · Zoom</div>
            </div>
          </div>
          <div className="hidden xl:flex absolute right-12 -top-4 bob-3 z-10">
            <div className="glass rounded-2xl px-4 py-3 text-xs font-mono shadow-xl">
              <div className="flex items-center gap-2 text-[var(--muted)] uppercase tracking-[0.14em] text-[10px] font-bold">
                <I.Layers size={11}/> Layout
              </div>
              <div className="font-display font-bold text-base mt-1.5">Comparison · 2×2</div>
              <div className="text-[10px] text-[var(--muted)] mt-0.5">Press 4 to switch</div>
            </div>
          </div>
        </div>
      </FadeUp>

      {/* Feature grid — bigger, two-line cards */}
      <div className="mt-24 lg:mt-32">
        <FadeUp>
          <div className="flex items-baseline justify-between gap-6 mb-8 pb-5 border-b border-[var(--line)]">
            <h3 className="font-display text-2xl md:text-3xl font-bold">Tools that come standard.</h3>
            <span className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--muted)]">8 / 60+</span>
          </div>
        </FadeUp>
        <Stagger className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-[var(--line)] border border-[var(--line)] rounded-2xl overflow-hidden">
          {pills.map((p, i) => (
            <Item key={i}>
              <div className="group h-full bg-white dark:bg-white/[0.03] p-5 transition-colors hover:bg-rose-soft/40 dark:hover:bg-rose/[0.08]">
                <div className="h-10 w-10 grid place-items-center rounded-xl bg-rose-soft dark:bg-rose/15 text-rose group-hover:bg-rose group-hover:text-white transition-colors">{p.i}</div>
                <div className="mt-4 font-display font-bold text-base">{p.t}</div>
                <div className="mt-1 text-xs text-[var(--muted)] leading-relaxed">{p.d}</div>
              </div>
            </Item>
          ))}
        </Stagger>
      </div>

      {/* Live demo video */}
      <FadeUp delay={0.1}>
        <div className="mt-16 grid lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-3 lg:pt-6">
            <Eyebrow tone="rose">Live demo</Eyebrow>
            <h4 className="font-display mt-4 text-2xl md:text-3xl font-bold leading-tight">
              Watch a multi-modality session in real time.
            </h4>
            <p className="mt-3 text-sm text-[var(--muted)] leading-relaxed">
              No edits, no cuts. Recorded on a ₹50K mid-tier desktop running Mediview v2.4.
            </p>
          </div>
          <div className="lg:col-span-9 rounded-2xl overflow-hidden border border-[var(--line)] bg-slate-950 shadow-2xl">
            <div className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 border-b border-white/5">
              <span className="h-2.5 w-2.5 rounded-full bg-rose" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              <span className="ml-3 text-[11px] font-mono text-white/50">live demo · multi-modality workflow</span>
            </div>
            <LazyVideo src="assets/viewer-demo.mp4" aspect="16/9" className="w-full block" />
          </div>
        </div>
      </FadeUp>
    </Section>
  );
};

const Measurements = () => {
  const cols = [
    { title: "Geometric", icon: <I.Ruler size={18}/>, items: ["Length","Angle","Probe","Rectangle ROI","Elliptical ROI","Freehand ROI"] },
    { title: "Markup", icon: <I.Pen size={18}/>, items: ["Arrow","Text","Stamps (signatures + custom icons)","Polyline"] },
    { title: "Workflow", icon: <I.Layers size={18}/>, items: ["Per-image persistence","Undo / redo history","Multi-viewport replication","Color picker"] },
  ];
  return (
    <Section className="bg-paper2/40 dark:bg-white/[0.02] border-y border-[var(--line)]">
      <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        <div>
          <SectionHead
            layout="stack"
            eyebrow="Measurements & annotations"
            title={<>Pixel-perfect measurements. <span className="italic text-grad-rose">Replicated.</span></>}
            sub="Every annotation persists, replicates across linked viewports, and survives study re-opens."
          />
          <Stagger className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {cols.map((c, i) => (
              <Item key={i}>
                <div className="lift rounded-2xl border border-[var(--line)] bg-white dark:bg-white/[0.03] p-5 h-full">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 grid place-items-center rounded-lg bg-rose-soft dark:bg-rose/15 text-rose">{c.icon}</div>
                    <div className="font-display font-bold">{c.title}</div>
                  </div>
                  <ul className="mt-4 space-y-2">
                    {c.items.map(it => (
                      <li key={it} className="flex items-start gap-2 text-[13px] text-ink/80 dark:text-paper/80">
                        <I.Check size={14} className="mt-0.5 text-rose shrink-0" />
                        <span>{it}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Item>
            ))}
          </Stagger>
        </div>
        <FadeUp delay={0.15}>
          <HoverTilt max={6} scale={1.015}>
            <div className="relative rounded-2xl overflow-hidden border border-[var(--line)] bg-slate-950">
            <img src="assets/viewer-cr.png" alt="CR Viewer" className="w-full block" />
            <div className="absolute top-4 right-4 px-3 py-1.5 rounded-full bg-rose text-white text-[11px] font-mono shadow-[0_10px_30px_-10px_rgba(225,29,72,0.7)] animate-pulse">
              ROI 1 · 142 mm² · HU 38
            </div>
          </div>
          </HoverTilt>
        </FadeUp>
      </div>
    </Section>
  );
};

const MPR = () => (
  <Section>
    <SectionHead
      eyebrow="MPR · 3D reconstruction"
      title={<>True 3D from any <span className="italic text-grad-rose">CT or MR series.</span></>}
      sub="Axial. Sagittal. Coronal. Real-time. Synchronized."
      align="center"
    />
    <FadeUp delay={0.15}>
      <Parallax speed={-30}>
        <div className="mt-14 mx-auto max-w-5xl rounded-2xl overflow-hidden bg-black border border-white/10 rim-rose">
          <LazyVideo src="assets/mpr-loop.mp4" poster="assets/mpr-static.png" aspect="16/9" className="w-full block" />
        </div>
      </Parallax>
    </FadeUp>
    <Stagger className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-3 max-w-5xl mx-auto">
      {[
        { i: <I.Zap size={16}/>, t: "Real-time MPR" },
        { i: <I.Compass size={16}/>, t: "Custom oblique planes" },
        { i: <I.Network size={16}/>, t: "Synchronized cross-references" },
        { i: <I.Activity size={16}/>, t: "Scroll-through navigation" },
      ].map((p, i) => (
        <Item key={i}>
          <div className="lift rounded-xl border border-[var(--line)] bg-white dark:bg-white/[0.03] px-4 py-3 flex items-center gap-3">
            <div className="h-8 w-8 grid place-items-center rounded-lg bg-rose-soft dark:bg-rose/15 text-rose">{p.i}</div>
            <span className="text-sm font-medium">{p.t}</span>
          </div>
        </Item>
      ))}
    </Stagger>
  </Section>
);

Object.assign(window, { ProblemSolution, CoreViewer, Measurements, MPR });
