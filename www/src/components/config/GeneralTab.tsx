import { useRef } from 'react';
import { useHospitalConfigStore, type PrintSlotContent, type PrinterConfig } from '@/stores/hospitalConfigStore';
import { Trash2, Star, Power, Plus } from 'lucide-react';
import { useState } from 'react';

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
  const [showAddPrinter, setShowAddPrinter] = useState(false);
  const [newPrinter, setNewPrinter] = useState({ name: '', displayName: '', type: 'Laser' });

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

  const handleAddPrinter = () => {
    if (!newPrinter.name.trim()) return;
    const printer: PrinterConfig = {
      name: newPrinter.name.trim(),
      displayName: newPrinter.displayName.trim() || newPrinter.name.trim(),
      type: newPrinter.type,
      isDefault: config.printers.length === 0,
      isActive: true,
    };
    config.addPrinter(printer);
    setNewPrinter({ name: '', displayName: '', type: 'Laser' });
    setShowAddPrinter(false);
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

      {/* Configured Printers */}
      <div>
        <h3 className="text-sm font-bold text-app-accent mb-3 pb-1 border-b border-app-border flex items-center justify-between">
          <span>Configured Printers</span>
          <button
            onClick={() => setShowAddPrinter(!showAddPrinter)}
            className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold border border-app-accent text-app-accent rounded hover:bg-app-accent hover:text-white transition-colors"
          >
            <Plus className="w-3 h-3" /> Add
          </button>
        </h3>

        {showAddPrinter && (
          <div className="mb-3 p-3 border border-app-border rounded bg-app-surface space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <FormField label="Printer Name" value={newPrinter.name} onChange={(v) => setNewPrinter(p => ({ ...p, name: v }))} />
              <FormField label="Display Name" value={newPrinter.displayName} onChange={(v) => setNewPrinter(p => ({ ...p, displayName: v }))} />
              <FormSelect label="Type" value={newPrinter.type} onChange={(v) => setNewPrinter(p => ({ ...p, type: v }))} options={[
                { value: 'Laser', label: 'Laser' },
                { value: 'Inkjet', label: 'Inkjet' },
                { value: 'DICOM Thermal', label: 'DICOM Thermal' },
                { value: 'DICOM Dry Laser', label: 'DICOM Dry Laser' },
                { value: 'Virtual', label: 'Virtual' },
              ]} />
            </div>
            <div className="flex gap-2">
              <button onClick={handleAddPrinter} className="px-3 py-1 text-xs font-semibold border-2 border-app-accent text-white bg-app-accent rounded hover:bg-app-accent-hover transition-colors">Add Printer</button>
              <button onClick={() => setShowAddPrinter(false)} className="px-3 py-1 text-xs font-semibold border border-app-border text-app-text rounded hover:bg-app-hover transition-colors">Cancel</button>
            </div>
          </div>
        )}

        {config.printers.length === 0 ? (
          <div className="text-xs text-app-text-muted py-4 text-center border border-dashed border-app-border rounded">
            No printers configured. Click "Add" to add a printer.
          </div>
        ) : (
          <div className="border border-app-border rounded overflow-hidden">
            {config.printers.map((printer) => (
              <div key={printer.name} className="flex items-center gap-2 px-3 py-2 border-b border-app-border last:border-b-0 text-xs">
                <div className="flex-1">
                  <div className="font-semibold text-app-text flex items-center gap-2">
                    {printer.displayName || printer.name}
                    {printer.isDefault && <span className="text-[9px] px-1.5 py-0.5 rounded bg-app-accent text-white">DEFAULT</span>}
                    {!printer.isActive && <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">DISABLED</span>}
                  </div>
                  <div className="text-[10px] text-app-text-muted">{printer.name} &middot; {printer.type}</div>
                </div>
                <button onClick={() => config.setDefaultPrinter(printer.name)} title="Set as default" className={`p-1 rounded hover:bg-app-hover ${printer.isDefault ? 'text-yellow-500' : 'text-app-text-muted'}`}>
                  <Star className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => config.togglePrinterActive(printer.name)} title="Toggle active" className={`p-1 rounded hover:bg-app-hover ${printer.isActive ? 'text-green-500' : 'text-red-400'}`}>
                  <Power className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => config.removePrinter(printer.name)} title="Remove" className="p-1 rounded hover:bg-app-hover text-red-400">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
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
