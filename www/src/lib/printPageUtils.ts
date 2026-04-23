function hasCapturedImage(source: string | null | undefined): source is string {
  return typeof source === 'string' && source !== '';
}

export function fillEmptyPrintSlots(
  pageCaptures: Array<Array<string | null>>,
  spotsPerPage: number,
): string[][] {
  const startingImages = pageCaptures.flat().filter(hasCapturedImage);

  return pageCaptures.map((page) => {
    let fallbackIndex = 0;

    return Array.from({ length: spotsPerPage }, (_, slotIndex) => {
      const capture = page[slotIndex];
      if (hasCapturedImage(capture)) return capture;
      if (startingImages.length === 0) return '';

      const fallbackCapture = startingImages[fallbackIndex % startingImages.length];
      fallbackIndex += 1;
      return fallbackCapture;
    });
  });
}
