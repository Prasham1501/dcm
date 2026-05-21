import { useState } from 'react';
import { Trash2, Power, Save } from 'lucide-react';
import type { PrinterSlot } from '@/types/bridge';
import { useConfigStore } from '@/stores/configStore';
import { PrinterPicker } from './PrinterPicker';

const PAPER_OPTIONS = ['A3', 'A4', 'A5', 'Letter', 'Legal'] as const;

interface Props {
  slot: PrinterSlot;
  index: number;
  /** Called after a successful save. The parent (modal) uses this to close. */
  onSaved?: () => void;
  /** Called after the slot is deleted. */
  onRemoved?: () => void;
}

export function SlotCard({ slot, index, onSaved, onRemoved }: Props) {
  const [draft, setDraft] = useState<PrinterSlot>(slot);
  const [errors, setErrors] = useState<string[]>([]);
  const upsert = useConfigStore((s) => s.upsertSlot);
  const remove = useConfigStore((s) => s.removeSlot);
  const slotStatus = useConfigStore((s) => s.slotStatus);

  const status = slotStatus.find((st) => st.slotId === slot.id);
  const dirty = JSON.stringify(draft) !== JSON.stringify(slot);

  const update = (patch: Partial<PrinterSlot>) => setDraft({ ...draft, ...patch });

  async function save() {
    const r = await upsert(draft);
    setErrors(r.errors || []);
    if (r.ok) onSaved?.();
  }

  async function remove_() {
    if (!confirm(`Remove ${slot.name}?`)) return;
    await remove(slot.id);
    onRemoved?.();
  }

  return (
    <div className="overflow-hidden rounded border-2 border-app-border bg-app-surface">
      <div className="flex items-center justify-between bg-app-header-bg px-3 py-1.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wide text-app-accent">PRINTER {index}</span>
          <input
            value={draft.name}
            onChange={(e) => update({ name: e.target.value })}
            className="rounded border border-app-border bg-app-bg px-2 py-0.5 text-xs text-app-text"
          />
          <span className={`flex items-center gap-1 text-2xs ${status?.listening ? 'text-green-500' : 'text-app-text-muted'}`}>
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${status?.listening ? 'bg-green-500' : 'bg-gray-500'}`} />
            {status?.listening ? 'Listening' : draft.enabled ? 'Starting…' : 'Disabled'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => update({ enabled: !draft.enabled })}
            title={draft.enabled ? 'Disable' : 'Enable'}
            className={`rounded p-1 ${draft.enabled ? 'text-green-500' : 'text-app-text-muted'} hover:bg-app-hover`}
          >
            <Power className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={remove_}
            title="Remove"
            className="rounded p-1 text-red-500 hover:bg-app-hover"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-x-4 gap-y-2 p-3 text-xs">
        <Field label="AE Title">
          <input
            value={draft.aeTitle}
            maxLength={16}
            onChange={(e) => update({ aeTitle: e.target.value.toUpperCase() })}
            className="w-full rounded border border-app-border bg-app-bg px-2 py-1 font-mono text-xs text-app-text"
          />
        </Field>
        <Field label="Bind IP">
          {/* Lets the user pin the listener to a specific NIC on multi-network
              hospital LANs. Empty = bind to all interfaces (0.0.0.0). The
              raw string is kept while editing so users can fully clear the
              field; the default is applied only on save / blur. */}
          <input
            value={draft.bindHost ?? ''}
            onChange={(e) => update({ bindHost: e.target.value })}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (!v) update({ bindHost: '0.0.0.0' });
            }}
            placeholder="0.0.0.0 (all interfaces)"
            className="w-full rounded border border-app-border bg-app-bg px-2 py-1 font-mono text-xs text-app-text"
          />
        </Field>
        <Field label="Port">
          <input
            type="number"
            value={draft.port}
            onChange={(e) => update({ port: parseInt(e.target.value, 10) || 0 })}
            className="w-full rounded border border-app-border bg-app-bg px-2 py-1 text-xs text-app-text"
          />
        </Field>

        <Field label="Windows Printer" full>
          <PrinterPicker value={draft.windowsPrinterName} onChange={(name) => update({ windowsPrinterName: name })} />
        </Field>

        <Field label="Paper" full>
          <select
            value={draft.paperSize}
            onChange={(e) => update({ paperSize: e.target.value as any })}
            className="w-full rounded border border-app-border bg-app-bg px-2 py-1 text-xs text-app-text"
          >
            {PAPER_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>
      </div>

      {errors.length > 0 && (
        <div className="border-t border-app-border bg-red-500/10 px-3 py-2 text-2xs text-red-500">
          {errors.map((e, i) => <div key={i}>• {e}</div>)}
        </div>
      )}

      <div className="flex justify-end gap-2 border-t border-app-border bg-app-header-bg px-3 py-2">
        <button
          onClick={() => setDraft(slot)}
          disabled={!dirty}
          className="rounded border border-app-border bg-app-bg px-3 py-1 text-xs text-app-text disabled:opacity-40"
        >
          Reset
        </button>
        <button
          onClick={save}
          disabled={!dirty}
          className="flex items-center gap-1 rounded border-2 border-app-accent bg-app-accent px-3 py-1 text-xs font-semibold text-white hover:bg-app-accent-hover disabled:opacity-40"
        >
          <Save className="h-3 w-3" /> Save & Apply
        </button>
      </div>
    </div>
  );
}

function Field({ label, children, full = false }: { label: string; children: React.ReactNode; full?: boolean }) {
  // `full` means "span the whole row" regardless of grid column count
  // (the parent uses 3 cols now).
  return (
    <label className={`flex flex-col gap-1 ${full ? 'col-span-3' : ''}`}>
      <span className="text-2xs font-semibold uppercase tracking-wide text-app-text-muted">{label}</span>
      {children}
    </label>
  );
}
