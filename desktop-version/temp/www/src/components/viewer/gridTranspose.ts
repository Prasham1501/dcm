/**
 * gridTranspose — display-only grid orientation swapping.
 *
 * When the viewer window's aspect ratio fights the selected layout's
 * orientation (e.g. wide monitor + portrait layout), each grid cell becomes
 * the wrong shape for the images inside it, producing large per-cell
 * letterboxing. These pure helpers let ViewportGrid/CRViewportGrid visually
 * transpose the grid (swap rows/cols) at render time without mutating the
 * store — print preview and layout thumbnails continue to see the original
 * orientation.
 *
 * `areas` layouts (asymmetric, CSS grid-template-areas) and mammography
 * layouts are skipped in v1.
 */
import type { ViewerLayout } from '@/types/viewer';

/** Target cell aspect ratio for fit scoring (most DICOM images are ~4:3). */
const TARGET_CELL_ASPECT = 4 / 3;

/** Hysteresis factor — transpose only when the swapped orientation is >10% better. */
const HYSTERESIS = 0.9;

/**
 * Decide whether the grid should be visually transposed for the current
 * container size. Pure — same inputs always give the same answer.
 */
export function shouldTranspose(
  containerW: number,
  containerH: number,
  layout: Pick<ViewerLayout, 'cols' | 'rows' | 'areas' | 'id'>
): boolean {
  if (containerW <= 0 || containerH <= 0) return false;
  if (layout.areas) return false; // asymmetric layouts opt out in v1
  if (layout.cols === layout.rows) return false; // nothing to gain
  if (layout.id?.startsWith('mamo-')) return false; // preserve L/R reading order

  const originalAspect = (containerW / layout.cols) / (containerH / layout.rows);
  const transposedAspect = (containerW / layout.rows) / (containerH / layout.cols);

  // Lower score = closer to target cell aspect
  const scoreOriginal = Math.abs(Math.log(originalAspect / TARGET_CELL_ASPECT));
  const scoreTransposed = Math.abs(Math.log(transposedAspect / TARGET_CELL_ASPECT));

  return scoreTransposed < scoreOriginal * HYSTERESIS;
}

/**
 * Swap columns and rows of a custom grid template override.
 * Returns undefined if the input was undefined.
 */
export function transposeGridTemplate(
  gridTemplate?: { columns: string; rows: string }
): { columns: string; rows: string } | undefined {
  if (!gridTemplate) return undefined;
  return { columns: gridTemplate.rows, rows: gridTemplate.columns };
}

/**
 * Map a display slot index (position in the transposed visual grid) back to
 * the logical slot index (the slot the store knows about).
 *
 * After transposition, the visual grid has `logicalRows` columns and
 * `logicalCols` rows. Standard row-major transpose: visual (dr, dc) ↔
 * logical (dc, dr).
 *
 * Example for logicalCols=2, logicalRows=3 (a 2×3 portrait layout shown as 3×2):
 *   display 0 → logical 0
 *   display 1 → logical 2
 *   display 2 → logical 4
 *   display 3 → logical 1
 *   display 4 → logical 3
 *   display 5 → logical 5
 */
export function displayToLogicalSlot(
  displaySlot: number,
  logicalCols: number,
  logicalRows: number
): number {
  const displayGridCols = logicalRows;
  const dr = Math.floor(displaySlot / displayGridCols);
  const dc = displaySlot % displayGridCols;
  const logicalRow = dc;
  const logicalCol = dr;
  return logicalRow * logicalCols + logicalCol;
}

/**
 * Inverse of displayToLogicalSlot — given a logical slot, return the display
 * position it will occupy when the grid is transposed.
 */
export function logicalToDisplaySlot(
  logicalSlot: number,
  logicalCols: number,
  logicalRows: number
): number {
  const logicalRow = Math.floor(logicalSlot / logicalCols);
  const logicalCol = logicalSlot % logicalCols;
  const dr = logicalCol;
  const dc = logicalRow;
  const displayGridCols = logicalRows;
  return dr * displayGridCols + dc;
}
