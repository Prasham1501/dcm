// Mediview Tweaks — three expressive controls that reshape the *feel* of the site.
//   1. Mood       → swaps brand palette + gradient + accent globally
//   2. Tempo      → calm / standard / punchy → scales spacing + animation speed
//   3. Surface    → paper / glass / print → swaps grain, glass-blur, gradient-text behavior
//
// Implemented by writing CSS custom-properties + body classnames; styles.css reads them.

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "mood": "editorial",
  "tempo": "standard",
  "surface": "paper",
  "italicHeads": true
}/*EDITMODE-END*/;

const MOODS = {
  editorial: {
    label: "Editorial",
    desc: "Crimson · amber · paper",
    brand: "#DC2626", brand2: "#B91C1C", brandSoft: "#FEE2E2",
    gold: "#F59E0B", teal: "#0891B2",
    gradFrom: "#DC2626", gradMid: "#F59E0B", gradTo: "#DC2626",
    bg: "#FFFFFF", bg2: "#F8FAFC",
    bgDark: "#0B1220", bg2Dark: "#111827",
    blob1: "rgba(220,38,38,0.45)",
    blob2: "rgba(245,158,11,0.35)",
    blob3: "rgba(8,145,178,0.30)",
  },
  clinical: {
    label: "Clinical",
    desc: "Cool blues · slate · sterile",
    brand: "#0369A1", brand2: "#075985", brandSoft: "#E0F2FE",
    gold: "#0EA5E9", teal: "#06B6D4",
    gradFrom: "#0EA5E9", gradMid: "#06B6D4", gradTo: "#0369A1",
    bg: "#F8FAFC", bg2: "#EFF6FF",
    bgDark: "#0A1628", bg2Dark: "#0F1E36",
    blob1: "rgba(3,105,161,0.45)",
    blob2: "rgba(6,182,212,0.35)",
    blob3: "rgba(139,92,246,0.25)",
  },
  vivid: {
    label: "Vivid",
    desc: "Electric magenta · teal · neon",
    brand: "#E11D74", brand2: "#BE185D", brandSoft: "#FCE7F3",
    gold: "#F59E0B", teal: "#14B8A6",
    gradFrom: "#E11D74", gradMid: "#A855F7", gradTo: "#06B6D4",
    bg: "#FFFFFF", bg2: "#FDF4FF",
    bgDark: "#0E0A1F", bg2Dark: "#1A0F2E",
    blob1: "rgba(225,29,116,0.55)",
    blob2: "rgba(168,85,247,0.45)",
    blob3: "rgba(20,184,166,0.40)",
  },
};

const TEMPOS = {
  calm:     { label: "Calm",     padScale: 1.25, animScale: 1.6, bob: "8s", marq: "70s" },
  standard: { label: "Standard", padScale: 1.0,  animScale: 1.0, bob: "5s", marq: "50s" },
  punchy:   { label: "Punchy",   padScale: 0.78, animScale: 0.6, bob: "3s", marq: "26s" },
};

const SURFACES = {
  paper: { label: "Paper",  desc: "Grain on · soft dots" },
  glass: { label: "Glass",  desc: "Glossy · no grain · blur" },
  print: { label: "Print",  desc: "Heavy grain · flat ink" },
};

// Apply tweaks → CSS variables + body classes
const applyTweaks = (t) => {
  const root = document.documentElement;
  const body = document.body;

  // Mood — overwrite :root and .dark CSS variables
  const m = MOODS[t.mood] || MOODS.editorial;
  const isDark = root.classList.contains('dark');
  root.style.setProperty('--brand',      m.brand);
  root.style.setProperty('--brand-2',    m.brand2);
  root.style.setProperty('--brand-soft', m.brandSoft);
  root.style.setProperty('--gold',       m.gold);
  root.style.setProperty('--teal',       m.teal);
  root.style.setProperty('--bg',  isDark ? m.bgDark  : m.bg);
  root.style.setProperty('--bg-2', isDark ? m.bg2Dark : m.bg2);
  root.style.setProperty('--grad-from', m.gradFrom);
  root.style.setProperty('--grad-mid',  m.gradMid);
  root.style.setProperty('--grad-to',   m.gradTo);
  root.style.setProperty('--blob-1', m.blob1);
  root.style.setProperty('--blob-2', m.blob2);
  root.style.setProperty('--blob-3', m.blob3);

  // Tempo
  const tempo = TEMPOS[t.tempo] || TEMPOS.standard;
  root.style.setProperty('--pad-scale',  tempo.padScale);
  root.style.setProperty('--anim-scale', tempo.animScale);
  root.style.setProperty('--bob-dur',    tempo.bob);
  root.style.setProperty('--marq-dur',   tempo.marq);

  // Surface — body classnames mv-surface-{name}
  body.classList.remove('mv-surface-paper','mv-surface-glass','mv-surface-print');
  body.classList.add(`mv-surface-${t.surface || 'paper'}`);

  // Italic heads toggle
  body.classList.toggle('mv-no-italic', !t.italicHeads);
};

const Tweaks = () => {
  const [tweaks, setTweaks] = useTweaks(TWEAK_DEFAULTS);

  // Apply on every change + first mount
  React.useEffect(() => { applyTweaks(tweaks); }, [tweaks]);

  // Re-apply when dark mode toggles (so bg colors swap correctly)
  React.useEffect(() => {
    const obs = new MutationObserver(() => applyTweaks(tweaks));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, [tweaks]);

  const moodOpts    = Object.entries(MOODS).map(([id, v]) => ({ value: id, label: v.label, sub: v.desc, swatch: [v.gradFrom, v.gradMid, v.gradTo] }));
  const tempoOpts   = Object.entries(TEMPOS).map(([id, v]) => ({ value: id, label: v.label }));
  const surfaceOpts = Object.entries(SURFACES).map(([id, v]) => ({ value: id, label: v.label, sub: v.desc }));

  return (
    <TweaksPanel title="Tweaks" subtitle="Reshape the feel">
      <TweakSection title="Mood" subtitle="Swaps the entire palette + gradients + accent">
        <div className="grid grid-cols-1 gap-1.5">
          {moodOpts.map(o => {
            const active = tweaks.mood === o.value;
            return (
              <button
                key={o.value}
                onClick={() => setTweaks({ mood: o.value })}
                className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition ${active ? 'border-rose bg-rose/10' : 'border-[var(--line)] hover:border-rose/50 bg-white/40 dark:bg-white/[0.03]'}`}
              >
                <span className="flex h-8 w-8 shrink-0 rounded-md overflow-hidden border border-black/10 dark:border-white/10">
                  {o.swatch.map((c, i) => <span key={i} style={{ background: c, flex: 1 }} />)}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold">{o.label}</span>
                  <span className="block text-[11px] text-[var(--muted)] truncate">{o.sub}</span>
                </span>
                {active && <span className="text-rose text-xs">●</span>}
              </button>
            );
          })}
        </div>
      </TweakSection>

      <TweakSection title="Tempo" subtitle="Page rhythm + motion speed">
        <div className="grid grid-cols-3 gap-1.5">
          {tempoOpts.map(o => {
            const active = tweaks.tempo === o.value;
            return (
              <button
                key={o.value}
                onClick={() => setTweaks({ tempo: o.value })}
                className={`px-2 py-2.5 rounded-lg border text-xs font-semibold transition ${active ? 'border-rose bg-rose text-white' : 'border-[var(--line)] hover:border-rose/50 bg-white/40 dark:bg-white/[0.03]'}`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </TweakSection>

      <TweakSection title="Surface" subtitle="Material world of the page">
        <div className="grid grid-cols-1 gap-1.5">
          {surfaceOpts.map(o => {
            const active = tweaks.surface === o.value;
            return (
              <button
                key={o.value}
                onClick={() => setTweaks({ surface: o.value })}
                className={`flex items-center justify-between px-3 py-2 rounded-lg border text-left transition ${active ? 'border-rose bg-rose/10' : 'border-[var(--line)] hover:border-rose/50 bg-white/40 dark:bg-white/[0.03]'}`}
              >
                <span>
                  <span className="block text-sm font-semibold">{o.label}</span>
                  <span className="block text-[11px] text-[var(--muted)]">{o.sub}</span>
                </span>
                {active && <span className="text-rose text-xs">●</span>}
              </button>
            );
          })}
        </div>
      </TweakSection>

      <TweakToggle
        label="Italic emphasis in headings"
        value={tweaks.italicHeads}
        onChange={v => setTweaks({ italicHeads: v })}
      />
    </TweaksPanel>
  );
};

window.Tweaks = Tweaks;
