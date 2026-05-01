import { useState, useEffect, useCallback } from 'react';
import { Printer, X, ZoomIn, ZoomOut, Plus, Trash2, Check } from 'lucide-react';
import { useCRViewerStore } from '@/stores/crViewerStore';
import { usePrintStore } from '@/stores/printStore';
import { useHospitalConfigStore, getFormattedAddress, renderPrintSlot, buildBrandHeaderHtml } from '@/stores/hospitalConfigStore';
import { usePatientStore } from '@/stores/patientStore';
import { getAutoOrientationForLayout, getLayoutAreaNames, getLayoutGridTemplate } from '@/lib/layoutUtils';
import { captureCornerstoneViewportForPrint, waitForViewportImages, PrintOverlay } from '@/lib/printCapture';
import { fillEmptyPrintSlots } from '@/lib/printPageUtils';


function captureViewport(viewportIndex: number): string | null {
  const imageId = getViewportImageIds()[viewportIndex];
  const { stampPlacements } = useCRViewerStore.getState();
  const overlays: PrintOverlay[] = stampPlacements
    .filter(sp => sp.imageId === imageId && imageId)
    .map(sp => ({
      text: sp.text,
      xPercent: sp.xPercent,
      yPercent: sp.yPercent,
      color: sp.color,
      fontSize: sp.fontSize,
      fontSizePercent: sp.fontSizePercent,
      type: sp.type ?? 'stamp',
    }));
  return captureCornerstoneViewportForPrint('data-cr-viewport-index', viewportIndex, overlays);
}

function getViewportImageIds(): Array<string | null> {
  const { currentLayout, currentPage, images, viewportImageOverrides } = useCRViewerStore.getState();
  const startIndex = (currentPage - 1) * currentLayout.spots;

  return Array.from({ length: currentLayout.spots }, (_, viewportIndex) => {
    const globalIdx = startIndex + viewportIndex;
    const override = viewportImageOverrides[globalIdx];
    if (override && override !== 'deleted') return override;
    return images[globalIdx]?.imageUrl || null;
  });
}

function getPageViewportImageIds(spots: number, page: number): Array<string | null> {
  const { images, viewportImageOverrides } = useCRViewerStore.getState();
  const startIndex = (page - 1) * spots;
  return Array.from({ length: spots }, (_, viewportIndex) => {
    const globalIdx = startIndex + viewportIndex;
    const override = viewportImageOverrides[globalIdx];
    if (override && override !== 'deleted') return override;
    return images[globalIdx]?.imageUrl || null;
  });
}

const PAPER_SIZES = ['A4', 'A3', 'A5', 'Letter', 'Legal'] as const;
type PaperSize = typeof PAPER_SIZES[number];

const PAPER_DIMS: Record<string, { w: number; h: number }> = {
  A4: { w: 595, h: 842 }, A3: { w: 842, h: 1191 },
  A5: { w: 420, h: 595 }, Letter: { w: 612, h: 792 }, Legal: { w: 612, h: 1008 },
};

const PAPER_DIMS_MM: Record<string, { w: number; h: number }> = {
  A4: { w: 210, h: 297 }, A3: { w: 297, h: 420 },
  A5: { w: 148, h: 210 }, Letter: { w: 215.9, h: 279.4 }, Legal: { w: 215.9, h: 355.6 },
};
const PAGE_MARGIN_MM = 10;

interface CRPrintPreviewProps {
  onClose: () => void;
  initialPageMode?: 'all' | 'current' | 'custom';
}

export function CRPrintPreview({ onClose, initialPageMode = 'all' }: CRPrintPreviewProps) {
  const { settings, updateSettings, addPrintJob, decrementPrintCount, printCountRemaining } = usePrintStore();
  const {
    currentLayout, currentPage, totalPages, totalImages,
    patientName, patientId, studyDate, setCurrentPage,
  } = useCRViewerStore();
  const hospitalConfig = useHospitalConfigStore();

  const [zoom, setZoom] = useState(1.0);
  const [printing, setPrinting] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [captureProgress, setCaptureProgress] = useState(0);
  const [captureTotal, setCaptureTotal] = useState(0);

  const [localPaperSize, setLocalPaperSize] = useState<PaperSize>(settings.paperSize as PaperSize);
  const [localOrientation, setLocalOrientation] = useState(() => getAutoOrientationForLayout(currentLayout));
  const [localCopies, setLocalCopies] = useState(settings.copies);

  const [pageMode, setPageMode] = useState<'all' | 'current' | 'custom'>(initialPageMode);
  const [customPageInput, setCustomPageInput] = useState('');
  const [allPageCaptures, setAllPageCaptures] = useState<string[][]>([]);

  const [showPrinterMgr, setShowPrinterMgr] = useState(false);
  const [newPrinterName, setNewPrinterName] = useState('');
  const [newPrinterDisplay, setNewPrinterDisplay] = useState('');
  const [newPrinterType, setNewPrinterType] = useState('Laser');

  const configuredPrinters = hospitalConfig.printers;
  const activePrinters = configuredPrinters.filter(p => p.isActive);

  // Escape key to close
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);
  const defaultPrinter = activePrinters.find(p => p.isDefault) || activePrinters[0];
  const [selectedPrinter, setSelectedPrinter] = useState(defaultPrinter?.name || '');

  useEffect(() => {
    if (!selectedPrinter || !activePrinters.some((printer) => printer.name === selectedPrinter)) {
      setSelectedPrinter(defaultPrinter?.name || '');
    }
  }, [activePrinters, defaultPrinter, selectedPrinter]);

  const parsePageList = useCallback((input: string): number[] => {
    const pages = new Set<number>();
    input.split(',').forEach(part => {
      const trimmed = part.trim();
      const rangeMatch = trimmed.match(/^(\d+)-(\d+)$/);
      if (rangeMatch) {
        const from = parseInt(rangeMatch[1]), to = parseInt(rangeMatch[2]);
        for (let i = from; i <= to; i++) if (i >= 1 && i <= totalPages) pages.add(i);
      } else {
        const n = parseInt(trimmed);
        if (!isNaN(n) && n >= 1 && n <= totalPages) pages.add(n);
      }
    });
    return [...pages].sort((a, b) => a - b);
  }, [totalPages]);

  const selectedPages = useCallback((): number[] => {
    if (pageMode === 'current') return [currentPage];
    if (pageMode === 'custom') return parsePageList(customPageInput);
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }, [pageMode, currentPage, customPageInput, parsePageList, totalPages]);

  useEffect(() => {
    let cancelled = false;

    const captureAllPages = async () => {
      setCapturing(true);
      const origPage = useCRViewerStore.getState().currentPage;
      const pagesToCapture = initialPageMode === 'current' ? [currentPage] : Array.from({ length: totalPages }, (_, i) => i + 1);
      setCaptureTotal(pagesToCapture.length);
      const rawCaptures: Array<Array<string | null>> = [];
      for (let idx = 0; idx < pagesToCapture.length; idx++) {
        if (cancelled) return;
        const p = pagesToCapture[idx];
        setCaptureProgress(idx + 1);
        setCurrentPage(p);
        await waitForViewportImages('data-cr-viewport-index', getPageViewportImageIds(currentLayout.spots, p));
        if (cancelled) return;
        await new Promise(r => setTimeout(r, 75));
        rawCaptures.push(
          Array.from({ length: currentLayout.spots }, (_, viewportIndex) => captureViewport(viewportIndex)),
        );
      }
      setCurrentPage(origPage);
      await waitForViewportImages('data-cr-viewport-index', getPageViewportImageIds(currentLayout.spots, origPage));
      await new Promise(r => setTimeout(r, 75));
      // Build a full-size array so page indices line up (fill missing pages with empty arrays)
      const fullCaptures: string[][] = [];
      for (let p = 1; p <= totalPages; p++) {
        const capturedIdx = pagesToCapture.indexOf(p);
        if (capturedIdx >= 0) {
          fullCaptures.push(fillEmptyPrintSlots([rawCaptures[capturedIdx]], currentLayout.spots)[0]);
        } else {
          fullCaptures.push(Array(currentLayout.spots).fill(''));
        }
      }
      if (!cancelled) {
        setAllPageCaptures(fullCaptures);
        setCapturing(false);
      }
    };

    void captureAllPages();
    return () => {
      cancelled = true;
    };
  }, []);

  // Default print orientation follows the shared spot-count rule.
  useEffect(() => {
    setLocalOrientation(getAutoOrientationForLayout(currentLayout));
  }, [currentLayout]);

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

  const services = (hospitalConfig.servicesList || '').split('|').filter(Boolean);

  const renderBrandHeaderPv = () => (
    <div style={{ display: 'flex', alignItems: 'center', padding: `${3 * zoom}px ${8 * zoom}px`, gap: 6 * zoom, borderBottom: '2px solid #2563eb' }} className="bg-white flex-shrink-0">
      <div style={{ flex: '0 0 auto', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        {hospitalConfig.logoDataUrl ? (
          <img src={hospitalConfig.logoDataUrl} style={{ width: 35 * zoom, height: 35 * zoom, borderRadius: '50%', objectFit: 'cover', border: '1px solid #ddd' }} alt="Logo" />
        ) : (
          <span style={{ fontSize: 6 * zoom }} className="text-gray-400">[Logo]</span>
        )}
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', lineHeight: 1.3 }}>
        <div style={{ marginBottom: 1 * zoom }}>
          <span style={{ fontSize: 11 * zoom, fontWeight: 800, color: '#1e3a5f' }}>{hospitalConfig.hospitalName}</span>
          {hospitalConfig.brandNameSecondary && <span style={{ fontSize: 11 * zoom, fontWeight: 400, color: '#2563eb', marginLeft: 3 * zoom }}>{hospitalConfig.brandNameSecondary}</span>}
        </div>
        {services.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 * zoom, fontSize: 6 * zoom, fontWeight: 600, color: '#1a1a1a', flexWrap: 'wrap', marginBottom: 1 * zoom }}>
            {services.map((s, i) => (
              <span key={i}>{i > 0 && <span style={{ margin: `0 ${2 * zoom}px`, color: '#999' }}>|</span>}{s.trim()}</span>
            ))}
          </div>
        )}
        <div style={{ fontSize: 5 * zoom, color: '#2563eb', textTransform: 'uppercase', letterSpacing: 0.5 }}>{getFormattedAddress(hospitalConfig as any).toUpperCase()}</div>
        {(hospitalConfig.phone || hospitalConfig.email || hospitalConfig.website) && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 * zoom, fontSize: 6 * zoom, color: '#333', flexWrap: 'wrap', marginTop: 1 * zoom }}>
            {hospitalConfig.phone && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 * zoom }}><span style={{ color: '#16a34a' }}>☎</span>{hospitalConfig.phone}</span>}
            {hospitalConfig.email && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 * zoom }}><span style={{ color: '#ca8a04' }}>✉</span>{hospitalConfig.email}</span>}
            {hospitalConfig.website && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 * zoom }}><span style={{ color: '#2563eb' }}>🌐</span>{hospitalConfig.website}</span>}
          </div>
        )}
      </div>
    </div>
  );

  const buildPrintHtml = useCallback((pagesToPrint: number[]) => {
    const grid = getLayoutGridTemplate(currentLayout);
    const areaNames = getLayoutAreaNames(currentLayout.areas);

    const buildHeaderHtml = () => {
      return buildBrandHeaderHtml(hospitalConfig as any);
    };
    const buildFooterHtml = () => {
      const l = renderPrintSlot(hospitalConfig.footerLayout.left, hospitalConfig as any, hospitalConfig.customFooterLeft, true);
      const c = renderPrintSlot(hospitalConfig.footerLayout.center, hospitalConfig as any, hospitalConfig.customFooterCenter, true);
      const r = renderPrintSlot(hospitalConfig.footerLayout.right, hospitalConfig as any, hospitalConfig.customFooterRight, true);
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 15px;border-top:1px solid #ccc;font-size:8px;color:#666"><div>${l}</div><div style="text-align:center">${c}</div><div style="text-align:right">${r}</div></div>`;
    };
    const patientBarHtml = () => settings.patientInfoEnabled
      ? `<div style="padding:4px 15px;background:#f5f5f5;border-bottom:1px solid #ccc;display:flex;justify-content:space-between;font-size:10px"><span><b>Patient:</b> ${patientName}</span><span><b>ID:</b> ${patientId}</span><span><b>Date:</b> ${studyDate}</span></div>`
      : '';
    const pagesHtml = pagesToPrint.map((pageNum) => {
      const caps = allPageCaptures[pageNum - 1] || [];
      const imgsHtml = Array.from({ length: currentLayout.spots }).map((_, viewportIndex) => {
        const src = caps[viewportIndex];
        const areaStyle = currentLayout.areas && areaNames[viewportIndex] ? `grid-area:${areaNames[viewportIndex]};` : '';
        return src
          ? `<div style="${areaStyle}background:#000;display:flex;align-items:center;justify-content:center;overflow:hidden"><img src="${src}" style="width:100%;height:100%;object-fit:contain" /></div>`
          : `<div style="${areaStyle}background:#000;display:flex;align-items:center;justify-content:center;overflow:hidden"></div>`;
      }).join('');
      return `<div class="page">${settings.headerEnabled ? buildHeaderHtml() : ''}${patientBarHtml()}<div class="grid">${imgsHtml}</div>${hospitalConfig.enableFooter ? buildFooterHtml() : ''}</div>`;
    }).join('');
    const paperMm = PAPER_DIMS_MM[localPaperSize] || PAPER_DIMS_MM.A4;
    const sheetW = isLandscape ? paperMm.h : paperMm.w;
    const sheetH = isLandscape ? paperMm.w : paperMm.h;
    const pageW = sheetW - PAGE_MARGIN_MM * 2;
    const pageH = sheetH - PAGE_MARGIN_MM * 2;
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>DICOM Print - ${patientName}</title><style>@page{size:${localPaperSize} ${isLandscape ? 'landscape' : 'portrait'};margin:${PAGE_MARGIN_MM}mm}*{box-sizing:border-box}html,body{margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;width:${pageW}mm}.page{page-break-after:always;page-break-inside:avoid;display:flex;flex-direction:column;width:${pageW}mm;height:${pageH}mm;overflow:hidden;border:1px solid #444}.page:last-child{page-break-after:auto}.grid{display:grid;grid-template-columns:${grid.columns};grid-template-rows:${grid.rows};${grid.areas ? `grid-template-areas:${grid.areas};` : ''}gap:2px;padding:2px;flex:1;min-height:0;background:#374151}img{display:block;image-rendering:-webkit-optimize-contrast;image-rendering:high-quality}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body>${pagesHtml}</body></html>`;
  }, [allPageCaptures, currentLayout, settings, hospitalConfig, patientName, patientId, studyDate, localPaperSize, isLandscape]);

  const handlePrint = async () => {
    if (activePrinters.length === 0) { alert('No printers configured. Please add a printer in Config or Printer Settings.'); return; }
    if (printCountRemaining <= 0) { alert('No prints remaining.'); return; }
    if (allPageCaptures.length === 0) { alert('Still capturing pages, please wait.'); return; }
    setPrinting(true);
    try {
      updateSettings({ paperSize: localPaperSize, orientation: localOrientation, copies: localCopies });
      const pagesToPrint = selectedPages();
      const htmlContent = buildPrintHtml(pagesToPrint);
      const electronAPI = (window as any).electronAPI;
      let printStarted = false;

      if (electronAPI?.printToPrinter && selectedPrinter) {
        const result = await electronAPI.printToPrinter({
          printerName: selectedPrinter,
          htmlContent,
          printSettings: { paperSize: localPaperSize, orientation: localOrientation, copies: localCopies, colorMode: 'color', margins: 'none' },
        });

        if (result.success) {
          printStarted = true;
        } else {
          console.error('Direct print failed:', result.error);
          if (electronAPI?.printReportDialog) {
            const fallbackResult = await electronAPI.printReportDialog({ htmlContent, paperSize: localPaperSize });
            printStarted = fallbackResult?.success !== false;
          }
        }
      } else if (electronAPI?.printReportDialog) {
        const fallbackResult = await electronAPI.printReportDialog({ htmlContent, paperSize: localPaperSize });
        printStarted = fallbackResult?.success !== false;
      } else {
        const printWin = window.open('', '_blank');
        if (printWin) {
          printWin.document.write(htmlContent);
          printWin.document.close();
          setTimeout(() => { printWin.print(); }, 600);
          printStarted = true;
        }
      }

      if (!printStarted) {
        alert('Printing could not be started. Check the selected printer and try again.');
        return;
      }

      addPrintJob({ patientName, studyDate, layout: `${currentLayout.spots} Spots`, copies: localCopies, paperSize: localPaperSize });
      for (let i = 0; i < localCopies; i++) decrementPrintCount();
      const { patients, editPatient } = usePatientStore.getState();
      const matchedPatient = patients.find(p => p.patientId === patientId && p.patientName === patientName);
      if (matchedPatient) editPatient(matchedPatient.id, { printed: true });
      onClose();
    } catch (e) {
      console.error('Print error:', e);
      alert('Printing failed. Check the printer configuration and try again.');
    } finally {
      setPrinting(false);
    }
  };

  const previewGridStyle: React.CSSProperties = {
    display: 'grid',
    gap: '2px',
    flex: 1,
    minHeight: 0,
    padding: '2px',
    backgroundColor: '#374151',
    ...(currentLayout.areas ? { gridTemplateAreas: currentLayout.areas } : {}),
    gridTemplateColumns: getLayoutGridTemplate(currentLayout).columns,
    gridTemplateRows: getLayoutGridTemplate(currentLayout).rows,
  };
  const toolbarH = showPrinterMgr ? 190 : 55;
  const areaNames = getLayoutAreaNames(currentLayout.areas);

  const handleAddPrinter = () => {
    if (!newPrinterName.trim()) return;
    hospitalConfig.addPrinter({ name: newPrinterName.trim(), displayName: newPrinterDisplay.trim() || newPrinterName.trim(), type: newPrinterType, isDefault: configuredPrinters.length === 0, isActive: true });
    setNewPrinterName(''); setNewPrinterDisplay(''); setNewPrinterType('Laser');
  };

  const pagesToShow = selectedPages();

  return (
    <div className="fixed inset-0 bg-black flex flex-col z-[1000]">
      <div className="flex items-center justify-between px-3 py-1.5 bg-app-header-bg border-b border-app-border flex-shrink-0 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="px-2 py-1 text-xs border border-app-border text-app-text-secondary bg-app-bg rounded hover:bg-app-hover flex items-center gap-1"><X className="w-3 h-3" /> Back</button>
          <Printer className="w-5 h-5 text-app-accent" />
          <span className="text-sm font-bold text-app-text">Print Preview</span>
          {capturing && <span className="text-[10px] text-yellow-500 animate-pulse">Capturing page {captureProgress}/{captureTotal}…</span>}
          {!capturing && <span className="text-xs text-app-text-muted">{totalPages} page{totalPages > 1 ? 's' : ''} · {totalImages} images</span>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-app-text-secondary whitespace-nowrap">Prints: <span className={`font-bold ${printCountRemaining < 50 ? 'text-red-500' : 'text-green-600'}`}>{printCountRemaining}</span></span>
          <button onClick={() => setZoom(Math.max(0.3, zoom - 0.1))} className="p-1 text-app-text-secondary hover:bg-app-hover rounded"><ZoomOut className="w-4 h-4" /></button>
          <span className="text-xs text-app-text w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(Math.min(2.0, zoom + 0.1))} className="p-1 text-app-text-secondary hover:bg-app-hover rounded"><ZoomIn className="w-4 h-4" /></button>
          <div className="w-px h-5 bg-app-border" />
          <select value={localPaperSize} onChange={(e) => setLocalPaperSize(e.target.value as PaperSize)} className="h-7 px-1 text-xs border border-app-border bg-app-bg text-app-text rounded">{PAPER_SIZES.map(s => <option key={s} value={s}>{s}</option>)}</select>
          <div className="flex rounded overflow-hidden border border-app-border">
            {(['portrait', 'landscape'] as const).map(o => (<button key={o} onClick={() => setLocalOrientation(o)} className={`px-2 py-1 text-[10px] font-bold transition-colors ${localOrientation === o ? 'bg-app-accent text-white' : 'bg-app-bg text-app-text-secondary hover:bg-app-hover'}`}>{o === 'portrait' ? 'P' : 'L'}</button>))}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-app-text-muted">Copies:</span>
            <input type="number" min={1} max={10} value={localCopies} onChange={(e) => setLocalCopies(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))} className="w-10 h-7 text-xs border border-app-border bg-app-bg text-app-text rounded text-center" />
          </div>
          <div className="flex items-center gap-1 border border-app-border rounded overflow-hidden">
            {(['all', 'current', 'custom'] as const).map(m => (<button key={m} onClick={() => setPageMode(m)} className={`px-2 py-1 text-[10px] font-semibold whitespace-nowrap transition-colors ${pageMode === m ? 'bg-app-accent text-white' : 'bg-app-bg text-app-text-secondary hover:bg-app-hover'}`}>{m === 'all' ? `All (${totalPages})` : m === 'current' ? `Page ${currentPage}` : 'Custom'}</button>))}
          </div>
          {pageMode === 'custom' && (<input type="text" value={customPageInput} onChange={(e) => setCustomPageInput(e.target.value)} placeholder="e.g. 1,3-5" className="w-24 h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded" />)}
          <div className="flex items-center gap-1">
            {activePrinters.length > 0 ? (
              <select value={selectedPrinter} onChange={(e) => setSelectedPrinter(e.target.value)} className="h-7 px-1 text-xs border border-app-border bg-app-bg text-app-text rounded max-w-[130px]">{activePrinters.map(p => <option key={p.name} value={p.name}>{p.displayName || p.name}</option>)}</select>
            ) : <span className="text-[10px] text-red-400 italic">No printers configured</span>}
            <button onClick={() => setShowPrinterMgr(v => !v)} className={`h-7 px-2 text-[10px] border rounded transition-colors ${showPrinterMgr ? 'border-app-accent bg-app-accent/10 text-app-accent' : 'border-app-border text-app-text-secondary hover:bg-app-hover'}`} title="Manage printers">⚙</button>
          </div>
          <button onClick={handlePrint} disabled={printing || capturing || printCountRemaining <= 0 || activePrinters.length === 0} className="flex items-center gap-2 px-5 py-1.5 text-xs font-bold bg-app-accent text-white rounded hover:brightness-110 disabled:opacity-50 transition-colors">
            <Printer className="w-4 h-4" />{printing ? 'Printing…' : capturing ? 'Capturing…' : `Print${pagesToShow.length > 1 ? ` (${pagesToShow.length}p)` : ''}`}
          </button>
        </div>
      </div>
      {showPrinterMgr && (
        <div className="bg-app-surface border-b border-app-border px-4 py-3 flex-shrink-0">
          <div className="flex items-start gap-6">
            <div className="flex-1">
              <h4 className="text-xs font-bold text-app-accent mb-2">Configured Printers</h4>
              {configuredPrinters.length === 0 ? (<p className="text-xs text-app-text-muted italic">No printers configured. Add one below.</p>) : (
                <div className="space-y-1 max-h-32 overflow-auto">
                  {configuredPrinters.map(p => (
                    <div key={p.name} className="flex items-center gap-2 text-xs">
                      <span className={`flex-1 ${!p.isActive ? 'opacity-40 line-through' : ''}`}>{p.displayName || p.name} <span className="text-app-text-muted">({p.type})</span></span>
                      {p.isDefault && <span className="text-[9px] bg-app-accent text-white px-1 rounded">Default</span>}
                      <button onClick={() => hospitalConfig.setDefaultPrinter(p.name)} title="Set as default" className="p-0.5 hover:text-app-accent"><Check className="w-3 h-3" /></button>
                      <button onClick={() => hospitalConfig.togglePrinterActive(p.name)} title="Toggle active" className="p-0.5 hover:text-yellow-500 text-app-text-muted">{p.isActive ? '●' : '○'}</button>
                      <button onClick={() => { hospitalConfig.removePrinter(p.name); if (selectedPrinter === p.name) setSelectedPrinter(''); }} title="Remove" className="p-0.5 hover:text-red-500 text-app-text-muted"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="w-64">
              <h4 className="text-xs font-bold text-app-accent mb-2">Add Printer</h4>
              <div className="space-y-1.5">
                <input type="text" value={newPrinterName} onChange={(e) => setNewPrinterName(e.target.value)} placeholder="System printer name (exact)" className="w-full h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded" />
                <input type="text" value={newPrinterDisplay} onChange={(e) => setNewPrinterDisplay(e.target.value)} placeholder="Display name (optional)" className="w-full h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded" />
                <div className="flex gap-1">
                  <select value={newPrinterType} onChange={(e) => setNewPrinterType(e.target.value)} className="flex-1 h-7 px-1 text-xs border border-app-border bg-app-bg text-app-text rounded">{['Laser', 'Inkjet', 'DICOM Thermal', 'Virtual', 'Other'].map(t => <option key={t} value={t}>{t}</option>)}</select>
                  <button onClick={handleAddPrinter} disabled={!newPrinterName.trim()} className="h-7 px-3 text-xs font-semibold bg-app-accent text-white rounded hover:opacity-90 disabled:opacity-40 flex items-center gap-1"><Plus className="w-3 h-3" /> Add</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="flex-1 overflow-auto flex flex-col items-center bg-gray-900/50 p-4 gap-4">
        {capturing ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-app-accent text-lg font-bold mb-2">Capturing Pages…</div>
              <div className="text-app-text-muted text-sm">Page {captureProgress} of {captureTotal}</div>
              <div className="w-48 h-2 bg-gray-700 rounded-full mt-3 overflow-hidden"><div className="h-full bg-app-accent rounded-full transition-all" style={{ width: `${(captureProgress / (captureTotal || 1)) * 100}%` }} /></div>
            </div>
          </div>
        ) : (
          pagesToShow.map((pageNum) => {
            const pageCaps = allPageCaptures[pageNum - 1] || [];
            return (
              <div key={`preview-page-${pageNum}`} className="flex-shrink-0 flex flex-col items-center mb-4">
                <div className="text-xs text-app-text-muted py-1 text-center">Page {pageNum} of {totalPages} — {localPaperSize} {localOrientation}</div>
                <div className="flex flex-col border border-gray-600 shadow-xl" style={{ width: `min(calc(98vw * ${zoom}), calc((100vh - ${toolbarH}px - 50px) * ${zoom} * ${(pw/ph).toFixed(4)}))`, aspectRatio: `${pw} / ${ph}` }}>
                  {settings.headerEnabled && renderBrandHeaderPv()}
                  {settings.patientInfoEnabled && (
                    <div style={{ padding: '3px 12px', fontSize: '10px' }} className="bg-gray-900 border-b border-gray-700 flex justify-between text-gray-300 font-medium flex-shrink-0">
                      <span>Patient: {patientName}</span><span>ID: {patientId}</span><span>Date: {studyDate}</span><span>Page {pageNum}/{totalPages}</span>
                    </div>
                  )}
                  <div className="flex-1 min-h-0">
                    <div style={previewGridStyle} className="h-full">
                      {Array.from({ length: currentLayout.spots }).map((_, i) => {
                        const src = pageCaps[i];
                        const areaStyle: React.CSSProperties = currentLayout.areas && areaNames[i] ? { gridArea: areaNames[i] } : {};
                        return (
                          <div key={i} className="bg-black overflow-hidden" style={areaStyle}>
                            {src ? (<img src={src} className="w-full h-full object-contain" alt={`Page ${pageNum} Image ${i + 1}`} />) : (<span className="text-gray-600 text-[10px] select-none flex items-center justify-center w-full h-full">Empty</span>)}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {hospitalConfig.enableFooter && (
                    <div style={{ padding: '3px 12px', fontSize: '9px' }} className="border-t border-gray-700 flex justify-between items-center bg-gray-900 text-gray-400 flex-shrink-0">
                      <div>{renderSlotPv(hospitalConfig.footerLayout.left, hospitalConfig.customFooterLeft)}</div>
                      <div className="text-center">{renderSlotPv(hospitalConfig.footerLayout.center, hospitalConfig.customFooterCenter)}</div>
                      <div className="text-right">{renderSlotPv(hospitalConfig.footerLayout.right, hospitalConfig.customFooterRight)}</div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
