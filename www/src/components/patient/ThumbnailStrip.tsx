import { useEffect, useRef, useCallback, useState, memo } from 'react';
import { usePatientStore } from '@/stores/patientStore';
import { useViewerStore } from '@/stores/viewerStore';
import { useNavigate } from 'react-router-dom';
import { cornerstone } from '@/lib/cornerstoneSetup';
import { localFileToImageId } from '@/lib/dicomLoader';

/**
 * DicomThumbnail — loads a single DICOM image lazily.
 * The `ready` prop controls when loading starts so that thumbnails
 * are staggered and don't all block the main thread at once.
 */
const DicomThumbnail = memo(function DicomThumbnail({
  filePath, index, onClick, ready,
}: {
  filePath: string; index: number; onClick: () => void; ready: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!ready) return;                       // wait until our turn
    const el = containerRef.current;
    if (!el) return;

    let cancelled = false;
    const imageId = localFileToImageId(filePath);

    try { cornerstone.enable(el); } catch { /* already enabled */ }

    cornerstone.loadImage(imageId)
      .then((image: any) => {
        if (cancelled) return;
        cornerstone.displayImage(el, image);
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
      try { cornerstone.disable(el); } catch { /* ignore */ }
    };
  }, [filePath, ready]);

  return (
    <div
      onClick={onClick}
      className="w-16 h-16 flex-shrink-0 bg-gray-800 border border-gray-600 rounded cursor-pointer hover:border-blue-500 transition-colors overflow-hidden relative"
    >
      {/* Cornerstone canvas target */}
      <div ref={containerRef} className="w-full h-full" style={{ width: 64, height: 56 }} />

      {/* Placeholder while loading */}
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
 * Uses progressive/staggered loading so selecting a patient feels instant.
 */
export function ThumbnailStrip() {
  const { selectedPatient } = usePatientStore();
  const loadStudyFiles = useViewerStore((s) => s.loadStudyFiles);
  const navigate = useNavigate();

  // Tracks how many thumbnails are allowed to start loading.
  // Increases progressively so the UI stays responsive.
  const [readyCount, setReadyCount] = useState(0);
  const patientIdRef = useRef<string | null>(null);

  // Reset readyCount when patient changes — stagger from 0 again
  useEffect(() => {
    const pid = selectedPatient?.id ?? null;
    if (pid === patientIdRef.current) return;
    patientIdRef.current = pid;
    setReadyCount(0);

    if (!pid) return;

    // Progressively allow thumbnails to load, 2 at a time every 60ms
    // This keeps the main thread free for UI updates between batches
    const fileCount = selectedPatient?.filePaths?.length ?? 0;
    if (fileCount === 0) return;

    const max = Math.min(fileCount, 20);
    let count = 0;
    const tick = () => {
      count = Math.min(count + 2, max);
      setReadyCount(count);
      if (count < max) {
        timerId = setTimeout(tick, 60);
      }
    };
    // Kick off after a micro-delay so the row highlight renders first
    let timerId: ReturnType<typeof setTimeout> = setTimeout(tick, 30);

    return () => clearTimeout(timerId);
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
    return (
      <div className="h-24 bg-app-thumbnail-bg border-t border-app-border flex items-center justify-center">
        <span className="text-xs text-app-text-muted">Select a patient to view thumbnails</span>
      </div>
    );
  }

  const hasRealFiles = selectedPatient.filePaths && selectedPatient.filePaths.length > 0;
  const thumbnailCount = selectedPatient.images;

  if (hasRealFiles) {
    const filesToShow = selectedPatient.filePaths!.slice(0, 20);
    return (
      <div className="h-24 bg-app-thumbnail-bg border-t border-app-border flex items-center gap-1 px-2 overflow-x-auto">
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
          <div className="w-16 h-16 flex-shrink-0 bg-gray-800 border border-gray-600 rounded flex items-center justify-center text-xs text-gray-400">
            +{selectedPatient.filePaths!.length - 20}
          </div>
        )}
      </div>
    );
  }

  // Fallback: gray placeholder boxes for mock data
  return (
    <div className="h-24 bg-app-thumbnail-bg border-t border-app-border flex items-center gap-1 px-2 overflow-x-auto">
      {Array.from({ length: thumbnailCount }, (_, i) => (
        <div
          key={i}
          className="w-16 h-16 flex-shrink-0 bg-gray-800 border border-gray-600 rounded flex items-center justify-center cursor-pointer hover:border-blue-500 transition-colors"
        >
          <div className="text-center">
            <div className="w-12 h-10 bg-gray-700 rounded-sm mb-0.5" />
            <span className="text-[9px] text-gray-400">{i + 1}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
