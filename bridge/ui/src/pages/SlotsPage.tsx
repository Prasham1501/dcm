import { useEffect, useState } from 'react';
import { Plus, Printer, X, Copy, Check, FileText, Coins } from 'lucide-react';
import { useConfigStore } from '@/stores/configStore';
import { SlotCard } from '@/components/SlotCard';
import { SlotHistoryModal } from '@/components/SlotHistoryModal';
import { SlotQuotaModal } from '@/components/SlotQuotaModal';
import { PasswordModal } from '@/components/PasswordModal';
import type { PrinterSlot } from '@/types/bridge';

// Same password protects "Add Printer Slot" and "Quota Settings".
const ADMIN_PASSWORD = 'Prasham123$';

export function SlotsPage() {
  const config = useConfigStore((s) => s.config);
  const newSlot = useConfigStore((s) => s.newSlot);
  const upsert = useConfigStore((s) => s.upsertSlot);
  const slotStatus = useConfigStore((s) => s.slotStatus);
  const [editing, setEditing] = useState<PrinterSlot | null>(null);
  const [editingIndex, setEditingIndex] = useState(0);
  const [historySlot, setHistorySlot] = useState<PrinterSlot | null>(null);
  // `passwordIntent` describes what to do once the password modal succeeds.
  // Keeps the gate generic without baking specific actions into the modal.
  const [passwordIntent, setPasswordIntent] = useState<null | { kind: 'add' } | { kind: 'quota'; slotId: string }>(null);
  const [quotaSlot, setQuotaSlot] = useState<PrinterSlot | null>(null);
  const [ips, setIps] = useState<{ iface: string; address: string }[]>([]);
  const [copied, setCopied] = useState<string>('');

  useEffect(() => {
    window.bridgeAPI.getLocalIps?.().then((list) => setIps(list || [])).catch(() => {});
  }, []);

  // Subscribe to live config changes so the quota counter refreshes after
  // each printed job without the user reopening the page.
  useEffect(() => {
    const off = window.bridgeAPI.onConfigChanged?.(() => { useConfigStore.getState().load(); });
    return () => { try { off && off(); } catch {} };
  }, []);

  // Global keybinding (registered in main process) → ask for password,
  // then open the quota modal for the first slot.
  useEffect(() => {
    const off = window.bridgeAPI.onOpenQuotaSettings?.(() => {
      const first = useConfigStore.getState().config?.slots?.[0];
      if (!first) {
        alert('Add a printer slot first.');
        return;
      }
      setPasswordIntent({ kind: 'quota', slotId: first.id });
    });
    return () => { try { off && off(); } catch {} };
  }, []);

  const primaryIp = ips[0]?.address || 'localhost';

  function copy(text: string, key: string) {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(''), 1200);
    }).catch(() => {});
  }

  async function doAdd() {
    const slot = await newSlot();
    await upsert(slot);
    setEditing(slot);
    setEditingIndex((config?.slots.length ?? 0) + 1);
  }

  if (!config) return <div className="p-6 text-app-text-muted">Loading…</div>;

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-app-accent">Printer Slots</h2>
          <p className="text-2xs text-app-text-muted">
            Each slot listens on its own AE title + IP + TCP port. Click a card to edit, or the history icon to see daily / monthly / yearly print activity.
          </p>
        </div>
        <button
          onClick={() => setPasswordIntent({ kind: 'add' })}
          className="flex items-center gap-1 rounded border-2 border-app-accent bg-app-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-app-accent-hover"
        >
          <Plus className="h-3.5 w-3.5" /> Add Printer Slot
        </button>
      </div>

      {/* This PC's address — point modalities here */}
      {ips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-app-border bg-app-surface px-3 py-2 text-2xs text-app-text-secondary">
          <span className="font-semibold uppercase tracking-wide text-app-text-muted">This PC:</span>
          {ips.map((ip) => (
            <button
              key={ip.address}
              onClick={() => copy(ip.address, ip.address)}
              title={`Copy ${ip.address} (${ip.iface})`}
              className="group flex items-center gap-1 rounded border border-app-border bg-app-bg px-2 py-0.5 font-mono text-xs text-app-text hover:border-app-accent hover:text-app-accent"
            >
              <span>{ip.address}</span>
              <span className="text-app-text-muted">· {ip.iface}</span>
              {copied === ip.address ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3 opacity-50 group-hover:opacity-100" />}
            </button>
          ))}
          <span className="text-app-text-muted">Set modality destination to <span className="font-mono">{'<ip>'}:{'<port>'}</span> with the slot's AE Title.</span>
        </div>
      )}

      {config.slots.length === 0 ? (
        <div className="rounded border-2 border-dashed border-app-border p-12 text-center text-sm text-app-text-muted">
          No printer slots yet. Click <strong className="text-app-accent">Add Printer Slot</strong> to add one.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {config.slots.map((s, i) => {
            const status = slotStatus.find((st) => st.slotId === s.id);
            const listening = !!status?.listening;
            const displayHost = s.bindHost && s.bindHost !== '0.0.0.0' ? s.bindHost : primaryIp;
            return (
              <div
                key={s.id}
                className="flex flex-col items-start gap-2 rounded-lg border-2 border-app-border bg-app-surface p-3 text-left transition hover:border-app-accent hover:shadow-md"
              >
                <div className="flex w-full items-center justify-between">
                  <span className="text-2xs font-bold uppercase tracking-wide text-app-accent">
                    Printer {i + 1}
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex items-center gap-1 text-2xs ${
                        listening ? 'text-green-500' : s.enabled ? 'text-amber-500' : 'text-app-text-muted'
                      }`}
                    >
                      <span
                        className={`inline-block h-1.5 w-1.5 rounded-full ${
                          listening ? 'bg-green-500' : s.enabled ? 'bg-amber-500' : 'bg-gray-400'
                        }`}
                      />
                      {listening ? 'Listening' : s.enabled ? 'Starting…' : 'Off'}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); setHistorySlot(s); }}
                      title="View print history (incl. pings)"
                      className="rounded p-0.5 text-app-text-muted hover:bg-app-hover hover:text-app-accent"
                    >
                      <FileText className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setPasswordIntent({ kind: 'quota', slotId: s.id }); }}
                      title="Quota settings (Ctrl+Shift+Q)"
                      className="rounded p-0.5 text-app-text-muted hover:bg-app-hover hover:text-app-accent"
                    >
                      <Coins className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => { setEditing(s); setEditingIndex(i + 1); }}
                  className="flex w-full flex-col items-start gap-1 text-left"
                >
                  <div className="truncate text-sm font-semibold text-app-text" title={s.name}>
                    {s.name}
                  </div>
                  <div className="font-mono text-2xs text-app-text-secondary">
                    {s.aeTitle} : {s.port}
                  </div>
                  <div
                    className="w-full truncate font-mono text-2xs text-app-accent"
                    title={`Modalities send to ${displayHost}:${s.port}`}
                  >
                    {displayHost}:{s.port}
                  </div>
                  <div className="flex w-full items-center gap-1 truncate text-2xs text-app-text-muted">
                    <Printer className="h-3 w-3 shrink-0" />
                    <span className="truncate" title={s.windowsPrinterName || 'No printer mapped'}>
                      {s.windowsPrinterName || 'No printer mapped'}
                    </span>
                  </div>
                  {/* Paper size + (optional) quota pill */}
                  <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px]">
                    <span className="rounded bg-app-accent/10 px-1.5 py-0.5 font-semibold uppercase tracking-wide text-app-accent">
                      {s.paperSize || 'A4'}
                    </span>
                    {s.quotaEnabled && (
                      <span
                        className={`rounded px-1.5 py-0.5 font-semibold uppercase tracking-wide ${
                          s.quotaRemaining <= 0
                            ? 'bg-red-500/15 text-red-500'
                            : s.quotaRemaining <= 50
                              ? 'bg-amber-500/15 text-amber-500'
                              : 'bg-green-500/15 text-green-500'
                        }`}
                        title={`${s.quotaRemaining} of ${s.quotaTotal || s.quotaRemaining} prints left`}
                      >
                        {s.quotaRemaining} prints left
                      </span>
                    )}
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <SlotConfigModal
          slot={editing}
          index={editingIndex}
          primaryIp={primaryIp}
          onClose={() => setEditing(null)}
        />
      )}

      {historySlot && (
        <SlotHistoryModal slot={historySlot} onClose={() => setHistorySlot(null)} />
      )}

      {quotaSlot && (
        <SlotQuotaModal slot={quotaSlot} onClose={() => setQuotaSlot(null)} />
      )}

      {passwordIntent && (
        <PasswordModal
          title={passwordIntent.kind === 'add' ? 'Add Printer Slot' : 'Quota Settings'}
          message={
            passwordIntent.kind === 'add'
              ? 'Enter the admin password to add a new printer slot.'
              : 'Enter the admin password to change print-quota settings.'
          }
          expected={ADMIN_PASSWORD}
          onOk={() => {
            const intent = passwordIntent;
            setPasswordIntent(null);
            if (intent.kind === 'add') {
              doAdd();
            } else {
              const slot = config.slots.find((s) => s.id === intent.slotId);
              if (slot) setQuotaSlot(slot);
            }
          }}
          onCancel={() => setPasswordIntent(null)}
        />
      )}
    </div>
  );
}

function SlotConfigModal({ slot, index, primaryIp, onClose }: { slot: PrinterSlot; index: number; primaryIp: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const host = slot.bindHost && slot.bindHost !== '0.0.0.0' ? slot.bindHost : primaryIp;
  const endpoint = `${host}:${slot.port}`;
  const copyEndpoint = () => {
    navigator.clipboard?.writeText(endpoint).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    }).catch(() => {});
  };
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-lg bg-app-bg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-app-border bg-app-header-bg px-4 py-2">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-bold text-app-text">Configure Printer {index}</h3>
            <button
              onClick={copyEndpoint}
              title={`Copy ${endpoint}`}
              className="flex items-center gap-1 rounded border border-app-border bg-app-bg px-2 py-0.5 font-mono text-2xs text-app-accent hover:border-app-accent"
            >
              {endpoint}
              {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3 opacity-50" />}
            </button>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-app-text-secondary hover:bg-app-hover hover:text-app-text"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <SlotCard slot={slot} index={index} onSaved={onClose} onRemoved={onClose} />
      </div>
    </div>
  );
}

