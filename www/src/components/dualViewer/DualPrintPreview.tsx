/**
 * DualPrintPreview — Print preview for the Dual viewer.
 * Shows both panels' current pages side by side.
 */
import { useState, useEffect } from 'react';
import { Printer, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useDualViewerStore } from '@/stores/dualViewerStore';
import { usePrintStore } from '@/stores/printStore';
import { useHospitalConfigStore, getFormattedAddress, renderPrintSlot } from '@/stores/hospitalConfigStore';
import { captureCornerstoneElementForPrint } from '@/lib/printCapture';

function captureViewport(panelId: string, viewportIndex: number): string | null {
  const el = document.querySelector(`[data-dual-viewport-index="${panelId}-${viewportIndex}"]`) as HTMLElement;
  if (!el) return null;
  return captureCornerstoneElementForPrint(el);
}

const PAPER_SIZES = ['A4', 'A3', 'A5', 'Letter', 'Legal'] as const;
type PaperSize = typeof PAPER_SIZES[number];
const PAPER_DIMS: Record<string, { w: number; h: number }> = {
  A4: { w: 595, h: 842 }, A3: { w: 842, h: 1191 },
  A5: { w: 420, h: 595 }, Letter: { w: 612, h: 792 }, Legal: { w: 612, h: 1008 },
};

interface DualPrintPreviewProps { onClose: () => void; }

export function DualPrintPreview({ onClose }: DualPrintPreviewProps) {
  const { settings, updateSettings, addPrintJob, decrementPrintCount, printCountRemaining } = usePrintStore();
  const { panels } = useDualViewerStore();
  const hospitalConfig = useHospitalConfigStore();

  const leftPanel = panels.left;
  const rightPanel = panels.right;

  const [zoom, setZoom] = useState(1.0);
  const [leftCaptures, setLeftCaptures] = useState<(string | null)[]>([]);
  const [rightCaptures, setRightCaptures] = useState<(string | null)[]>([]);
  const [printing, setPrinting] = useState(false);

  const [localPaperSize, setLocalPaperSize] = useState<PaperSize>(settings.paperSize as PaperSize);
  const [localOrientation, setLocalOrientation] = useState(settings.orientation);
  const [localCopies, setLocalCopies] = useState(settings.copies);

  // Capture viewports from both panels
  useEffect(() => {
    const capturePanel = (panel: typeof leftPanel, pid: string) => {
      const caps: (string | null)[] = [];
      for (let i = 0; i < panel.currentLayout.spots; i++) {
        const startIndex = (panel.currentPage - 1) * panel.currentLayout.spots;
        if (startIndex + i < panel.totalImages) {
          caps.push(captureViewport(pid, i));
        } else {
          caps.push(null);
        }
      }
      return caps;
    };
    setLeftCaptures(capturePanel(leftPanel, 'left'));
    setRightCaptures(capturePanel(rightPanel, 'right'));
  }, [leftPanel.currentLayout.spots, leftPanel.currentPage, leftPanel.totalImages,
      rightPanel.currentLayout.spots, rightPanel.currentPage, rightPanel.totalImages]);

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

  const renderPanelGrid = (captures: (string | null)[], layout: typeof leftPanel.currentLayout) => {
    const gridStyle: React.CSSProperties = {
      display: 'grid',
      gap: '1px',
      gridTemplateColumns: `repeat(${layout.cols}, 1fr)`,
      gridTemplateRows: `repeat(${layout.rows}, 1fr)`,
      width: '100%',
      height: '100%',
    };
    return (
      <div style={gridStyle}>
        {captures.map((src, i) => (
          <div key={i} className="bg-black flex items-center justify-center overflow-hidden border border-gray-800">
            {src ? <img src={src} className="w-full h-full object-contain" alt="" /> : <span className="text-gray-600 text-[10px]">Empty</span>}
          </div>
        ))}
      </div>
    );
  };

  const handlePrint = async () => {
    if (printCountRemaining <= 0) { alert('No prints remaining.'); return; }
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

    const buildPanelGridHtml = (captures: (string | null)[], layout: typeof leftPanel.currentLayout) => {
      const gridCols = `repeat(${layout.cols}, 1fr)`;
      const gridRows = `repeat(${layout.rows}, 1fr)`;
      const imgsHtml = captures.map(src =>
        `<div style="background:black;display:flex;align-items:center;justify-content:center;overflow:hidden;border:1px solid #ddd">
          ${src ? `<img src="${src}" style="width:100%;height:100%;object-fit:contain" />` : ''}
        </div>`
      ).join('');
      return `<div style="display:grid;grid-template-columns:${gridCols};grid-template-rows:${gridRows};gap:2px;height:100%">${imgsHtml}</div>`;
    };

    const patientBar = () => settings.patientInfoEnabled
      ? `<div style="padding:4px 15px;background:#f5f5f5;border-bottom:1px solid #ccc;display:flex;justify-content:space-between;font-size:10px">
          <span><b>Left:</b> ${leftPanel.patientName}</span>
          <span><b>Right:</b> ${rightPanel.patientName}</span>
          <span><b>Date:</b> ${leftPanel.studyDate}</span>
        </div>`
      : '';

    printWin.document.write(`
      <html>
      <head>
        <title>Dual Print - ${leftPanel.patientName} vs ${rightPanel.patientName}</title>
        <style>
          @page { size: ${localPaperSize} ${isLandscape ? 'landscape' : 'portrait'}; margin: 10mm; }
          body { margin: 0; font-family: Arial, sans-serif; }
          img { image-rendering: -webkit-optimize-contrast; image-rendering: high-quality; }
          @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <div style="height:100vh;display:flex;flex-direction:column">
          ${settings.headerEnabled ? buildHeaderHtml() : ''}
          ${patientBar()}
          <div style="flex:1;display:flex;gap:4px;padding:4px">
            <div style="flex:1">${buildPanelGridHtml(leftCaptures, leftPanel.currentLayout)}</div>
            <div style="flex:1">${buildPanelGridHtml(rightCaptures, rightPanel.currentLayout)}</div>
          </div>
          ${settings.footerEnabled ? buildFooterHtml() : ''}
        </div>
        <script>window.onload = function() { setTimeout(() => { window.print(); window.close(); }, 500); }</script>
      </body>
      </html>
    `);
    printWin.document.close();

    addPrintJob({
      patientName: `${leftPanel.patientName} vs ${rightPanel.patientName}`,
      studyDate: leftPanel.studyDate,
      layout: `Dual ${leftPanel.currentLayout.spots}+${rightPanel.currentLayout.spots}`,
      copies: localCopies,
      paperSize: localPaperSize,
    });
    for (let i = 0; i < localCopies; i++) decrementPrintCount();

    setPrinting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex flex-col z-[1000]">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-app-header-bg border-b border-app-border flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-1 rounded hover:bg-app-hover text-app-text-secondary"><X className="w-5 h-5" /></button>
          <Printer className="w-5 h-5 text-app-accent" />
          <span className="text-sm font-bold text-app-text">Dual Print Preview</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button onClick={() => setZoom(Math.max(0.3, zoom - 0.1))} className="p-1 text-app-text-secondary"><ZoomOut className="w-4 h-4" /></button>
            <span className="text-xs text-app-text w-10 text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(Math.min(2.0, zoom + 0.1))} className="p-1 text-app-text-secondary"><ZoomIn className="w-4 h-4" /></button>
          </div>
          <select value={localPaperSize} onChange={(e) => setLocalPaperSize(e.target.value as PaperSize)}
            className="h-7 px-1 text-xs border border-app-border bg-app-bg text-app-text rounded">
            {PAPER_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <div className="flex rounded overflow-hidden border border-app-border">
            {(['portrait', 'landscape'] as const).map(o => (
              <button key={o} onClick={() => setLocalOrientation(o)}
                className={`px-3 py-1 text-[10px] font-bold ${localOrientation === o ? 'bg-app-accent text-white' : 'bg-app-bg text-app-text-secondary'}`}>
                {o === 'portrait' ? 'P' : 'L'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-app-text-muted">Copies:</span>
            <input type="number" min={1} value={localCopies} onChange={(e) => setLocalCopies(parseInt(e.target.value) || 1)}
              className="w-10 h-7 text-xs border border-app-border bg-app-bg text-app-text rounded text-center" />
          </div>
          <button onClick={handlePrint} disabled={printing || printCountRemaining <= 0}
            className="flex items-center gap-2 px-6 py-1.5 text-xs font-bold bg-app-accent text-white rounded hover:brightness-110 disabled:opacity-50">
            <Printer className="w-4 h-4" /> {printing ? 'Printing...' : 'Print Now'}
          </button>
        </div>
      </div>

      {/* Preview Area */}
      <div className="flex-1 overflow-auto p-10 flex justify-center bg-gray-900/50">
        <div className="bg-white shadow-2xl relative transition-all duration-300" style={{ width: pw * zoom, height: ph * zoom, minWidth: pw * zoom }}>
          {settings.headerEnabled && (
            <div style={{ padding: `${8 * zoom}px ${15 * zoom}px` }} className="border-b border-gray-200 flex items-center justify-between">
              <div>{renderSlotPv(hospitalConfig.headerLayout.left, hospitalConfig.customHeaderLeft)}</div>
              <div className="text-center">{renderSlotPv(hospitalConfig.headerLayout.center, hospitalConfig.customHeaderCenter)}</div>
              <div className="text-right">{renderSlotPv(hospitalConfig.headerLayout.right, hospitalConfig.customHeaderRight)}</div>
            </div>
          )}
          {settings.patientInfoEnabled && (
            <div style={{ padding: `${5 * zoom}px ${15 * zoom}px`, fontSize: `${9 * zoom}px` }} className="bg-gray-50 border-b border-gray-200 flex justify-between text-gray-600 font-medium">
              <span>Left: {leftPanel.patientName}</span>
              <span>Right: {rightPanel.patientName}</span>
              <span>Date: {leftPanel.studyDate}</span>
            </div>
          )}
          <div style={{ display: 'flex', gap: `${4 * zoom}px`, padding: `${4 * zoom}px`, height: `${(ph - 150) * zoom}px` }}>
            <div style={{ flex: 1 }}>{renderPanelGrid(leftCaptures, leftPanel.currentLayout)}</div>
            <div style={{ flex: 1 }}>{renderPanelGrid(rightCaptures, rightPanel.currentLayout)}</div>
          </div>
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
