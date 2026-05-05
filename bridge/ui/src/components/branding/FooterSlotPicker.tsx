import type { PrintSlotContent } from '@/types/bridge';

interface FooterSlotPickerProps {
  label: string;
  value: PrintSlotContent;
  customText: string;
  onChange: (value: PrintSlotContent) => void;
  onCustomTextChange: (text: string) => void;
}

const OPTIONS: { value: PrintSlotContent; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'logo', label: 'Logo' },
  { value: 'name', label: 'Hospital Name' },
  { value: 'address', label: 'Address' },
  { value: 'custom', label: 'Custom Text' },
];

export function FooterSlotPicker({ label, value, customText, onChange, onCustomTextChange }: FooterSlotPickerProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="flex items-center gap-2 text-xs text-app-text-secondary">
        <span className="w-16 shrink-0">{label}</span>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as PrintSlotContent)}
          className="rounded border border-app-border bg-app-surface px-2 py-1 text-xs text-app-text"
        >
          {OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </label>
      {value === 'custom' && (
        <input
          type="text"
          value={customText}
          onChange={(e) => onCustomTextChange(e.target.value)}
          placeholder="Enter custom text..."
          className="ml-[4.5rem] rounded border border-app-border bg-app-surface px-2 py-1 text-xs text-app-text"
        />
      )}
    </div>
  );
}
