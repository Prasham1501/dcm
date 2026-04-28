import { useEffect, useRef, useCallback, useState, memo } from 'react';
import { usePatientStore } from '@/stores/patientStore';
import { useViewerStore } from '@/stores/viewerStore';
import { useNavigate } from 'react-router-dom';
import { cornerstone } from '@/lib/cornerstoneSetup';
import { localFileToImageId } from '@/lib/dicomLoader';

/**
 * DicomThumbnail — loads a single DICOM image lazily using an offscreen canvas
 * to avoid blocking the main thread with cornerstone enable/disable per thumbnail.
 */
const DicomThumbnail = memo(function DicomThumbnail({
  filePath, index, onClick, ready,
}: {
  filePath: string; index: number; onClick: () => void; ready: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!ready) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    const imageId = localFileToImageId(filePath);

    // Load image via cornerstone but render to our own canvas — avoids enable/disable overhead
    cornerstone.loadImage(imageId)
      .then((image: any) => {
        if (cancelled) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Create a temporary render canvas from cornerstone image
        const renderCanvas = image.getCanvas?.() || image.getImage?.();
        if (renderCanvas) {
          canvas.width = 128;
          canvas.height = 112;
          ctx.drawImage(renderCanvas, 0, 0, 128, 112);
          setLoaded(true);
          return;
        }

        // Fallback: use pixel data directly
        const pixelData = image.getPixelData();
        if (!pixelData) { setError(true); return; }

        canvas.width = 64;
        canvas.height = 56;

        // Create a small offscreen canvas at image size, then scale down
        const tmpCanvas = document.createElement('canvas');
        tmpCanvas.width = image.width;
        tmpCanvas.height = image.height;
        const tmpCtx = tmpCanvas.getContext('2d');
        if (!tmpCtx) { setError(true); return; }

        const imgData = tmpCtx.createImageData(image.width, image.height);
        const ww = image.windowWidth ?? 255;
        const wc = image.windowCenter ?? 127;
        const minVal = wc - ww / 2;

        for (let i = 0; i < pixelData.length; i++) {
          const val = Math.max(0, Math.min(255, ((pixelData[i] - minVal) / ww) * 255));
          imgData.data[i * 4] = val;
          imgData.data[i * 4 + 1] = val;
          imgData.data[i * 4 + 2] = val;
          imgData.data[i * 4 + 3] = 255;
        }
        tmpCtx.putImageData(imgData, 0, 0);
        ctx.drawImage(tmpCanvas, 0, 0, 128, 112);
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => { cancelled = true; };
  }, [filePath, ready]);

  return (
    <div
      onClick={onClick}
      className="w-24 h-20 2xl:w-28 2xl:h-24 flex-shrink-0 bg-gray-800 border border-gray-600 rounded cursor-pointer hover:border-blue-500 transition-colors overflow-hidden relative"
    >
      <canvas ref={canvasRef} className="w-full h-full" style={{ display: loaded ? 'block' : 'none' }} />

      {!loaded && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
          <div className="w-3 h-3 border-2 border-gray-500 border-t-gray-300 rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
          <span className="text-[9px] text-gray-500">err</span>
        </div>
      )}

      <span className="absolute bottom-0 left-0 right-0 text-center text-[9px] text-gray-400 bg-black/50">
        {index + 1}
      </span>
    </div>
  );
});

/**
 * ThumbnailStrip — shows thumbnails for the selected patient.
 * Selection is instant; thumbnails load progressively in the background.
 */
export function ThumbnailStrip() {
  const { selectedPatient } = usePatientStore();
  const loadStudyFiles = useViewerStore((s) => s.loadStudyFiles);
  const navigate = useNavigate();

  const [readyCount, setReadyCount] = useState(0);
  const patientIdRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset and stagger thumbnails when patient changes
  useEffect(() => {
    const pid = selectedPatient?.id ?? null;

    // Clean up previous stagger timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (pid === patientIdRef.current) return;
    patientIdRef.current = pid;
    setReadyCount(0);

    if (!pid) return;

    const fileCount = selectedPatient?.filePaths?.length ?? 0;
    if (fileCount === 0) return;

    const max = Math.min(fileCount, 20);

    // Use requestAnimationFrame for the first batch so the row highlight
    // renders immediately, then load remaining thumbnails progressively
    requestAnimationFrame(() => {
      // Load first 4 immediately
      setReadyCount(Math.min(4, max));

      if (max > 4) {
        let count = 4;
        const tick = () => {
          count = Math.min(count + 4, max);
          setReadyCount(count);
          if (count < max) {
            timerRef.current = setTimeout(tick, 100);
          }
        };
        timerRef.current = setTimeout(tick, 150);
      }
    });

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [selectedPatient?.id, selectedPatient?.filePaths?.length]);

  const handleThumbnailClick = useCallback((index: number) => {
    if (!selectedPatient?.filePaths) return;
    loadStudyFiles({
      patientName: selectedPatient.patientName,
      patientId: selectedPatient.patientId,
      studyDate: selectedPatient.studyDate,
      filePaths: selectedPatient.filePaths,
    });
    navigate('/viewer');
  }, [selectedPatient, loadStudyFiles, navigate]);

  if (!selectedPatient) {
    return null;
  }

  const hasRealFiles = selectedPatient.filePaths && selectedPatient.filePaths.length > 0;
  const thumbnailCount = selectedPatient.images;

  if (hasRealFiles) {
    const filesToShow = selectedPatient.filePaths!.slice(0, 20);
    return (
      <div className="h-24 2xl:h-32 bg-app-thumbnail-bg border-t border-app-border flex items-center gap-1 px-1.5 overflow-x-auto">
        {filesToShow.map((fp, i) => (
          <DicomThumbnail
            key={fp}
            filePath={fp}
            index={i}
            ready={i < readyCount}
            onClick={() => handleThumbnailClick(i)}
          />
        ))}
        {selectedPatient.filePaths!.length > 20 && (
          <div className="w-24 h-20 2xl:w-28 2xl:h-24 flex-shrink-0 bg-gray-800 border border-gray-600 rounded flex items-center justify-center text-xs text-gray-400 font-semibold">
            +{selectedPatient.filePaths!.length - 20}
          </div>
        )}
      </div>
    );
  }

  // Fallback: gray placeholder boxes for mock data
  return (
    <div className="h-24 2xl:h-32 bg-app-thumbnail-bg border-t border-app-border flex items-center gap-1 px-1.5 overflow-x-auto">
      {Array.from({ length: thumbnailCount }, (_, i) => (
        <div
          key={i}
          className="w-24 h-20 2xl:w-28 2xl:h-24 flex-shrink-0 bg-gray-800 border border-gray-600 rounded flex items-center justify-center cursor-pointer hover:border-blue-500 transition-colors"
        >
          <div className="text-center">
            <div className="w-20 h-14 bg-gray-700 rounded-sm mb-0.5" />
            <span className="text-[9px] text-gray-400">{i + 1}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
