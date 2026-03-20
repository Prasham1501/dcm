/**
 * ViewerActionBar — Slim vertical toolbar between viewports and thumbnails.
 * Contains: Clear All, Insert All, Header/Footer toggle, Image Info, Page navigator.
 */
import { useState } from 'react';
import { useViewerStore } from '@/stores/viewerStore';
import { usePrintStore } from '@/stores/printStore';
import { cornerstone } from '@/lib/cornerstoneSetup';
import {
  X, ImagePlus, PanelTop, Info, ChevronUp, ChevronDown, Printer, ListOrdered, Undo2, RotateCcw
} from 'lucide-react';
import { useCustomAnnotationStore } from '@/stores/customAnnotationStore';
import { HeaderFooterModal } from './HeaderFooterModal';

/** Get DICOM metadata tags from the currently displayed image in the selected viewport */
function getDicomTags(): Record<string, { tag: string; name: string; value: string }> | null {
  const { selectedViewport } = useViewerStore.getState();
  const el = document.querySelector(`[data-viewport-index="${selectedViewport}"]`) as HTMLDivElement;
  if (!el) return null;

  try {
    const enabledEl = cornerstone.getEnabledElement(el);
    const image = enabledEl?.image;
    if (!image) return null;

    // Try to get the parsed DICOM dataset from the image
    const dataSet = (image as any).data;
    if (!dataSet || !dataSet.elements) {
      // Fallback: return basic image properties
      return getBasicImageInfo(image);
    }

    const tags: Record<string, { tag: string; name: string; value: string }> = {};
    const tagNames = getDicomTagNames();

    for (const key of Object.keys(dataSet.elements)) {
      const element = dataSet.elements[key];
      const tagStr = `(${key.substring(1, 5)},${key.substring(5, 9)})`;
      const name = tagNames[tagStr] || key;

      let value = '';
      try {
        if (element.length <= 256) {
          value = dataSet.string(key) || '';
        } else {
          value = `[Binary data: ${element.length} bytes]`;
        }
      } catch {
        value = '[Unable to read]';
      }

      if (value || tagNames[tagStr]) {
        tags[tagStr] = { tag: tagStr, name, value };
      }
    }
    return tags;
  } catch {
    return null;
  }
}

function getBasicImageInfo(image: any): Record<string, { tag: string; name: string; value: string }> {
  const tags: Record<string, { tag: string; name: string; value: string }> = {};
  const add = (tag: string, name: string, value: any) => {
    if (value !== undefined && value !== null && value !== '') {
      tags[tag] = { tag, name, value: String(value) };
    }
  };

  add('(0028,0010)', 'Rows', image.rows || image.height);
  add('(0028,0011)', 'Columns', image.columns || image.width);
  add('(0028,0100)', 'Bits Allocated', image.bitsAllocated);
  add('(0028,0101)', 'Bits Stored', image.bitsStored);
  add('(0028,0102)', 'High Bit', image.highBit);
  add('(0028,0103)', 'Pixel Representation', image.pixelRepresentation);
  add('(0028,0004)', 'Photometric Interpretation', image.photometricInterpretation);
  add('(0028,0002)', 'Samples per Pixel', image.samplesPerPixel);
  add('(0028,1050)', 'Window Center', image.windowCenter);
  add('(0028,1051)', 'Window Width', image.windowWidth);
  add('(0028,1052)', 'Rescale Intercept', image.intercept);
  add('(0028,1053)', 'Rescale Slope', image.slope);
  add('', 'Image ID', image.imageId);
  add('', 'Color', image.color ? 'Yes' : 'No');
  add('', 'Min Pixel Value', image.minPixelValue);
  add('', 'Max Pixel Value', image.maxPixelValue);
  return tags;
}

function getDicomTagNames(): Record<string, string> {
  return {
    '(0008,0005)': 'Specific Character Set',
    '(0008,0008)': 'Image Type',
    '(0008,0012)': 'Instance Creation Date',
    '(0008,0013)': 'Instance Creation Time',
    '(0008,0016)': 'SOP Class UID',
    '(0008,0018)': 'SOP Instance UID',
    '(0008,0020)': 'Study Date',
    '(0008,0021)': 'Series Date',
    '(0008,0023)': 'Content Date',
    '(0008,0030)': 'Study Time',
    '(0008,0031)': 'Series Time',
    '(0008,0033)': 'Content Time',
    '(0008,0050)': 'Accession Number',
    '(0008,0060)': 'Modality',
    '(0008,0070)': 'Manufacturer',
    '(0008,0080)': 'Institution Name',
    '(0008,0090)': 'Referring Physician',
    '(0008,1010)': 'Station Name',
    '(0008,1030)': 'Study Description',
    '(0008,103e)': 'Series Description',
    '(0008,1040)': 'Department Name',
    '(0008,1050)': 'Performing Physician',
    '(0008,1070)': "Operators' Name",
    '(0008,1090)': 'Manufacturer Model',
    '(0010,0010)': "Patient's Name",
    '(0010,0020)': "Patient's ID",
    '(0010,0030)': "Patient's Birth Date",
    '(0010,0040)': "Patient's Sex",
    '(0010,1010)': "Patient's Age",
    '(0010,1020)': "Patient's Size",
    '(0010,1030)': "Patient's Weight",
    '(0018,0015)': 'Body Part Examined',
    '(0018,1000)': 'Device Serial Number',
    '(0018,1020)': 'Software Versions',
    '(0018,1030)': 'Protocol Name',
    '(0018,5010)': 'Transducer Data',
    '(0020,000d)': 'Study Instance UID',
    '(0020,000e)': 'Series Instance UID',
    '(0020,0010)': 'Study ID',
    '(0020,0011)': 'Series Number',
    '(0020,0013)': 'Instance Number',
    '(0028,0002)': 'Samples per Pixel',
    '(0028,0004)': 'Photometric Interpretation',
    '(0028,0010)': 'Rows',
    '(0028,0011)': 'Columns',
    '(0028,0100)': 'Bits Allocated',
    '(0028,0101)': 'Bits Stored',
    '(0028,0102)': 'High Bit',
    '(0028,0103)': 'Pixel Representation',
    '(0028,1050)': 'Window Center',
    '(0028,1051)': 'Window Width',
    '(0028,1052)': 'Rescale Intercept',
    '(0028,1053)': 'Rescale Slope',
  };
}

export function ViewerActionBar() {
  const {
    currentPage, totalPages, totalImages, images,
    nextPage, prevPage, clearViewports, insertAllViewports,
    isArrangeMode, toggleArrangeMode,
  } = useViewerStore();
  const { settings, setShowPrintPreview } = usePrintStore();
  const [showDicomInfo, setShowDicomInfo] = useState(false);
  const [showHeaderFooter, setShowHeaderFooter] = useState(false);
  const [dicomTags, setDicomTags] = useState<Record<string, { tag: string; name: string; value: string }> | null>(null);

  const hasImages = images.length > 0;

  // Show DICOM tags for the selected viewport's image
  const handleShowInfo = () => {
    const tags = getDicomTags();
    setDicomTags(tags);
    setShowDicomInfo(true);
  };

  return (
    <>
      <div className="w-12 flex flex-col items-center bg-app-surface border-l border-app-border py-2 gap-2">
        {/* Global Undo (Ctrl+Z) */}
        <button
          type="button"
          onClick={() => useCustomAnnotationStore.getState().undo()}
          className="w-9 h-9 flex items-center justify-center rounded border border-app-border text-app-text-secondary hover:bg-blue-500/20 hover:text-blue-400 hover:border-blue-500/50 transition-colors"
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="w-5 h-5" />
        </button>

        {/* Global Reset (Replaced Clear All) */}
        <button
          type="button"
          onClick={() => {
            if (window.confirm('Reset all viewports and clear all annotations?')) {
              useCustomAnnotationStore.getState().resetAll();
              clearViewports();
            }
          }}
          className="w-9 h-9 flex items-center justify-center rounded border border-app-border text-app-text-secondary hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/50 transition-colors"
          title="Reset All"
        >
          <RotateCcw className="w-5 h-5" />
        </button>

        {/* Insert / Fill All Viewports */}
        <button
          type="button"
          onClick={insertAllViewports}
          disabled={!hasImages}
          className="w-9 h-9 flex items-center justify-center rounded border border-app-border text-app-text-secondary hover:bg-green-500/20 hover:text-green-400 hover:border-green-500/50 transition-colors disabled:opacity-30"
          title="Insert images into all viewport slots"
        >
          <ImagePlus className="w-5 h-5" />
        </button>

        {/* Page indicator */}
        <div className="flex flex-col items-center my-0.5">
          <span className="text-[10px] text-app-text-muted leading-tight">{currentPage}</span>
          <span className="text-[10px] text-app-accent font-bold leading-tight">{totalImages}</span>
        </div>

        {/* Page up */}
        <button
          type="button"
          onClick={prevPage}
          disabled={currentPage <= 1}
          className="w-9 h-9 flex items-center justify-center rounded border border-app-border text-app-text-secondary hover:bg-app-hover transition-colors disabled:opacity-30"
          title="Previous page"
        >
          <ChevronUp className="w-5 h-5" />
        </button>

        {/* Page down */}
        <button
          type="button"
          onClick={nextPage}
          disabled={currentPage >= totalPages}
          className="w-9 h-9 flex items-center justify-center rounded border border-app-border text-app-text-secondary hover:bg-app-hover transition-colors disabled:opacity-30"
          title="Next page"
        >
          <ChevronDown className="w-5 h-5" />
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Layout grid icon */}
        <button
          type="button"
          onClick={() => useViewerStore.getState().setShowLayoutModal(true)}
          className="w-9 h-9 flex items-center justify-center rounded border border-app-border text-app-text-secondary hover:bg-app-hover transition-colors"
          title="Change layout"
        >
          <svg className="w-5 h-5" viewBox="0 0 16 16" fill="currentColor">
            <rect x="1" y="1" width="6" height="6" rx="1" />
            <rect x="9" y="1" width="6" height="6" rx="1" />
            <rect x="1" y="9" width="6" height="6" rx="1" />
            <rect x="9" y="9" width="6" height="6" rx="1" />
          </svg>
        </button>

        {/* Header/Footer settings */}
        <button
          type="button"
          onClick={() => setShowHeaderFooter(true)}
          className={`w-9 h-9 flex items-center justify-center rounded border transition-colors ${
            settings.headerEnabled
              ? 'border-app-accent bg-app-accent/20 text-app-accent'
              : 'border-app-border text-app-text-secondary hover:bg-app-hover'
          }`}
          title={`Header/Footer: ${settings.headerEnabled ? 'ON' : 'OFF'} — click to configure`}
        >
          <PanelTop className="w-5 h-5" />
        </button>

        {/* Image Info */}
        <button
          type="button"
          onClick={handleShowInfo}
          className="w-9 h-9 flex items-center justify-center rounded border border-app-border text-app-text-secondary hover:bg-blue-500/20 hover:text-blue-400 hover:border-blue-500/50 transition-colors"
          title="Show DICOM image information"
        >
          <Info className="w-5 h-5" />
        </button>

        {/* Print shortcut */}
        <button
          type="button"
          onClick={() => setShowPrintPreview(true)}
          disabled={!hasImages}
          className="w-9 h-9 flex items-center justify-center rounded border border-app-border text-app-text-secondary hover:bg-purple-500/20 hover:text-purple-400 hover:border-purple-500/50 transition-colors disabled:opacity-30"
          title="Print preview"
        >
          <Printer className="w-5 h-5" />
        </button>
      </div>

      {/* DICOM Info Modal */}
      {showDicomInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-app-bg border border-app-border rounded-lg shadow-2xl w-[700px] max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-2 border-b border-app-border">
              <span className="text-sm font-bold text-app-accent">DICOM Image Information</span>
              <button
                onClick={() => setShowDicomInfo(false)}
                className="text-app-text-muted hover:text-app-text"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-3">
              {dicomTags && Object.keys(dicomTags).length > 0 ? (
                <table className="w-full text-[11px] font-mono">
                  <thead>
                    <tr className="text-left text-app-accent border-b border-app-border">
                      <th className="py-1 pr-2 w-28">Tag</th>
                      <th className="py-1 pr-2 w-52">Description</th>
                      <th className="py-1">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.values(dicomTags).map((entry) => (
                      <tr key={entry.tag + entry.name} className="border-b border-app-border/50 hover:bg-app-hover">
                        <td className="py-0.5 pr-2 text-app-accent">{entry.tag}</td>
                        <td className="py-0.5 pr-2 text-app-text-secondary">{entry.name}</td>
                        <td className="py-0.5 text-app-text break-all">{entry.value || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center text-app-text-muted py-8">
                  <p className="text-sm">No DICOM tag data available</p>
                  <p className="text-xs mt-1">Load a DICOM image first, then select a viewport to view its tags.</p>
                </div>
              )}
            </div>
            <div className="flex justify-end px-4 py-2 border-t border-app-border">
              <button
                onClick={() => setShowDicomInfo(false)}
                className="px-4 py-1.5 text-xs font-semibold border-2 border-app-accent text-app-accent bg-app-bg rounded hover:bg-app-accent hover:text-white transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header/Footer Config Modal */}
      <HeaderFooterModal open={showHeaderFooter} onClose={() => setShowHeaderFooter(false)} />
    </>
  );
}
