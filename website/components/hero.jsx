// HERO — refreshed: split layout, mask-reveal headline, parallax video, magnetic CTAs.
const useTypewriter = (phrases, speed = 70, pause = 1500) => {
  const [text, setText] = React.useState("");
  const [phraseIdx, setPhraseIdx] = React.useState(0);
  const [del, setDel] = React.useState(false);
  React.useEffect(() => {
    const cur = phrases[phraseIdx];
    if (!del && text === cur) { const t = setTimeout(() => setDel(true), pause); return () => clearTimeout(t); }
    if (del && text === "") { setDel(false); setPhraseIdx((phraseIdx + 1) % phrases.length); return; }
    const t = setTimeout(() => setText(del ? cur.slice(0, text.length - 1) : cur.slice(0, text.length + 1)), del ? speed/2 : speed);
    return () => clearTimeout(t);
  }, [text, del, phraseIdx, phrases, speed, pause]);
  return text;
};

const OrbitalCard = ({ label, value, unit, accent = "rose", className = "" }) => {
  const palette = accent === "teal"
    ? "from-teal/20 to-teal/5 border-teal/40"
    : accent === "gold"
    ? "from-amber-400/20 to-amber-500/5 border-amber-300/50"
    : "from-rose/20 to-rose/5 border-rose/40";
  return (
    <div className={`absolute ${className} pointer-events-none`}>
      <div className={`rounded-xl px-4 py-3 min-w-[150px] shadow-2xl border bg-gradient-to-br ${palette} backdrop-blur-xl bg-slate-950/55`}>
        <div className="text-[10px] uppercase tracking-[0.18em] text-white/60 font-bold">{label}</div>
        <div className="mt-1 flex items-baseline gap-1">
          <span className="font-display text-2xl font-bold text-white tabnums">{value}</span>
          {unit && <span className="text-xs text-white/70">{unit}</span>}
        </div>
      </div>
    </div>
  );
};

const Hero = () => {
  const typed = useTypewriter(["See more.", "Diagnose faster.", "Bill accurately."], 80, 1400);

  return (
    <section id="top" className="relative pt-28 pb-16 md:pt-36 md:pb-24 overflow-hidden">
      <div className="absolute inset-0 -z-10 dotgrid"/>
      <div className="absolute inset-0 -z-10">
        <div className="blob bg-rose/30 -top-40 -right-32 w-[700px] h-[700px]" />
        <div className="blob bg-amber-300/30 top-1/2 -left-40 w-[600px] h-[600px]" style={{ animationDelay: '-6s' }} />
        <div className="blob bg-teal/20 bottom-0 right-1/3 w-[400px] h-[400px]" style={{ animationDelay: '-12s' }} />
      </div>

      <div className="mx-auto max-w-7xl px-6 lg:px-10 grid lg:grid-cols-12 gap-10 lg:gap-12 items-center relative">
        <div className="lg:col-span-6">
          <FadeUp>
            <Eyebrow tone="rose"><span>🇮🇳</span> Made in India · For Indian hospitals</Eyebrow>
          </FadeUp>

          <FadeUp delay={0.1}>
            <h1 className="font-display mt-6 text-5xl md:text-6xl lg:text-[72px] font-bold leading-[1.05] tracking-tight">
              <span className="text-ink dark:text-paper">{typed || '\u00A0'}</span>
              <span className="caret inline-block w-[3px] h-[0.78em] align-[-0.05em] ml-1 bg-rose" />
              <br />
              <span className="italic font-medium text-grad-rose">One workstation.</span>
              <br />
              <span className="text-ink/40 dark:text-paper/40 font-light">Every modality.</span>
            </h1>
          </FadeUp>

          <FadeUp delay={0.5}>
            <p className="mt-7 max-w-xl text-lg text-[var(--muted)] leading-relaxed">
              A complete radiology workstation — DICOM viewer, AI reporting, multi-viewport, integrated PACS, and per-print billing — in one Windows installer.
            </p>
          </FadeUp>

          <FadeUp delay={0.6}>
            <div className="mt-9 flex flex-wrap gap-3">
              <Btn href="#/download" variant="primary" size="lg" icon={<I.Windows size={17}/>} magnetic>Download Free Trial</Btn>
              <Btn href="#/pricing" variant="ghost" size="lg" icon={<I.Key size={16}/>}>Buy License Key</Btn>
            </div>
          </FadeUp>
        </div>

        <FadeUp delay={0.25} className="lg:col-span-6 relative">
          <Parallax speed={-40}>
            <div className="relative">
              <div className="absolute inset-10 rounded-full pulsering border border-rose/30" />
              <div className="absolute inset-16 rounded-full pulsering border border-teal/30" style={{ animationDelay: '0.8s' }} />

              <div className="relative rounded-3xl overflow-hidden rim-rose bg-slate-950 aspect-[4/3]">
                {/* preload="none" so the 22 MB MP4 doesn't block first paint
                 * or the connection pool. The poster (~2 MB) carries the
                 * hero visually while the video lazily loads later. */}
                <video src="assets/hero-volume.mp4" poster="assets/hero-volume-poster.png" autoPlay loop muted playsInline preload="none" className="w-full h-full object-cover" />
                <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/10 rounded-3xl" />
                <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/55 backdrop-blur border border-white/10 text-[11px] font-mono text-white/80">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  LIVE · CHEST CT · VOL RENDER
                </div>
                <div className="absolute bottom-4 right-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/55 backdrop-blur border border-white/10 text-[11px] font-mono text-white/80">
                  <I.Cube size={12} /> 256 slices
                </div>
              </div>

              <div className="bob-3"><OrbitalCard label="EFW" value="2719" unit="g ±397g" accent="gold" className="-right-6 bottom-20 md:-right-10" /></div>
              <div className="bob-4"><OrbitalCard label="AI Confidence" value="94" unit="%" accent="teal" className="-left-4 bottom-10 md:-left-10" /></div>
            </div>
          </Parallax>

          <div className="mt-7 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/60 dark:bg-white/5 border border-[var(--line)]">
              <I.Sparkles size={12} className="text-teal" /> Cornerstone.js v2
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/60 dark:bg-white/5 border border-[var(--line)]">
              <I.Brain size={12} className="text-teal" /> AI-assisted
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/60 dark:bg-white/5 border border-[var(--line)]">
              <I.Shield size={12} className="text-emerald-600" /> HIPAA-aware
            </span>
          </div>
        </FadeUp>
      </div>
    </section>
  );
};

window.Hero = Hero;

// TRUSTED BAND — full-bleed strip of hospital logos + stats, sits below hero
const TrustedBand = () => {
  const hospitals = [
    { id: 'medanta', name: 'Medanta' },
    { id: 'fortis', name: 'Fortis' },
    { id: 'apollo', name: 'Apollo' },
    { id: 'max', name: 'Max Healthcare' },
    { id: 'lilavati', name: 'Lilavati' },
  ];
  return (
    <section className="relative border-y border-[var(--line)] bg-paper2/60 dark:bg-white/[0.02] overflow-hidden">
      <div className="absolute inset-0 dotgrid opacity-30 -z-10"/>
      <div className="mx-auto max-w-7xl px-6 lg:px-10 py-14 md:py-16">
        <FadeUp>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 md:gap-10">
            <div>
              <div className="text-[11px] uppercase tracking-[0.24em] font-bold text-rose">Trusted by radiologists at</div>
              <h2 className="font-display mt-3 text-3xl md:text-4xl font-bold leading-[1.1] tracking-tight max-w-xl">
                12 hospitals. <span className="italic text-grad-rose">240+ workstations.</span>
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-x-8 gap-y-3 text-sm text-[var(--muted)]">
              <div className="flex items-baseline gap-2">
                <span className="font-display text-2xl font-bold text-ink dark:text-paper"><Counter to={1200000} /></span>
                <span className="text-xs">studies read</span>
              </div>
              <div className="h-6 w-px bg-[var(--line)]"/>
              <div className="flex items-baseline gap-2">
                <span className="font-display text-2xl font-bold text-ink dark:text-paper">99.9<span className="text-rose">%</span></span>
                <span className="text-xs">uptime</span>
              </div>
              <div className="h-6 w-px bg-[var(--line)]"/>
              <div className="flex items-baseline gap-2">
                <span className="font-display text-2xl font-bold text-ink dark:text-paper">412<span className="text-rose">ms</span></span>
                <span className="text-xs">avg load</span>
              </div>
            </div>
          </div>
        </FadeUp>
        <FadeUp delay={0.15}>
          <div className="mt-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 items-center gap-x-6 gap-y-8">
            {hospitals.map(h => (
              <div key={h.id} className="flex flex-col items-center justify-center group">
                <img
                  src={`assets/hospital-${h.id}.png`}
                  alt={h.name}
                  className="h-14 md:h-16 w-auto object-contain opacity-70 group-hover:opacity-100 transition grayscale group-hover:grayscale-0 dark:invert"
                />
                <div className="mt-3 text-[10px] uppercase tracking-[0.2em] font-bold text-[var(--muted)] group-hover:text-rose transition">{h.name}</div>
              </div>
            ))}
          </div>
        </FadeUp>
      </div>
    </section>
  );
};

window.TrustedBand = TrustedBand;
