// FEATURES PAGE
const FeaturesPage = () => (
  <div className="page-in">
    <PageHeader
      eyebrow="Features"
      title={<>Every tool a radiologist <span className="italic text-grad-rose">actually needs.</span></>}
      sub="60+ multi-viewport layouts, true 3D MPR, pixel-perfect measurements, and one-click reporting — all in one Windows installer."
    />
    <CoreViewer />
    <Measurements />
    <MPR />
    <Specialty />
    <Reporting />
    <PACS />
    <Security />
    <SysReq />
    <FinalCTA />
  </div>
);
window.FeaturesPage = FeaturesPage;
