import { cornerstone } from '@/lib/cornerstoneSetup';

interface RefitCornerstoneViewportOptions {
  preserveVoi?: boolean;
  preserveRotation?: boolean;
  preserveFlip?: boolean;
  preserveInvert?: boolean;
  preservePixelReplication?: boolean;
}

function defaultVoi(image: any) {
  const windowCenter = Array.isArray(image?.windowCenter) ? image.windowCenter[0] : image?.windowCenter;
  const windowWidth = Array.isArray(image?.windowWidth) ? image.windowWidth[0] : image?.windowWidth;

  return {
    windowCenter: Number.isFinite(Number(windowCenter)) ? Number(windowCenter) : 127,
    windowWidth: Number.isFinite(Number(windowWidth)) ? Number(windowWidth) : 255,
  };
}

export function refitCornerstoneViewport(
  element: HTMLElement,
  {
    preserveVoi = true,
    preserveRotation = true,
    preserveFlip = true,
    preserveInvert = true,
    preservePixelReplication = true,
  }: RefitCornerstoneViewportOptions = {},
): boolean {
  try {
    const enabledElement = cornerstone.getEnabledElement(element);
    const image = enabledElement?.image;
    if (!image) {
      cornerstone.resize(element, true);
      return false;
    }

    const currentViewport = enabledElement.viewport || cornerstone.getViewport(element) || {};

    // Resize first so cornerstone knows the new container dimensions,
    // then get the default viewport which computes correct fit-to-window scale.
    cornerstone.resize(element, false);
    const defaultViewport = cornerstone.getDefaultViewportForImage(element, image) || {};

    const nextViewport: any = {
      ...defaultViewport,
      scale: defaultViewport.scale ?? 1,
      translation: { x: 0, y: 0 },
      voi: preserveVoi ? (currentViewport.voi || defaultViewport.voi || defaultVoi(image)) : defaultVoi(image),
      rotation: preserveRotation ? (currentViewport.rotation || 0) : 0,
      hflip: preserveFlip ? Boolean(currentViewport.hflip) : false,
      vflip: preserveFlip ? Boolean(currentViewport.vflip) : false,
      invert: preserveInvert ? Boolean(currentViewport.invert) : false,
      pixelReplication: preservePixelReplication ? Boolean(currentViewport.pixelReplication) : false,
      labelmap: Boolean(currentViewport.labelmap),
    };

    delete nextViewport.displayedArea;
    cornerstone.displayImage(element, image, nextViewport);
    return true;
  } catch {
    try {
      cornerstone.resize(element, true);
    } catch {
      // Ignore resize fallback failures.
    }
    return false;
  }
}

export function resetCornerstoneViewport(element: HTMLElement): boolean {
  return refitCornerstoneViewport(element, {
    preserveVoi: false,
    preserveRotation: false,
    preserveFlip: false,
    preserveInvert: false,
    preservePixelReplication: false,
  });
}
