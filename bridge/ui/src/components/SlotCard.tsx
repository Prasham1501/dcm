import { useMemo, useState } from 'react';
import { Trash2, Power, Save, Plus } from 'lucide-react';
import type { PrinterSlot, FilmMapTarget } from '@/types/bridge';
import { useConfigStore } from '@/stores/configStore';
import { PrinterPicker } from './PrinterPicker';
import { PAPER_OPTIONS, FILM_SIZE_ROWS, MAP_TARGET_OPTIONS } from '@/lib/paperSizes';

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
  const [customFilm, setCustomFilm] = useState('');
  const [customFilms, setCustomFilms] = useState<string[]>([]);
  const upsert = useConfigStore((s) => s.upsertSlot);
  const remove = useConfigStore((s) => s.removeSlot);
  const slotStatus = useConfigStore((s) => s.slotStatus);
  const brandings = useConfigStore((s) => s.config?.brandings || []);

  const status = slotStatus.find((st) => st.slotId === slot.id);
  const dirty = JSON.stringify(draft) !== JSON.stringify(slot);

  const update = (patch: Partial<PrinterSlot>) => setDraft({ ...draft, ...patch });

  const filmMap = draft.filmSizeMap || {};

  // Standard film rows (with friendly labels) + any custom/saved ids that
  // aren't already a standard row (rendered with the raw id as the label).
  const filmRows = useMemo(() => {
    const known = new Set(FILM_SIZE_ROWS.map((r) => r.id));
    const extras = [...new Set([...Object.keys(filmMap), ...customFilms])]
      .filter((id) => !known.has(id))
      .map((id) => ({ id, label: id }));
    return [...FILM_SIZE_ROWS, ...extras];
  }, [filmMap, customFilms]);

  function setFilmTarget(filmId: string, target: '' | FilmMapTarget) {
    const next = { ...(draft.filmSizeMap || {}) };
    if (!target) delete next[filmId];           // '' → no conversion (use default paper)
    else next[filmId] = target;
    update({ filmSizeMap: next });
  }

  function addCustomFilm() {
    const id = customFilm.trim().toUpperCase().replace(/\s+/g, '');
    if (!id) return;
    if (!filmRows.some((r) => r.id === id)) setCustomFilms((prev) => [...prev, id]);
    setCustomFilm('');
  }

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

        <Field label="Default Paper">
          <select
            value={draft.paperSize}
            onChange={(e) => update({ paperSize: e.target.value as PrinterSlot['paperSize'] })}
            className="w-full rounded border border-app-border bg-app-bg px-2 py-1 text-xs text-app-text"
          >
            {PAPER_OPTIONS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </Field>

        <Field label="Branding (header / footer)" full>
          <select
            value={draft.brandingId ?? ''}
            onChange={(e) => update({ brandingId: e.target.value || null })}
            className="w-full rounded border border-app-border bg-app-bg px-2 py-1 text-xs text-app-text"
          >
            <option value="">Use default branding</option>
            {brandings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </Field>
      </div>

      {/* Paper sizes — one row per incoming DICOM film size, each mapped to a
          target paper (mirrors the reference printing-bridge layout). */}
      <div className="border-t border-app-border px-3 py-3 text-xs">
        <div className="mb-1 text-sm font-bold text-app-accent">Paper sizes</div>
        <p className="mb-2 text-2xs text-app-text-muted">
          Convert each incoming DICOM film size to a paper size. Rows left on
          <em> Default paper</em> use the slot default ({draft.paperSize}); image
          jobs (no film size) always use the default.
        </p>
        <div className="space-y-1.5">
          {filmRows.map((row) => (
            <div key={row.id} className="flex items-center gap-2">
              <span className="flex-1 text-app-text">
                Print <span className="font-semibold">{row.label}</span> film size print job on this paper size
              </span>
              <select
                value={(filmMap[row.id] as string) || ''}
                onChange={(e) => setFilmTarget(row.id, e.target.value as '' | FilmMapTarget)}
                className="w-64 shrink-0 rounded border border-app-border bg-app-bg px-2 py-1 text-2xs text-app-text"
              >
                <option value="">Default paper ({draft.paperSize})</option>
                {MAP_TARGET_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <input
            value={customFilm}
            onChange={(e) => setCustomFilm(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomFilm(); } }}
            placeholder="Add another film size ID (e.g. 24CMX30CM)"
            className="flex-1 rounded border border-app-border bg-app-bg px-2 py-1 font-mono text-2xs text-app-text"
          />
          <button
            onClick={addCustomFilm}
            className="flex items-center gap-1 rounded border border-app-accent px-2 py-1 text-2xs font-semibold text-app-accent hover:bg-app-accent hover:text-white"
          >
            <Plus className="h-3 w-3" /> Add
          </button>
        </div>
      </div>

      {/* Print contrast — per-slot gamma LUT. Deepens (or lightens) the dark
          tones of the printed image without touching the white paper. */}
      <div className="border-t border-app-border px-3 py-3 text-xs">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!draft.lutEnabled}
            onChange={(e) => update({ lutEnabled: e.target.checked, lutGamma: draft.lutGamma ?? 1.0 })}
          />
          <span className="text-sm font-bold text-app-accent">Print contrast (adjust black level)</span>
        </label>
        {draft.lutEnabled && (
          <div className="mt-2">
            <div className="flex items-center gap-3">
              <span className="text-2xs text-app-text-muted">Lighter</span>
              <input
                type="range"
                min={0.3}
                max={3}
                step={0.1}
                value={draft.lutGamma ?? 1.0}
                onChange={(e) => update({ lutGamma: parseFloat(e.target.value) })}
                className="flex-1"
              />
              <span className="text-2xs text-app-text-muted">Darker</span>
              <button
                type="button"
                onClick={() => update({ lutGamma: 1.0 })}
                className="rounded border border-app-border px-2 py-0.5 text-2xs text-app-text hover:bg-app-hover"
              >
                Reset
              </button>
            </div>
            <p className="mt-1 text-2xs text-app-text-muted">
              {(() => {
                const g = draft.lutGamma ?? 1.0;
                const label = Math.abs(g - 1) < 0.05 ? 'No change' : g > 1 ? 'Darker / denser blacks' : 'Lighter';
                return <>gamma {g.toFixed(1)} — <span className="font-semibold">{label}</span>. Whites stay white; only the darker tones shift.</>;
              })()}
            </p>
          </div>
        )}
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
