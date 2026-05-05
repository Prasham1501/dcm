import { useState, useEffect, useCallback } from 'react';
import { Save, RotateCcw } from 'lucide-react';
import { useConfigStore } from '@/stores/configStore';
import type { HospitalBranding, PrintSlotContent } from '@/types/bridge';
import { LogoUploader } from '@/components/branding/LogoUploader';
import { ColorField } from '@/components/branding/ColorField';
import { NumberField } from '@/components/branding/NumberField';
import { FooterSlotPicker } from '@/components/branding/FooterSlotPicker';
import { BrandingPreview } from '@/components/branding/BrandingPreview';

const DEFAULT_BRANDING: HospitalBranding = {
  hospitalName: '',
  brandNameSecondary: '',
  servicesList: '',
  address1: '', address2: '', address3: '',
  city: '', state: '', pincode: '',
  phone: '', email: '', website: '',
  logoDataUrl: '',
  headerShowLogo: true, headerLogoSize: 60,
  headerLogoPosition: 'left', headerLogoShape: 'circle',
  headerShowName: true, headerNameFontSize: 18, headerNameColor: '#1e3a5f', headerNameAlign: 'left',
  headerSecondaryNameColor: '#2563eb',
  headerShowServices: true, headerServicesFontSize: 10, headerServicesColor: '#1a1a1a', headerServicesAlign: 'left',
  headerShowAddress: true, headerAddressFontSize: 8, headerAddressColor: '#2563eb', headerAddressAlign: 'left',
  headerShowContact: true, headerContactFontSize: 9, headerContactColor: '#333333', headerContactAlign: 'left',
  headerBgColor: '#ffffff', headerBorderBottomColor: '#2563eb',
  enableFooter: true,
  footerLayout: { left: 'name', center: 'custom', right: 'address' },
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-app-border bg-app-surface p-3">
      <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-app-accent">{title}</h3>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function TextInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="flex items-center gap-2 text-xs text-app-text-secondary">
      <span className="w-24 shrink-0">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 rounded border border-app-border bg-app-surface px-2 py-1 text-xs text-app-text"
      />
    </label>
  );
}

function CheckboxField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-xs text-app-text-secondary cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="rounded" />
      <span>{label}</span>
    </label>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <label className="flex items-center gap-2 text-xs text-app-text-secondary">
      <span className="w-24 shrink-0">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-app-border bg-app-surface px-2 py-1 text-xs text-app-text"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

export function BrandingPage() {
  const config = useConfigStore((s) => s.config);
  const saveBranding = useConfigStore((s) => s.saveBranding);
  const [local, setLocal] = useState<HospitalBranding>(DEFAULT_BRANDING);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (config?.branding) {
      setLocal({ ...DEFAULT_BRANDING, ...config.branding });
    }
  }, [config?.branding]);

  const update = useCallback(<K extends keyof HospitalBranding>(key: K, value: HospitalBranding[K]) => {
    setLocal((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }, []);

  const updateFooterLayout = useCallback((slot: 'left' | 'center' | 'right', value: PrintSlotContent) => {
    setLocal((prev) => ({
      ...prev,
      footerLayout: { ...prev.footerLayout, [slot]: value },
    }));
    setSaved(false);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveBranding(local);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error('Failed to save branding:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setLocal(DEFAULT_BRANDING);
    setSaved(false);
  };

  return (
    <div className="flex h-full">
      {/* Form */}
      <div className="flex-1 overflow-auto p-4">
        <div className="mx-auto flex max-w-2xl flex-col gap-3">
          <Section title="Logo">
            <LogoUploader
              logoDataUrl={local.logoDataUrl}
              onChange={(v) => update('logoDataUrl', v)}
            />
            <div className="flex flex-wrap gap-4">
              <NumberField label="Size" value={local.headerLogoSize} onChange={(v) => update('headerLogoSize', v)} min={20} max={120} unit="px" />
              <SelectField
                label="Position"
                value={local.headerLogoPosition}
                onChange={(v) => update('headerLogoPosition', v as 'left' | 'center' | 'right')}
                options={[{ value: 'left', label: 'Left' }, { value: 'center', label: 'Center' }, { value: 'right', label: 'Right' }]}
              />
              <SelectField
                label="Shape"
                value={local.headerLogoShape}
                onChange={(v) => update('headerLogoShape', v as 'circle' | 'square')}
                options={[{ value: 'circle', label: 'Circle' }, { value: 'square', label: 'Square' }]}
              />
            </div>
          </Section>

          <Section title="Hospital Identity">
            <TextInput label="Name" value={local.hospitalName} onChange={(v) => update('hospitalName', v)} placeholder="Hospital name" />
            <TextInput label="Secondary" value={local.brandNameSecondary} onChange={(v) => update('brandNameSecondary', v)} placeholder="Secondary brand name" />
            <TextInput label="Services" value={local.servicesList} onChange={(v) => update('servicesList', v)} placeholder="Ultrasound|X-Ray|CT Scan" />
            <div className="flex flex-wrap gap-4">
              <CheckboxField label="Show name" checked={local.headerShowName} onChange={(v) => update('headerShowName', v)} />
              <CheckboxField label="Show services" checked={local.headerShowServices} onChange={(v) => update('headerShowServices', v)} />
              <CheckboxField label="Show logo" checked={local.headerShowLogo} onChange={(v) => update('headerShowLogo', v)} />
            </div>
          </Section>

          <div className="grid grid-cols-2 gap-3">
            <Section title="Address">
              <TextInput label="Line 1" value={local.address1} onChange={(v) => update('address1', v)} />
              <TextInput label="Line 2" value={local.address2} onChange={(v) => update('address2', v)} />
              <TextInput label="Line 3" value={local.address3} onChange={(v) => update('address3', v)} />
              <TextInput label="City" value={local.city} onChange={(v) => update('city', v)} />
              <TextInput label="State" value={local.state} onChange={(v) => update('state', v)} />
              <TextInput label="Pincode" value={local.pincode} onChange={(v) => update('pincode', v)} />
              <CheckboxField label="Show address in header" checked={local.headerShowAddress} onChange={(v) => update('headerShowAddress', v)} />
            </Section>

            <Section title="Contact">
              <TextInput label="Phone" value={local.phone} onChange={(v) => update('phone', v)} />
              <TextInput label="Email" value={local.email} onChange={(v) => update('email', v)} />
              <TextInput label="Website" value={local.website} onChange={(v) => update('website', v)} />
              <CheckboxField label="Show contact in header" checked={local.headerShowContact} onChange={(v) => update('headerShowContact', v)} />
            </Section>
          </div>

          <Section title="Header Style">
            <div className="flex flex-wrap gap-4">
              <ColorField label="Background" value={local.headerBgColor} onChange={(v) => update('headerBgColor', v)} />
              <ColorField label="Border" value={local.headerBorderBottomColor} onChange={(v) => update('headerBorderBottomColor', v)} />
              <ColorField label="Name color" value={local.headerNameColor} onChange={(v) => update('headerNameColor', v)} />
              <ColorField label="Secondary" value={local.headerSecondaryNameColor} onChange={(v) => update('headerSecondaryNameColor', v)} />
            </div>
            <div className="flex flex-wrap gap-4">
              <NumberField label="Name size" value={local.headerNameFontSize} onChange={(v) => update('headerNameFontSize', v)} min={10} max={36} unit="px" />
              <SelectField
                label="Name align"
                value={local.headerNameAlign}
                onChange={(v) => update('headerNameAlign', v as 'left' | 'center' | 'right')}
                options={[{ value: 'left', label: 'Left' }, { value: 'center', label: 'Center' }, { value: 'right', label: 'Right' }]}
              />
            </div>
            <div className="flex flex-wrap gap-4">
              <ColorField label="Services" value={local.headerServicesColor} onChange={(v) => update('headerServicesColor', v)} />
              <ColorField label="Address" value={local.headerAddressColor} onChange={(v) => update('headerAddressColor', v)} />
              <ColorField label="Contact" value={local.headerContactColor} onChange={(v) => update('headerContactColor', v)} />
            </div>
            <div className="flex flex-wrap gap-4">
              <NumberField label="Address size" value={local.headerAddressFontSize} onChange={(v) => update('headerAddressFontSize', v)} min={6} max={32} unit="px" />
              <NumberField label="Contact size" value={local.headerContactFontSize} onChange={(v) => update('headerContactFontSize', v)} min={6} max={32} unit="px" />
            </div>
          </Section>

          <Section title="Footer">
            <CheckboxField label="Enable footer" checked={local.enableFooter} onChange={(v) => update('enableFooter', v)} />
            {local.enableFooter && (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <FooterSlotPicker
                    label="Left"
                    value={local.footerLayout.left}
                    customText={local.customFooterLeft}
                    onChange={(v) => updateFooterLayout('left', v)}
                    onCustomTextChange={(v) => update('customFooterLeft', v)}
                  />
                  <FooterSlotPicker
                    label="Center"
                    value={local.footerLayout.center}
                    customText={local.customFooterCenter}
                    onChange={(v) => updateFooterLayout('center', v)}
                    onCustomTextChange={(v) => update('customFooterCenter', v)}
                  />
                  <FooterSlotPicker
                    label="Right"
                    value={local.footerLayout.right}
                    customText={local.customFooterRight}
                    onChange={(v) => updateFooterLayout('right', v)}
                    onCustomTextChange={(v) => update('customFooterRight', v)}
                  />
                </div>
                <div className="flex flex-wrap gap-4">
                  <NumberField label="Font size" value={local.footerFontSize} onChange={(v) => update('footerFontSize', v)} min={6} max={32} unit="px" />
                  <ColorField label="Font color" value={local.footerFontColor} onChange={(v) => update('footerFontColor', v)} />
                  <ColorField label="Background" value={local.footerBgColor} onChange={(v) => update('footerBgColor', v)} />
                  <ColorField label="Border" value={local.footerBorderTopColor} onChange={(v) => update('footerBorderTopColor', v)} />
                </div>
              </>
            )}
          </Section>

          <Section title="Patient Metadata on Print">
            <p className="text-[10px] text-app-text-muted mb-1">Select which patient details to show in the dark bar below the header on printed pages.</p>
            <div className="grid grid-cols-3 gap-2">
              <CheckboxField label="Patient Name" checked={local.metadataPrintPatientName} onChange={(v) => update('metadataPrintPatientName', v)} />
              <CheckboxField label="Patient ID" checked={local.metadataPrintPatientId} onChange={(v) => update('metadataPrintPatientId', v)} />
              <CheckboxField label="Age" checked={local.metadataPrintAge} onChange={(v) => update('metadataPrintAge', v)} />
              <CheckboxField label="Sex" checked={local.metadataPrintSex} onChange={(v) => update('metadataPrintSex', v)} />
              <CheckboxField label="Modality" checked={local.metadataPrintModality} onChange={(v) => update('metadataPrintModality', v)} />
              <CheckboxField label="Study Name" checked={local.metadataPrintStudyName} onChange={(v) => update('metadataPrintStudyName', v)} />
              <CheckboxField label="Accession No" checked={local.metadataPrintAccessNo} onChange={(v) => update('metadataPrintAccessNo', v)} />
              <CheckboxField label="Ref By / Done By" checked={local.metadataPrintRefBy} onChange={(v) => update('metadataPrintRefBy', v)} />
            </div>
          </Section>

          <Section title="Image Appearance">
            <CheckboxField label="Black background (full-bleed dark page)" checked={local.printBlackBg} onChange={(v) => update('printBlackBg', v)} />
            <CheckboxField label="Print border around images" checked={local.printBorderEnabled} onChange={(v) => update('printBorderEnabled', v)} />
            {local.printBorderEnabled && (
              <ColorField label="Border color" value={local.printBorderColor} onChange={(v) => update('printBorderColor', v)} />
            )}
          </Section>

          {/* Actions */}
          <div className="flex items-center justify-between py-2">
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 rounded border border-app-border px-3 py-1.5 text-xs text-app-text-secondary hover:bg-app-hover"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset to Defaults
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 rounded bg-app-accent px-4 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? 'Saving...' : saved ? 'Saved!' : 'Save & Apply'}
            </button>
          </div>
        </div>
      </div>

      {/* Live preview sidebar */}
      <div className="w-80 shrink-0 border-l border-app-border bg-app-bg p-4 overflow-auto">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-app-text-secondary">Live Preview</h3>
        <BrandingPreview branding={local} />
        <p className="mt-2 text-[10px] text-app-text-secondary">
          This preview shows how the header and footer will appear on printed pages.
        </p>
      </div>
    </div>
  );
}
