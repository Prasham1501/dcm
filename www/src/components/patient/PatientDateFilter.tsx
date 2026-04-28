import { usePatientStore } from '@/stores/patientStore';
import type { DateRangePreset } from '@/types/patient';

const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function PatientDateFilter() {
  const { filters, setDateRange, setFilter, applyFilters } = usePatientStore();

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
          onChange={(e) => { setFilter('month', e.target.value); setDateRange('custom'); }}
          className="h-6 px-1 text-xs border border-app-border bg-app-bg text-app-text rounded-sm"
        >
          <option value="">Month</option>
          {months.map((m, i) => (
            <option key={m} value={String(i + 1)}>{m}</option>
          ))}
        </select>

        {/* From date */}
        <input
          type="text"
          value={filters.fromDate || `15-03-${currentYear}`}
          onChange={(e) => { setFilter('fromDate', e.target.value); setDateRange('custom'); }}
          className="w-20 h-6 px-1 text-xs border border-app-border bg-app-bg text-app-text rounded-sm"
          placeholder="DD-MM-YYYY"
        />
        <span className="text-xs text-app-text-secondary">v</span>

        {/* Year */}
        <select
          value={filters.year || String(currentYear)}
          onChange={(e) => { setFilter('year', e.target.value); setDateRange('custom'); }}
          className="h-6 px-1 text-xs border border-app-border bg-app-bg text-app-text rounded-sm"
        >
          {years.map((y) => (
            <option key={y} value={String(y)}>{y}</option>
          ))}
        </select>
        <span className="text-xs text-app-text-secondary">v</span>

        {/* Custom from/to */}
        <label className="flex items-center gap-1">
          <input type="radio" name="dateRange" checked={filters.dateRange === 'custom'} onChange={() => setDateRange('custom')} className="accent-app-accent w-3 h-3" />
        </label>
        <input
          type="text"
          value={filters.fromDate || `15-03-${currentYear}`}
          onChange={(e) => { setFilter('fromDate', e.target.value); setDateRange('custom'); }}
          className="w-20 h-6 px-1 text-xs border border-app-border bg-app-bg text-app-text rounded-sm"
        />
        <span className="text-xs text-app-text-secondary">v</span>
        <span className="text-xs font-semibold text-app-accent">To</span>
        <input
          type="text"
          value={filters.toDate || `15-03-${currentYear}`}
          onChange={(e) => { setFilter('toDate', e.target.value); setDateRange('custom'); }}
          className="w-20 h-6 px-1 text-xs border border-app-border bg-app-bg text-app-text rounded-sm"
        />
        <span className="text-xs text-app-text-secondary">v</span>
      </div>
    </div>
  );
}
