import { useState, useEffect } from 'react';
import { Printer, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useCRViewerStore } from '@/stores/crViewerStore';
import { usePrintStore } from '@/stores/printStore';
import { useHospitalConfigStore, getFormattedAddress, renderPrintSlot } from '@/stores/hospitalConfigStore';
import { cornerstone } from '@/lib/cornerstoneSetup';

/**
 * Capture a single CR viewport canvas to data URL from the live DOM.
 */
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

/**
 * Load a DICOM image from cornerstone cache and render it to a canvas data URL.
 * Used for padding empty print slots with images from the beginning of the study.
 */
async function loadImageToDataUrl(imageId: string): Promise<string | null> {
  try {
    const csImage = await cornerstone.loadAndCacheImage(imageId);
    const w = csImage.width || csImage.columns || 512;
    const h = csImage.height || csImage.rows || 512;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    if (csImage.getCanvas && typeof csImage.getCanvas === 'function') {
      const srcCanvas = csImage.getCanvas();
      if (srcCanvas) {
        ctx.drawImage(srcCanvas, 0, 0, w, h);
        return canvas.toDataURL('image/jpeg', 0.9);
      }
    }

    if (csImage.getPixelData) {
      const pixelData = csImage.getPixelData();
      const imgData = ctx.createImageData(w, h);
      const wc = csImage.windowCenter ?? 127;
      const ww = csImage.windowWidth ?? 255;
      const minVal = wc - ww / 2;
      const range = ww || 1;
      for (let i = 0; i < w * h; i++) {
        const raw = pixelData[i] || 0;
        const val = raw * (csImage.slope ?? 1) + (csImage.intercept ?? 0);
        const pv = Math.max(0, Math.min(255, ((val - minVal) / range) * 255));
        imgData.data[i * 4] = pv;
        imgData.data[i * 4 + 1] = pv;
        imgData.data[i * 4 + 2] = pv;
        imgData.data[i * 4 + 3] = 255;
      }
      ctx.putImageData(imgData, 0, 0);
      return canvas.toDataURL('image/jpeg', 0.9);
    }
    return null;
  } catch {
    return null;
  }
}

const PAPER_SIZES = ['A4', 'A3', 'A5', 'Letter', 'Legal'] as const;
type PaperSize = typeof PAPER_SIZES[number];

const PAPER_DIMS: Record<string, { w: number; h: number }> = {
  A4: { w: 595, h: 842 }, A3: { w: 842, h: 1191 },
  A5: { w: 420, h: 595 }, Letter: { w: 612, h: 792 }, Legal: { w: 612, h: 1008 },
};

interface CRPrintPreviewProps {
  onClose: () => void;
}

export function CRPrintPreview({ onClose }: CRPrintPreviewProps) {
  const { settings, updateSettings, addPrintJob, decrementPrintCount, printCountRemaining } = usePrintStore();
  const {
    currentLayout, currentPage, totalPages, totalImages, images,
    patientName, patientId, studyDate,
  } = useCRViewerStore();
  const hospitalConfig = useHospitalConfigStore();

  const [zoom, setZoom] = useState(1.0);
  // Preview captures: null for empty slots (shows "Empty" in preview)
  const [currentPageCaptures, setCurrentPageCaptures] = useState<(string | null)[]>([]);
  // Print captures: empty slots are padded with cycled images from the start of the study
  const [printCaptures, setPrintCaptures] = useState<(string | null)[]>([]);
  const [printing, setPrinting] = useState(false);

  const [localPaperSize, setLocalPaperSize] = useState<PaperSize>(settings.paperSize as PaperSize);
  const [localOrientation, setLocalOrientation] = useState(settings.orientation);
  const [localCopies, setLocalCopies] = useState(settings.copies);

  // Capture current page viewports; async-load padded images for empty slots
  useEffect(() => {
    const startIndex = (currentPage - 1) * currentLayout.spots;
    const caps: (string | null)[] = [];
    const padPromises: Promise<string | null>[] = [];

    for (let i = 0; i < currentLayout.spots; i++) {
      const spotImgIndex = startIndex + i;
      if (spotImgIndex < totalImages) {
        // Real image slot: capture from the live cornerstone canvas
        const captured = captureViewport(i);
        caps.push(captured);
        padPromises.push(Promise.resolve(captured));
      } else {
        // Empty slot: show nothing in the preview
        caps.push(null);
        // For print: cycle images from beginning of study so no slot is blank
        const emptyCount = i - (totalImages - startIndex);
        const padIdx = emptyCount % totalImages;
        const padImageId = images[padIdx]?.imageUrl;
        padPromises.push(padImageId ? loadImageToDataUrl(padImageId) : Promise.resolve(null));
      }
    }

    setCurrentPageCaptures(caps);
    Promise.all(padPromises).then(setPrintCaptures);
  }, [currentLayout.spots, currentPage, totalImages, images]);

  const dims = PAPER_DIMS[localPaperSize] || PAPER_DIMS.A4;
  const isLandscape = localOrientation === 'landscape';
  const pw = isLandscape ? dims.h : dims.w;
  const ph = isLandscape ? dims.w : dims.h;

  const renderSlotPv = (slot: string, customText: string) => {
    switch (slot) {
      case 'logo': return hospitalConfig.logoDataUrl
        ? <img src={hospitalConfig.logoDataUrl} style={{ maxHeight: 30 * zoom, maxWidth: 80 * zoom, objectFit: 'contain' }} alt="Logo" />
        : <span style={{ fontSize: 8 * zoom }} className="text-gray-400">[No Logo]</span>;
      case 'name': return <span style={{ fontSize: 9 * zoom, fontWeight: 600 }} className="text-gray-700">{hospitalConfig.hospitalName}</span>;
      case 'address': return <span style={{ fontSize: 7 * zoom }} className="text-gray-500">{getFormattedAddress(hospitalConfig as any)}{hospitalConfig.phone && ` | ${hospitalConfig.phone}`}</span>;
      case 'custom': return <span style={{ fontSize: 8 * zoom }} className="text-gray-500">{customText}</span>;
      default: return null;
    }
  };

  const handlePrint = async () => {
    if (printCountRemaining <= 0) {
      alert('No prints remaining.');
      return;
    }
    setPrinting(true);
    updateSettings({ paperSize: localPaperSize, orientation: localOrientation, copies: localCopies });

    const printWin = window.open('', '_blank');
    if (!printWin) { setPrinting(false); return; }

    const buildHeaderHtml = () => {
      const l = renderPrintSlot(hospitalConfig.headerLayout.left, hospitalConfig as any, hospitalConfig.customHeaderLeft);
      const c = renderPrintSlot(hospitalConfig.headerLayout.center, hospitalConfig as any, hospitalConfig.customHeaderCenter);
      const r = renderPrintSlot(hospitalConfig.headerLayout.right, hospitalConfig as any, hospitalConfig.customHeaderRight);
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 15px;border-bottom:1px solid #ccc;font-size:10px"><div>${l}</div><div style="text-align:center">${c}</div><div style="text-align:right">${r}</div></div>`;
    };

    const buildFooterHtml = () => {
      const l = renderPrintSlot(hospitalConfig.footerLayout.left, hospitalConfig as any, hospitalConfig.customFooterLeft);
      const c = renderPrintSlot(hospitalConfig.footerLayout.center, hospitalConfig as any, hospitalConfig.customFooterCenter);
      const r = renderPrintSlot(hospitalConfig.footerLayout.right, hospitalConfig as any, hospitalConfig.customFooterRight);
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 15px;border-top:1px solid #ccc;font-size:8px;color:#999"><div>${l}</div><div style="text-align:center">${c}</div><div style="text-align:right">${r}</div></div>`;
    };

    const patientBar = () => settings.patientInfoEnabled
      ? `<div style="padding:4px 15px;background:#f5f5f5;border-bottom:1px solid #ccc;display:flex;justify-content:space-between;font-size:10px"><span><b>Patient:</b> ${patientName}</span><span><b>ID:</b> ${patientId}</span><span><b>Date:</b> ${studyDate}</span></div>`
      : '';

    const buildPageHtml = (caps: (string | null)[]) => {
      const gridCols = `repeat(${currentLayout.cols}, 1fr)`;
      const gridRows = `repeat(${currentLayout.rows}, 1fr)`;
      const imgsHtml = caps.map(src =>
        `<div style="background:black;display:flex;align-items:center;justify-content:center;overflow:hidden;border:1px solid #ddd">
          ${src ? `<img src="${src}" style="width:100%;height:100%;object-fit:contain" />` : ''}
        </div>`
      ).join('');
      return `
        <div class="page" style="page-break-after:always;page-break-inside:avoid">
          ${settings.headerEnabled ? buildHeaderHtml() : ''}
          ${patientBar()}
          <div style="display:grid;grid-template-columns:${gridCols};grid-template-rows:${gridRows};gap:2px;padding:4px;height:calc(100vh - 120px)">
            ${imgsHtml}
          </div>
          ${settings.footerEnabled ? buildFooterHtml() : ''}
        </div>`;
    };

    printWin.document.write(`
      <html>
      <head>
        <title>CR Print - ${patientName}</title>
        <style>
          @page { size: ${localPaperSize} ${isLandscape ? 'landscape' : 'portrait'}; margin: 10mm; }
          body { margin: 0; font-family: Arial, sans-serif; }
          .page:last-child { page-break-after: auto; }
          @media print { body { -webkit-print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        ${buildPageHtml(printCaptures)}
        <script>window.onload = function() { setTimeout(() => { window.print(); window.close(); }, 500); }</script>
      </body>
      </html>
    `);
    printWin.document.close();

    addPrintJob({ patientName, studyDate, layout: `${currentLayout.spots} Spots`, copies: localCopies, paperSize: localPaperSize });
    for (let i = 0; i < localCopies; i++) decrementPrintCount();

    setPrinting(false);
    onClose();
  };

  const previewGridStyle: React.CSSProperties = {
    display: 'grid',
    gap: '2px',
    gridTemplateColumns: `repeat(${currentLayout.cols}, 1fr)`,
    gridTemplateRows: `repeat(${currentLayout.rows}, 1fr)`,
    width: '100%',
    height: `${(ph - 150) * zoom}px`,
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex flex-col z-[1000]">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-app-header-bg border-b border-app-border flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-1 rounded hover:bg-app-hover text-app-text-secondary">
            <X className="w-5 h-5" />
          </button>
          <Printer className="w-5 h-5 text-app-accent" />
          <span className="text-sm font-bold text-app-text">CR Print Preview</span>
          <span className="text-xs text-app-text-muted">
            Page {currentPage}/{totalPages} · Empty slots filled with study images for print
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button onClick={() => setZoom(Math.max(0.3, zoom - 0.1))} className="p-1 text-app-text-secondary"><ZoomOut className="w-4 h-4" /></button>
            <span className="text-xs text-app-text w-10 text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(Math.min(2.0, zoom + 0.1))} className="p-1 text-app-text-secondary"><ZoomIn className="w-4 h-4" /></button>
          </div>

          <div className="h-6 w-px bg-app-border" />

          <select
            value={localPaperSize}
            onChange={(e) => setLocalPaperSize(e.target.value as PaperSize)}
            className="h-7 px-1 text-xs border border-app-border bg-app-bg text-app-text rounded"
          >
            {PAPER_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <div className="flex rounded overflow-hidden border border-app-border">
            {(['portrait', 'landscape'] as const).map(o => (
              <button
                key={o}
                onClick={() => setLocalOrientation(o)}
                className={`px-3 py-1 text-[10px] font-bold ${localOrientation === o ? 'bg-app-accent text-white' : 'bg-app-bg text-app-text-secondary'}`}
              >
                {o === 'portrait' ? 'P' : 'L'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <span className="text-xs text-app-text-muted">Copies:</span>
            <input
              type="number"
              min={1}
              value={localCopies}
              onChange={(e) => setLocalCopies(parseInt(e.target.value) || 1)}
              className="w-10 h-7 text-xs border border-app-border bg-app-bg text-app-text rounded text-center"
            />
          </div>

          <button
            onClick={handlePrint}
            disabled={printing || printCountRemaining <= 0}
            className="flex items-center gap-2 px-6 py-1.5 text-xs font-bold bg-app-accent text-white rounded hover:brightness-110 disabled:opacity-50"
          >
            <Printer className="w-4 h-4" />
            {printing ? 'Printing...' : 'Print Now'}
          </button>
        </div>
      </div>

      {/* Preview Area */}
      <div className="flex-1 overflow-auto p-10 flex justify-center bg-gray-900/50">
        <div
          className="bg-white shadow-2xl relative transition-all duration-300"
          style={{ width: pw * zoom, height: ph * zoom, minWidth: pw * zoom }}
        >
          {/* Paper Header */}
          {settings.headerEnabled && (
            <div style={{ padding: `${8 * zoom}px ${15 * zoom}px` }} className="border-b border-gray-200 flex items-center justify-between">
              <div>{renderSlotPv(hospitalConfig.headerLayout.left, hospitalConfig.customHeaderLeft)}</div>
              <div className="text-center">{renderSlotPv(hospitalConfig.headerLayout.center, hospitalConfig.customHeaderCenter)}</div>
              <div className="text-right">{renderSlotPv(hospitalConfig.headerLayout.right, hospitalConfig.customHeaderRight)}</div>
            </div>
          )}

          {/* Patient Info Bar */}
          {settings.patientInfoEnabled && (
            <div style={{ padding: `${5 * zoom}px ${15 * zoom}px`, fontSize: `${9 * zoom}px` }} className="bg-gray-50 border-b border-gray-200 flex justify-between text-gray-600 font-medium">
              <span>Patient: {patientName}</span>
              <span>ID: {patientId}</span>
              <span>Date: {studyDate}</span>
              <span>Page {currentPage}/{totalPages}</span>
            </div>
          )}

          {/* Image Grid — preview shows "Empty" for vacant slots */}
          <div style={{ padding: `${4 * zoom}px` }}>
            <div style={previewGridStyle}>
              {currentPageCaptures.map((src, i) => (
                <div key={i} className="bg-black flex items-center justify-center overflow-hidden border border-gray-800">
                  {src ? (
                    <img src={src} className="w-full h-full object-contain" alt="Preview" />
                  ) : (
                    <span className="text-gray-600 text-[10px] select-none">Empty</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Paper Footer */}
          {settings.footerEnabled && (
            <div style={{ padding: `${5 * zoom}px ${15 * zoom}px`, fontSize: `${7 * zoom}px` }} className="absolute bottom-0 left-0 right-0 border-t border-gray-200 flex justify-between items-center bg-white text-gray-400">
              <div>{renderSlotPv(hospitalConfig.footerLayout.left, hospitalConfig.customFooterLeft)}</div>
              <div className="text-center">{renderSlotPv(hospitalConfig.footerLayout.center, hospitalConfig.customFooterCenter)}</div>
              <div className="text-right">{renderSlotPv(hospitalConfig.footerLayout.right, hospitalConfig.customFooterRight)}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
