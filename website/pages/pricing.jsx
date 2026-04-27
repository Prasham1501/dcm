// PRICING PAGE
const PricingPage = () => (
  <div className="page-in">
    <PageHeader
      eyebrow="Pricing & wallet"
      title={<>Pay once, or <span className="italic text-grad-rose">monthly.</span></>}
      sub="Free 30-day trial — no credit card. Annual licenses include 1,000 free A4 B&W print credits. Print credits sold separately and never expire."
    />
    <Pricing />
    <PrintWallet />
    <FAQ />
    <FinalCTA />
  </div>
);
window.PricingPage = PricingPage;
