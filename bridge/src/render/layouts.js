/**
 * LAYOUT_CATEGORIES — copied verbatim from dcm/www/src/types/viewer.ts (lines 40-155)
 * so the bridge's print pages use the EXACT SAME grid templates as the DCM viewer.
 *
 * Keep this in sync with bridge/ui/src/lib/layouts.ts (TypeScript copy).
 */

const LAYOUT_CATEGORIES = [
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
      { id: '2+1-top', name: '3', spots: 3, cols: 2, rows: 2, areas: '"a b" "c c"' },
      { id: '1+2-left', name: '3', spots: 3, cols: 2, rows: 2, areas: '"a b" "a c"' },
      { id: '1+2-right', name: '3', spots: 3, cols: 2, rows: 2, areas: '"a b" "c b"' },
      { id: '2+1-bottom', name: '3', spots: 3, cols: 2, rows: 2, areas: '"a a" "b c"' },
    ],
  },
  {
    label: '4 Spots',
    layouts: [
      { id: '2x2', name: '4', spots: 4, cols: 2, rows: 2 },
      { id: '4h', name: '4', spots: 4, cols: 4, rows: 1 },
      { id: '4v', name: '4', spots: 4, cols: 1, rows: 4 },
      { id: '1+3-left', name: '4', spots: 4, cols: 2, rows: 3, areas: '"a b" "a c" "a d"' },
      { id: '1+3-right', name: '4', spots: 4, cols: 2, rows: 3, areas: '"a b" "c b" "d b"' },
      { id: '3+1-top', name: '4', spots: 4, cols: 3, rows: 2, areas: '"a b c" "d d d"' },
      { id: '3+1-bottom', name: '4', spots: 4, cols: 3, rows: 2, areas: '"a a a" "b c d"' },
      { id: '1+2+1', name: '4', spots: 4, cols: 2, rows: 3, areas: '"a a" "b c" "d d"' },
    ],
  },
  {
    label: '5 & 7 Spots',
    layouts: [
      { id: '2+3', name: '5', spots: 5, cols: 3, rows: 2, areas: '"a b c" "a d e"',
        gridTemplate: { columns: '2fr 1fr 1fr', rows: '1fr 1fr' } },
      { id: '1+4-big', name: '5', spots: 5, cols: 3, rows: 2, areas: '"a b c" "a d e"',
        gridTemplate: { columns: '2fr 1fr 1fr', rows: '1fr 1fr' } },
      { id: '2+2+1', name: '5', spots: 5, cols: 2, rows: 3, areas: '"a b" "c d" "e e"',
        gridTemplate: { columns: '1fr 1fr', rows: '1fr 1fr 2fr' } },
      { id: '1+2+2', name: '5', spots: 5, cols: 2, rows: 3, areas: '"a a" "b c" "d e"',
        gridTemplate: { columns: '1fr 1fr', rows: '2fr 1fr 1fr' } },
      { id: '5h', name: '5', spots: 5, cols: 5, rows: 1 },
      { id: '5v', name: '5', spots: 5, cols: 1, rows: 5 },
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

module.exports = { LAYOUT_CATEGORIES };
