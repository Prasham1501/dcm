/**
 * Gestational age + EDD helpers.
 *
 * GA from LMP uses Naegele's rule (280 days). Caller can override later when
 * a CRL-derived GA from biometry becomes available.
 */

export interface Dating {
  gaWeeks: number | null;     // decimal weeks
  gaDisplay: string;          // "12w+4d"
  edd: string | null;         // YYYY-MM-DD
}

export function deriveDatingFromLmp(lmpDate: string | null, examDate: string | null): Dating {
  if (!lmpDate || !examDate) {
    return { gaWeeks: null, gaDisplay: '-', edd: null };
  }
  const lmp = new Date(lmpDate);
  const exam = new Date(examDate);
  if (isNaN(lmp.getTime()) || isNaN(exam.getTime())) {
    return { gaWeeks: null, gaDisplay: '-', edd: null };
  }

  const ms = exam.getTime() - lmp.getTime();
  if (ms < 0) return { gaWeeks: null, gaDisplay: '-', edd: null };

  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  const weeks = Math.floor(days / 7);
  const remDays = days % 7;
  const gaWeeks = days / 7;

  const eddDate = new Date(lmp.getTime() + 280 * 24 * 60 * 60 * 1000);
  const yyyy = eddDate.getFullYear();
  const mm = String(eddDate.getMonth() + 1).padStart(2, '0');
  const dd = String(eddDate.getDate()).padStart(2, '0');

  return {
    gaWeeks,
    gaDisplay: `${weeks}w+${remDays}d`,
    edd: `${yyyy}-${mm}-${dd}`,
  };
}

export function formatDateDisplay(iso: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${dd} ${months[d.getMonth()]} ${d.getFullYear()}`;
}
