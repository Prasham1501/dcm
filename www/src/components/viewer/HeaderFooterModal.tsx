/**
 * HeaderFooterModal — Configure header and footer zones (left/center/right).
 * Each zone supports: logo, hospital name, address, custom text, or none.
 * Modal stays open until user explicitly closes it — changes only apply on Save.
 */
import { useState } from 'react';
import { X, Check } from 'lucide-react';
import { usePrintStore } from '@/stores/printStore';
import { useHospitalConfigStore, type PrintSlotContent } from '@/stores/hospitalConfigStore';

const SLOT_OPTIONS: { value: PrintSlotContent; label: string }[] = [
  { value: 'none',    label: 'None' },
  { value: 'logo',    label: 'Logo' },
  { value: 'name',    label: 'Hospital Name' },
  { value: 'address', label: 'Address & Phone' },
  { value: 'custom',  label: 'Custom Text' },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export function HeaderFooterModal({ open, onClose }: Props) {
  const config = useHospitalConfigStore();
  const { settings, updateSettings } = usePrintStore();

  const [headerEnabled, setHeaderEnabled]   = useState(settings.headerEnabled);
  const [footerEnabled, setFooterEnabled]   = useState(settings.footerEnabled);

  // Header slots
  const [hLeft,   setHLeft]   = useState(config.headerLayout.left);
  const [hCenter, setHCenter] = useState(config.headerLayout.center);
  const [hRight,  setHRight]  = useState(config.headerLayout.right);
  const [hTextLeft,   setHTextLeft]   = useState(config.customHeaderLeft);
  const [hTextCenter, setHTextCenter] = useState(config.customHeaderCenter);
  const [hTextRight,  setHTextRight]  = useState(config.customHeaderRight);

  // Footer slots
  const [fLeft,   setFLeft]   = useState(config.footerLayout.left);
  const [fCenter, setFCenter] = useState(config.footerLayout.center);
  const [fRight,  setFRight]  = useState(config.footerLayout.right);
  const [fTextLeft,   setFTextLeft]   = useState(config.customFooterLeft);
  const [fTextCenter, setFTextCenter] = useState(config.customFooterCenter);
  const [fTextRight,  setFTextRight]  = useState(config.customFooterRight);

  const [saved, setSaved] = useState(false);

  if (!open) return null;

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    config.updateField('headerLayout', { left: hLeft, center: hCenter, right: hRight });
    config.updateField('footerLayout', { left: fLeft, center: fCenter, right: fRight });
    config.updateField('customHeaderLeft',   hTextLeft);
    config.updateField('customHeaderCenter', hTextCenter);
    config.updateField('customHeaderRight',  hTextRight);
    config.updateField('customFooterLeft',   fTextLeft);
    config.updateField('customFooterCenter', fTextCenter);
    config.updateField('customFooterRight',  fTextRight);
    // keep legacy shared fields in sync too
    config.updateField('customHeaderText', hTextCenter || hTextLeft || hTextRight);
    config.updateField('customFooterText', fTextCenter || fTextLeft || fTextRight);

    updateSettings({ headerEnabled, footerEnabled });

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    // Modal stays open — does NOT close after Save
  };

  // Slot editor for one zone row
  const SlotRow = ({
    label, value, onChange, customText, onCustomText,
  }: {
    label: string;
    value: PrintSlotContent;
    onChange: (v: PrintSlotContent) => void;
    customText: string;
    onCustomText: (v: string) => void;
  }) => (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-app-text-secondary w-12 flex-shrink-0">{label}</span>
        <select
          value={value}
          onChange={e => onChange(e.target.value as PrintSlotContent)}
          onClick={e => e.stopPropagation()}
          className="flex-1 h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded"
        >
          {SLOT_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
      {value === 'custom' && (
        <div className="ml-14">
          <input
            type="text"
            value={customText}
            onChange={e => { e.stopPropagation(); onCustomText(e.target.value); }}
            onClick={e => e.stopPropagation()}
            onKeyDown={e => e.stopPropagation()}
            placeholder={`Enter ${label.toLowerCase()} text…`}
            className="w-full h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded"
          />
        </div>
      )}
    </div>
  );

  // Mini live preview of a zone
  const PreviewCell = ({ slot, customText }: { slot: PrintSlotContent; customText: string }) => {
    switch (slot) {
      case 'logo':
        return config.logoDataUrl
          ? <img src={config.logoDataUrl} className="max-h-5 max-w-12 object-contain" alt="Logo" />
          : <span className="text-[9px] text-gray-400">[No Logo]</span>;
      case 'name':
        return <span className="text-[9px] font-semibold text-gray-700">{config.hospitalName || 'Hospital Name'}</span>;
      case 'address':
        return <span className="text-[9px] text-gray-500">{config.address1 || 'Address'}{config.phone ? ` | ${config.phone}` : ''}</span>;
      case 'custom':
        return <span className="text-[9px] text-gray-600">{customText || <em>custom text…</em>}</span>;
      default:
        return <span className="text-[9px] text-gray-300">—</span>;
    }
  };

  return (
    // Backdrop — clicking outside does NOT close (modal is sticky)
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={e => e.stopPropagation()}
    >
      <div
        className="bg-app-bg border border-app-border rounded-lg shadow-2xl w-[580px] flex flex-col max-h-[85vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Title bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-app-border flex-shrink-0">
          <span className="text-sm font-bold text-app-accent">Header &amp; Footer Settings</span>
          <button type="button" onClick={e => { e.stopPropagation(); onClose(); }} className="text-app-text-muted hover:text-app-text p-1 rounded hover:bg-app-hover">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-auto flex-1 p-4 space-y-5">

          {/* ── HEADER ── */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-app-text">Header</span>
              <label className="flex items-center gap-2 cursor-pointer select-none" onClick={e => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={headerEnabled}
                  onChange={e => { e.stopPropagation(); setHeaderEnabled(e.target.checked); }}
                  className="accent-red-600 w-3.5 h-3.5"
                />
                <span className="text-[11px] text-app-text-secondary">Enabled</span>
              </label>
            </div>

            {headerEnabled && (
              <div className="pl-2 border-l-2 border-app-accent/30 space-y-2">
                <SlotRow label="Left"   value={hLeft}   onChange={setHLeft}   customText={hTextLeft}   onCustomText={setHTextLeft} />
                <SlotRow label="Center" value={hCenter} onChange={setHCenter} customText={hTextCenter} onCustomText={setHTextCenter} />
                <SlotRow label="Right"  value={hRight}  onChange={setHRight}  customText={hTextRight}  onCustomText={setHTextRight} />
                {/* Live preview */}
                <div className="bg-white border border-gray-200 rounded p-2 flex items-center justify-between min-h-[32px] mt-1">
                  <div><PreviewCell slot={hLeft}   customText={hTextLeft} /></div>
                  <div className="text-center"><PreviewCell slot={hCenter} customText={hTextCenter} /></div>
                  <div className="text-right"><PreviewCell slot={hRight}  customText={hTextRight} /></div>
                </div>
              </div>
            )}
          </section>

          {/* ── FOOTER ── */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-app-text">Footer</span>
              <label className="flex items-center gap-2 cursor-pointer select-none" onClick={e => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={footerEnabled}
                  onChange={e => { e.stopPropagation(); setFooterEnabled(e.target.checked); }}
                  className="accent-red-600 w-3.5 h-3.5"
                />
                <span className="text-[11px] text-app-text-secondary">Enabled</span>
              </label>
            </div>

            {footerEnabled && (
              <div className="pl-2 border-l-2 border-app-accent/30 space-y-2">
                <SlotRow label="Left"   value={fLeft}   onChange={setFLeft}   customText={fTextLeft}   onCustomText={setFTextLeft} />
                <SlotRow label="Center" value={fCenter} onChange={setFCenter} customText={fTextCenter} onCustomText={setFTextCenter} />
                <SlotRow label="Right"  value={fRight}  onChange={setFRight}  customText={fTextRight}  onCustomText={setFTextRight} />
                {/* Live preview */}
                <div className="bg-white border border-gray-200 rounded p-2 flex items-center justify-between min-h-[32px] mt-1">
                  <div><PreviewCell slot={fLeft}   customText={fTextLeft} /></div>
                  <div className="text-center"><PreviewCell slot={fCenter} customText={fTextCenter} /></div>
                  <div className="text-right"><PreviewCell slot={fRight}  customText={fTextRight} /></div>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-app-border flex-shrink-0">
          <span className={`text-xs font-semibold transition-opacity duration-500 flex items-center gap-1 ${saved ? 'text-green-500 opacity-100' : 'opacity-0'}`}>
            <Check className="w-3.5 h-3.5" /> Saved!
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onClose(); }}
              className="px-4 py-1.5 text-xs font-semibold border-2 border-app-border text-app-text bg-app-bg rounded hover:bg-app-hover transition-colors"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 text-xs font-semibold border-2 border-app-accent text-white bg-app-accent rounded hover:opacity-90 transition-colors"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
