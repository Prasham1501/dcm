/**
 * SlotQuotaModal — toggle per-slot print quota + edit remaining prints.
 *
 *  - quotaEnabled OFF (default): slot prints unlimited (software licence).
 *  - quotaEnabled ON: each print decrements quotaRemaining; alert <=50; stop at 0.
 *
 * Opened either from a slot card or from the global Ctrl+Shift+Q
 * keybinding. Already wrapped in a PasswordModal upstream.
 */
import { useEffect, useState } from 'react';
import { X, Save, ToggleLeft, ToggleRight, Plus } from 'lucide-react';
import type { PrinterSlot } from '@/types/bridge';
import { useConfigStore } from '@/stores/configStore';

export function SlotQuotaModal({ slot, onClose }: { slot: PrinterSlot; onClose: () => void }) {
  const reload = useConfigStore((s) => s.load);
  const [enabled, setEnabled]     = useState(slot.quotaEnabled);
  const [remaining, setRemaining] = useState(slot.quotaRemaining || 0);
  const [topUp, setTopUp]         = useState(0);
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);

  useEffect(() => {
    setEnabled(slot.quotaEnabled);
    setRemaining(slot.quotaRemaining || 0);
  }, [slot.id, slot.quotaEnabled, slot.quotaRemaining]);

  async function save() {
    setSaving(true);
    try {
      const finalRemaining = remaining + (topUp || 0);
      const finalTotal     = Math.max(slot.quotaTotal || 0, finalRemaining);
      await window.bridgeAPI.setSlotQuota({
        slotId: slot.id,
        quotaEnabled: enabled,
        quotaRemaining: finalRemaining,
        quotaTotal: finalTotal,
      });
      await reload();
      setSaved(true);
      setTimeout(() => onClose(), 800);
    } finally {
      setSaving(false);
    }
  }

  const low = enabled && remaining + topUp <= 50;
  const empty = enabled && remaining + topUp <= 0;

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg bg-app-bg shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-app-border bg-app-header-bg px-4 py-2">
          <h3 className="text-sm font-bold text-app-text">Print Quota · {slot.name}</h3>
          <button onClick={onClose} title="Close"
            className="rounded p-1 text-app-text-secondary hover:bg-app-hover hover:text-app-text">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-4 text-sm">
          {/* Mode toggle */}
          <div className="rounded border border-app-border p-3">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <div className="font-semibold text-app-text">Quota mode</div>
                <p className="mt-0.5 text-xs text-app-text-secondary">
                  {enabled
                    ? 'Sell-by-print: each printed page decrements the counter. Bridge will stop printing when it hits zero.'
                    : 'Unlimited (software licence): prints are not counted.'}
                </p>
              </div>
              <button
                onClick={() => setEnabled((v) => !v)}
                className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold transition ${
                  enabled ? 'bg-app-accent text-white' : 'bg-app-hover text-app-text-secondary'
                }`}
              >
                {enabled ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                {enabled ? 'On' : 'Off'}
              </button>
            </div>
          </div>

          {/* Counters (only meaningful when quota is on) */}
          <div className={`space-y-3 rounded border border-app-border p-3 ${enabled ? '' : 'opacity-40'}`}>
            <div className="flex items-center justify-between gap-3">
              <label className="text-xs font-bold uppercase text-app-text-muted">Remaining prints</label>
              <input
                type="number"
                min={0}
                value={remaining}
                disabled={!enabled}
                onChange={(e) => setRemaining(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-28 rounded border border-app-border bg-app-bg px-2 py-1 text-right font-mono text-sm text-app-text"
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-1 text-xs font-bold uppercase text-app-text-muted">
                <Plus className="h-3 w-3" /> Add top-up
              </label>
              <input
                type="number"
                min={0}
                value={topUp || ''}
                placeholder="0"
                disabled={!enabled}
                onChange={(e) => setTopUp(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-28 rounded border border-app-border bg-app-bg px-2 py-1 text-right font-mono text-sm text-app-text"
              />
            </div>
            <div className="border-t border-app-border pt-2 text-xs">
              {empty
                ? <span className="font-semibold text-red-500">After save: 0 prints — slot will refuse to print.</span>
                : low
                  ? <span className="font-semibold text-amber-500">After save: {remaining + (topUp || 0)} prints — below 50 (low-quota alert active).</span>
                  : <span className="text-app-text-secondary">After save: <b className="text-app-text">{remaining + (topUp || 0)}</b> prints available.</span>}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={onClose}
              className="rounded border border-app-border bg-app-bg px-3 py-1.5 text-xs text-app-text hover:bg-app-hover">
              Cancel
            </button>
            <button onClick={save} disabled={saving}
              className="flex items-center gap-1.5 rounded bg-app-accent px-4 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50">
              <Save className="h-3.5 w-3.5" />
              {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Quota'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
