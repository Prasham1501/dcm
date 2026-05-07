import { X, Baby, FileText, Stethoscope, Scan, Brain, Heart } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ScoredDetection } from './detector';
import { REPORT_TYPES, getReportType } from './registry';
import type { ReportTypeDef } from './types';

const ICONS: Record<string, LucideIcon> = {
  Baby,
  FileText,
  Stethoscope,
  Scan,
  Brain,
  Heart,
};

interface Props {
  title: string;
  subtitle?: string;
  candidates: ScoredDetection[];   // detection results, best-first; may be empty
  preselectedId?: string;
  /** Hide types that have no existing reports — used by "Open Report" mode */
  filterByExisting?: boolean;
  /** Per-type existing-report counts (used in 'open' mode) */
  existingCounts?: Record<string, number>;
  onPick: (type: ReportTypeDef) => void;
  onClose: () => void;
}

const CONFIDENCE_BADGE: Record<string, { text: string; className: string }> = {
  high:   { text: 'Detected match',  className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  medium: { text: 'Possible match',  className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  low:    { text: 'Fallback',        className: 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300' },
};

export function ReportTypePickerModal({
  title,
  subtitle,
  candidates,
  preselectedId,
  filterByExisting,
  existingCounts,
  onPick,
  onClose,
}: Props) {
  // Build the visible list:
  //   - If filterByExisting: show only types with reports.
  //   - Otherwise: show the union of all registered types and detection candidates,
  //     keeping the detection order on top, then any others underneath.
  const candidateMap = new Map(candidates.map((c) => [c.typeId, c]));
  const visibleTypes: ReportTypeDef[] = filterByExisting
    ? REPORT_TYPES.filter((t) => (existingCounts?.[t.id] ?? 0) > 0)
    : [
        ...candidates.map((c) => getReportType(c.typeId)).filter((t): t is ReportTypeDef => !!t),
        ...REPORT_TYPES.filter((t) => !candidateMap.has(t.id)),
      ];

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-[480px] max-w-[90vw]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h3 className="font-semibold text-base text-slate-800 dark:text-slate-100">{title}</h3>
            {subtitle && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-3 max-h-[400px] overflow-y-auto">
          {visibleTypes.length === 0 ? (
            <p className="px-3 py-8 text-sm text-center text-slate-500">
              {filterByExisting ? 'No reports saved yet for this patient.' : 'No report types available.'}
            </p>
          ) : (
            <ul className="space-y-1.5">
              {visibleTypes.map((t) => {
                const detection = candidateMap.get(t.id);
                const Icon = ICONS[t.iconName] ?? FileText;
                const isPreselected = t.id === preselectedId;
                const count = existingCounts?.[t.id];

                return (
                  <li key={t.id}>
                    <button
                      onClick={() => onPick(t)}
                      className={`w-full text-left flex items-center gap-3 px-3 py-3 rounded-lg border transition
                        ${isPreselected
                          ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-900/20 ring-1 ring-blue-500/40'
                          : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                    >
                      <span className={`flex-shrink-0 w-10 h-10 rounded-lg grid place-items-center ${t.accent}`}>
                        <Icon size={20} />
                      </span>

                      <span className="flex-1 min-w-0">
                        <span className="flex items-center gap-2 mb-0.5">
                          <span className="font-medium text-sm text-slate-800 dark:text-slate-100">
                            {t.name}
                          </span>
                          {filterByExisting && count !== undefined && count > 0 && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                              {count} saved
                            </span>
                          )}
                          {!filterByExisting && detection && (
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${CONFIDENCE_BADGE[detection.confidence].className}`}>
                              {CONFIDENCE_BADGE[detection.confidence].text}
                            </span>
                          )}
                        </span>
                        <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">
                          {detection?.reason ?? t.description}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer hint */}
        {!filterByExisting && (
          <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 rounded-b-xl">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Detection is based on study modality and description.  You can override the suggestion.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
