/**
 * CRPrintPreview — Print preview modal for the CR viewer.
 * Captures viewport images and renders them in a print-friendly layout.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useCRViewerStore } from '@/stores/crViewerStore';
import { cornerstone } from '@/lib/cornerstoneSetup';
import { X, Printer, ZoomIn, ZoomOut } from 'lucide-react';

interface CRPrintPreviewProps {
  onClose: () => void;
}

function captureViewport(viewportIndex: number): string | null {
  const el = document.querySelector(`[data-cr-viewport-index="${viewportIndex}"]`) as HTMLDivElement;
  if (!el) return null;
  try {
    const enabledEl = cornerstone.getEnabledElement(el);
    if (enabledEl?.canvas) {
      return enabledEl.canvas.toDataURL('image/png');
    }
  } catch { /* ignore */ }
  return null;
}

export function CRPrintPreview({ onClose }: CRPrintPreviewProps) {
  const { currentLayout, patientName, patientId, studyDate, totalImages } = useCRViewerStore();
  const [captures, setCaptures] = useState<(string | null)[]>([]);
  const [zoom, setZoom] = useState(0.7);
  const [printing, setPrinting] = useState(false);

  // Capture all current viewports on mount
  useEffect(() => {
    const caps: (string | null)[] = [];
    for (let i = 0; i < currentLayout.spots; i++) {
      caps.push(captureViewport(i));
    }
    setCaptures(caps);
  }, [currentLayout.spots]);

  const handlePrint = useCallback(() => {
    setPrinting(true);
    setTimeout(() => {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        setPrinting(false);
        alert('Please allow popups to print.');
        return;
      }

      const validCaptures = captures.filter(Boolean);

      printWindow.document.write(`
        <html>
        <head>
          <title>CR Print - ${patientName}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { background: white; font-family: Arial, sans-serif; }
            .header { text-align: center; padding: 8px; border-bottom: 2px solid #333; margin-bottom: 8px; }
            .header h2 { font-size: 14px; margin: 0; }
            .header p { font-size: 10px; color: #666; margin: 2px 0; }
            .grid {
              display: grid;
              grid-template-columns: repeat(${currentLayout.cols}, 1fr);
              grid-template-rows: repeat(${currentLayout.rows}, 1fr);
              gap: 2px;
              padding: 4px;
              height: calc(100vh - 80px);
            }
            .grid img { width: 100%; height: 100%; object-fit: contain; background: black; }
            @media print {
              @page { margin: 5mm; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>${patientName}</h2>
            <p>ID: ${patientId} | Date: ${studyDate} | Images: ${totalImages}</p>
          </div>
          <div class="grid">
            ${validCaptures.map(src => `<img src="${src}" />`).join('')}
          </div>
          <script>window.onload = function() { window.print(); window.close(); }</script>
        </body>
        </html>
      `);
      printWindow.document.close();
      setPrinting(false);
    }, 200);
  }, [captures, currentLayout, patientName, patientId, studyDate, totalImages]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-app-bg border border-app-border rounded-lg shadow-2xl w-[90vw] max-w-[800px] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-app-border">
          <span className="text-sm font-bold text-app-accent">Print Preview</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setZoom(Math.max(0.3, zoom - 0.1))}
              className="p-1 rounded text-app-text-secondary hover:bg-app-hover"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs text-app-text-muted">{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => setZoom(Math.min(2, zoom + 0.1))}
              className="p-1 rounded text-app-text-secondary hover:bg-app-hover"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="text-app-text-muted hover:text-app-text ml-2">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Preview area */}
        <div className="flex-1 overflow-auto p-4 bg-gray-800">
          <div
            className="mx-auto bg-white shadow-xl"
            style={{
              width: `${595 * zoom}px`,
              height: `${842 * zoom}px`,
              padding: `${8 * zoom}px`,
            }}
          >
            {/* Patient header */}
            <div className="text-center border-b-2 border-gray-800 pb-1 mb-1" style={{ fontSize: `${10 * zoom}px` }}>
              <div className="font-bold text-black" style={{ fontSize: `${12 * zoom}px` }}>{patientName}</div>
              <div className="text-gray-600">ID: {patientId} | Date: {studyDate} | Images: {totalImages}</div>
            </div>

            {/* Image grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${currentLayout.cols}, 1fr)`,
                gridTemplateRows: `repeat(${currentLayout.rows}, 1fr)`,
                gap: `${2 * zoom}px`,
                height: `calc(100% - ${30 * zoom}px)`,
              }}
            >
              {captures.map((src, i) => (
                <div key={i} className="bg-black overflow-hidden">
                  {src ? (
                    <img src={src} className="w-full h-full object-contain" alt={`Viewport ${i + 1}`} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-600" style={{ fontSize: `${8 * zoom}px` }}>
                      Empty
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-app-border">
          <span className="text-xs text-app-text-muted">
            {currentLayout.name} | {captures.filter(Boolean).length} images
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-semibold border-2 border-app-border text-app-text rounded hover:bg-app-hover transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handlePrint}
              disabled={printing}
              className="flex items-center gap-1 px-4 py-1.5 text-xs font-semibold bg-app-accent text-white rounded hover:opacity-90 transition-colors disabled:opacity-50"
            >
              <Printer className="w-3.5 h-3.5" />
              {printing ? 'Printing...' : 'Print'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
