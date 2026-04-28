export function fillEmptyPrintSlots(
  pageCaptures: Array<Array<string | null>>,
  spotsPerPage: number,
): string[][] {
  return pageCaptures.map((page) => {
    // Preserve empty viewports so the preview/printout matches the live viewer.
    return Array.from({ length: spotsPerPage }, (_, slotIndex) => page[slotIndex] || '');
  });
}
