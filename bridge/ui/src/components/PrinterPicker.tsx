import { useEffect } from 'react';
import { Printer, RefreshCw } from 'lucide-react';
import { useConfigStore } from '@/stores/configStore';

interface Props {
  value: string;
  onChange: (printerName: string) => void;
}

export function PrinterPicker({ value, onChange }: Props) {
  const printers = useConfigStore((s) => s.systemPrinters);
  const reload = useConfigStore((s) => s.loadSystemPrinters);

  useEffect(() => { if (printers.length === 0) reload(); }, [reload, printers.length]);

  return (
    <div className="flex items-center gap-2">
      <Printer className="h-3.5 w-3.5 text-app-text-muted" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 rounded border border-app-border bg-app-bg px-2 py-1 text-xs text-app-text"
      >
        <option value="">— Select printer —</option>
        {printers.map((p) => (
          <option key={p.name} value={p.name}>
            {p.displayName}{p.isDefault ? '  (OS default)' : ''}
          </option>
        ))}
      </select>
      <button
        onClick={reload}
        title="Refresh printer list"
        className="rounded border border-app-border p-1 text-app-text-muted hover:bg-app-hover"
      >
        <RefreshCw className="h-3 w-3" />
      </button>
    </div>
  );
}
