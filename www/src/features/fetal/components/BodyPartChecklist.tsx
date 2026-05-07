import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { BodySystem, StructuralStatus } from '@/features/fetal/lib/anatomySchema';
import { useStructuralStore, getRow } from '@/features/fetal/stores/structuralStore';

const STATUS_OPTIONS: { value: StructuralStatus; label: string }[] = [
  { value: 'select',   label: 'Select' },
  { value: 'normal',   label: 'Normal' },
  { value: 'abnormal', label: 'Abnormal' },
  { value: 'not_seen', label: 'Not seen' },
];

const STATUS_COLOR: Record<StructuralStatus, string> = {
  select:   'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300',
  normal:   'border-emerald-400 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20',
  abnormal: 'border-red-400 text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20',
  not_seen: 'border-amber-400 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20',
};

interface Props {
  systems: BodySystem[];
}

export function BodyPartChecklist({ systems }: Props) {
  const rows         = useStructuralStore((s) => s.rows);
  const setStatus    = useStructuralStore((s) => s.setStatus);
  const setComments  = useStructuralStore((s) => s.setComments);
  const markAllNormal = useStructuralStore((s) => s.markAllNormal);
  const markAllSelect = useStructuralStore((s) => s.markAllSelect);

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  return (
    <div className="space-y-3">
      {systems.map((system) => {
        const open = !collapsed[system.key];
        const itemKeys = system.items.map((i) => i.key);
        const allNormal = itemKeys.every(
          (k) => getRow(rows, system.key, k).status === 'normal',
        );

        return (
          <section
            key={system.key}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden"
          >
            <header className="flex items-center justify-between px-4 py-2 bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setCollapsed((c) => ({ ...c, [system.key]: open }))}
                className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200"
              >
                {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                {system.label}
                <span className="text-xs font-normal text-slate-400">
                  ({system.items.length})
                </span>
              </button>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allNormal}
                    onChange={(e) => {
                      if (e.target.checked) markAllNormal(system.key, itemKeys);
                      else markAllSelect(system.key, itemKeys);
                    }}
                    className="rounded"
                  />
                  Mark all as normal
                </label>
              </div>
            </header>

            {open && (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-900/30 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="text-left px-4 py-1.5 w-2/5">Anatomy</th>
                    <th className="text-left px-4 py-1.5 w-32">Status</th>
                    <th className="text-left px-4 py-1.5">Comments</th>
                  </tr>
                </thead>
                <tbody>
                  {system.items.map((item) => {
                    const row = getRow(rows, system.key, item.key);
                    return (
                      <tr
                        key={item.key}
                        className="border-t border-slate-100 dark:border-slate-700/50 hover:bg-slate-50/60 dark:hover:bg-slate-700/20"
                      >
                        <td className="px-4 py-1.5 text-slate-700 dark:text-slate-200">
                          {item.label}
                        </td>
                        <td className="px-4 py-1.5">
                          <select
                            value={row.status}
                            onChange={(e) =>
                              setStatus(system.key, item.key, e.target.value as StructuralStatus)
                            }
                            className={`w-full px-2 py-1 text-xs rounded border focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-slate-700 ${STATUS_COLOR[row.status]}`}
                          >
                            {STATUS_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-1.5">
                          <input
                            type="text"
                            value={row.comments ?? ''}
                            onChange={(e) => setComments(system.key, item.key, e.target.value)}
                            placeholder={row.status === 'abnormal' ? 'Describe finding…' : 'Optional comment'}
                            className="w-full px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>
        );
      })}
    </div>
  );
}
