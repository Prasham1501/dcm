import { usePatientStore } from '@/stores/patientStore';
import type { DateRangePreset } from '@/types/patient';

const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// DD-MM-YYYY ⇄ YYYY-MM-DD helpers so we can keep the store's DD-MM-YYYY format
// while presenting a native HTML5 date picker (which requires YYYY-MM-DD).
function ddmmToIso(v: string): string {
  if (!v) return '';
  const m = v.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  return '';
}
function isoToDdmm(v: string): string {
  if (!v) return '';
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return v;
}

export function PatientDateFilter() {
  const { filters, setDateRange, setFilter, applyFilters } = usePatientStore();
  void applyFilters;

  const presets: { label: string; value: DateRangePreset }[] = [
    { label: 'Today', value: 'today' },
    { label: 'Yesterday & Today', value: 'yesterdayAndToday' },
    { label: 'Yesterday', value: 'yesterday' },
    { label: 'Last 7 Days', value: 'last7days' },
    { label: 'All', value: 'all' },
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear - i);

  return (
    <div className="flex items-center gap-2 px-2 py-1 border-b border-app-border bg-app-surface flex-wrap gap-y-0.5">
      {/* Radio presets */}
      {presets.map((preset) => (
        <label key={preset.value} className="flex items-center gap-1 cursor-pointer">
          <input
            type="radio"
            name="dateRange"
            checked={filters.dateRange === preset.value}
            onChange={() => setDateRange(preset.value)}
            className="accent-app-accent w-3 h-3"
          />
          <span className="text-xs 2xl:text-sm text-app-text-secondary whitespace-nowrap">{preset.label}</span>
        </label>
      ))}

      <div className="flex items-center gap-1 ml-2">
        {/* Month */}
        <select
          value={filters.month}
          onChange={(e) => {
            setFilter('month', e.target.value);
            setDateRange('custom');
          }}
          className="h-6 px-1 text-xs border border-app-border bg-app-bg text-app-text rounded-sm"
        >
          <option value="">Month</option>
          {months.map((m, i) => (
            <option key={m} value={String(i + 1)}>{m}</option>
          ))}
        </select>

        {/* Year */}
        <select
          value={filters.year}
          onChange={(e) => { setFilter('year', e.target.value); setDateRange('custom'); }}
          className="h-6 px-1 text-xs border border-app-border bg-app-bg text-app-text rounded-sm"
        >
          <option value="">Year (any)</option>
          {years.map((y) => (
            <option key={y} value={String(y)}>{y}</option>
          ))}
        </select>

        {/* Custom from/to with native date pickers */}
        <label className="flex items-center gap-1 ml-2">
          <input type="radio" name="dateRange" checked={filters.dateRange === 'custom'} onChange={() => setDateRange('custom')} className="accent-app-accent w-3 h-3" />
          <span className="text-xs text-app-text-secondary">Custom</span>
        </label>
        <input
          type="date"
          value={ddmmToIso(filters.fromDate)}
          onChange={(e) => { setFilter('fromDate', isoToDdmm(e.target.value)); setDateRange('custom'); }}
          className="h-6 px-1 text-xs border border-app-border bg-app-bg text-app-text rounded-sm"
          title="From date"
        />
        <span className="text-xs font-semibold text-app-accent">To</span>
        <input
          type="date"
          value={ddmmToIso(filters.toDate)}
          onChange={(e) => { setFilter('toDate', isoToDdmm(e.target.value)); setDateRange('custom'); }}
          className="h-6 px-1 text-xs border border-app-border bg-app-bg text-app-text rounded-sm"
          title="To date"
        />
      </div>
    </div>
  );
}
