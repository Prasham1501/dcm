/**
 * paperSizes.ts — UI mirror of bridge/src/render/paperSizes.js.
 * The 8 selectable papers (with friendly labels) + DICOM film-size presets.
 */
import type { PaperSize, FilmMapTarget } from '@/types/bridge';

// Labels mirror the reference UI format: "<w> x <h> inch <name> | <win code>".
export const PAPER_OPTIONS: { id: PaperSize; label: string }[] = [
  { id: 'A4',     label: '8.27 x 11.69 inch A4 | 9' },
  { id: 'A5',     label: '5.83 x 8.27 inch A5 | 11' },
  { id: 'B4JIS',  label: '10.12 x 14.33 inch B4 (JIS) | 12' },
  { id: 'B5JIS',  label: '7.17 x 10.12 inch B5 (JIS) | 13' },
  { id: 'ENV9',   label: '3.87 x 8.87 inch Envelope #9 | 19' },
  { id: 'ENV10',  label: '4.12 x 9.50 inch Envelope #10 | 20' },
  { id: 'CSHEET', label: '17.00 x 22.00 inch C size sheet | 24' },
  { id: 'DSHEET', label: '22.00 x 34.00 inch D size sheet | 25' },
];

/** Standard medical film sizes shown as labeled conversion rows (per slot). */
export const FILM_SIZE_ROWS: { id: string; label: string }[] = [
  { id: '14INX17IN', label: '14 × 17' },
  { id: '11INX14IN', label: '11 × 14' },
  { id: '10INX14IN', label: '10 × 14' },
  { id: '8INX10IN',  label: '8 × 10' },
];

/** Short label for pills / badges. */
export const PAPER_SHORT: Record<PaperSize, string> = {
  A4: 'A4', A5: 'A5', B4JIS: 'B4', B5JIS: 'B5',
  ENV9: 'Env#9', ENV10: 'Env#10', CSHEET: 'C', DSHEET: 'D',
};

/** Options for a mapping target cell: the paper sizes + "Same as film". */
export const MAP_TARGET_OPTIONS: { id: FilmMapTarget; label: string }[] = [
  ...PAPER_OPTIONS,
  { id: 'SAME', label: 'Same as film (no conversion)' },
];
