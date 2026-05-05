interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}

export function NumberField({ label, value, onChange, min = 0, max = 100, step = 1, unit }: NumberFieldProps) {
  return (
    <label className="flex items-center gap-2 text-xs text-app-text-secondary">
      <span className="w-24 shrink-0">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        min={min}
        max={max}
        step={step}
        className="w-20 rounded border border-app-border bg-app-surface px-2 py-1 text-xs text-app-text"
      />
      {unit && <span className="text-app-text-secondary">{unit}</span>}
    </label>
  );
}
