// PRICING PAGE
const PricingPage = () => (
  <div className="page-in">
    <PageHeader
      eyebrow="Pricing & wallet"
      title={<>Pay once, or <span className="italic text-grad-rose">monthly.</span></>}
      sub="Free 30-day trial — no credit card. Annual licenses include 1,000 free A4 B&W print credits. Print credits sold separately and never expire."
    />
    <Pricing />
    {/* Bridge — separately priced, separately licensed product. */}
    <Section className="bg-paper2/40 dark:bg-white/[0.02] border-y border-[var(--line)]">
      <SectionHead eyebrow="Bridge — separate product" title={<>Add the auto-print tray app for <span className="italic text-grad-rose">₹3,000/month</span>.</>} align="center"
        sub="Bridge has its own installer, its own license key, and its own price. Buy only what you use."/>
      <Stagger className="mt-12 grid md:grid-cols-2 gap-5 max-w-3xl mx-auto">
        {[
          { name: 'Bridge Monthly', price: '₹3,000', period: 'per machine / month', cta: 'Buy Bridge Monthly', href: 'dashboard.html#/dashboard/licenses?product=bridge' },
          { name: 'Bridge Annual',  price: '₹30,000', period: 'per machine / year · save ₹6,000', cta: 'Buy Bridge Annual', href: 'dashboard.html#/dashboard/licenses?product=bridge', popular: true },
        ].map((c, i) => (
          <Item key={i}>
            <div className={`rounded-2xl border p-7 h-full flex flex-col ${c.popular ? 'border-amber-400 bg-gradient-to-br from-amber-50 to-white dark:from-amber-500/15 dark:to-white/[0.03] shadow-[0_30px_70px_-30px_rgba(245,158,11,0.5)]' : 'border-[var(--line)] bg-white dark:bg-white/[0.03]'}`}>
              {c.popular && <div className="self-start mb-3 px-2.5 py-1 rounded-full bg-amber-500 text-white text-[10px] font-bold uppercase tracking-[0.16em]">Save ₹6,000</div>}
              <div className="text-[11px] uppercase tracking-[0.16em] font-bold text-[var(--muted)]">{c.name}</div>
              <div className="mt-3 font-display text-4xl font-bold">{c.price}</div>
              <div className="text-xs text-[var(--muted)] mt-1">{c.period}</div>
              <ul className="mt-5 space-y-2 border-t border-[var(--line)] pt-5 flex-1">
                {['Up to 8 DICOM listener slots','Auto-routes to mapped printers','Branded headers / footers','Auto-start at Windows login'].map(f => (
                  <li key={f} className="flex items-start gap-2 text-[13px]"><I.Check size={14} className="mt-0.5 text-amber-500 shrink-0"/><span>{f}</span></li>
                ))}
              </ul>
              <Btn href={c.href} variant={c.popular ? 'primary' : 'ghost'} size="md" className="mt-6 w-full">{c.cta}</Btn>
            </div>
          </Item>
        ))}
      </Stagger>
      <FadeUp delay={0.15}>
        <div className="mt-8 text-center text-xs text-[var(--muted)] max-w-2xl mx-auto">
          A Bridge key only activates Mediview Bridge. A Viewer key only activates Mediview Viewer.
          You can run both on the same PC with two keys.
        </div>
      </FadeUp>
    </Section>
    <PrintWallet />
    <FAQ />
    <FinalCTA />
  </div>
);
window.PricingPage = PricingPage;
