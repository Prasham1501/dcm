import { useRef } from 'react';
import { useHospitalConfigStore, getFormattedAddress, type PrintSlotContent } from '@/stores/hospitalConfigStore';

const ALIGN_OPTIONS = [
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
];

const LOGO_POS_OPTIONS = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
];

const SLOT_OPTIONS: { value: PrintSlotContent; label: string }[] = [
  { value: 'logo', label: 'Logo' },
  { value: 'name', label: 'Hospital Name' },
  { value: 'address', label: 'Address' },
  { value: 'custom', label: 'Custom Text' },
  { value: 'none', label: 'None' },
];

export function PrintSettingsTab() {
  const config = useHospitalConfigStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const services = (config.servicesList || '').split('|').filter(Boolean);
  const logoRadius = config.headerLogoShape === 'square' ? '6px' : '50%';
  const previewLogoSize = (config.headerLogoSize || 60) * 0.6;

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { if (typeof reader.result === 'string') config.setLogo(reader.result); };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const alignStyle = (a: string) => a === 'left' ? 'flex-start' : a === 'right' ? 'flex-end' : 'center';

  const renderSlotPreview = (slot: string, customText: string) => {
    const fs = config.footerFontSize || 8;
    const fc = config.footerFontColor || '#999';
    switch (slot) {
      case 'logo': return config.logoDataUrl ? <img src={config.logoDataUrl} style={{ maxHeight: 20, maxWidth: 60, objectFit: 'contain' }} alt="Logo" /> : <span style={{ fontSize: 7, color: '#9ca3af' }}>[No Logo]</span>;
      case 'name': return <span style={{ fontWeight: 600, fontSize: fs, color: fc }}>{config.hospitalName}</span>;
      case 'address': return <span style={{ fontSize: fs, color: fc }}>{getFormattedAddress(config as any)}{config.phone && ` | ${config.phone}`}</span>;
      case 'custom': return <span style={{ fontSize: fs, color: fc }}>{customText || '—'}</span>;
      default: return <span style={{ color: '#ccc' }}>—</span>;
    }
  };

  return (
    <div className="space-y-4 text-xs">

      {/* ── SECTION 1: HEADER ── */}
      <Section title="Print Header">
        <div className="space-y-3">
          {/* Live Preview — full width, fixed width matching print output proportions */}
          <div>
            <div className="text-[10px] font-bold text-app-text-muted uppercase mb-1">Live Header Preview</div>
            <div style={{ width: 500 }} className="border border-app-border rounded overflow-hidden shadow-sm">
              <div style={{
                display: 'flex', alignItems: 'center', padding: '6px 10px', gap: 8,
                borderBottom: `2px solid ${config.headerBorderBottomColor || '#2563eb'}`,
                background: config.headerBgColor || '#ffffff',
                flexDirection: config.headerLogoPosition === 'right' ? 'row-reverse' : 'row',
              }}>
                {config.headerShowLogo && (
                  <div style={{ flex: '0 0 auto' }}>
                    {config.logoDataUrl ? (
                      <img src={config.logoDataUrl} style={{ width: previewLogoSize, height: previewLogoSize, borderRadius: logoRadius, objectFit: 'cover', border: '1px solid #ddd' }} alt="Logo" />
                    ) : (
                      <div style={{ width: previewLogoSize, height: previewLogoSize, borderRadius: logoRadius, background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, color: '#9ca3af' }}>[Logo]</div>
                    )}
                  </div>
                )}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', lineHeight: 1.3 }}>
                  {config.headerShowName && (
                    <div style={{ marginBottom: 1, textAlign: config.headerNameAlign as any }}>
                      <span style={{ fontSize: config.headerNameFontSize * 0.7, fontWeight: 800, color: config.headerNameColor }}>{config.hospitalName}</span>
                      {config.brandNameSecondary && <span style={{ fontSize: config.headerNameFontSize * 0.7, fontWeight: 400, color: config.headerSecondaryNameColor, marginLeft: 4 }}>{config.brandNameSecondary}</span>}
                    </div>
                  )}
                  {config.headerShowServices && services.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: alignStyle(config.headerServicesAlign), gap: 3, fontSize: config.headerServicesFontSize * 0.7, fontWeight: 600, color: config.headerServicesColor, flexWrap: 'wrap', marginBottom: 1 }}>
                      {services.map((s, i) => (
                        <span key={i}>{i > 0 && <span style={{ margin: '0 2px', color: '#999' }}>|</span>}{s.trim()}</span>
                      ))}
                    </div>
                  )}
                  {config.headerShowAddress && (
                    <div style={{ fontSize: config.headerAddressFontSize * 0.7, color: config.headerAddressColor, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: config.headerAddressAlign as any }}>{getFormattedAddress(config as any).toUpperCase()}</div>
                  )}
                  {config.headerShowContact && (config.phone || config.email || config.website) && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: alignStyle(config.headerContactAlign), gap: 6, fontSize: config.headerContactFontSize * 0.7, color: config.headerContactColor, flexWrap: 'wrap', marginTop: 1 }}>
                      {config.phone && <span>☎ {config.phone}</span>}
                      {config.email && <span>✉ {config.email}</span>}
                      {config.website && <span>🌐 {config.website}</span>}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="space-y-3">
            {/* Header Background */}
            <div className="grid grid-cols-2 gap-2">
              <ColorField label="Background" value={config.headerBgColor} onChange={(v) => config.updateField('headerBgColor', v)} />
              <ColorField label="Border Color" value={config.headerBorderBottomColor} onChange={(v) => config.updateField('headerBorderBottomColor', v)} />
            </div>

            {/* Logo */}
            <FieldGroup title="Logo" checked={config.headerShowLogo} onToggle={(v) => config.updateField('headerShowLogo', v)}>
              <div className="flex items-center gap-2 flex-wrap">
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                <button onClick={() => fileInputRef.current?.click()} className="px-2 py-0.5 text-[10px] font-semibold border border-app-accent text-app-accent rounded hover:bg-app-accent hover:text-white transition-colors">Upload</button>
                {config.logoDataUrl && <button onClick={() => config.removeLogo()} className="px-2 py-0.5 text-[10px] font-semibold border border-red-500 text-red-500 rounded hover:bg-red-500 hover:text-white transition-colors">Remove</button>}
                <NumberField label="Size" value={config.headerLogoSize} onChange={(v) => config.updateField('headerLogoSize', v)} min={20} max={200} />
                <SelectField label="Pos" value={config.headerLogoPosition} onChange={(v) => config.updateField('headerLogoPosition', v)} options={LOGO_POS_OPTIONS} />
                <SelectField label="Shape" value={config.headerLogoShape} onChange={(v) => config.updateField('headerLogoShape', v)} options={[{ value: 'circle', label: 'Circle' }, { value: 'square', label: 'Square' }]} />
              </div>
            </FieldGroup>

            {/* Hospital Name */}
            <FieldGroup title="Hospital Name" checked={config.headerShowName} onToggle={(v) => config.updateField('headerShowName', v)}>
              <div className="flex items-center gap-2 flex-wrap">
                <NumberField label="Size" value={config.headerNameFontSize} onChange={(v) => config.updateField('headerNameFontSize', v)} min={8} max={36} />
                <ColorField label="Color" value={config.headerNameColor} onChange={(v) => config.updateField('headerNameColor', v)} />
                <ColorField label="2nd" value={config.headerSecondaryNameColor} onChange={(v) => config.updateField('headerSecondaryNameColor', v)} />
                <SelectField label="Align" value={config.headerNameAlign} onChange={(v) => config.updateField('headerNameAlign', v)} options={ALIGN_OPTIONS} />
              </div>
            </FieldGroup>

            {/* Services */}
            <FieldGroup title="Services / Title" checked={config.headerShowServices} onToggle={(v) => config.updateField('headerShowServices', v)}>
              <div className="flex items-center gap-2 flex-wrap">
                <NumberField label="Size" value={config.headerServicesFontSize} onChange={(v) => config.updateField('headerServicesFontSize', v)} min={6} max={24} />
                <ColorField label="Color" value={config.headerServicesColor} onChange={(v) => config.updateField('headerServicesColor', v)} />
                <SelectField label="Align" value={config.headerServicesAlign} onChange={(v) => config.updateField('headerServicesAlign', v)} options={ALIGN_OPTIONS} />
              </div>
            </FieldGroup>

            {/* Address */}
            <FieldGroup title="Address" checked={config.headerShowAddress} onToggle={(v) => config.updateField('headerShowAddress', v)}>
              <div className="flex items-center gap-2 flex-wrap">
                <NumberField label="Size" value={config.headerAddressFontSize} onChange={(v) => config.updateField('headerAddressFontSize', v)} min={6} max={20} />
                <ColorField label="Color" value={config.headerAddressColor} onChange={(v) => config.updateField('headerAddressColor', v)} />
                <SelectField label="Align" value={config.headerAddressAlign} onChange={(v) => config.updateField('headerAddressAlign', v)} options={ALIGN_OPTIONS} />
              </div>
            </FieldGroup>

            {/* Contact */}
            <FieldGroup title="Contact Info" checked={config.headerShowContact} onToggle={(v) => config.updateField('headerShowContact', v)}>
              <div className="flex items-center gap-2 flex-wrap">
                <NumberField label="Size" value={config.headerContactFontSize} onChange={(v) => config.updateField('headerContactFontSize', v)} min={6} max={18} />
                <ColorField label="Color" value={config.headerContactColor} onChange={(v) => config.updateField('headerContactColor', v)} />
                <SelectField label="Align" value={config.headerContactAlign} onChange={(v) => config.updateField('headerContactAlign', v)} options={ALIGN_OPTIONS} />
              </div>
            </FieldGroup>
          </div>

        </div>
      </Section>

      {/* ── SECTION 2: FOOTER ── */}
      <Section title="Print Footer" toggle={{ checked: config.enableFooter, onChange: (v) => config.updateField('enableFooter', v), label: 'Enable' }}>
        {config.enableFooter && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <ColorField label="Background" value={config.footerBgColor} onChange={(v) => config.updateField('footerBgColor', v)} />
              <ColorField label="Border Top" value={config.footerBorderTopColor} onChange={(v) => config.updateField('footerBorderTopColor', v)} />
              <NumberField label="Font Size" value={config.footerFontSize} onChange={(v) => config.updateField('footerFontSize', v)} min={6} max={18} />
              <ColorField label="Font Color" value={config.footerFontColor} onChange={(v) => config.updateField('footerFontColor', v)} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-app-text-muted uppercase mb-0.5">Left Slot</label>
                <select value={config.footerLayout.left} onChange={(e) => config.updateFooterLayout('left', e.target.value as PrintSlotContent)} className="w-full h-6 px-1 text-[10px] border border-app-border bg-app-bg text-app-text rounded">
                  {SLOT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                {config.footerLayout.left === 'custom' && <input type="text" value={config.customFooterLeft} onChange={(e) => config.updateField('customFooterLeft', e.target.value)} placeholder="Custom text" className="w-full h-6 mt-1 px-1 text-[10px] border border-app-border bg-app-bg text-app-text rounded" />}
              </div>
              <div>
                <label className="block text-[10px] font-bold text-app-text-muted uppercase mb-0.5">Center Slot</label>
                <select value={config.footerLayout.center} onChange={(e) => config.updateFooterLayout('center', e.target.value as PrintSlotContent)} className="w-full h-6 px-1 text-[10px] border border-app-border bg-app-bg text-app-text rounded">
                  {SLOT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                {config.footerLayout.center === 'custom' && <input type="text" value={config.customFooterCenter} onChange={(e) => config.updateField('customFooterCenter', e.target.value)} placeholder="Custom text" className="w-full h-6 mt-1 px-1 text-[10px] border border-app-border bg-app-bg text-app-text rounded" />}
              </div>
              <div>
                <label className="block text-[10px] font-bold text-app-text-muted uppercase mb-0.5">Right Slot</label>
                <select value={config.footerLayout.right} onChange={(e) => config.updateFooterLayout('right', e.target.value as PrintSlotContent)} className="w-full h-6 px-1 text-[10px] border border-app-border bg-app-bg text-app-text rounded">
                  {SLOT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                {config.footerLayout.right === 'custom' && <input type="text" value={config.customFooterRight} onChange={(e) => config.updateField('customFooterRight', e.target.value)} placeholder="Custom text" className="w-full h-6 mt-1 px-1 text-[10px] border border-app-border bg-app-bg text-app-text rounded" />}
              </div>
            </div>
            {/* Footer Preview */}
            <div className="border border-app-border rounded overflow-hidden">
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 10px',
                borderTop: `1px solid ${config.footerBorderTopColor || '#ccc'}`,
                background: config.footerBgColor || '#ffffff',
              }}>
                <div>{renderSlotPreview(config.footerLayout.left, config.customFooterLeft)}</div>
                <div style={{ textAlign: 'center' }}>{renderSlotPreview(config.footerLayout.center, config.customFooterCenter)}</div>
                <div style={{ textAlign: 'right' }}>{renderSlotPreview(config.footerLayout.right, config.customFooterRight)}</div>
              </div>
            </div>
          </div>
        )}
      </Section>

      {/* ── SECTION 3: PATIENT INFO ON PRINT ── */}
      <Section title="Patient Metadata on Print">
        <div className="grid grid-cols-3 gap-x-4 gap-y-1.5">
          <CheckboxRow label="Patient Name" checked={config.metadataPrintPatientName} onChange={(v) => config.updateField('metadataPrintPatientName', v)} />
          <CheckboxRow label="Patient ID" checked={config.metadataPrintPatientId} onChange={(v) => config.updateField('metadataPrintPatientId', v)} />
          <CheckboxRow label="Age" checked={config.metadataPrintAge} onChange={(v) => config.updateField('metadataPrintAge', v)} />
          <CheckboxRow label="Sex" checked={config.metadataPrintSex} onChange={(v) => config.updateField('metadataPrintSex', v)} />
          <CheckboxRow label="Modality" checked={config.metadataPrintModality} onChange={(v) => config.updateField('metadataPrintModality', v)} />
          <CheckboxRow label="Study Name" checked={config.metadataPrintStudyName} onChange={(v) => config.updateField('metadataPrintStudyName', v)} />
          <CheckboxRow label="Accession No" checked={config.metadataPrintAccessNo} onChange={(v) => config.updateField('metadataPrintAccessNo', v)} />
          <CheckboxRow label="Ref By / Done By" checked={config.metadataPrintRefBy} onChange={(v) => config.updateField('metadataPrintRefBy', v)} />
        </div>
      </Section>

      {/* ── SECTION 4: IMAGE APPEARANCE ── */}
      <Section title="Image Appearance">
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          <div className="space-y-2">
            <CheckboxRow label="Black background" checked={config.printBlackBg} onChange={(v) => config.updateField('printBlackBg', v)} />
            <CheckboxRow label="Border around images" checked={config.printBorderEnabled} onChange={(v) => config.updateField('printBorderEnabled', v)} />
            {config.printBorderEnabled && (
              <div className="ml-5">
                <ColorField label="Border Color" value={config.printBorderColor} onChange={(v) => config.updateField('printBorderColor', v)} />
              </div>
            )}
          </div>
          <div className="space-y-2">
            <ColorField label="Viewport Border" value={config.viewportBorderColor} onChange={(v) => config.updateField('viewportBorderColor', v)} />
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-bold text-app-text-muted uppercase w-24">Image Gap</label>
              <input type="number" min={0} max={200} value={config.gapBetweenImages}
                onChange={(e) => config.updateField('gapBetweenImages', parseInt(e.target.value) || 0)}
                className="w-16 h-6 px-1.5 text-[10px] border border-app-border bg-app-bg text-app-text rounded-sm" />
              <span className="text-[9px] text-app-text-muted">px</span>
            </div>
          </div>
        </div>
      </Section>

      {/* ── SECTION 5: MISC SETTINGS ── */}
      <Section title="Other Settings">
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-bold text-app-text-muted uppercase w-36">Print count warning at</label>
              <input type="number" min={0} max={9999} value={config.printCountWarningAt}
                onChange={(e) => config.updateField('printCountWarningAt', parseInt(e.target.value) || 50)}
                className="w-16 h-6 px-1.5 text-[10px] border border-app-border bg-app-bg text-app-text rounded-sm" />
            </div>
            <CheckboxRow label="Popup when image received" checked={config.popupOnImageReceived} onChange={(v) => config.updateField('popupOnImageReceived', v)} />
          </div>
          <div className="space-y-2">
            <div>
              <label className="text-[10px] font-bold text-app-text-muted uppercase mb-1 block">Export Folder Name</label>
              <div className="space-y-1 ml-1">
                <RadioRow label="Patient Name" checked={config.exportFolderNameMode === 'patientName'} onChange={() => config.updateField('exportFolderNameMode', 'patientName')} name="exportFolder" />
                <RadioRow label="Id-Name-Gender-Age" checked={config.exportFolderNameMode === 'idNameGenderAge'} onChange={() => config.updateField('exportFolderNameMode', 'idNameGenderAge')} name="exportFolder" />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-app-text-muted uppercase mb-1 block">6 Spots Spacing</label>
              <div className="space-y-1 ml-1">
                <RadioRow label="Equal space top & bottom" checked={config.sixSpotsSpacing === 'equalSpace'} onChange={() => config.updateField('sixSpotsSpacing', 'equalSpace')} name="sixSpots" />
                <RadioRow label="Compact" checked={config.sixSpotsSpacing === 'compact'} onChange={() => config.updateField('sixSpotsSpacing', 'compact')} name="sixSpots" />
              </div>
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}

/* ── Helper Components ── */

function Section({ title, children, toggle }: { title: string; children: React.ReactNode; toggle?: { checked: boolean; onChange: (v: boolean) => void; label: string } }) {
  return (
    <div>
      <h3 className="text-[11px] font-bold text-app-accent mb-2 pb-1 border-b border-app-border flex items-center justify-between">
        <span>{title}</span>
        {toggle && (
          <label className="flex items-center gap-1.5 text-[10px] font-medium text-app-text cursor-pointer">
            <input type="checkbox" checked={toggle.checked} onChange={(e) => toggle.onChange(e.target.checked)} className="accent-app-accent" />
            {toggle.label}
          </label>
        )}
      </h3>
      {children}
    </div>
  );
}

function FieldGroup({ title, checked, onToggle, children }: { title: string; checked: boolean; onToggle: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <div className={`border border-app-border rounded p-1.5 ${!checked ? 'opacity-40' : ''}`}>
      <label className="flex items-center gap-1.5 text-[10px] font-bold text-app-text cursor-pointer mb-1">
        <input type="checkbox" checked={checked} onChange={(e) => onToggle(e.target.checked)} className="accent-app-accent" />
        {title}
      </label>
      {checked && children}
    </div>
  );
}

function CheckboxRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-app-text cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-app-accent" />
      {label}
    </label>
  );
}

function RadioRow({ label, checked, onChange, name }: { label: string; checked: boolean; onChange: () => void; name: string }) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-app-text cursor-pointer">
      <input type="radio" name={name} checked={checked} onChange={onChange} className="accent-app-accent" />
      {label}
    </label>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-1">
      <label className="text-[10px] font-bold text-app-text-muted uppercase flex-shrink-0">{label}</label>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="w-5 h-5 bg-transparent border-none cursor-pointer flex-shrink-0" />
      <span className="text-app-text font-mono text-[9px]">{value}</span>
    </div>
  );
}

function NumberField({ label, value, onChange, min, max }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number }) {
  return (
    <div className="flex items-center gap-1">
      <label className="text-[10px] font-bold text-app-text-muted uppercase flex-shrink-0">{label}</label>
      <input type="number" min={min} max={max} value={value}
        onChange={(e) => onChange(parseInt(e.target.value) || min)}
        className="w-12 h-5 px-1 text-[10px] border border-app-border bg-app-bg text-app-text rounded-sm" />
    </div>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="flex items-center gap-1">
      <label className="text-[10px] font-bold text-app-text-muted uppercase flex-shrink-0">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-5 px-0.5 text-[10px] border border-app-border bg-app-bg text-app-text rounded">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
