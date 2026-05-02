export function fillEmptyPrintSlots(
  pageCaptures: Array<Array<string | null>>,
  spotsPerPage: number,
): string[][] {
  return pageCaptures.map((page) => {
    const slots: string[] = Array.from({ length: spotsPerPage }, (_, i) => page[i] || '');
    // Find the last slot that actually has an image; gaps before it are preserved.
    let lastFilled = -1;
    for (let i = slots.length - 1; i >= 0; i--) {
      if (slots[i]) { lastFilled = i; break; }
    }
    if (lastFilled >= 0 && lastFilled < slots.length - 1) {
      const lastImage = slots[lastFilled];
      for (let i = lastFilled + 1; i < slots.length; i++) slots[i] = lastImage;
    }
    return slots;
  });
}
