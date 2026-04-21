/**
 * useAnnotationPersistence - Attaches to cornerstone-tools measurement events
 * and auto-saves/restores annotations for the current study.
 *
 * Call this once in DicomViewport when cornerstone is enabled.
 */
import { useEffect } from 'react';
import { cornerstoneTools } from '@/lib/cornerstoneSetup';
import { useAnnotationStore, getStudyKey } from '@/stores/annotationStore';
import { useViewerStore } from '@/stores/viewerStore';

export function useAnnotationPersistence() {
  const { saveAnnotations, getAnnotations } = useAnnotationStore.getState();

  useEffect(() => {
    const EVENTS = cornerstoneTools.EVENTS;
    if (!EVENTS) return;

    const getCurrentStudyKey = () => {
      const { studyUID, images } = useViewerStore.getState();
      const filePaths = images.map((img) => img.imageUrl);
      return getStudyKey(studyUID, filePaths);
    };

    const debounceSave = (() => {
      let timer: ReturnType<typeof setTimeout> | null = null;
      return () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          try {
            const manager = cornerstoneTools.globalImageIdSpecificToolStateManager;
            if (!manager) return;
            const state = manager.saveToolState();
            if (state && Object.keys(state).length > 0) {
              saveAnnotations(getCurrentStudyKey(), state);
            }
          } catch {
            // ignore
          }
        }, 500);
      };
    })();

    const handleAnnotationChange = () => debounceSave();

    // Cornerstone-tools v3 fires these events on the document
    const events = [
      EVENTS.MEASUREMENT_ADDED,
      EVENTS.MEASUREMENT_MODIFIED,
      EVENTS.MEASUREMENT_REMOVED,
    ].filter(Boolean);

    events.forEach((evt) => {
      document.addEventListener(evt, handleAnnotationChange);
    });

    return () => {
      events.forEach((evt) => {
        document.removeEventListener(evt, handleAnnotationChange);
      });
    };
  }, [saveAnnotations]);
}

/**
 * Restore annotations for a study key into cornerstone-tools global state manager.
 * Call this after a study finishes loading.
 */
export function restoreAnnotations(studyKey: string) {
  try {
    const data = useAnnotationStore.getState().getAnnotations(studyKey);
    if (!data || !data.toolState) return;
    const manager = cornerstoneTools.globalImageIdSpecificToolStateManager;
    if (!manager || typeof manager.restoreToolState !== 'function') return;
    manager.restoreToolState(data.toolState);
    console.log('[Annotations] Restored for study:', studyKey);
  } catch (err) {
    console.warn('[Annotations] Restore failed:', err);
  }
}
