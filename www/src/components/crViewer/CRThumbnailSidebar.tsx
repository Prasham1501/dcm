/**
 * CRThumbnailSidebar - Shows image thumbnails for the CR viewer.
 * Renders pixel data manually from cornerstone-loaded images.
 * Supports dragging thumbnails into viewports.
 */
import { useCallback, useRef, useEffect, useState } from 'react';
import { useCRViewerStore } from '@/stores/crViewerStore';
import { cornerstone } from '@/lib/cornerstoneSetup';

export function CRThumbnailSidebar() {
  const { 
    images, currentPage, currentLayout, setCurrentPage,
    isArrangeMode, toggleArrangeViewport, arrangeClickOrder
  } = useCRViewerStore();
  const hasImages = images.length > 0;

  // Store rendered data URLs
  const [thumbDataUrls, setThumbDataUrls] = useState<Map<string, string>>(new Map());
  const renderingRef = useRef<Set<string>>(new Set());

  // Render thumbnails
  useEffect(() => {
    if (!hasImages) return;

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

          ctx.fillStyle = '#000';
          ctx.fillRect(0, 0, thumbSize, thumbSize);

          const imgWidth = csImage.width || csImage.columns || 120;
          const imgHeight = csImage.height || csImage.rows || 90;

          if (csImage.getCanvas && typeof csImage.getCanvas === 'function') {
            const srcCanvas = csImage.getCanvas();
            if (srcCanvas) {
              const scale = Math.min(thumbSize / imgWidth, thumbSize / imgHeight);
              const dx = (thumbSize - imgWidth * scale) / 2;
              const dy = (thumbSize - imgHeight * scale) / 2;
              ctx.drawImage(srcCanvas, 0, 0, imgWidth, imgHeight, dx, dy, imgWidth * scale, imgHeight * scale);
              setThumbDataUrls(prev => new Map(prev).set(url, canvas.toDataURL('image/jpeg', 0.8)));
              renderingRef.current.delete(url);
              return;
            }
          }

          if (csImage.getPixelData) {
            const pixelData = csImage.getPixelData();
            const width = imgWidth;
            const height = imgHeight;
            const imageData = ctx.createImageData(thumbSize, thumbSize);
            const scale = Math.min(thumbSize / width, thumbSize / height);
            const offsetX = (thumbSize - width * scale) / 2;
            const offsetY = (thumbSize - height * scale) / 2;

            const wc = csImage.windowCenter ?? 127;
            const ww = csImage.windowWidth ?? 255;
            const minVal = wc - ww / 2;
            const range = ww || 1;

            for (let y = 0; y < thumbSize; y++) {
              for (let x = 0; x < thumbSize; x++) {
                const srcX = Math.floor((x - offsetX) / scale);
                const srcY = Math.floor((y - offsetY) / scale);
                const idx = (y * thumbSize + x) * 4;
                if (srcX >= 0 && srcX < width && srcY >= 0 && srcY < height) {
                  const srcIdx = srcY * width + srcX;
                  const raw = pixelData[srcIdx] || 0;
                  const val = raw * (csImage.slope ?? 1) + (csImage.intercept ?? 0);
                  const pv = Math.max(0, Math.min(255, ((val - minVal) / range) * 255));
                  imageData.data[idx] = pv;
                  imageData.data[idx+1] = pv;
                  imageData.data[idx+2] = pv;
                }
                imageData.data[idx+3] = 255;
              }
            }
            ctx.putImageData(imageData, 0, 0);
            setThumbDataUrls(prev => new Map(prev).set(url, canvas.toDataURL('image/jpeg', 0.8)));
          }
        } catch (e) { console.warn(e); }
        renderingRef.current.delete(url);
      }).catch(() => renderingRef.current.delete(url));
    });
  }, [hasImages, images]);

  const handleDragStart = (e: React.DragEvent, imgUrl: string) => {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('application/dicom-image-url', imgUrl);
    e.dataTransfer.setData('text/plain', imgUrl);
  };

  const handleThumbClick = (i: number) => {
    if (isArrangeMode) {
      // In CR Viewer Arrange mode, we might want to support clicking thumbnails too?
      // For now, only viewport selection is handled.
    } else {
      const pageNum = Math.floor(i / currentLayout.spots) + 1;
      setCurrentPage(pageNum);
    }
  };

  return (
    <div className="w-36 flex flex-col bg-app-surface border-l border-app-border overflow-y-auto custom-scrollbar shadow-inner">
      <div className="p-2 border-b border-app-border bg-app-bg/50">
        <span className="text-[10px] font-bold text-app-accent uppercase tracking-wider">Preview</span>
      </div>
      
      {images.map((img, i) => {
        const pageForImage = Math.floor(i / currentLayout.spots) + 1;
        const isOnCurrentPage = pageForImage === currentPage;
        const dataUrl = thumbDataUrls.get(img.imageUrl);

        return (
          <div
            key={img.id}
            className={`p-1 cursor-pointer select-none transition-all ${isOnCurrentPage ? 'bg-app-accent/10 border-r-2 border-app-accent' : 'hover:bg-app-hover border-r-2 border-transparent'}`}
            draggable
            onDragStart={(e) => handleDragStart(e, img.imageUrl)}
            onClick={() => handleThumbClick(i)}
          >
            <div className="flex justify-between items-center px-1 mb-0.5">
              <span className={`text-[9px] font-bold ${isOnCurrentPage ? 'text-app-accent' : 'text-app-text-muted'}`}>
                {img.instanceNumber}
              </span>
            </div>

            <div className={`aspect-[4/3] border rounded overflow-hidden bg-black ${isOnCurrentPage ? 'border-app-accent/50' : 'border-app-border'}`}>
              {dataUrl ? (
                <img src={dataUrl} className="w-full h-full object-contain" alt="" />
              ) : (
                <div className="w-full h-full flex items-center justify-center opacity-20">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
          </div>
        );
      })}

      {!hasImages && (
        <div className="flex-1 flex items-center justify-center text-[10px] text-app-text-muted italic">
          No images
        </div>
      )}
    </div>
  );
}
