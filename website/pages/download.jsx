// DOWNLOAD PAGE
const DownloadPage = () => (
  <div className="page-in">
    <PageHeader
      eyebrow="Download"
      title={<>Get Mediview running <span className="italic text-grad-rose">in minutes.</span></>}
      sub="Free 30-day trial. No credit card. Full feature unlock — Windows 10 / 11."
    />

    <Section>
      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        {/* Viewer download tile */}
        <FadeUp>
          <div className="lift rounded-3xl border border-rose/30 bg-gradient-to-br from-rose-soft via-white to-rose-soft/60 dark:from-rose/12 dark:via-white/[0.03] dark:to-rose/10 p-7 h-full">
            <Eyebrow tone="rose">DICOM Viewer · Recommended</Eyebrow>
            <h2 className="font-display mt-4 text-3xl md:text-4xl font-bold leading-[1.05]">Mediview Viewer</h2>
            <p className="mt-3 text-[var(--muted)] text-sm">Full DICOM workstation — MPR, AI reporting, print billing. Bundles XAMPP, MySQL, Orthanc.</p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
              {[['Size','~180 MB'],['OS','Win 10/11'],['Plan','from ₹8K/mo']].map(([k,v]) => (
                <div key={k} className="rounded-lg border border-[var(--line)] bg-white/60 dark:bg-white/[0.04] p-2">
                  <div className="text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] font-bold">{k}</div>
                  <div className="mt-0.5 font-mono font-semibold text-[12px]">{v}</div>
                </div>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Btn href="api/release/check?app=viewer&amp;current=0.0.0" variant="primary" size="md" icon={<I.Download size={15}/>}>Download Viewer</Btn>
              <Btn href="#/features" variant="ghost" size="md">See features</Btn>
            </div>
          </div>
        </FadeUp>
        {/* Bridge download tile — separate product */}
        <FadeUp delay={0.1}>
          <div className="lift rounded-3xl border border-amber-400/30 bg-gradient-to-br from-amber-50 via-white to-amber-50/60 dark:from-amber-500/[0.10] dark:via-white/[0.03] dark:to-amber-500/[0.06] p-7 h-full">
            <Eyebrow tone="gold">Bridge · Standalone product</Eyebrow>
            <h2 className="font-display mt-4 text-3xl md:text-4xl font-bold leading-[1.05]">Mediview Bridge</h2>
            <p className="mt-3 text-[var(--muted)] text-sm">Tray-only auto-print companion. Receives DICOM, routes per printer, prints silently. Needs its own license.</p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
              {[['Size','~50 MB'],['OS','Win 10/11'],['Plan','₹3K/mo']].map(([k,v]) => (
                <div key={k} className="rounded-lg border border-[var(--line)] bg-white/60 dark:bg-white/[0.04] p-2">
                  <div className="text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] font-bold">{k}</div>
                  <div className="mt-0.5 font-mono font-semibold text-[12px]">{v}</div>
                </div>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Btn href="api/release/check?app=bridge&amp;current=0.0.0" variant="primary" size="md" icon={<I.Download size={15}/>}>Download Bridge</Btn>
              <Btn href="#/bridge" variant="ghost" size="md">About Bridge</Btn>
            </div>
          </div>
        </FadeUp>
      </div>
      <FadeUp delay={0.15}>
        <div className="rounded-2xl border border-[var(--line)] bg-white dark:bg-white/[0.03] p-5 grid sm:grid-cols-4 gap-4 text-xs">
          {[
            ['Setup Guide PDF',     'api/download/setup-guide'],
            ['macOS Viewer',         null],
            ['Sample DICOMs (ZIP)',  null],
            ['Setup video (8 min)',  null],
          ].map(([t, href]) => (
            <a key={t} href={href || '#'} className={`flex items-center justify-between gap-2 ${href ? 'text-rose hover:underline font-semibold' : 'text-[var(--muted)]'}`}>
              <span>{t}</span>
              <I.ChevronRight size={14} className={href ? 'text-rose' : 'text-[var(--muted)]/40'}/>
            </a>
          ))}
        </div>
      </FadeUp>
    </Section>

    <Install />
    <SysReq />
    <Security />
    <FinalCTA />
  </div>
);
window.DownloadPage = DownloadPage;
