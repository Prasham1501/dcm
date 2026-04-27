// DOWNLOAD PAGE
const DownloadPage = () => (
  <div className="page-in">
    <PageHeader
      eyebrow="Download"
      title={<>Get Mediview running <span className="italic text-grad-rose">in minutes.</span></>}
      sub="Free 30-day trial. No credit card. Full feature unlock — Windows 10 / 11."
    />

    <Section>
      <div className="grid lg:grid-cols-3 gap-6">
        <FadeUp>
          <div className="lg:col-span-2 lift rounded-3xl border border-rose/30 bg-gradient-to-br from-rose-soft via-white to-amber-50 dark:from-rose/12 dark:via-white/[0.03] dark:to-amber-500/10 p-8 md:p-10">
            <Eyebrow tone="rose">Recommended</Eyebrow>
            <h2 className="font-display mt-5 text-4xl md:text-5xl font-bold leading-[1.05]">Mediview Installer · v3.4.0</h2>
            <p className="mt-4 text-[var(--muted)] max-w-xl">Single .exe — bundles XAMPP, MySQL, Orthanc, and Mediview. No technical setup required.</p>
            <div className="mt-6 grid sm:grid-cols-3 gap-3">
              {[["Size","~180 MB"], ["Platform","Windows 10/11"], ["Released","12 Apr 2026"]].map(([k,v]) => (
                <div key={k} className="rounded-xl border border-[var(--line)] bg-white/60 dark:bg-white/[0.04] p-3">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--muted)] font-bold">{k}</div>
                  <div className="mt-1 font-mono font-semibold">{v}</div>
                </div>
              ))}
            </div>
            <div className="mt-7 flex flex-wrap gap-3">
              <Btn variant="primary" size="lg" icon={<I.Download size={17}/>} magnetic>Download for Windows</Btn>
              <Btn variant="ghost" size="lg" icon={<I.FileText size={16}/>}>Setup Guide PDF</Btn>
            </div>
          </div>
        </FadeUp>
        <FadeUp delay={0.1}>
          <div className="rounded-3xl border border-[var(--line)] bg-white dark:bg-white/[0.03] p-7 h-full">
            <div className="font-display font-bold text-lg">Other downloads</div>
            <ul className="mt-5 space-y-4">
              {[
                ["macOS", "Coming Q3 2026", false],
                ["Linux (.deb)", "Beta · on request", false],
                ["Sample DICOMs", "ZIP · 240 MB", true],
                ["Setup video", "8 min · YouTube", true],
              ].map(([t,d,active]) => (
                <li key={t} className="flex items-center justify-between">
                  <div>
                    <div className={`font-semibold ${active ? '' : 'text-[var(--muted)]'}`}>{t}</div>
                    <div className="text-xs text-[var(--muted)]">{d}</div>
                  </div>
                  <I.ChevronRight size={16} className={active ? 'text-rose' : 'text-[var(--muted)]/40'}/>
                </li>
              ))}
            </ul>
          </div>
        </FadeUp>
      </div>
    </Section>

    <Install />
    <SysReq />
    <Security />
    <FinalCTA />
  </div>
);
window.DownloadPage = DownloadPage;
