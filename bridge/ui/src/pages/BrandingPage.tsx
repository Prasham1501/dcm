/**
 * BrandingPage — ported from the Mediview Viewer's PrintSettingsTab.
 *
 * Vertical sections (no left/right split). Each of Header and Footer shows a
 * full-width landscape preview followed by inline per-element controls:
 *   - one FieldGroup per element (Logo, Name, Services, Address, Contact)
 *   - color / font size / alignment in each group
 * Print output is rendered by `lib/brandingHtml.ts`, which the preview
 * `dangerouslySetInnerHTML`s as well — so what you see is exactly what prints.
 *
 * No "upload whole header as image" mode. Logo upload stays.
 */
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Save, RotateCcw, Upload, X, Plus, ArrowUp, ArrowDown } from 'lucide-react';
import { useConfigStore } from '@/stores/configStore';
import type { HospitalBranding, PrintSlotContent, FooterSlotItem } from '@/types/bridge';
import { buildBrandHeaderHtml, buildFooterHtml } from '@/lib/brandingHtml';

const DEFAULT_BRANDING: HospitalBranding = {
  hospitalName: '', brandNameSecondary: '', servicesList: '',
  address1: '', address2: '', address3: '',
  city: '', state: '', pincode: '',
  phone: '', email: '', website: '',
  logoDataUrl: '',
  headerShowLogo: true, headerLogoSize: 80,
  headerLogoPosition: 'left',
  headerShowName: true, headerNameFontSize: 18, headerNameColor: '#1e3a5f', headerNameAlign: 'left',
  headerSecondaryNameColor: '#2563eb',
  headerShowServices: true, headerServicesFontSize: 10, headerServicesColor: '#1a1a1a', headerServicesAlign: 'left',
  headerShowAddress: true, headerAddressFontSize: 8, headerAddressColor: '#2563eb', headerAddressAlign: 'left',
  headerShowContact: true, headerContactFontSize: 9, headerContactColor: '#333333', headerContactAlign: 'left',
  headerBgColor: '#ffffff', headerBorderBottomColor: '#2563eb',
  enableFooter: true,
  // Footer slots now hold arrays of items — stack as many fields as you like.
  footerLayout: {
    left:   [{ type: 'name' }],
    center: [{ type: 'address' }],
    right:  [{ type: 'phone' }, { type: 'website' }],
  },
  customFooterLeft: '', customFooterCenter: '', customFooterRight: '',
  footerFontSize: 8, footerFontColor: '#999999',
  footerBgColor: '#ffffff', footerBorderTopColor: '#cccccc',
  printBlackBg: true, printBorderEnabled: true, printBorderColor: '#333333',
  gapBetweenImages: 1, marginTop: 5, marginLeft: 5, marginRight: 5,
  metadataPrintPatientName: true, metadataPrintPatientId: true,
  metadataPrintAge: true, metadataPrintSex: true,
  metadataPrintModality: true, metadataPrintStudyName: true,
  metadataPrintAccessNo: true, metadataPrintRefBy: true,
};

const ALIGN_OPTIONS = [
  { value: 'left',   label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right',  label: 'Right' },
];

const LOGO_POS_OPTIONS = [
  { value: 'left',   label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right',  label: 'Right' },
];

const SLOT_OPTIONS: { value: PrintSlotContent; label: string }[] = [
  { value: 'name',     label: 'Hospital Name' },
  { value: 'services', label: 'Services' },
  { value: 'address',  label: 'Address' },
  { value: 'phone',    label: 'Phone' },
  { value: 'email',    label: 'Email' },
  { value: 'website',  label: 'Website' },
  { value: 'logo',     label: 'Logo' },
  { value: 'custom',   label: 'Custom Text' },
];

export function BrandingPage() {
  const config = useConfigStore((s) => s.config);
  const saveBranding = useConfigStore((s) => s.saveBranding);
  const [local, setLocal] = useState<HospitalBranding>(DEFAULT_BRANDING);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (config?.branding) setLocal({ ...DEFAULT_BRANDING, ...config.branding });
  }, [config?.branding]);

  const update = useCallback(<K extends keyof HospitalBranding>(key: K, value: HospitalBranding[K]) => {
    setLocal((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }, []);

  // Footer-slot mutation helpers — each slot is an array of FooterSlotItems.
  const setFooterItems = useCallback((slot: 'left' | 'center' | 'right', items: FooterSlotItem[]) => {
    setLocal((prev) => ({ ...prev, footerLayout: { ...prev.footerLayout, [slot]: items } }));
    setSaved(false);
  }, []);
  const addFooterItem = useCallback((slot: 'left' | 'center' | 'right', type: PrintSlotContent) => {
    setLocal((prev) => {
      const items = [...(prev.footerLayout[slot] || [])];
      items.push(type === 'custom' ? { type, customText: '' } : { type });
      return { ...prev, footerLayout: { ...prev.footerLayout, [slot]: items } };
    });
    setSaved(false);
  }, []);
  const removeFooterItem = useCallback((slot: 'left' | 'center' | 'right', index: number) => {
    setLocal((prev) => {
      const items = [...(prev.footerLayout[slot] || [])];
      items.splice(index, 1);
      return { ...prev, footerLayout: { ...prev.footerLayout, [slot]: items } };
    });
    setSaved(false);
  }, []);
  const updateFooterItem = useCallback((slot: 'left' | 'center' | 'right', index: number, patch: Partial<FooterSlotItem>) => {
    setLocal((prev) => {
      const items = [...(prev.footerLayout[slot] || [])];
      items[index] = { ...items[index], ...patch } as FooterSlotItem;
      return { ...prev, footerLayout: { ...prev.footerLayout, [slot]: items } };
    });
    setSaved(false);
  }, []);
  const moveFooterItem = useCallback((slot: 'left' | 'center' | 'right', index: number, dir: -1 | 1) => {
    setLocal((prev) => {
      const items = [...(prev.footerLayout[slot] || [])];
      const j = index + dir;
      if (j < 0 || j >= items.length) return prev;
      [items[index], items[j]] = [items[j], items[index]];
      return { ...prev, footerLayout: { ...prev.footerLayout, [slot]: items } };
    });
    setSaved(false);
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await saveBranding(local);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  function handleReset() { setLocal(DEFAULT_BRANDING); setSaved(false); }

  return (
    <div className="space-y-4 p-4 text-xs">
      {/* Hospital identity — base data the header/footer pull from.
          Labels stack above inputs so the grid stays tight across window sizes
          and never overflows. */}
      <Section title="Hospital Identity">
        <div className="space-y-3">
          {/* Row 1: brand identity */}
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <TextField label="Hospital Name" value={local.hospitalName}       onChange={(v) => update('hospitalName', v)} />
            <TextField label="Secondary"     value={local.brandNameSecondary} onChange={(v) => update('brandNameSecondary', v)} />
            <TextField label="Services"      value={local.servicesList}       onChange={(v) => update('servicesList', v)} />
          </div>
          {/* Row 2: address */}
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <TextField label="Address Line 1" value={local.address1} onChange={(v) => update('address1', v)} />
            <TextField label="Address Line 2" value={local.address2} onChange={(v) => update('address2', v)} />
            <TextField label="Address Line 3" value={local.address3} onChange={(v) => update('address3', v)} />
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            <TextField label="City"    value={local.city}    onChange={(v) => update('city', v)} />
            <TextField label="State"   value={local.state}   onChange={(v) => update('state', v)} />
            <TextField label="Pincode" value={local.pincode} onChange={(v) => update('pincode', v)} numericOnly />
          </div>
          {/* Row 3: contact */}
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <TextField label="Phone"   value={local.phone}   onChange={(v) => update('phone', v)} numericOnly inputMode="tel" />
            <TextField label="Email"   value={local.email}   onChange={(v) => update('email', v)} type="email" />
            <TextField label="Website" value={local.website} onChange={(v) => update('website', v)} />
          </div>
        </div>
      </Section>

      {/* HEADER */}
      <Section title="Print Header">
        <div className="space-y-3">
          {/* Full-width landscape preview */}
          <HeaderPreview branding={local} />

          <div className="grid grid-cols-2 gap-3">
            <ColorField label="Background"    value={local.headerBgColor}            onChange={(v) => update('headerBgColor', v)} />
            <ColorField label="Bottom border" value={local.headerBorderBottomColor}  onChange={(v) => update('headerBorderBottomColor', v)} />
          </div>

          <FieldGroup title="Logo" checked={local.headerShowLogo} onToggle={(v) => update('headerShowLogo', v)}>
            <LogoControls
              logoDataUrl={local.logoDataUrl}
              onLogoChange={(v) => update('logoDataUrl', v)}
              size={local.headerLogoSize}
              onSize={(v) => update('headerLogoSize', v)}
              position={local.headerLogoPosition}
              onPosition={(v) => update('headerLogoPosition', v as 'left' | 'center' | 'right')}
            />
          </FieldGroup>

          <FieldGroup title="Hospital Name" checked={local.headerShowName} onToggle={(v) => update('headerShowName', v)}>
            <div className="flex flex-wrap items-center gap-3">
              <NumberField label="Size"      value={local.headerNameFontSize}        onChange={(v) => update('headerNameFontSize', v)}        min={8} max={36} />
              <ColorField  label="Color"     value={local.headerNameColor}           onChange={(v) => update('headerNameColor', v)} />
              <ColorField  label="Secondary" value={local.headerSecondaryNameColor}  onChange={(v) => update('headerSecondaryNameColor', v)} />
              <SelectField label="Align"     value={local.headerNameAlign}           onChange={(v) => update('headerNameAlign', v as any)} options={ALIGN_OPTIONS} />
            </div>
          </FieldGroup>

          <FieldGroup title="Services / Title" checked={local.headerShowServices} onToggle={(v) => update('headerShowServices', v)}>
            <div className="flex flex-wrap items-center gap-3">
              <NumberField label="Size"  value={local.headerServicesFontSize}  onChange={(v) => update('headerServicesFontSize', v)}  min={6} max={24} />
              <ColorField  label="Color" value={local.headerServicesColor}     onChange={(v) => update('headerServicesColor', v)} />
              <SelectField label="Align" value={local.headerServicesAlign}     onChange={(v) => update('headerServicesAlign', v as any)} options={ALIGN_OPTIONS} />
            </div>
          </FieldGroup>

          <FieldGroup title="Address" checked={local.headerShowAddress} onToggle={(v) => update('headerShowAddress', v)}>
            <div className="flex flex-wrap items-center gap-3">
              <NumberField label="Size"  value={local.headerAddressFontSize}  onChange={(v) => update('headerAddressFontSize', v)}  min={6} max={20} />
              <ColorField  label="Color" value={local.headerAddressColor}     onChange={(v) => update('headerAddressColor', v)} />
              <SelectField label="Align" value={local.headerAddressAlign}     onChange={(v) => update('headerAddressAlign', v as any)} options={ALIGN_OPTIONS} />
            </div>
          </FieldGroup>

          <FieldGroup title="Contact Info" checked={local.headerShowContact} onToggle={(v) => update('headerShowContact', v)}>
            <div className="flex flex-wrap items-center gap-3">
              <NumberField label="Size"  value={local.headerContactFontSize}  onChange={(v) => update('headerContactFontSize', v)}  min={6} max={18} />
              <ColorField  label="Color" value={local.headerContactColor}     onChange={(v) => update('headerContactColor', v)} />
              <SelectField label="Align" value={local.headerContactAlign}     onChange={(v) => update('headerContactAlign', v as any)} options={ALIGN_OPTIONS} />
            </div>
          </FieldGroup>
        </div>
      </Section>

      {/* FOOTER */}
      <Section title="Print Footer" toggle={{ checked: local.enableFooter, onChange: (v) => update('enableFooter', v), label: 'Enable' }}>
        {local.enableFooter && (
          <div className="space-y-3">
            <FooterPreview branding={local} />

            <div className="grid grid-cols-3 gap-3">
              <ColorField  label="Background"  value={local.footerBgColor}        onChange={(v) => update('footerBgColor', v)} />
              <ColorField  label="Top border"  value={local.footerBorderTopColor} onChange={(v) => update('footerBorderTopColor', v)} />
              <div className="flex flex-wrap items-center gap-3">
                <NumberField label="Font Size" value={local.footerFontSize}  onChange={(v) => update('footerFontSize', v)}  min={6} max={18} />
                <ColorField  label="Color"     value={local.footerFontColor} onChange={(v) => update('footerFontColor', v)} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {(['left', 'center', 'right'] as const).map((slot) => (
                <FooterSlotEditor
                  key={slot}
                  label={slot[0].toUpperCase() + slot.slice(1) + ' Slot'}
                  items={local.footerLayout[slot] || []}
                  onAdd={(t) => addFooterItem(slot, t)}
                  onRemove={(i) => removeFooterItem(slot, i)}
                  onUpdate={(i, patch) => updateFooterItem(slot, i, patch)}
                  onMove={(i, dir) => moveFooterItem(slot, i, dir)}
                />
              ))}
            </div>
          </div>
        )}
      </Section>

      {/* Patient metadata */}
      <Section title="Patient Metadata on Print">
        <p className="mb-2 text-[10px] text-app-text-muted">Which patient details to show in the dark bar below the header on every printed page.</p>
        <div className="grid grid-cols-4 gap-x-4 gap-y-1.5">
          <CheckboxRow label="Patient Name"    checked={local.metadataPrintPatientName} onChange={(v) => update('metadataPrintPatientName', v)} />
          <CheckboxRow label="Patient ID"      checked={local.metadataPrintPatientId}   onChange={(v) => update('metadataPrintPatientId', v)} />
          <CheckboxRow label="Age"             checked={local.metadataPrintAge}         onChange={(v) => update('metadataPrintAge', v)} />
          <CheckboxRow label="Sex"             checked={local.metadataPrintSex}         onChange={(v) => update('metadataPrintSex', v)} />
          <CheckboxRow label="Modality"        checked={local.metadataPrintModality}    onChange={(v) => update('metadataPrintModality', v)} />
          <CheckboxRow label="Study Name"      checked={local.metadataPrintStudyName}   onChange={(v) => update('metadataPrintStudyName', v)} />
          <CheckboxRow label="Accession No"    checked={local.metadataPrintAccessNo}    onChange={(v) => update('metadataPrintAccessNo', v)} />
          <CheckboxRow label="Ref By / Done By" checked={local.metadataPrintRefBy}      onChange={(v) => update('metadataPrintRefBy', v)} />
        </div>
      </Section>

      {/* Image appearance */}
      <Section title="Image Appearance">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <CheckboxRow label="Black background" checked={local.printBlackBg}       onChange={(v) => update('printBlackBg', v)} />
          <div className="flex items-center gap-2">
            <CheckboxRow label="Image border" checked={local.printBorderEnabled} onChange={(v) => update('printBorderEnabled', v)} />
            {local.printBorderEnabled && <ColorField label="" value={local.printBorderColor} onChange={(v) => update('printBorderColor', v)} />}
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold uppercase text-app-text-muted">Image Gap</label>
            <input type="number" min={0} max={200} value={local.gapBetweenImages}
              onChange={(e) => update('gapBetweenImages', parseInt(e.target.value, 10) || 0)}
              className="h-6 w-16 rounded-sm border border-app-border bg-app-bg px-1.5 text-[10px] text-app-text" />
            <span className="text-[9px] text-app-text-muted">px</span>
          </div>
        </div>
      </Section>

      {/* Sticky action bar */}
      <div className="sticky bottom-0 -mx-4 flex items-center justify-between border-t border-app-border bg-app-bg px-4 py-3">
        <button onClick={handleReset}
          className="flex items-center gap-1.5 rounded border border-app-border px-3 py-1.5 text-xs text-app-text-secondary hover:bg-app-hover">
          <RotateCcw className="h-3.5 w-3.5" /> Reset to Defaults
        </button>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-1.5 rounded bg-app-accent px-4 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50">
          <Save className="h-3.5 w-3.5" />
          {saving ? 'Saving…' : saved ? 'Saved!' : 'Save & Apply'}
        </button>
      </div>
    </div>
  );
}

/* ── Header / Footer previews (full width, landscape, render via brandingHtml.ts) ── */

function HeaderPreview({ branding }: { branding: HospitalBranding }) {
  const html = useMemo(() => buildBrandHeaderHtml(branding), [branding]);
  return (
    <div>
      <div className="mb-1 text-[10px] font-bold uppercase text-app-text-muted">Live Header Preview · prints exactly like this</div>
      <div className="w-full overflow-hidden rounded border border-app-border bg-white shadow-sm">
        {html
          ? <div dangerouslySetInnerHTML={{ __html: html }} />
          : <div className="flex h-20 items-center justify-center text-[11px] text-gray-400">Enter a hospital name to see the preview</div>}
      </div>
    </div>
  );
}

function FooterPreview({ branding }: { branding: HospitalBranding }) {
  const html = useMemo(() => buildFooterHtml(branding), [branding]);
  return (
    <div>
      <div className="mb-1 text-[10px] font-bold uppercase text-app-text-muted">Live Footer Preview</div>
      <div className="w-full overflow-hidden rounded border border-app-border bg-white shadow-sm">
        {html
          ? <div dangerouslySetInnerHTML={{ __html: html }} />
          : <div className="flex h-10 items-center justify-center text-[11px] text-gray-400">Footer is empty</div>}
      </div>
    </div>
  );
}

/* ── Logo controls (upload + size + position; shape removed) ──
 *
 * The preview thumbnail is now a 16:6 landscape box with `object-fit:contain`
 * so wide wordmark-style logos (like Mediview's) aren't cropped. */

function LogoControls({
  logoDataUrl, onLogoChange, size, onSize, position, onPosition,
}: {
  logoDataUrl: string;
  onLogoChange: (v: string) => void;
  size: number;
  onSize: (v: number) => void;
  position: 'left' | 'center' | 'right';
  onPosition: (v: 'left' | 'center' | 'right') => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  async function pick() {
    try {
      const dataUrl = await window.bridgeAPI.pickAndEncodeLogo();
      if (dataUrl) onLogoChange(dataUrl);
    } catch (e: any) {
      alert(e?.message || 'Failed to load logo');
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {logoDataUrl ? (
        <div className="relative flex h-20 w-56 items-center justify-center rounded border border-app-border bg-white p-1">
          <img src={logoDataUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
          <button onClick={() => onLogoChange('')} title="Remove" className="absolute -right-1 -top-1 rounded-full bg-red-500 p-0.5 text-white hover:bg-red-600">
            <X className="h-2.5 w-2.5" />
          </button>
        </div>
      ) : (
        <div className="flex h-20 w-56 items-center justify-center rounded border border-dashed border-app-border text-app-text-secondary">
          <Upload className="h-5 w-5" />
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" />
      <button onClick={pick}
        className="rounded border border-app-accent px-2 py-1 text-[10px] font-semibold text-app-accent hover:bg-app-accent hover:text-white">
        {logoDataUrl ? 'Change Logo' : 'Upload Logo'}
      </button>
      <NumberField label="Height" value={size} onChange={onSize} min={20} max={240} />
      <SelectField label="Pos"    value={position} onChange={(v) => onPosition(v as any)} options={LOGO_POS_OPTIONS} />
    </div>
  );
}

/* ── Multi-item footer slot editor ──
 *
 * Stack any combination of fields (name, address, phone, email, website,
 * services, logo, custom) inside one slot. Each row has reorder + remove. */
function FooterSlotEditor({
  label, items, onAdd, onRemove, onUpdate, onMove,
}: {
  label: string;
  items: FooterSlotItem[];
  onAdd: (t: PrintSlotContent) => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, patch: Partial<FooterSlotItem>) => void;
  onMove: (index: number, dir: -1 | 1) => void;
}) {
  return (
    <div className="rounded border border-app-border bg-app-bg p-2">
      <label className="mb-1 block text-[10px] font-bold uppercase text-app-text-muted">{label}</label>

      {items.length === 0 ? (
        <div className="mb-1 rounded border border-dashed border-app-border px-2 py-3 text-center text-[10px] text-app-text-muted">
          Empty — add a field below
        </div>
      ) : (
        <div className="mb-2 space-y-1">
          {items.map((it, i) => (
            <div key={i} className="rounded border border-app-border bg-app-surface p-1">
              <div className="flex items-center gap-1">
                <select
                  value={it.type}
                  onChange={(e) => onUpdate(i, { type: e.target.value as PrintSlotContent })}
                  className="h-6 flex-1 min-w-0 rounded border border-app-border bg-app-bg px-1 text-[10px] text-app-text"
                >
                  {SLOT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <button onClick={() => onMove(i, -1)} disabled={i === 0}
                  title="Move up" className="rounded p-0.5 text-app-text-muted hover:bg-app-hover disabled:opacity-30">
                  <ArrowUp className="h-3 w-3" />
                </button>
                <button onClick={() => onMove(i, 1)} disabled={i === items.length - 1}
                  title="Move down" className="rounded p-0.5 text-app-text-muted hover:bg-app-hover disabled:opacity-30">
                  <ArrowDown className="h-3 w-3" />
                </button>
                <button onClick={() => onRemove(i)} title="Remove"
                  className="rounded p-0.5 text-red-500 hover:bg-app-hover">
                  <X className="h-3 w-3" />
                </button>
              </div>
              {it.type === 'custom' && (
                <input
                  type="text"
                  value={it.customText || ''}
                  onChange={(e) => onUpdate(i, { customText: e.target.value })}
                  placeholder="Custom text"
                  className="mt-1 h-6 w-full rounded border border-app-border bg-app-bg px-1 text-[10px] text-app-text"
                />
              )}
            </div>
          ))}
        </div>
      )}

      <select
        value=""
        onChange={(e) => { if (e.target.value) { onAdd(e.target.value as PrintSlotContent); e.target.value = ''; } }}
        className="h-6 w-full rounded border border-app-accent bg-app-bg px-1 text-[10px] font-semibold text-app-accent"
      >
        <option value="">+ Add field…</option>
        {SLOT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

/* ── Helper layout components (mirror viewer style) ── */

function Section({
  title, children, toggle,
}: {
  title: string;
  children: React.ReactNode;
  toggle?: { checked: boolean; onChange: (v: boolean) => void; label: string };
}) {
  return (
    <div className="rounded-lg border border-app-border bg-app-surface p-3">
      <h3 className="mb-2 flex items-center justify-between border-b border-app-border pb-1 text-[11px] font-bold text-app-accent">
        <span>{title}</span>
        {toggle && (
          <label className="flex cursor-pointer items-center gap-1.5 text-[10px] font-medium text-app-text">
            <input type="checkbox" checked={toggle.checked} onChange={(e) => toggle.onChange(e.target.checked)} className="accent-app-accent" />
            {toggle.label}
          </label>
        )}
      </h3>
      {children}
    </div>
  );
}

function FieldGroup({
  title, checked, onToggle, children,
}: {
  title: string;
  checked: boolean;
  onToggle: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded border border-app-border p-2 ${!checked ? 'opacity-40' : ''}`}>
      <label className="mb-1.5 flex cursor-pointer items-center gap-1.5 text-[10px] font-bold text-app-text">
        <input type="checkbox" checked={checked} onChange={(e) => onToggle(e.target.checked)} className="accent-app-accent" />
        {title}
      </label>
      {checked && children}
    </div>
  );
}

function TextField({
  label, value, onChange, placeholder = 'add text here', numericOnly, type = 'text', inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  numericOnly?: boolean;
  type?: string;
  inputMode?: 'text' | 'tel' | 'numeric' | 'email' | 'url';
}) {
  // Stacked layout: label on top, input full-width. Keeps the grid tidy at
  // any window width and never overflows. `numericOnly` strips non-digits.
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[10px] font-bold uppercase tracking-wide text-app-text-muted">{label}</span>
      <input
        type={type}
        value={value}
        inputMode={inputMode || (numericOnly ? 'numeric' : undefined)}
        onChange={(e) => onChange(numericOnly ? e.target.value.replace(/\D/g, '') : e.target.value)}
        placeholder={placeholder}
        className="w-full min-w-0 rounded border border-app-border bg-app-bg px-2 py-1 text-xs text-app-text placeholder:text-app-text-muted focus:border-app-accent focus:outline-none"
      />
    </label>
  );
}

function CheckboxRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-1.5 text-xs text-app-text">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-app-accent" />
      {label}
    </label>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-1">
      {label && <label className="shrink-0 text-[10px] font-bold uppercase text-app-text-muted">{label}</label>}
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-5 w-5 shrink-0 cursor-pointer border-none bg-transparent" />
      <span className="font-mono text-[9px] text-app-text">{value}</span>
    </div>
  );
}

function NumberField({ label, value, onChange, min, max }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number }) {
  return (
    <div className="flex items-center gap-1">
      <label className="shrink-0 text-[10px] font-bold uppercase text-app-text-muted">{label}</label>
      <input type="number" min={min} max={max} value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10) || min)}
        className="h-5 w-14 rounded-sm border border-app-border bg-app-bg px-1 text-[10px] text-app-text" />
    </div>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="flex items-center gap-1">
      <label className="shrink-0 text-[10px] font-bold uppercase text-app-text-muted">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-5 rounded border border-app-border bg-app-bg px-0.5 text-[10px] text-app-text">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
