// SECTIONS B — AI section, Specialty, Reporting (refreshed)

const AISection = () => {
  const cards = [
    { t: "Whole-study analysis", d: "Send the entire study. AI fetches every image from your PACS, runs OCR on the ultrasound machine's on-screen measurements (FL, AC, BPD, HC, EFW, GA, EDD with percentiles), cross-checks gestational age, and returns a structured impression in under 30 seconds.", icon: <I.Brain size={22}/> },
    { t: "Multi-strategy extraction", d: "DICOM Structured Reports → DICOM tags → Tesseract OCR → vision fallback. We never miss a number.", icon: <I.Layers size={22}/> },
    { t: "Doctor-in-the-loop", d: "Every AI finding has a confidence score, urgency flags, and a feedback button. Your corrections retrain the model for your hospital.", icon: <I.Stethoscope size={22}/> },
  ];
  return (
    <Section id="ai" className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-teal-soft/40 via-paper to-paper dark:from-teal/5 dark:via-midnight dark:to-midnight"/>
      <div className="absolute inset-0 -z-10"><Blobs tone="teal"/></div>

      <SectionHead
        eyebrow="AI · second-opinion radiologist"
        eyebrowTone="teal"
        title={<>Your <span className="italic text-grad-teal">always-on</span> reading partner.</>}
        sub="OCR-grade measurement extraction. Specialty templates for obstetric, abdominal, pelvic, thyroid, cardiac, and vascular studies."
        align="center"
      />

      <Stagger className="mt-16 grid md:grid-cols-3 gap-6">
        {cards.map((c, i) => (
          <Item key={i}>
            <Spotlight>
              <div className="glass lift lift-teal rounded-2xl p-7 h-full border border-teal/15">
                <div className="h-12 w-12 grid place-items-center rounded-xl bg-teal text-white shadow-[0_15px_40px_-10px_rgba(14,124,123,0.6)]">{c.icon}</div>
                <h3 className="mt-5 font-display font-bold text-xl">{c.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{c.d}</p>
              </div>
            </Spotlight>
          </Item>
        ))}
      </Stagger>

      {/* AI showcase — single hero panel: live build video front and center */}
      <FadeUp delay={0.1}>
        <div className="mt-16 mx-auto max-w-5xl">
          <HoverTilt max={4} scale={1.01}>
            <div className="rounded-2xl overflow-hidden border border-teal/30 bg-slate-950 shadow-[0_60px_140px_-40px_rgba(8,145,178,0.5)]">
              <div className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-900 border-b border-white/5">
                <span className="h-2.5 w-2.5 rounded-full bg-rose" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                <span className="ml-3 text-[11px] font-mono text-white/50">mediview · ai radiologist · obstetric study</span>
                <span className="ml-auto flex items-center gap-1.5 text-[11px] font-mono text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"/> generating · 28 tok/s
                </span>
              </div>
              <LazyVideo src="assets/ai-report-build.mp4" aspect="16/10" className="w-full block" />
              <div className="px-5 py-3 bg-slate-900/60 border-t border-white/10 flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] font-mono text-white/60">
                <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-teal"/> EFW 1142g (P52)</span>
                <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-teal"/> AFI 14.2 cm</span>
                <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-teal"/> Placenta · anterior · grade II</span>
                <span className="ml-auto px-2 py-0.5 rounded-full bg-teal/20 text-teal font-bold">94% confidence</span>
              </div>
            </div>
          </HoverTilt>
        </div>
      </FadeUp>

      {/* Output sample — separate, smaller, contextual */}
      <FadeUp delay={0.2}>
        <div className="mt-10 grid lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-2">
            <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-teal">What you get</div>
            <h3 className="font-display mt-3 text-2xl md:text-3xl font-bold leading-[1.15] tracking-tight">
              A signed-off radiology report. <span className="italic text-grad-teal">In your hospital's letterhead.</span>
            </h3>
            <p className="mt-4 text-[15px] text-[var(--muted)] leading-relaxed max-w-xl">
              Every measurement extracted, cross-checked against gestational age, and laid out in your hospital's templated format. Edit, sign, and send — the AI does the typing, you do the diagnosis.
            </p>
            <div className="mt-6 grid sm:grid-cols-2 gap-3 max-w-xl">
              {[
                ['28 sec','avg report time'],
                ['97%','measurement accuracy'],
                ['12+','specialty templates'],
                ['100%','editable output'],
              ].map(([v, l]) => (
                <div key={l} className="rounded-xl border border-[var(--line)] bg-white/60 dark:bg-white/[0.03] p-4">
                  <div className="font-display text-2xl font-bold text-teal">{v}</div>
                  <div className="text-[11px] uppercase tracking-[0.14em] text-[var(--muted)] mt-1">{l}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="relative">
            <div className="rounded-xl overflow-hidden border border-[var(--line)] bg-white shadow-[0_30px_80px_-20px_rgba(8,145,178,0.35)] tilt-r">
              <img src="assets/ai-report.png" alt="Sample AI report" className="w-full block" />
            </div>
            <div className="absolute -bottom-3 -left-3 px-3 py-1.5 rounded-full bg-teal text-white text-[10px] font-bold uppercase tracking-[0.16em] shadow-lg">Sample output</div>
          </div>
        </div>
      </FadeUp>

      <FadeUp delay={0.1}>
        <div className="mt-12 rounded-2xl border-2 border-teal/40 bg-teal-soft/40 dark:bg-teal/5 p-6 md:p-7 flex flex-col md:flex-row gap-4 md:items-center">
          <div className="h-12 w-12 shrink-0 grid place-items-center rounded-xl bg-teal text-white"><I.Lock size={20}/></div>
          <div className="flex-1">
            <div className="font-display font-bold text-lg">Patient identifiers are anonymized before any data leaves your machine.</div>
            <div className="text-sm text-[var(--muted)] mt-1">PHI never reaches the AI provider. Only pixel data and de-identified DICOM tags are sent.</div>
          </div>
        </div>
      </FadeUp>

      <p className="mt-6 text-center text-xs text-[var(--muted)]">AI-assisted preliminary analysis. All findings reviewed by a qualified radiologist.</p>
    </Section>
  );
};

const Specialty = () => {
  const tiles = [
    { i: <I.Baby size={20}/>, t: "Obstetric", d: "Auto-detects FL/AC/BPD/HC/EFW + percentiles." },
    { i: <I.Activity size={20}/>, t: "Abdominal", d: "Liver, kidney, spleen, gallbladder findings." },
    { i: <I.Circle size={20}/>, t: "Pelvic", d: "Uterus, ovaries, follicle counts, endometrium." },
    { i: <I.Triangle size={20}/>, t: "Thyroid / Small parts", d: "TI-RADS scoring, nodule characterization." },
    { i: <I.Heart size={20}/>, t: "Cardiac", d: "Chamber dimensions, EF, valve flow patterns." },
    { i: <I.Network size={20}/>, t: "Vascular", d: "Doppler waveforms, stenosis grading." },
  ];
  return (
    <Section className="bg-paper2/40 dark:bg-white/[0.02] border-y border-[var(--line)]">
      <SectionHead eyebrow="Specialty templates" title={<>Trained for the scans <span className="italic text-grad-rose">you actually do.</span></>} align="center" />
      <Stagger className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tiles.map((tile, i) => (
          <Item key={i}>
            <Spotlight>
              <div className="lift rounded-2xl border border-[var(--line)] bg-white dark:bg-white/[0.03] p-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 grid place-items-center rounded-lg bg-rose-soft dark:bg-rose/15 text-rose">{tile.i}</div>
                  <div className="font-display font-bold text-lg">{tile.t}</div>
                </div>
                <p className="mt-3 text-sm text-[var(--muted)]">{tile.d}</p>
              </div>
            </Spotlight>
          </Item>
        ))}
      </Stagger>
    </Section>
  );
};

const Reporting = () => {
  const bullets = ["Template library per scan type","Click-to-insert findings","Growth charts for obstetric","Draft / final / printed states","Digital signatures","One-click PDF + print"];
  return (
    <Section id="reporting">
      <div className="grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <SectionHead layout="stack" eyebrow="Reporting" title={<>Reports your doctors <span className="italic text-grad-rose">actually use.</span></>} sub="Hospital letterhead. Templated by scan type. Signed, sealed, printed in one click." />
          <Stagger className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
            {bullets.map(b => (
              <Item key={b}>
                <div className="flex items-start gap-2 text-sm">
                  <I.Check size={16} className="mt-0.5 text-rose shrink-0" />
                  <span>{b}</span>
                </div>
              </Item>
            ))}
          </Stagger>
        </div>
        <FadeUp delay={0.15}>
          <Parallax speed={-25}>
            <div className="relative">
              <div className="relative bg-white text-ink rounded-xl shadow-2xl border border-line p-8 max-w-md mx-auto" style={{ aspectRatio: '0.75' }}>
                <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
                  <div>
                    <div className="font-display font-bold text-lg">Apex Diagnostic Centre</div>
                    <div className="text-[10px] text-[var(--muted)]">Mumbai · GST 27ABCDE1234F1Z5</div>
                  </div>
                  <I.Cross size={26} className="text-rose"/>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-[11px]">
                  <div><span className="text-[var(--muted)]">Patient</span><div className="font-semibold">Priya Sharma</div></div>
                  <div><span className="text-[var(--muted)]">Study</span><div className="font-semibold">USG Obstetric</div></div>
                  <div><span className="text-[var(--muted)]">Age</span><div className="font-semibold">28 Y / F</div></div>
                  <div><span className="text-[var(--muted)]">Date</span><div className="font-semibold">25-04-2026</div></div>
                </div>
                <div className="mt-4 text-[11px] font-bold uppercase text-rose">Findings</div>
                <div className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-ink/80">
                  <div>• Single live intrauterine fetus, cephalic presentation.</div>
                  <div>• Fetal heart rate: <span className="font-mono font-bold">142 bpm</span>.</div>
                  <div>• Estimated fetal weight: <span className="font-mono font-bold">2719 g ± 397g</span> (Hadlock).</div>
                  <div>• Placenta: posterior, grade II maturity.</div>
                </div>
                <div className="mt-4 text-[11px] font-bold uppercase text-rose">Impression</div>
                <div className="mt-2 text-[11px] leading-relaxed text-ink/80">
                  Single live intrauterine pregnancy of <span className="font-mono">36w 4d</span>. EFW corresponds to 27.8th percentile — appropriate for gestational age.
                </div>
                <div className="mt-6 flex justify-end">
                  <div className="text-right">
                    <div className="font-display italic text-rose text-sm">Dr. R. Patel</div>
                    <div className="text-[9px] text-[var(--muted)]">DMRD · MD Radiodiagnosis</div>
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-3 -right-3 bg-emerald-500 text-white rounded-full px-3 py-1.5 text-[11px] font-mono shadow-lg flex items-center gap-1.5">
                <I.Check size={12}/> SIGNED · v3
              </div>
            </div>
          </Parallax>
        </FadeUp>
      </div>
    </Section>
  );
};

Object.assign(window, { AISection, Specialty, Reporting });
