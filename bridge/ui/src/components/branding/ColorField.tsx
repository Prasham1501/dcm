interface ColorFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export function ColorField({ label, value, onChange }: ColorFieldProps) {
  return (
    <label className="flex items-center gap-2 text-xs text-app-text-secondary">
      <span className="w-24 shrink-0">{label}</span>
      <input
        type="color"
        value={value || '#000000'}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 w-8 cursor-pointer rounded border border-app-border bg-transparent p-0"
      />
      <input
        type="text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-20 rounded border border-app-border bg-app-surface px-2 py-1 text-xs text-app-text"
        placeholder="#000000"
      />
    </label>
  );
}
