// Reusable visual blocks shared across pages: Hero, marquee strips, partner row, AI cards, Wallet, Pricing, etc.
// Kept minimal — heavy sections live in their original sections-x.jsx files.

// Marquee of trust hospitals
const HospitalMarquee = ({ tilt = 0, faded = true }) => {
  const hospitals = ['medanta', 'fortis', 'apollo', 'max', 'lilavati'];
  const row = [...hospitals, ...hospitals, ...hospitals];
  return (
    <div className={`relative overflow-hidden mask-reveal ${tilt === -1 ? 'tilt-l' : tilt === 1 ? 'tilt-r' : ''}`}>
      <div className="marquee-track flex items-center gap-12 w-max py-6">
        {row.map((h, i) => (
          <img key={i} src={`assets/hospital-${h}.png`} alt={h} loading="lazy" decoding="async" className={`h-9 w-auto object-contain shrink-0 ${faded ? 'grayscale opacity-60 dark:invert' : ''}`} />
        ))}
      </div>
    </div>
  );
};

// Big tag / scrolling word strip (motionsites-style)
const WordMarquee = ({ words, accent = "rose" }) => {
  const all = [...words, ...words, ...words];
  return (
    <div className="overflow-hidden border-y border-[var(--line)] py-6 bg-paper2/40 dark:bg-white/[0.02]">
      <div className="marquee-track flex gap-10 w-max items-center">
        {all.map((w, i) => (
          <div key={i} className="flex items-center gap-10 shrink-0">
            <span className={`font-display text-3xl md:text-5xl font-bold ${accent === 'teal' ? 'text-teal' : 'text-ink dark:text-paper'}`}>{w}</span>
            <span className={`h-2 w-2 rounded-full ${accent === 'teal' ? 'bg-teal' : 'bg-rose'}`} />
          </div>
        ))}
      </div>
    </div>
  );
};

// Stat row
const StatRow = ({ stats }) => (
  <Stagger className="grid grid-cols-2 md:grid-cols-4 gap-4">
    {stats.map((s, i) => (
      <Item key={i}>
        <div className="rounded-2xl border border-[var(--line)] bg-white/60 dark:bg-white/[0.03] p-6">
          <div className="font-display text-4xl md:text-5xl font-bold text-grad-rose">
            {typeof s.value === 'number' ? <Counter to={s.value} suffix={s.suffix || ''} /> : s.value}
          </div>
          <div className="mt-2 text-sm text-[var(--muted)]">{s.label}</div>
        </div>
      </Item>
    ))}
  </Stagger>
);

Object.assign(window, { HospitalMarquee, WordMarquee, StatRow });
