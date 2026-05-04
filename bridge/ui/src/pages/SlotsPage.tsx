import { Plus } from 'lucide-react';
import { useConfigStore } from '@/stores/configStore';
import { SlotCard } from '@/components/SlotCard';

export function SlotsPage() {
  const config = useConfigStore((s) => s.config);
  const newSlot = useConfigStore((s) => s.newSlot);
  const upsert = useConfigStore((s) => s.upsertSlot);

  async function add() {
    const slot = await newSlot();
    await upsert(slot);
  }

  if (!config) return <div className="p-6 text-app-text-muted">Loading…</div>;

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-app-accent">Printer Slots</h2>
          <p className="text-2xs text-app-text-muted">
            Each slot listens on its own AE title + TCP port. Modalities (MRI / CT / USG) configured to send to that AET will print on the mapped Windows printer.
          </p>
        </div>
        <button
          onClick={add}
          className="flex items-center gap-1 rounded border-2 border-app-accent bg-app-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-app-accent-hover"
        >
          <Plus className="h-3.5 w-3.5" /> Add Printer Slot
        </button>
      </div>

      {config.slots.length === 0 ? (
        <div className="rounded border-2 border-dashed border-app-border p-12 text-center text-sm text-app-text-muted">
          No printer slots yet. Click <strong className="text-app-accent">Add Printer Slot</strong> to add one.
        </div>
      ) : (
        <div className="space-y-3">
          {config.slots.map((s, i) => (
            <SlotCard key={s.id} slot={s} index={i + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
