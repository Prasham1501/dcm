import { useState, useEffect, CSSProperties } from 'react';
import { Printer, X } from 'lucide-react';
import { useDualViewerStore } from '@/stores/dualViewerStore';
import { usePrintStore } from '@/stores/printStore';
import { useHospitalConfigStore, getFormattedAddress, renderPrintSlot } from '@/stores/hospitalConfigStore';
import { captureCornerstoneElementForPrint, PrintOverlay } from '@/lib/printCapture';

function captureViewport(panelId: string, viewportIndex: number): string | null {
  const sel = '[data-dual-viewport-index="' + panelId + '-' + viewportIndex + '"]';
  const el = document.querySelector(sel) as HTMLElement;
  if (!el) return null;

  const { panels, stampPlacements } = useDualViewerStore.getState();
  const panel = panels[panelId as 'left' | 'right'];
  const startIndex = (panel.currentPage - 1) * panel.currentLayout.spots;
  const imageId = panel.images[startIndex + viewportIndex]?.imageUrl ?? null;

  const overlays: PrintOverlay[] = stampPlacements
    .filter(sp => sp.panelId === panelId && sp.imageId === imageId && imageId)
    .map(sp => ({
      text: sp.text,
      xPercent: sp.xPercent,
      yPercent: sp.yPercent,
      color: sp.color,
      fontSize: sp.fontSize,
      fontSizePercent: sp.fontSizePercent,
      type: sp.type ?? 'stamp',
    }));

  return captureCornerstoneElementForPrint(el, overlays);
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

  const [leftCaptures, setLeftCaptures] = useState<(string | null)[]>([]);
  const [rightCaptures, setRightCaptures] = useState<(string | null)[]>([]);
  const [printing, setPrinting] = useState(false);

  const [localPaperSize, setLocalPaperSize] = useState<PaperSize>(settings.paperSize as PaperSize);
  const [localOrientation, setLocalOrientation] = useState<'portrait' | 'landscape'>('landscape');
  const [localCopies] = useState(settings.copies);

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
  const pw = localOrientation === 'landscape' ? dims.h : dims.w;
  const ph = localOrientation === 'landscape' ? dims.w : dims.h;

  const renderSlotPv = (slot: string, customText: string) => {
    switch (slot) {
      case 'logo': return hospitalConfig.logoDataUrl
        ? <img src={hospitalConfig.logoDataUrl} style={{ maxHeight: 30, maxWidth: 80, objectFit: 'contain' }} alt="Logo" />
        : <span style={{ fontSize: 8 }} className="text-gray-400">[No Logo]</span>;
      case 'name': return <span style={{ fontSize: 9, fontWeight: 600 }} className="text-gray-700">{hospitalConfig.hospitalName}</span>;
      case 'address': return <span style={{ fontSize: 7 }} className="text-gray-500">{getFormattedAddress(hospitalConfig as any)}</span>;
      case 'custom': return <span style={{ fontSize: 8 }} className="text-gray-500">{customText}</span>;
      default: return null;
    }
  };

  const renderPanelGrid = (captures: (string | null)[], layout: typeof leftPanel.currentLayout, patientName: string) => {
    const gridStyle: CSSProperties = {
      display: 'grid',
      gap: '1px',
      gridTemplateColumns: 'repeat(' + layout.cols + ', 1fr)',
      gridTemplateRows: 'repeat(' + layout.rows + ', 1fr)',
      width: '100%',
      flex: 1,
      minHeight: 0,
      overflow: 'hidden',
    };
    const borderColor = hospitalConfig.viewportBorderColor || '#333';
    return (
      <div className="flex flex-col h-full border border-gray-200 overflow-hidden" style={{ minHeight: 0 }}>
        <div className="bg-gray-100 text-center font-bold border-b border-gray-200 text-gray-700 text-[10px] py-0.5 underline flex-shrink-0">
          {patientName}
        </div>
        <div style={gridStyle}>
          {captures.map((src, i) => (
            <div key={i} className="bg-black flex items-center justify-center overflow-hidden border" style={{ borderColor, minHeight: 0 }}>
              {src ? <img src={src} className="w-full h-full object-contain" alt="" /> : <span className="text-gray-600 text-[10px]">Empty</span>}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const handlePrint = async () => {
    if (printCountRemaining <= 0) { alert('No prints remaining.'); return; }
    setPrinting(true);
    updateSettings({ paperSize: localPaperSize, orientation: localOrientation, copies: localCopies });

    const printWin = window.open('', '_blank');
    if (!printWin) { setPrinting(false); return; }

    const borderCol = hospitalConfig.viewportBorderColor || '#ddd';

    const buildHeaderHtml = () => {
      const l = renderPrintSlot(hospitalConfig.headerLayout.left, hospitalConfig as any, hospitalConfig.customHeaderLeft);
      const c = renderPrintSlot(hospitalConfig.headerLayout.center, hospitalConfig as any, hospitalConfig.customHeaderCenter);
      const r = renderPrintSlot(hospitalConfig.headerLayout.right, hospitalConfig as any, hospitalConfig.customHeaderRight);
      return '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 15px;border-bottom:1px solid #ccc;font-size:10px"><div>' + l + '</div><div style="text-align:center">' + c + '</div><div style="text-align:right">' + r + '</div></div>';
    };

    const buildFooterHtml = () => {
      const l = renderPrintSlot(hospitalConfig.footerLayout.left, hospitalConfig as any, hospitalConfig.customFooterLeft, true);
      const c = renderPrintSlot(hospitalConfig.footerLayout.center, hospitalConfig as any, hospitalConfig.customFooterCenter, true);
      const r = renderPrintSlot(hospitalConfig.footerLayout.right, hospitalConfig as any, hospitalConfig.customFooterRight, true);
      return '<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 15px;border-top:1px solid #ccc;font-size:8px;color:#999"><div>' + l + '</div><div style="text-align:center">' + c + '</div><div style="text-align:right">' + r + '</div></div>';
    };

    const buildPanelGridHtml = (captures: (string | null)[], layout: typeof leftPanel.currentLayout, patientName: string) => {
      const gridCols = 'repeat(' + layout.cols + ', 1fr)';
      const gridRows = 'repeat(' + layout.rows + ', 1fr)';
      const imgsHtml = captures.map(src => {
        const inner = src ? '<img src="' + src + '" style="width:100%;height:100%;object-fit:contain" />' : '';
        return '<div style="background:black;display:flex;align-items:center;justify-content:center;overflow:hidden;min-height:0;border:1px solid ' + borderCol + '">' + inner + '</div>';
      }).join('');
      return '<div style="flex:1;display:flex;flex-direction:column;min-height:0;overflow:hidden">' +
        '<div style="padding:4px;text-align:center;font-weight:bold;font-size:12px;background:#eee;border:1px solid #ccc;text-decoration:underline;flex-shrink:0">' + patientName + '</div>' +
        '<div style="flex:1;display:grid;grid-template-columns:' + gridCols + ';grid-template-rows:' + gridRows + ';gap:2px;min-height:0;overflow:hidden">' + imgsHtml + '</div>' +
        '</div>';
    };

    let patientBarHtml = '';
    if (settings.patientInfoEnabled) {
      patientBarHtml = '<div style="padding:4px 15px;background:#f5f5f5;border-bottom:1px solid #ccc;display:flex;justify-content:center;font-size:10px"><span><b>Comparison:</b> ' + leftPanel.patientName + ' vs ' + rightPanel.patientName + ' | <b>Date:</b> ' + leftPanel.studyDate + '</span></div>';
    }

    printWin.document.open();
    printWin.document.write('<html><head><title>Print</title>');
    printWin.document.write('<style>@page { size: ' + localPaperSize + ' ' + localOrientation + '; margin: 5mm; } body { margin: 0; font-family: Arial; } img { image-rendering: high-quality; }</style></head><body>');
    printWin.document.write('<div style="height:100vh;display:flex;flex-direction:column">');
    if (settings.headerEnabled) printWin.document.write(buildHeaderHtml());
    printWin.document.write(patientBarHtml);
    printWin.document.write('<div style="flex:1;display:flex;gap:10px;padding:8px;min-height:0;overflow:hidden">');
    printWin.document.write(buildPanelGridHtml(leftCaptures, leftPanel.currentLayout, leftPanel.patientName));
    printWin.document.write(buildPanelGridHtml(rightCaptures, rightPanel.currentLayout, rightPanel.patientName));
    printWin.document.write('</div>');
    if (settings.footerEnabled) printWin.document.write(buildFooterHtml());
    printWin.document.write('</div>');
    printWin.document.write('<script>window.onload = function() { setTimeout(function() { window.print(); window.close(); }, 500); }<\/script>');
    printWin.document.write('</body></html>');
    printWin.document.close();

    const jobName = leftPanel.patientName + ' vs ' + rightPanel.patientName;
    const jobLayout = 'Dual ' + leftPanel.currentLayout.spots + '+' + rightPanel.currentLayout.spots;
    addPrintJob({
       patientName: jobName,
       studyDate: leftPanel.studyDate,
       layout: jobLayout,
       copies: localCopies, paperSize: localPaperSize
    });
    for (let i = 0; i < localCopies; i++) decrementPrintCount();
    setPrinting(false);
    onClose();
  };

  const orientationBtnClass = (o: string) => {
    const base = 'px-3 py-1 text-[10px] font-bold ';
    return base + (localOrientation === o ? 'bg-app-accent text-white' : 'bg-app-bg text-app-text-secondary');
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex flex-col z-[1000]">
      <div className="flex items-center justify-between px-4 py-2 bg-app-header-bg border-b border-app-border flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-1 rounded hover:bg-app-hover text-app-text-secondary"><X className="w-5 h-5" /></button>
          <span className="text-sm font-bold text-app-text">Dual Print Preview</span>
        </div>
        <div className="flex items-center gap-4">
          <select value={localPaperSize} onChange={(e) => setLocalPaperSize(e.target.value as PaperSize)} className="h-7 px-1 text-xs border border-app-border bg-app-bg text-app-text rounded">
            {PAPER_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <div className="flex rounded overflow-hidden border border-app-border">
            <button onClick={() => setLocalOrientation('portrait')} className={orientationBtnClass('portrait')}>P</button>
            <button onClick={() => setLocalOrientation('landscape')} className={orientationBtnClass('landscape')}>L</button>
          </div>
          <button onClick={handlePrint} disabled={printing || printCountRemaining <= 0} className="flex items-center gap-2 px-6 py-1.5 text-xs font-bold bg-app-accent text-white rounded hover:brightness-110 disabled:opacity-50">
            <Printer className="w-4 h-4" /> {printing ? 'Printing...' : 'Print Now'}
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-10 flex justify-center bg-gray-900/50">
        <div className="bg-white shadow-2xl relative flex flex-col" style={{ width: pw, height: ph, minWidth: pw, overflow: 'hidden' }}>
          <div style={{ padding: '8px 15px' }} className="border-b border-gray-200 flex justify-between flex-shrink-0">
            {renderSlotPv(hospitalConfig.headerLayout.left, hospitalConfig.customHeaderLeft)}
            {renderSlotPv(hospitalConfig.headerLayout.center, hospitalConfig.customHeaderCenter)}
            {renderSlotPv(hospitalConfig.headerLayout.right, hospitalConfig.customHeaderRight)}
          </div>
          <div style={{ display: 'flex', gap: '10px', padding: '8px', flex: 1, minHeight: 0, overflow: 'hidden' }}>
            <div className="flex-1" style={{ minHeight: 0, overflow: 'hidden' }}>{renderPanelGrid(leftCaptures, leftPanel.currentLayout, leftPanel.patientName)}</div>
            <div className="flex-1" style={{ minHeight: 0, overflow: 'hidden' }}>{renderPanelGrid(rightCaptures, rightPanel.currentLayout, rightPanel.patientName)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
