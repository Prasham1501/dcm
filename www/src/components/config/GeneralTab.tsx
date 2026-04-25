import { useRef } from 'react';
import { useHospitalConfigStore, type PrintSlotContent } from '@/stores/hospitalConfigStore';

const SLOT_OPTIONS: { value: PrintSlotContent; label: string }[] = [
  { value: 'logo', label: 'Logo' },
  { value: 'name', label: 'Hospital Name' },
  { value: 'address', label: 'Address' },
  { value: 'custom', label: 'Custom Text' },
  { value: 'none', label: 'None' },
];

export function GeneralTab() {
  const config = useHospitalConfigStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        config.setLogo(reader.result);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-5">
      {/* Hospital Information */}
      <div>
        <h3 className="text-sm font-bold text-app-accent mb-3 pb-1 border-b border-app-border">
          Hospital Information
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Hospital Name" value={config.hospitalName} onChange={(v) => config.updateField('hospitalName', v)} />
          <FormSelect
            label="Timezone"
            value={config.timezone}
            onChange={(v) => config.updateField('timezone', v)}
            options={[
              { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST)' },
              { value: 'America/New_York', label: 'America/New_York (EST)' },
              { value: 'Europe/London', label: 'Europe/London (GMT)' },
              { value: 'Asia/Dubai', label: 'Asia/Dubai (GST)' },
            ]}
          />
          <FormField label="Registration No." value={config.registration} onChange={(v) => config.updateField('registration', v)} />
          <FormField label="Website" value={config.website} onChange={(v) => config.updateField('website', v)} />
        </div>
      </div>

      {/* Address */}
      <div>
        <h3 className="text-sm font-bold text-app-accent mb-3 pb-1 border-b border-app-border">
          Hospital Address
        </h3>
        <div className="space-y-2">
          <FormField label="Address Line 1" value={config.address1} onChange={(v) => config.updateField('address1', v)} />
          <FormField label="Address Line 2" value={config.address2} onChange={(v) => config.updateField('address2', v)} />
          <FormField label="Address Line 3" value={config.address3} onChange={(v) => config.updateField('address3', v)} />
          <div className="grid grid-cols-3 gap-3">
            <FormField label="City" value={config.city} onChange={(v) => config.updateField('city', v)} />
            <FormField label="State" value={config.state} onChange={(v) => config.updateField('state', v)} />
            <FormField label="PIN Code" value={config.pincode} onChange={(v) => config.updateField('pincode', v)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Phone" value={config.phone} onChange={(v) => config.updateField('phone', v)} />
            <FormField label="Email" value={config.email} onChange={(v) => config.updateField('email', v)} />
          </div>
        </div>
      </div>

      {/* Logo */}
      <div>
        <h3 className="text-sm font-bold text-app-accent mb-3 pb-1 border-b border-app-border">
          Logo Settings
        </h3>
        <div className="flex items-start gap-4">
          <div className="w-28 h-20 border border-app-border rounded flex items-center justify-center bg-app-surface text-app-text-muted text-xs overflow-hidden">
            {config.logoDataUrl ? (
              <img src={config.logoDataUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
            ) : (
              'No Logo'
            )}
          </div>
          <div className="space-y-2">
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            <div className="flex gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1 text-xs font-semibold border-2 border-app-accent text-app-accent bg-app-bg rounded hover:bg-app-accent hover:text-white transition-colors"
              >
                Upload Logo
              </button>
              {config.logoDataUrl && (
                <button
                  onClick={() => config.removeLogo()}
                  className="px-3 py-1 text-xs font-semibold border-2 border-red-500 text-red-500 bg-app-bg rounded hover:bg-red-500 hover:text-white transition-colors"
                >
                  Remove
                </button>
              )}
            </div>
            <div className="space-y-1">
              <label className="flex items-center gap-2 text-xs text-app-text">
                <input type="checkbox" checked={config.showLogoInHeader} onChange={(e) => config.updateField('showLogoInHeader', e.target.checked)} className="accent-app-accent" />
                Show logo in header
              </label>
              <label className="flex items-center gap-2 text-xs text-app-text">
                <input type="checkbox" checked={config.showLogoInFooter} onChange={(e) => config.updateField('showLogoInFooter', e.target.checked)} className="accent-app-accent" />
                Show logo in footer
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Header Layout */}
      <div>
        <h3 className="text-sm font-bold text-app-accent mb-3 pb-1 border-b border-app-border">
          Print Header Layout
        </h3>
        <div className="grid grid-cols-3 gap-3">
          <FormSelect label="Left" value={config.headerLayout.left} onChange={(v) => config.updateHeaderLayout('left', v as PrintSlotContent)} options={SLOT_OPTIONS} />
          <FormSelect label="Center" value={config.headerLayout.center} onChange={(v) => config.updateHeaderLayout('center', v as PrintSlotContent)} options={SLOT_OPTIONS} />
          <FormSelect label="Right" value={config.headerLayout.right} onChange={(v) => config.updateHeaderLayout('right', v as PrintSlotContent)} options={SLOT_OPTIONS} />
        </div>
        <div className="mt-2">
          <FormField label="Custom Header Text" value={config.customHeaderText} onChange={(v) => config.updateField('customHeaderText', v)} />
        </div>
      </div>

      {/* Footer Layout */}
      <div>
        <h3 className="text-sm font-bold text-app-accent mb-3 pb-1 border-b border-app-border flex items-center justify-between">
          <span>Print Footer Layout</span>
          <label className="flex items-center gap-2 text-xs font-medium text-app-text cursor-pointer">
            <input
              type="checkbox"
              checked={config.enableFooter}
              onChange={(e) => config.updateField('enableFooter', e.target.checked)}
              className="accent-app-accent"
            />
            Enable Footer
          </label>
        </h3>
        <div className={config.enableFooter ? '' : 'opacity-40 pointer-events-none'}>
          <div className="grid grid-cols-3 gap-3">
            <FormSelect label="Left" value={config.footerLayout.left} onChange={(v) => config.updateFooterLayout('left', v as PrintSlotContent)} options={SLOT_OPTIONS} />
            <FormSelect label="Center" value={config.footerLayout.center} onChange={(v) => config.updateFooterLayout('center', v as PrintSlotContent)} options={SLOT_OPTIONS} />
            <FormSelect label="Right" value={config.footerLayout.right} onChange={(v) => config.updateFooterLayout('right', v as PrintSlotContent)} options={SLOT_OPTIONS} />
          </div>
          <div className="mt-2">
            <FormField label="Custom Footer Text" value={config.customFooterText} onChange={(v) => config.updateField('customFooterText', v)} />
          </div>
        </div>
      </div>
    </div>
  );
}

function FormField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-app-text-secondary mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded-sm focus:border-app-accent focus:outline-none"
      />
    </div>
  );
}

function FormSelect({ label, value, onChange, options }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-app-text-secondary mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded-sm focus:border-app-accent focus:outline-none"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}
