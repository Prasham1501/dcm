// AI PAGE
const AIPage = () => (
  <div className="page-in">
    <PageHeader
      tone="teal"
      eyebrow="AI · Always-on second opinion"
      title={<>Your second-opinion radiologist. <span className="italic text-grad-teal">Always on call.</span></>}
      sub="OCR-grade measurement extraction. Specialty templates for obstetric, abdominal, pelvic, thyroid, cardiac, and vascular studies. Patient identifiers stripped before any data leaves your machine."
    />
    <AISection />
    <Specialty />
    <Reporting />
    <FinalCTA />
  </div>
);
window.AIPage = AIPage;
