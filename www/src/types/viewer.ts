export interface ViewerLayout {
  id: string;
  name: string;
  spots: number;
  cols: number;
  rows: number;
  /** CSS Grid template areas for asymmetric layouts */
  areas?: string;
  /** CSS Grid template definition override */
  gridTemplate?: { columns: string; rows: string };
}

export interface LayoutCategory {
  label: string;
  layouts: ViewerLayout[];
}

export interface ViewportState {
  id: string;
  imageIndex: number;
  seriesIndex: number;
  selected: boolean;
}

export interface MockImage {
  id: string;
  label: string;
  seriesNumber: number;
  instanceNumber: number;
  description: string;
}

export type Orientation = 'portrait' | 'landscape';
export type PaperSize = 'A4' | 'A3' | 'Letter' | 'Legal';

/**
 * Layout definitions matching Accurate DICOM Viewer.
 * Organized in tabs matching the reference project's layout selector modal.
 */
export const LAYOUT_CATEGORIES: LayoutCategory[] = [
  {
    label: '1 & 2 Spots',
    layouts: [
      { id: '1x1', name: '1', spots: 1, cols: 1, rows: 1 },
      { id: '1x2', name: '2', spots: 2, cols: 2, rows: 1 },
      { id: '2x1', name: '2', spots: 2, cols: 1, rows: 2 },
    ],
  },
  {
    label: '3 Spots',
    layouts: [
      { id: '3h', name: '3', spots: 3, cols: 3, rows: 1 },
      { id: '3v', name: '3', spots: 3, cols: 1, rows: 3 },
      // 2+1 Top: two on top, one full-width bottom
      { id: '2+1-top', name: '3', spots: 3, cols: 2, rows: 2, areas: '"a b" "c c"' },
      // 1+2 Left Big: one tall left, two stacked right
      { id: '1+2-left', name: '3', spots: 3, cols: 2, rows: 2, areas: '"a b" "a c"' },
      // 1+2 Right Big: two stacked left, one tall right
      { id: '1+2-right', name: '3', spots: 3, cols: 2, rows: 2, areas: '"a b" "c b"' },
      // 2+1 Bottom: one full-width top, two on bottom
      { id: '2+1-bottom', name: '3', spots: 3, cols: 2, rows: 2, areas: '"a a" "b c"' },
    ],
  },
  {
    label: '4 Spots',
    layouts: [
      { id: '2x2', name: '4', spots: 4, cols: 2, rows: 2 },
      { id: '4h', name: '4', spots: 4, cols: 4, rows: 1 },
      { id: '4v', name: '4', spots: 4, cols: 1, rows: 4 },
      // 1+3 Left Big: one tall left spanning 3 rows, three stacked right
      { id: '1+3-left', name: '4', spots: 4, cols: 2, rows: 3, areas: '"a b" "a c" "a d"' },
      // 1+3 Right Big: three stacked left, one tall right spanning 3 rows
      { id: '1+3-right', name: '4', spots: 4, cols: 2, rows: 3, areas: '"a b" "c b" "d b"' },
      // 3+1 Top: three on top, one full-width bottom
      { id: '3+1-top', name: '4', spots: 4, cols: 3, rows: 2, areas: '"a b c" "d d d"' },
      // 3+1 Bottom: one full-width top, three on bottom
      { id: '3+1-bottom', name: '4', spots: 4, cols: 3, rows: 2, areas: '"a a a" "b c d"' },
      // 1+2+1: full-width top, two middle, full-width bottom
      { id: '1+2+1', name: '4', spots: 4, cols: 2, rows: 3, areas: '"a a" "b c" "d d"' },
    ],
  },
  {
    label: '5 & 7 Spots',
    layouts: [
      // 2+3: 1 big left (50%) + 4 small right
      { id: '2+3', name: '5', spots: 5, cols: 3, rows: 2, areas: '"a b c" "a d e"',
        gridTemplate: { columns: '2fr 1fr 1fr', rows: '1fr 1fr' } },
      // 1+4 Big Left: big left (2fr) + 4 small right
      { id: '1+4-big', name: '5', spots: 5, cols: 3, rows: 2, areas: '"a b c" "a d e"',
        gridTemplate: { columns: '2fr 1fr 1fr', rows: '1fr 1fr' } },
      // 2+2+1: two on top, two middle, one big bottom (50%)
      { id: '2+2+1', name: '5', spots: 5, cols: 2, rows: 3, areas: '"a b" "c d" "e e"',
        gridTemplate: { columns: '1fr 1fr', rows: '1fr 1fr 2fr' } },
      // 1+2+2: one big top (50%), two middle, two bottom
      { id: '1+2+2', name: '5', spots: 5, cols: 2, rows: 3, areas: '"a a" "b c" "d e"',
        gridTemplate: { columns: '1fr 1fr', rows: '2fr 1fr 1fr' } },
      // 1×5 horizontal
      { id: '5h', name: '5', spots: 5, cols: 5, rows: 1 },
      // 5×1 vertical
      { id: '5v', name: '5', spots: 5, cols: 1, rows: 5 },
      // 7-spot layouts
      { id: '3+2+2', name: '7', spots: 7, cols: 3, rows: 3, areas: '"a b c" "d d e" "f f g"' },
      { id: '1+3+3', name: '7', spots: 7, cols: 3, rows: 3, areas: '"a a a" "b c d" "e f g"',
        gridTemplate: { columns: '1fr 1fr 1fr', rows: '2fr 1fr 1fr' } },
      { id: '7-mixed', name: '7', spots: 7, cols: 4, rows: 2, areas: '"a b c d" "e f f g"' },
    ],
  },
  {
    label: '6 to 12 spots',
    layouts: [
      { id: '2x3', name: '6', spots: 6, cols: 2, rows: 3 },
      { id: '3x2', name: '6', spots: 6, cols: 3, rows: 2 },
      { id: '2x4', name: '8', spots: 8, cols: 2, rows: 4 },
      { id: '4x2', name: '8', spots: 8, cols: 4, rows: 2 },
      { id: '3x3', name: '9', spots: 9, cols: 3, rows: 3 },
      { id: '3x4-11', name: '11', spots: 11, cols: 3, rows: 4,
        areas: '"a b c" "d e f" "g h i" "j j k"' },
      { id: '3x4', name: '12', spots: 12, cols: 3, rows: 4 },
      { id: '4x3', name: '12', spots: 12, cols: 4, rows: 3 },
      { id: '3x4v', name: '12', spots: 12, cols: 4, rows: 3 },
    ],
  },
  {
    label: '15 to 56 Spots',
    layouts: [
      { id: '3x5', name: '15', spots: 15, cols: 3, rows: 5 },
      { id: '5x3', name: '15', spots: 15, cols: 5, rows: 3 },
      { id: '4x4', name: '16', spots: 16, cols: 4, rows: 4 },
      { id: '3x6', name: '18', spots: 18, cols: 3, rows: 6 },
      { id: '6x3', name: '18', spots: 18, cols: 6, rows: 3 },
      { id: '4x5', name: '20', spots: 20, cols: 4, rows: 5 },
      { id: '5x4', name: '20', spots: 20, cols: 5, rows: 4 },
      { id: '4x6', name: '24', spots: 24, cols: 4, rows: 6 },
      { id: '6x4', name: '24', spots: 24, cols: 6, rows: 4 },
      { id: '5x5', name: '25', spots: 25, cols: 5, rows: 5 },
      { id: '5x6', name: '30', spots: 30, cols: 5, rows: 6 },
      { id: '6x5', name: '30', spots: 30, cols: 6, rows: 5 },
      { id: '5x7', name: '35', spots: 35, cols: 5, rows: 7 },
      { id: '7x5', name: '35', spots: 35, cols: 7, rows: 5 },
      { id: '6x6', name: '36', spots: 36, cols: 6, rows: 6 },
      { id: '6x7', name: '42', spots: 42, cols: 6, rows: 7 },
      { id: '7x6', name: '42', spots: 42, cols: 7, rows: 6 },
      { id: '7x8', name: '56', spots: 56, cols: 7, rows: 8 },
      { id: '8x7', name: '56', spots: 56, cols: 8, rows: 7 },
    ],
  },
  {
    label: 'Mamo',
    layouts: [
      { id: 'mamo-2x1', name: 'Mamo 2', spots: 2, cols: 2, rows: 1 },
      { id: 'mamo-2x2', name: 'Mamo 4', spots: 4, cols: 2, rows: 2 },
      { id: 'mamo-4x1', name: 'Mamo 4h', spots: 4, cols: 4, rows: 1 },
    ],
  },
];

export const mockImages: MockImage[] = Array.from({ length: 20 }, (_, i) => ({
  id: `img-${i + 1}`,
  label: `Image ${i + 1}`,
  seriesNumber: 1,
  instanceNumber: i + 1,
  description: i < 7 ? 'OB Ultrasound' : 'Fetal Assessment',
}));
