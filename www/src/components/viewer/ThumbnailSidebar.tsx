/**
 * ThumbnailSidebar - Shows image thumbnails using plain <img> elements.
 * Does NOT use cornerstone.enable() — thumbnails are completely independent
 * of cornerstone-tools global state, so tool activations never corrupt them.
 * Renders pixel data manually from cornerstone-loaded images.
 */
import { useCallback, useRef, useEffect, useState } from 'react';
import { useViewerStore } from '@/stores/viewerStore';
import { cornerstone } from '@/lib/cornerstoneSetup';

export function ThumbnailSidebar() {
  const { 
    currentPage, currentLayout, images, setCurrentPage,
    isArrangeMode, arrangeSelectedImages, toggleArrangeImageSelection,
    viewportImageOverrides
  } = useViewerStore();
  const hasRealImages = images.length > 0;

  // Store rendered data URLs for each image
  const [thumbDataUrls, setThumbDataUrls] = useState<Map<string, string>>(new Map());
  const renderingRef = useRef<Set<string>>(new Set());

  // Render thumbnails by loading image pixel data and drawing to an offscreen canvas
  useEffect(() => {
    if (!hasRealImages) return;

    images.forEach((img) => {
      const url = img.imageUrl;
      if (!url || thumbDataUrls.has(url) || renderingRef.current.has(url)) return;

      renderingRef.current.add(url);

      cornerstone.loadImage(url).then((csImage: any) => {
        try {
          const canvas = document.createElement('canvas');
          const thumbSize = 160;
          canvas.width = thumbSize;
          canvas.height = thumbSize;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;

          // Fill black background
          ctx.fillStyle = '#000';
          ctx.fillRect(0, 0, thumbSize, thumbSize);

          // Get image dimensions (cornerstone uses width/height)
          const imgWidth = csImage.width || csImage.columns || 120;
          const imgHeight = csImage.height || csImage.rows || 90;

          // Check if image has a getCanvas method (color images from WADO loader)
          if (csImage.getCanvas && typeof csImage.getCanvas === 'function') {
            const srcCanvas = csImage.getCanvas();
            if (srcCanvas) {
              // Color image: draw from the source canvas
              const scale = Math.min(thumbSize / imgWidth, thumbSize / imgHeight);
              const dx = (thumbSize - imgWidth * scale) / 2;
              const dy = (thumbSize - imgHeight * scale) / 2;
              ctx.drawImage(srcCanvas, 0, 0, imgWidth, imgHeight, dx, dy, imgWidth * scale, imgHeight * scale);
              const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
              setThumbDataUrls((prev) => new Map(prev).set(url, dataUrl));
              renderingRef.current.delete(url);
              return;
            }
          }

          // Check if image has getImage method (JPEG/PNG images)
          if (csImage.getImage && typeof csImage.getImage === 'function') {
            const jsImage = csImage.getImage();
            if (jsImage) {
              const scale = Math.min(thumbSize / imgWidth, thumbSize / imgHeight);
              const dx = (thumbSize - imgWidth * scale) / 2;
              const dy = (thumbSize - imgHeight * scale) / 2;
              ctx.drawImage(jsImage, 0, 0, imgWidth, imgHeight, dx, dy, imgWidth * scale, imgHeight * scale);
              const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
              setThumbDataUrls((prev) => new Map(prev).set(url, dataUrl));
              renderingRef.current.delete(url);
              return;
            }
          }

          // Grayscale rendering: use getPixelData + window/level
          if (csImage.getPixelData) {
            const pixelData = csImage.getPixelData();
            const width = imgWidth;
            const height = imgHeight;

            const imageData = ctx.createImageData(thumbSize, thumbSize);
            const scale = Math.min(thumbSize / width, thumbSize / height);
            const offsetX = (thumbSize - width * scale) / 2;
            const offsetY = (thumbSize - height * scale) / 2;

            // Window/Level
            const wc = Array.isArray(csImage.windowCenter) ? csImage.windowCenter[0] : (csImage.windowCenter ?? 127);
            const ww = Array.isArray(csImage.windowWidth) ? csImage.windowWidth[0] : (csImage.windowWidth ?? 256);
            const minVal = wc - ww / 2;
            const maxVal = wc + ww / 2;
            const range = maxVal - minVal || 1;

            // Check if this is a color image stored as RGB pixel data
            const isColor = csImage.color === true;
            const samplesPerPixel = csImage.samplesPerPixel || 1;

            for (let y = 0; y < thumbSize; y++) {
              for (let x = 0; x < thumbSize; x++) {
                const srcX = Math.floor((x - offsetX) / scale);
                const srcY = Math.floor((y - offsetY) / scale);
                const idx = (y * thumbSize + x) * 4;

                if (srcX >= 0 && srcX < width && srcY >= 0 && srcY < height) {
                  const srcIdx = srcY * width + srcX;

                  if (isColor || samplesPerPixel >= 3) {
                    // Color pixel data (RGB interleaved)
                    const pixIdx = srcIdx * samplesPerPixel;
                    imageData.data[idx] = pixelData[pixIdx] || 0;
                    imageData.data[idx + 1] = pixelData[pixIdx + 1] || 0;
                    imageData.data[idx + 2] = pixelData[pixIdx + 2] || 0;
                  } else {
                    // Grayscale with W/L
                    const raw = pixelData[srcIdx] || 0;
                    const slope = csImage.slope ?? 1;
                    const intercept = csImage.intercept ?? 0;
                    const val = raw * slope + intercept;
                    const pv = Math.max(0, Math.min(255, ((val - minVal) / range) * 255));
                    imageData.data[idx] = pv;
                    imageData.data[idx + 1] = pv;
                    imageData.data[idx + 2] = pv;
                  }
                }
                // else: remains black (from fillRect)
                imageData.data[idx + 3] = 255;
              }
            }

            ctx.putImageData(imageData, 0, 0);
          }

          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          setThumbDataUrls((prev) => new Map(prev).set(url, dataUrl));
        } catch (err) {
          console.warn('[Thumbnail] render error for', url, err);
        }
        renderingRef.current.delete(url);
      }).catch((err: any) => {
        console.warn('[Thumbnail] load error for', url, err);
        renderingRef.current.delete(url);
      });
    });
  }, [hasRealImages, images]); // thumbDataUrls intentionally NOT a dependency

  const handleThumbClick = useCallback((imgIndex: number, imgUrl: string) => {
    if (isArrangeMode) {
      toggleArrangeImageSelection(imgUrl);
      return;
    }
    const pageNum = Math.floor(imgIndex / currentLayout.spots) + 1;
    setCurrentPage(pageNum);
  }, [currentLayout.spots, setCurrentPage, isArrangeMode, toggleArrangeImageSelection]);

  // Double-click a thumbnail to load it into the currently selected viewport
  const handleThumbDoubleClick = useCallback((imgUrl: string) => {
    if (isArrangeMode) return;
    const { selectedViewport, setViewportImageOverride } = useViewerStore.getState();
    setViewportImageOverride(selectedViewport, imgUrl);
  }, [isArrangeMode]);

  // Drag start
  const handleDragStart = useCallback((e: React.DragEvent, imgIndex: number) => {
    const img = images[imgIndex];
    if (!img) return;
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('application/dicom-image-url', img.imageUrl);
    e.dataTransfer.setData('text/plain', imgIndex.toString());
  }, [images]);

  if (!hasRealImages) {
    return (
      <div className="w-16 sm:w-32 lg:w-44 2xl:w-56 flex flex-col bg-gray-900 border-l border-gray-700 overflow-y-auto">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="p-1">
            <div className="text-[7px] sm:text-[9px] text-gray-500 px-0.5">P {i + 1}</div>
            <div className="aspect-[4/3] bg-gray-800 border border-gray-600 rounded-sm" />
          </div>
        ))}
      </div>
    );
  }

  // Precompute which images are in which viewports on the *current page*
  const activeViewportImages = new Map<string, number>();
  const startIndex = (currentPage - 1) * currentLayout.spots;
  for (let i = 0; i < currentLayout.spots; i++) {
    const overrideUrl = viewportImageOverrides[i];
    if (overrideUrl) {
      activeViewportImages.set(overrideUrl, i + 1); // 1-indexed for display
    } else {
      const defaultImg = images[startIndex + i];
      if (defaultImg) {
        activeViewportImages.set(defaultImg.imageUrl, i + 1);
      }
    }
  }

  return (
    <div className="w-16 sm:w-32 lg:w-44 2xl:w-56 flex flex-col bg-gray-900 border-l border-gray-700 overflow-y-auto">
      {images.map((img, i) => {
        const pageForImage = Math.floor(i / currentLayout.spots) + 1;
        const isOnCurrentPage = pageForImage === currentPage;
        const dataUrl = thumbDataUrls.get(img.imageUrl);
        const assignedViewport = activeViewportImages.get(img.imageUrl);

        // Arrange Mode specifics
        const arrangeIdx = isArrangeMode ? arrangeSelectedImages.indexOf(img.imageUrl) : -1;
        const isArrangeSelected = arrangeIdx !== -1;

        return (
          <div
            key={img.id}
            className={`p-0.5 sm:p-1 lg:p-1.5 cursor-pointer select-none relative ${
              isArrangeMode ? '' : 'active:cursor-grabbing'
            }`}
            draggable={!isArrangeMode}
            onDragStart={(e) => { if (!isArrangeMode) handleDragStart(e, i); }}
            onClick={() => handleThumbClick(i, img.imageUrl)}
            onDoubleClick={() => handleThumbDoubleClick(img.imageUrl)}
            title={`Image ${img.instanceNumber}${isArrangeMode ? '' : ' — drag to viewport, double-click to load into selected viewport'}`}
          >
            <div className="flex justify-between items-center px-0.5 relative z-10 w-full mb-0.5">
              <span className={`text-[8px] sm:text-[10px] font-bold ${isOnCurrentPage ? 'text-blue-400' : 'text-gray-500'}`}>
                {img.instanceNumber}
              </span>
              
              {/* Show Viewport Assignment Badge */}
              {assignedViewport !== undefined && (
                <span className="text-[7px] sm:text-[9px] font-bold text-white bg-green-600 px-1 rounded-sm shadow-sm opacity-90 leading-tight">
                  <span className="hidden sm:inline">Spot </span>{assignedViewport}
                </span>
              )}
            </div>

            <div
              className={`aspect-[4/3] border rounded-sm overflow-hidden relative bg-black transition-all ${
                isArrangeSelected 
                  ? 'border-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' 
                  : isOnCurrentPage 
                  ? 'border-blue-500' 
                  : 'border-gray-600 hover:border-gray-400'
              }`}
            >
              {/* Arrange Selection Overlay Badge */}
              {isArrangeSelected && (
                <div className="absolute inset-0 bg-green-500/20 z-10 flex items-center justify-center pointer-events-none">
                  <div className="w-4 h-4 sm:w-6 sm:h-6 rounded-full bg-green-600 border border-white flex items-center justify-center text-white text-[8px] sm:text-xs font-bold shadow-md">
                    {arrangeIdx + 1}
                  </div>
                </div>
              )}

              {dataUrl ? (
                <img
                  src={dataUrl}
                  alt={`Image ${img.instanceNumber}`}
                  className="w-full h-full object-contain"
                  draggable={false}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="w-3 h-3 border border-gray-500 border-t-blue-400 rounded-full animate-spin" />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
