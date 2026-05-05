/**
 * Simplified print layouts — only the standard counts: 1, 2, 4, 6, 8, 9, 12, 15, 18
 * Each count has a portrait and landscape variant.
 *
 * Keep this in sync with bridge/ui/src/lib/layouts.ts (TypeScript copy).
 */

const LAYOUT_CATEGORIES = [
  {
    label: 'Standard',
    layouts: [
      { id: '1x1', name: '1', spots: 1, cols: 1, rows: 1 },
      { id: '1x2', name: '2', spots: 2, cols: 2, rows: 1 },
      { id: '2x1', name: '2', spots: 2, cols: 1, rows: 2 },
      { id: '2x2', name: '4', spots: 4, cols: 2, rows: 2 },
      { id: '2x3', name: '6', spots: 6, cols: 2, rows: 3 },
      { id: '3x2', name: '6', spots: 6, cols: 3, rows: 2 },
      { id: '2x4', name: '8', spots: 8, cols: 2, rows: 4 },
      { id: '4x2', name: '8', spots: 8, cols: 4, rows: 2 },
      { id: '3x3', name: '9', spots: 9, cols: 3, rows: 3 },
      { id: '3x4', name: '12', spots: 12, cols: 3, rows: 4 },
      { id: '4x3', name: '12', spots: 12, cols: 4, rows: 3 },
      { id: '3x5', name: '15', spots: 15, cols: 3, rows: 5 },
      { id: '5x3', name: '15', spots: 15, cols: 5, rows: 3 },
      { id: '3x6', name: '18', spots: 18, cols: 3, rows: 6 },
      { id: '6x3', name: '18', spots: 18, cols: 6, rows: 3 },
    ],
  },
];

module.exports = { LAYOUT_CATEGORIES };
