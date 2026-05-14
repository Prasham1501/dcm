/**
 * WorkspaceBreadcrumb — compact breadcrumb that shows
 *   Patients › <patient>  ›  Examination N (<exam_type>, GA)  ›  <Tab>
 *
 * Read-only navigation aid; only the "Patients" segment is clickable.
 */
import { ChevronRight, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Examination } from '@/features/fetal/types';

interface Props {
  patientId: string;
  patientName?: string;
  examination: Examination | null;
  gaDisplay?: string;
  activeTabLabel?: string;
  /** Optional back handler (overrides default navigate('/')) for inline contexts. */
  onBack?: () => void;
}

export function WorkspaceBreadcrumb({
  patientId, patientName, examination, gaDisplay, activeTabLabel, onBack,
}: Props) {
  const navigate = useNavigate();
  const goBack = onBack ?? (() => navigate('/'));

  return (
    <nav className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 overflow-hidden whitespace-nowrap">
      <button
        onClick={goBack}
        className="flex items-center gap-1 text-blue-600 hover:underline flex-shrink-0"
      >
        <ArrowLeft size={12} /> Patients
      </button>

      <ChevronRight size={12} className="text-slate-300 flex-shrink-0" />

      <span className="truncate max-w-[200px]" title={patientName ?? patientId}>
        {patientName || patientId}
      </span>

      {examination && (
        <>
          <ChevronRight size={12} className="text-slate-300 flex-shrink-0" />
          <span className="truncate max-w-[280px]" title={examination.exam_label}>
            {examination.exam_label}
            <span className="text-slate-400 ml-1">
              ({examination.exam_type}{gaDisplay ? ` · ${gaDisplay}` : ''})
            </span>
          </span>
        </>
      )}

      {activeTabLabel && (
        <>
          <ChevronRight size={12} className="text-slate-300 flex-shrink-0" />
          <span className="font-medium text-slate-700 dark:text-slate-200">{activeTabLabel}</span>
        </>
      )}
    </nav>
  );
}
