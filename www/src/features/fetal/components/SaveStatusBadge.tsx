/**
 * SaveStatusBadge — aggregate save indicator that watches every fetal
 * mutable store (biometry, structural, DST, risk) and surfaces the worst
 * state as a single pill in the workspace header.
 *
 * Priority (highest first):
 *   - "Saving…"      if any store has pending writes
 *   - "Error: …"     if any store reported an error
 *   - "Unsaved"      if a store is dirty
 *   - "All saved"    otherwise
 */
import { Check, Loader2, AlertCircle, AlertTriangle } from 'lucide-react';
import { useBiometryStore }   from '@/features/fetal/stores/biometryStore';
import { useStructuralStore } from '@/features/fetal/stores/structuralStore';
import { useDstStore }        from '@/features/fetal/stores/dstStore';
import { useRiskStore }       from '@/features/fetal/stores/riskStore';

export function SaveStatusBadge() {
  // Subscribe to the fields we care about; selectors keep re-renders cheap.
  const biSaving = useBiometryStore((s) => s.saving);
  const biError  = useBiometryStore((s) => s.error);

  const stSaving = useStructuralStore((s) => s.saving);
  const stDirty  = useStructuralStore((s) => s.dirty);
  const stError  = useStructuralStore((s) => s.error);

  const dstPending = useDstStore((s) => s.pendingOps);
  const dstError   = useDstStore((s) => s.error);

  const rkSaving = useRiskStore((s) => s.saving);
  const rkError  = useRiskStore((s) => s.error);

  const anySaving = biSaving || stSaving || dstPending > 0 || rkSaving;
  const firstError = biError || stError || dstError || rkError;
  const anyDirty   = stDirty;     // biometry & DST write immediately, only structural is batched

  if (anySaving) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
        <Loader2 size={11} className="animate-spin" /> Saving…
      </span>
    );
  }
  if (firstError) {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 max-w-[280px] truncate"
        title={firstError}
      >
        <AlertCircle size={11} /> {firstError}
      </span>
    );
  }
  if (anyDirty) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
        <AlertTriangle size={11} /> Unsaved changes
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
      <Check size={11} /> All saved
    </span>
  );
}
