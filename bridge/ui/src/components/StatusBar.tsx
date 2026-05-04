import { useEffect, useState } from 'react';
import { useConfigStore } from '@/stores/configStore';

export function StatusBar() {
  const slotStatus = useConfigStore((s) => s.slotStatus);
  const config = useConfigStore((s) => s.config);
  const [recent, setRecent] = useState<string>('');

  useEffect(() => {
    const off = window.bridgeAPI.onSlotEvent((evt) => {
      const slot = config?.slots.find((s) => s.id === evt.payload?.slotId);
      const name = slot?.name || evt.payload?.slotId || '';
      if (evt.type === 'file') setRecent(`Received from ${evt.payload?.callingAE || '?'} → ${name}`);
      else if (evt.type === 'printed') setRecent(`Printed ${evt.payload?.pages} page(s) → ${name}`);
      else if (evt.type === 'failed') setRecent(`Failed: ${name} — ${evt.payload?.error || ''}`);
      else if (evt.type === 'slot-error') setRecent(`Slot error: ${name} — ${evt.payload?.error || ''}`);
    });
    return off;
  }, [config]);

  const listening = slotStatus.filter((s) => s.listening).length;
  const total = config?.slots.length || 0;

  return (
    <footer className="flex items-center justify-between border-t border-app-border bg-app-statusbar-bg px-3 py-1 text-2xs text-app-text-muted">
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1">
          <span className={`inline-block h-2 w-2 rounded-full ${listening > 0 ? 'bg-green-500' : 'bg-gray-500'}`} />
          {listening} of {total} slot{total === 1 ? '' : 's'} listening
        </span>
        {recent && <span className="text-app-text-secondary">{recent}</span>}
      </div>
      <div>v1.0.0</div>
    </footer>
  );
}
