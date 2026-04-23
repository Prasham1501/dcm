import { cornerstone } from '@/lib/cornerstoneSetup';

function imageDimension(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function defaultVoi(image: any) {
  const windowCenter = Array.isArray(image.windowCenter) ? image.windowCenter[0] : image.windowCenter;
  const windowWidth = Array.isArray(image.windowWidth) ? image.windowWidth[0] : image.windowWidth;

  return {
    windowCenter: Number.isFinite(Number(windowCenter)) ? Number(windowCenter) : 127,
    windowWidth: Number.isFinite(Number(windowWidth)) ? Number(windowWidth) : 255,
  };
}

function buildPrintViewport(sourceViewport: any, image: any) {
  const viewport = {
    ...(sourceViewport || {}),
    scale: 1,
    translation: { x: 0, y: 0 },
    voi: sourceViewport?.voi || defaultVoi(image),
    rotation: sourceViewport?.rotation || 0,
    hflip: Boolean(sourceViewport?.hflip),
    vflip: Boolean(sourceViewport?.vflip),
    invert: Boolean(sourceViewport?.invert),
    pixelReplication: Boolean(sourceViewport?.pixelReplication),
  };

  // A viewport-scaled displayedArea is the source of the print-preview letterboxing.
  delete (viewport as any).displayedArea;
  return viewport;
}

export function captureCornerstoneElementForPrint(element: HTMLElement | null): string | null {
  if (!element) return null;

  try {
    const enabledElement = cornerstone.getEnabledElement(element);
    if (enabledElement?.image) {
      const image = enabledElement.image;
      const width = imageDimension(image.columns ?? image.width, 512);
      const height = imageDimension(image.rows ?? image.height, 512);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      cornerstone.renderToCanvas(
        canvas,
        image,
        buildPrintViewport(enabledElement.viewport || cornerstone.getViewport(element), image),
      );

      return canvas.toDataURL('image/jpeg', 0.95);
    }

    if (enabledElement?.canvas) {
      return enabledElement.canvas.toDataURL('image/png');
    }
  } catch {
    const canvas = element.querySelector('canvas');
    if (canvas) return canvas.toDataURL('image/png');
  }

  return null;
}

export function captureCornerstoneViewportForPrint(indexAttribute: string, viewportIndex: number): string | null {
  const element = document.querySelector(`[${indexAttribute}="${viewportIndex}"]`) as HTMLElement | null;
  return captureCornerstoneElementForPrint(element);
}

export function captureCornerstoneElementsForPrint(selector: string, indexAttribute: string): string[] {
  return Array.from(document.querySelectorAll(selector))
    .sort((a, b) => {
      const ai = Number((a as HTMLElement).getAttribute(indexAttribute) ?? 0);
      const bi = Number((b as HTMLElement).getAttribute(indexAttribute) ?? 0);
      return ai - bi;
    })
    .map((element) => captureCornerstoneElementForPrint(element as HTMLElement) || '');
}
