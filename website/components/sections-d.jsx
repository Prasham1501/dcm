// SECTIONS D — Install, Security, SysReq, Testimonials, FAQ, Final CTA

const Install = () => {
  const steps = [
    { n: 1, t: "Download the Windows installer", d: ".exe, ~180 MB", icon: <I.Download size={20}/> },
    { n: 2, t: "Run setup", d: "XAMPP / MySQL / Orthanc auto-install", icon: <I.Settings size={20}/> },
    { n: 3, t: "Activate license key", d: "DICOM-XXXX-XXXX-XXXX-XXXX format", icon: <I.Key size={20}/> },
    { n: 4, t: "Import patients, start reporting", d: "Drag DICOMs in, write reports out", icon: <I.PlayCircle size={20}/> },
  ];
  return (
    <Section id="download" className="bg-paper2/40 dark:bg-white/[0.02] border-y border-[var(--line)]">
      <SectionHead eyebrow="Installation" title={<>Up and running in <span className="italic text-grad-rose">four steps.</span></>} align="center"/>
      <Stagger className="mt-14 grid md:grid-cols-4 gap-4 relative">
        <div className="hidden md:block absolute top-12 left-[12%] right-[12%] h-px bg-gradient-to-r from-rose/40 via-rose to-rose/40 -z-10"/>
        {steps.map(s => (
          <Item key={s.n}>
            <div className="lift rounded-2xl border border-[var(--line)] bg-white dark:bg-white/[0.03] p-6 h-full text-center">
              <div className="mx-auto h-14 w-14 rounded-full bg-rose text-white grid place-items-center font-display font-bold text-xl shadow-[0_15px_40px_-10px_rgba(225,29,72,0.6)]">
                {s.n}
              </div>
              <div className="mt-5 font-display font-bold text-base">{s.t}</div>
              <p className="mt-2 text-sm text-[var(--muted)]">{s.d}</p>
            </div>
          </Item>
        ))}
      </Stagger>
      <div className="mt-12 text-center">
        <Btn variant="primary" size="lg" icon={<I.Windows size={17}/>} magnetic>Download Installer (Windows)</Btn>
        <div className="mt-3 text-xs text-[var(--muted)]">macOS coming soon</div>
      </div>
    </Section>
  );
};

const Security = () => {
  const items = [
    { i: <I.Shield size={18}/>, t: "HIPAA-aware architecture" },
    { i: <I.Users size={18}/>, t: "RBAC (Admin / Doctor / Viewer)" },
    { i: <I.FileText size={18}/>, t: "Audit logs" },
    { i: <I.Server size={18}/>, t: "Local data first" },
    { i: <I.Wifi size={18}/>, t: "7-day offline grace" },
    { i: <I.Lock size={18}/>, t: "AES-encrypted MySQL" },
    { i: <I.Banknote size={18}/>, t: "Razorpay UPI payment" },
    { i: <I.Brain size={18}/>, t: "Anonymized AI calls" },
  ];
  return (
    <Section>
      <SectionHead eyebrow="Security & compliance" title={<>Built for <span className="italic text-grad-rose">hospital-grade</span> trust.</>} align="center"/>
      <Stagger className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-3">
        {items.map((c, i) => (
          <Item key={i}>
            <div className="lift rounded-xl border border-[var(--line)] bg-white dark:bg-white/[0.03] px-4 py-3 flex items-center gap-3">
              <div className="h-9 w-9 grid place-items-center rounded-lg bg-rose-soft dark:bg-rose/15 text-rose">{c.i}</div>
              <span className="text-sm font-medium">{c.t}</span>
            </div>
          </Item>
        ))}
      </Stagger>
    </Section>
  );
};

const SysReq = () => {
  const cols = [
    { name: "Minimum", items: ["Dual-core CPU", "4 GB RAM", "20 GB storage", "Chrome 90+", "Windows 10+"] },
    { name: "Recommended", items: ["Quad-core+ CPU", "8 GB+ RAM", "100 GB+ for image storage", "10 Mbps+ network", "Windows 10 / 11"], hot: true },
  ];
  return (
    <Section className="bg-paper2/40 dark:bg-white/[0.02] border-y border-[var(--line)]">
      <SectionHead eyebrow="System requirements" title={<>Runs on the <span className="italic text-grad-rose">PC you already have.</span></>} align="center"/>
      <Stagger className="mt-12 grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        {cols.map((c, i) => (
          <Item key={i}>
            <div className={`rounded-2xl border p-7 h-full ${c.hot ? 'border-rose bg-gradient-to-br from-rose-soft to-white dark:from-rose/10 dark:to-white/[0.03]' : 'border-[var(--line)] bg-white dark:bg-white/[0.03]'}`}>
              <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-[var(--muted)]">{c.name}</div>
              <ul className="mt-4 space-y-2.5">
                {c.items.map(it => (
                  <li key={it} className="flex items-start gap-2 text-sm">
                    <I.Check size={14} className="mt-0.5 text-rose shrink-0"/>{it}
                  </li>
                ))}
              </ul>
            </div>
          </Item>
        ))}
      </Stagger>
    </Section>
  );
};

const Testimonials = () => {
  const tt = [
    { q: "Mediview cut my obstetric reporting time by 70%. The AI catches percentile outliers I'd skim past at 9 PM.", n: "Dr. Rohan Patel", r: "Sonologist, Mumbai", a: "doctor-1" },
    { q: "We installed Mediview across 4 of our centres. Single license server, per-machine billing — finally, our print costs make sense.", n: "Dr. Ananya Sharma", r: "Radiology Head, Multi-Specialty Hospital, Delhi", a: "doctor-2" },
    { q: "The MPR is as smooth as my Philips workstation. At one-tenth the price.", n: "Dr. Karthik Iyer", r: "Consultant Radiologist, Bangalore", a: "doctor-3" },
  ];
  const all = [...tt, ...tt];
  return (
    <Section className="overflow-hidden">
      <SectionHead eyebrow="Testimonials" title={<>From the doctors <span className="italic text-grad-rose">who use it daily.</span></>} align="center"/>
      <FadeUp delay={0.1}>
        <div className="mt-14 relative overflow-hidden">
          <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-paper to-transparent dark:from-midnight z-10 pointer-events-none"/>
          <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-paper to-transparent dark:from-midnight z-10 pointer-events-none"/>
          <div className="marquee-track flex gap-6 w-max">
            {all.map((t, i) => (
              <div key={i} className="w-[420px] shrink-0 rounded-2xl border border-[var(--line)] bg-white dark:bg-white/[0.03] p-7">
                <div className="flex gap-1 text-rose text-sm">{'★★★★★'}</div>
                <p className="mt-4 font-display text-lg leading-snug">"{t.q}"</p>
                <div className="mt-5 flex items-center gap-3">
                  <img src={`assets/${t.a}.png`} alt={t.n} className="h-12 w-12 rounded-full object-cover border-2 border-rose/30"/>
                  <div>
                    <div className="font-semibold">{t.n}</div>
                    <div className="text-xs text-[var(--muted)]">{t.r}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </FadeUp>
    </Section>
  );
};

const FAQ = () => {
  const items = [
    ["Does Mediview work offline?", "Yes. Once activated, you get a 7-day offline grace period. The license re-validates with our servers every 24 hours when online."],
    ["One license = one PC?", "Correct. Each license is bound to a machine fingerprint. You can deactivate from one PC and move to another from your dashboard."],
    ["How does print billing work?", "Every print is metered against your wallet. Recharge via UPI. GST invoices auto-generated."],
    ["Can I use my existing PACS?", "Yes — Mediview connects to any DICOM-compliant PACS, including Orthanc, DCM4CHEE, and most hospital PACS via DIMSE/STOW-RS."],
    ["Which AI model — is patient data sent to Google?", "Mediview uses a Gemini-based image analysis pipeline. Patient identifiers (PHI) are stripped before any image leaves your machine. Only pixel data + de-identified DICOM tags are sent."],
    ["What hardware do I need?", "Minimum dual-core, 4 GB RAM, 20 GB free storage. Recommended: quad-core, 8 GB RAM, 100 GB. Windows 10 or 11."],
    ["Can I generate GST invoices for print credits?", "Yes — every recharge generates a GST-compliant invoice automatically."],
    ["Refund / trial policy?", "30-day free trial — no credit card. Annual plans: 7-day money-back guarantee. Print credits are non-refundable but never expire."],
  ];
  const [open, setOpen] = React.useState(0);
  return (
    <Section id="faq" className="bg-paper2/40 dark:bg-white/[0.02] border-y border-[var(--line)]">
      <SectionHead eyebrow="FAQ" title={<>Questions, <span className="italic text-grad-rose">answered.</span></>} align="center"/>
      <div className="mt-12 max-w-3xl mx-auto space-y-3">
        {items.map(([q, a], i) => {
          const isOpen = open === i;
          return (
            <FadeUp key={i} delay={i * 0.04}>
              <div className={`rounded-2xl border bg-white dark:bg-white/[0.03] transition-all ${isOpen ? 'border-rose/40 shadow-[0_15px_40px_-25px_rgba(225,29,72,0.4)]' : 'border-[var(--line)]'}`}>
                <button onClick={() => setOpen(isOpen ? -1 : i)} className="w-full text-left p-5 flex items-center justify-between gap-4">
                  <span className="font-display font-semibold text-base md:text-lg">{q}</span>
                  <span className={`h-8 w-8 grid place-items-center rounded-full transition-all ${isOpen ? 'bg-rose text-white rotate-45' : 'bg-paper2 dark:bg-white/5'}`}>
                    <I.Plus size={16}/>
                  </span>
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 -mt-1 text-sm leading-relaxed text-[var(--muted)]">{a}</div>
                )}
              </div>
            </FadeUp>
          );
        })}
      </div>
    </Section>
  );
};

const FinalCTA = () => (
  <section className="relative overflow-hidden">
    <div className="absolute inset-0 bg-gradient-to-br from-rose via-rose-dark to-[#7f1d1d]"/>
    <div className="absolute inset-0 dotgrid opacity-30 mix-blend-overlay"/>
    <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-amber-300/30 blur-3xl"/>
    <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-rose-200/30 blur-3xl"/>
    <div className="relative mx-auto max-w-5xl px-6 lg:px-10 py-24 md:py-32 text-center text-white">
      <FadeUp><Eyebrow tone="gold" className="bg-white/15 text-white border-white/30">Ready when you are</Eyebrow></FadeUp>
      <FadeUp delay={0.05}>
        <h2 className="font-display mt-6 text-5xl md:text-7xl font-bold leading-[1.02] tracking-tight">
          Stop scrolling. <span className="italic text-amber-200">Start diagnosing.</span>
        </h2>
      </FadeUp>
      <FadeUp delay={0.1}>
        <p className="mt-6 text-lg md:text-xl text-white/85 max-w-2xl mx-auto">Download the 30-day free trial. No credit card. Full feature unlock.</p>
      </FadeUp>
      <FadeUp delay={0.2}>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Btn variant="light" size="lg" icon={<I.Windows size={17}/>} magnetic>Download Free Trial</Btn>
          <Btn variant="dark" size="lg" icon={<I.Key size={16}/>}>Buy Annual License — ₹1,00,000</Btn>
        </div>
      </FadeUp>
    </div>
  </section>
);

Object.assign(window, { Install, Security, SysReq, Testimonials, FAQ, FinalCTA });
