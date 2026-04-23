import { Printer, X, ZoomIn, ZoomOut, ChevronLeft, Users, Plus, Trash2, Check } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePrintStore } from '@/stores/printStore';
import { useViewerStore } from '@/stores/viewerStore';
import { usePatientStore } from '@/stores/patientStore';
import { useHospitalConfigStore, getFormattedAddress, renderPrintSlot } from '@/stores/hospitalConfigStore';
import { captureCornerstoneElementsForPrint } from '@/lib/printCapture';

function captureAllViewportsHQ(): string[] {
  return captureCornerstoneElementsForPrint('[data-viewport-index]', 'data-viewport-index');
}

function getAreaLetters(areas: string): string[] {
  return [...new Set(areas.replace(/['"]/g, '').split(/\s+/).filter(Boolean))];
}

function autoFill(imgs: string[], spots: number, isCR: boolean): string[] {
  if (isCR) return imgs;
  const filled = imgs.filter(i => i && i !== '');
  if (filled.length === 0) return imgs;
  const out: string[] = [];
  for (let i = 0; i < spots; i++) {
    out.push(imgs[i] && imgs[i] !== '' ? imgs[i] : filled[i % filled.length]);
  }
  return out;
}

const PAPER_SIZES = ['A4', 'A3', 'A5', 'Letter', 'Legal'] as const;
type PaperSize = typeof PAPER_SIZES[number];

const PAPER_DIMS: Record<string, { w: number; h: number }> = {
  A4: { w: 595, h: 842 }, A3: { w: 842, h: 1191 },
  A5: { w: 420, h: 595 }, Letter: { w: 612, h: 792 }, Legal: { w: 612, h: 1008 },
};

export function PrintPreview() {
  const navigate = useNavigate();
  const { settings, updateSettings, setShowPrintPreview, addPrintJob, decrementPrintCount, printCountRemaining } = usePrintStore();
  const { currentLayout, patientName, patientId, studyDate, currentPage, totalPages, totalImages, images, setCurrentPage } = useViewerStore();
  const hospitalConfig = useHospitalConfigStore();

  const [zoom, setZoom] = useState(1.0);
  const [printType, setPrintType] = useState<'image' | 'pcpndt'>('image');
  const [printing, setPrinting] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [captureProgress, setCaptureProgress] = useState(0);

  const [localPaperSize, setLocalPaperSize] = useState<PaperSize>(settings.paperSize as PaperSize);
  const [localOrientation, setLocalOrientation] = useState(settings.orientation);
  const [localCopies, setLocalCopies] = useState(settings.copies);

  const [pageMode, setPageMode] = useState<'all' | 'current' | 'custom'>('all');
  const [customPageInput, setCustomPageInput] = useState('');
  const [allPageCaptures, setAllPageCaptures] = useState<string[][]>([]);

  const [showPrinterMgr, setShowPrinterMgr] = useState(false);
  const [newPrinterName, setNewPrinterName] = useState('');
  const [newPrinterDisplay, setNewPrinterDisplay] = useState('');
  const [newPrinterType, setNewPrinterType] = useState('Laser');

  const isCR = images.some(img => img.description?.toUpperCase().includes('CR') || (img as any).modality?.toUpperCase() === 'CR');

  const configuredPrinters = hospitalConfig.printers;
  const activePrinters = configuredPrinters.filter(p => p.isActive);
  const defaultPrinter = activePrinters.find(p => p.isDefault) || activePrinters[0];
  const [selectedPrinter, setSelectedPrinter] = useState(defaultPrinter?.name || '');

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
    const captureAllPages = async () => {
      setCapturing(true);
      const origPage = currentPage;
      const captures: string[][] = [];
      for (let p = 1; p <= totalPages; p++) {
        setCaptureProgress(p);
        setCurrentPage(p);
        await new Promise(r => setTimeout(r, 600));
        const pageCaps = captureAllViewportsHQ();
        captures.push(autoFill(pageCaps, currentLayout.spots, isCR));
      }
      setCurrentPage(origPage);
      await new Promise(r => setTimeout(r, 300));
      setAllPageCaptures(captures);
      setCapturing(false);
    };
    captureAllPages();
  }, []);

  // Default print sheets follow the configured film layout; square/tall layouts use portrait.
  useEffect(() => {
    if (currentLayout.cols > currentLayout.rows) setLocalOrientation('landscape');
    else setLocalOrientation('portrait');
  }, []);

  const dims = PAPER_DIMS[localPaperSize] || PAPER_DIMS.A4;
  const isLandscape = localOrientation === 'landscape';
  const pw = isLandscape ? dims.h : dims.w;
  const ph = isLandscape ? dims.w : dims.h;

  // Swap cols/rows to match orientation (only for simple grids without areas)
  const needsSwap = !currentLayout.areas && (
    (isLandscape && currentLayout.cols < currentLayout.rows) ||
    (!isLandscape && currentLayout.cols > currentLayout.rows)
  );
  const effectiveCols = needsSwap ? currentLayout.rows : currentLayout.cols;
  const effectiveRows = needsSwap ? currentLayout.cols : currentLayout.rows;

  const buildGridCss = () => {
    const l = currentLayout;
    const gridCols = l.areas ? (l.gridTemplate?.columns ?? `repeat(${l.cols}, 1fr)`) : `repeat(${effectiveCols}, 1fr)`;
    const gridRows = l.areas ? (l.gridTemplate?.rows ?? `repeat(${l.rows}, 1fr)`) : `repeat(${effectiveRows}, 1fr)`;
    const gridAreas = l.areas ? `grid-template-areas: ${l.areas};` : '';
    return { gridCols, gridRows, gridAreas };
  };

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

  const patientBarHtml = () => settings.patientInfoEnabled
    ? `<div style="padding:4px 15px;background:#f5f5f5;border-bottom:1px solid #ccc;display:flex;justify-content:space-between;font-size:10px"><span><b>Patient:</b> ${patientName}</span><span><b>ID:</b> ${patientId}</span><span><b>Date:</b> ${studyDate}</span></div>`
    : '';

  const renderSlotPv = (slot: string, customText: string) => {
    switch (slot) {
      case 'logo': return hospitalConfig.logoDataUrl ? <img src={hospitalConfig.logoDataUrl} style={{ maxHeight: 30 * zoom, maxWidth: 80 * zoom, objectFit: 'contain' }} alt="Logo" /> : <span style={{ fontSize: 8 * zoom }} className="text-gray-400">[No Logo]</span>;
      case 'name': return <span style={{ fontSize: 9 * zoom, fontWeight: 600 }} className="text-gray-700">{hospitalConfig.hospitalName}</span>;
      case 'address': return <span style={{ fontSize: 7 * zoom }} className="text-gray-500">{getFormattedAddress(hospitalConfig as any)}{hospitalConfig.phone && ` | ${hospitalConfig.phone}`}</span>;
      case 'custom': return <span style={{ fontSize: 8 * zoom }} className="text-gray-500">{customText}</span>;
      default: return null;
    }
  };

  const buildPrintHtml = useCallback((pagesToPrint: number[]) => {
    const { gridCols, gridRows, gridAreas } = buildGridCss();
    const areaNames = currentLayout.areas ? getAreaLetters(currentLayout.areas) : [];
    const pagesHtml = pagesToPrint.map((pageNum) => {
      const caps = allPageCaptures[pageNum - 1] || [];
      const imgsHtml = Array.from({ length: currentLayout.spots }).map((_, i) => {
        const src = caps[i];
        const cellBg = src ? '#000' : '#f5f5f5';
        const areaStyle = currentLayout.areas && areaNames[i] ? `grid-area:${areaNames[i]};` : '';
        return src
          ? `<div style="${areaStyle}background:${cellBg};display:flex;align-items:center;justify-content:center;overflow:hidden"><img src="${src}" style="width:100%;height:100%;object-fit:contain" /></div>`
          : `<div style="${areaStyle}background:${cellBg};display:flex;align-items:center;justify-content:center;overflow:hidden"></div>`;
      }).join('');
      return `<div class="page">${settings.headerEnabled ? buildHeaderHtml() : ''}${patientBarHtml()}<div class="grid">${imgsHtml}</div>${hospitalConfig.enableFooter ? buildFooterHtml() : ''}</div>`;
    }).join('');
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>DICOM Print - ${patientName}</title><style>@page{size:${localPaperSize} ${isLandscape ? 'landscape' : 'portrait'};margin:10mm}*{box-sizing:border-box}body{margin:0;padding:0;font-family:Arial,Helvetica,sans-serif}.page{page-break-after:always;page-break-inside:avoid;display:flex;flex-direction:column;height:calc(100vh);overflow:hidden}.page:last-child{page-break-after:auto}.grid{display:grid;grid-template-columns:${gridCols};grid-template-rows:${gridRows};${gridAreas}gap:1px;background:#444;padding:0;flex:1;min-height:0}img{display:block}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body>${pagesHtml}</body></html>`;
  }, [allPageCaptures, currentLayout, settings, hospitalConfig, patientName, patientId, studyDate, localPaperSize, isLandscape]);

  const buildPcpndtHtml = () => {
    const hosp = hospitalConfig.hospitalName || 'Hospital';
    const addr = [hospitalConfig.address1, hospitalConfig.city, hospitalConfig.state, hospitalConfig.pincode].filter(Boolean).join(', ');
    const rows = [['Patient Name', patientName], ['Patient ID', patientId], ['Date of Examination', studyDate], ['Referred By', ''], ['Address', ''], ['Age / LMP', ''], ['No. of Children (M/F)', ''], ['Indication for Test', ''], ['Findings', ''], ['Result / Impression', '']];
    const rowsHtml = rows.map(([l, v]) => `<tr><td class="label">${l}</td><td class="val">${v || '&nbsp;'}</td></tr>`).join('');
    return `<!DOCTYPE html><html><head><title>PCPNDT Form F</title><style>@page{size:A5 portrait;margin:8mm}body{margin:0;font-family:Arial,sans-serif;font-size:10pt}.box{border:2px solid #000;padding:8px;min-height:170mm}h2{text-align:center;font-size:12pt;margin:3px 0}h3{text-align:center;font-size:10pt;margin:2px 0}table{width:100%;border-collapse:collapse;margin-top:8px}td{padding:3px 5px;border:1px solid #000;font-size:9pt}.label{font-weight:bold;width:40%}.val{min-height:16px}.sig{margin-top:16mm;display:flex;justify-content:space-between}.sigLine{border-top:1px solid #000;width:60mm;margin-top:10mm}@media print{body{-webkit-print-color-adjust:exact}}</style></head><body><div class="box"><h2>${hosp}</h2><h3>${addr}</h3>${hospitalConfig.phone ? `<p style="text-align:center;font-size:9pt;margin:2px 0">Tel: ${hospitalConfig.phone}</p>` : ''}<hr style="margin:5px 0;border-top:1px solid #000"/><h3 style="text-decoration:underline">Form F (PCPNDT)</h3><p style="text-align:center;font-size:8pt;margin:2px 0">Pre-Conception &amp; Pre-Natal Diagnostic Techniques Act, 1994</p><table>${rowsHtml}</table><div class="sig"><div style="text-align:center"><div class="sigLine"></div><div style="font-size:8pt">Signature of Patient / Guardian</div></div><div style="text-align:center"><div class="sigLine"></div><div style="font-size:8pt">Signature &amp; Seal of Radiologist</div></div></div><p style="font-size:7pt;text-align:center;margin-top:4px">This record shall be maintained for a period of 2 years or such period as may be prescribed.</p></div></body></html>`;
  };

  const handlePrint = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (activePrinters.length === 0) { alert('No printers configured. Please add a printer in Config or Printer Settings.'); return; }
    if (printCountRemaining <= 0) { alert('No prints remaining. Please recharge your print count.'); return; }
    if (allPageCaptures.length === 0 && printType === 'image') { alert('Still capturing pages, please wait.'); return; }
    setPrinting(true);
    updateSettings({ paperSize: localPaperSize, orientation: localOrientation, copies: localCopies, defaultPrinter: selectedPrinter });
    const pagesToPrint = selectedPages();
    const htmlContent = printType === 'pcpndt' ? buildPcpndtHtml() : buildPrintHtml(pagesToPrint);
    const electronAPI = (window as any).electronAPI;
    if (electronAPI?.printToPrinter && selectedPrinter) {
      try {
        const result = await electronAPI.printToPrinter({ printerName: selectedPrinter, htmlContent, printSettings: { paperSize: localPaperSize, orientation: localOrientation, copies: localCopies, colorMode: 'color', margins: 'none' } });
        if (!result.success) {
          console.error('Direct print failed:', result.error);
          if (electronAPI?.printReportDialog) await electronAPI.printReportDialog({ htmlContent, paperSize: localPaperSize });
        }
      } catch (err) { console.error('Print error:', err); }
    } else if (electronAPI?.printReportDialog) {
      try { await electronAPI.printReportDialog({ htmlContent, paperSize: localPaperSize }); } catch (err) { console.error('PDF print error:', err); }
    } else {
      const printWin = window.open('', '_blank');
      if (printWin) { printWin.document.write(htmlContent); printWin.document.close(); setTimeout(() => { printWin.print(); }, 600); }
    }
    addPrintJob({ patientName, studyDate, layout: `${currentLayout.spots} Spots`, copies: localCopies, paperSize: localPaperSize });
    for (let i = 0; i < localCopies; i++) decrementPrintCount();
    const { patients, editPatient } = usePatientStore.getState();
    const matchedPatient = patients.find(p => p.patientId === patientId && p.patientName === patientName);
    if (matchedPatient) editPatient(matchedPatient.id, { printed: true });
    setPrinting(false);
    setShowPrintPreview(false);
  };

  const previewGridStyle: React.CSSProperties = {
    display: 'grid', gap: '1px', flex: 1, minHeight: 0, padding: 0, background: '#444',
    ...(currentLayout.areas ? {
      gridTemplateAreas: currentLayout.areas,
      gridTemplateColumns: currentLayout.gridTemplate?.columns ?? `repeat(${currentLayout.cols}, 1fr)`,
      gridTemplateRows: currentLayout.gridTemplate?.rows ?? `repeat(${currentLayout.rows}, 1fr)`,
    } : {
      gridTemplateColumns: `repeat(${effectiveCols}, 1fr)`,
      gridTemplateRows: `repeat(${effectiveRows}, 1fr)`,
    }),
  };
  const toolbarH = showPrinterMgr ? 190 : 55;
  const areaNames = currentLayout.areas ? getAreaLetters(currentLayout.areas) : [];

  const handleAddPrinter = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!newPrinterName.trim()) return;
    hospitalConfig.addPrinter({ name: newPrinterName.trim(), displayName: newPrinterDisplay.trim() || newPrinterName.trim(), type: newPrinterType, isDefault: configuredPrinters.length === 0, isActive: true });
    setNewPrinterName(''); setNewPrinterDisplay(''); setNewPrinterType('Laser');
  };

  const pagesToShow = selectedPages();

  return (
    <div className="fixed inset-0 bg-black/80 flex flex-col z-[1000]" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between px-3 py-1.5 bg-app-header-bg border-b border-app-border flex-shrink-0 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button type="button" onClick={e => { e.stopPropagation(); setShowPrintPreview(false); navigate('/'); }} className="px-2 py-1 text-xs border border-app-border text-app-text-secondary bg-app-bg rounded hover:bg-app-hover flex items-center gap-1"><Users className="w-3 h-3" /> Patients</button>
          <button type="button" onClick={e => { e.stopPropagation(); setShowPrintPreview(false); }} className="px-2 py-1 text-xs border border-app-border text-app-text-secondary bg-app-bg rounded hover:bg-app-hover flex items-center gap-1"><ChevronLeft className="w-3 h-3" /> Viewer</button>
          <span className="text-xs text-app-text-muted">|</span>
          <Printer className="w-5 h-5 text-app-accent" />
          <span className="text-sm font-bold text-app-text">Print Preview</span>
          {capturing && <span className="text-[10px] text-yellow-500 animate-pulse">Capturing page {captureProgress}/{totalPages}…</span>}
          {!capturing && <span className="text-xs text-app-text-muted">{totalPages} page{totalPages > 1 ? 's' : ''} · {totalImages} images</span>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-app-text-secondary whitespace-nowrap">Prints: <span className={`font-bold ${printCountRemaining < 50 ? 'text-red-500' : 'text-green-600'}`}>{printCountRemaining}</span></span>
          <button type="button" onClick={e => { e.stopPropagation(); setZoom(z => Math.max(0.3, z - 0.1)); }} className="p-1 text-app-text-secondary hover:bg-app-hover rounded"><ZoomOut className="w-4 h-4" /></button>
          <span className="text-xs text-app-text w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={e => { e.stopPropagation(); setZoom(z => Math.min(2.0, z + 0.1)); }} className="p-1 text-app-text-secondary hover:bg-app-hover rounded"><ZoomIn className="w-4 h-4" /></button>
          <div className="w-px h-5 bg-app-border" />
          <select value={localPaperSize} onChange={e => { e.stopPropagation(); setLocalPaperSize(e.target.value as PaperSize); }} onClick={e => e.stopPropagation()} className="h-7 px-1 text-xs border border-app-border bg-app-bg text-app-text rounded">{PAPER_SIZES.map(s => <option key={s} value={s}>{s}</option>)}</select>
          <div className="flex rounded overflow-hidden border border-app-border">
            {(['portrait', 'landscape'] as const).map(o => (<button key={o} type="button" onClick={e => { e.stopPropagation(); setLocalOrientation(o); }} className={`px-2 py-1 text-[10px] font-bold transition-colors ${localOrientation === o ? 'bg-app-accent text-white' : 'bg-app-bg text-app-text-secondary hover:bg-app-hover'}`}>{o === 'portrait' ? 'P' : 'L'}</button>))}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-app-text-muted">Copies:</span>
            <input type="number" min={1} max={10} value={localCopies} onChange={e => { e.stopPropagation(); setLocalCopies(Math.max(1, Math.min(10, Number(e.target.value)))); }} onClick={e => e.stopPropagation()} className="w-10 h-7 px-1 text-xs border border-app-border bg-app-bg text-app-text rounded text-center" />
          </div>
          <div className="flex items-center gap-1 border border-app-border rounded overflow-hidden">
            {(['all', 'current', 'custom'] as const).map(m => (<button key={m} type="button" onClick={e => { e.stopPropagation(); setPageMode(m); }} className={`px-2 py-1 text-[10px] font-semibold whitespace-nowrap transition-colors ${pageMode === m ? 'bg-app-accent text-white' : 'bg-app-bg text-app-text-secondary hover:bg-app-hover'}`}>{m === 'all' ? `All (${totalPages})` : m === 'current' ? `Page ${currentPage}` : 'Custom'}</button>))}
          </div>
          {pageMode === 'custom' && (<input type="text" value={customPageInput} onChange={e => { e.stopPropagation(); setCustomPageInput(e.target.value); }} onClick={e => e.stopPropagation()} placeholder="e.g. 1,3-5" className="w-24 h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded" />)}
          <div className="flex items-center gap-1">
            {activePrinters.length > 0 ? (
              <select value={selectedPrinter} onChange={e => { e.stopPropagation(); setSelectedPrinter(e.target.value); }} onClick={e => e.stopPropagation()} className="h-7 px-1 text-xs border border-app-border bg-app-bg text-app-text rounded max-w-[130px]">{activePrinters.map(p => <option key={p.name} value={p.name}>{p.displayName || p.name}</option>)}</select>
            ) : <span className="text-[10px] text-red-400 italic">No printers configured</span>}
            <button type="button" onClick={e => { e.stopPropagation(); setShowPrinterMgr(v => !v); }} className={`h-7 px-2 text-[10px] border rounded transition-colors ${showPrinterMgr ? 'border-app-accent bg-app-accent/10 text-app-accent' : 'border-app-border text-app-text-secondary hover:bg-app-hover'}`} title="Manage printers">⚙</button>
          </div>
          <div className="flex rounded overflow-hidden border border-app-border">
            <button type="button" onClick={e => { e.stopPropagation(); setPrintType('image'); }} className={`px-2 py-1 text-[10px] font-semibold transition-colors ${printType === 'image' ? 'bg-app-accent text-white' : 'bg-app-bg text-app-text-secondary hover:bg-app-hover'}`}>DICOM</button>
            <button type="button" onClick={e => { e.stopPropagation(); setPrintType('pcpndt'); }} className={`px-2 py-1 text-[10px] font-semibold transition-colors ${printType === 'pcpndt' ? 'bg-app-accent text-white' : 'bg-app-bg text-app-text-secondary hover:bg-app-hover'}`}>PCPNDT</button>
          </div>
          <button type="button" onClick={handlePrint} disabled={printing || capturing || printCountRemaining <= 0 || activePrinters.length === 0} className="flex items-center gap-2 px-5 py-1.5 text-xs font-bold bg-app-accent text-white rounded hover:brightness-110 disabled:opacity-50 transition-colors">
            <Printer className="w-4 h-4" />{printing ? 'Printing…' : capturing ? 'Capturing…' : `Print${pagesToShow.length > 1 ? ` (${pagesToShow.length}p)` : ''}`}
          </button>
          <button type="button" onClick={e => { e.stopPropagation(); setShowPrintPreview(false); }} className="p-1 text-app-text-secondary hover:text-app-text"><X className="w-4 h-4" /></button>
        </div>
      </div>
      {showPrinterMgr && (
        <div className="bg-app-surface border-b border-app-border px-4 py-3 flex-shrink-0" onClick={e => e.stopPropagation()}>
          <div className="flex items-start gap-6">
            <div className="flex-1">
              <h4 className="text-xs font-bold text-app-accent mb-2">Configured Printers</h4>
              {configuredPrinters.length === 0 ? (<p className="text-xs text-app-text-muted italic">No printers configured. Add one below.</p>) : (
                <div className="space-y-1 max-h-32 overflow-auto">
                  {configuredPrinters.map(p => (
                    <div key={p.name} className="flex items-center gap-2 text-xs">
                      <span className={`flex-1 ${!p.isActive ? 'opacity-40 line-through' : ''}`}>{p.displayName || p.name} <span className="text-app-text-muted">({p.type})</span></span>
                      {p.isDefault && <span className="text-[9px] bg-app-accent text-white px-1 rounded">Default</span>}
                      <button type="button" onClick={e => { e.stopPropagation(); hospitalConfig.setDefaultPrinter(p.name); }} title="Set as default" className="p-0.5 hover:text-app-accent"><Check className="w-3 h-3" /></button>
                      <button type="button" onClick={e => { e.stopPropagation(); hospitalConfig.togglePrinterActive(p.name); }} title="Toggle active" className="p-0.5 hover:text-yellow-500 text-app-text-muted">{p.isActive ? '●' : '○'}</button>
                      <button type="button" onClick={e => { e.stopPropagation(); hospitalConfig.removePrinter(p.name); if (selectedPrinter === p.name) setSelectedPrinter(''); }} title="Remove" className="p-0.5 hover:text-red-500 text-app-text-muted"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="w-64">
              <h4 className="text-xs font-bold text-app-accent mb-2">Add Printer</h4>
              <div className="space-y-1.5">
                <input type="text" value={newPrinterName} onChange={e => { e.stopPropagation(); setNewPrinterName(e.target.value); }} onClick={e => e.stopPropagation()} placeholder="System printer name (exact)" className="w-full h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded" />
                <input type="text" value={newPrinterDisplay} onChange={e => { e.stopPropagation(); setNewPrinterDisplay(e.target.value); }} onClick={e => e.stopPropagation()} placeholder="Display name (optional)" className="w-full h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded" />
                <div className="flex gap-1">
                  <select value={newPrinterType} onChange={e => { e.stopPropagation(); setNewPrinterType(e.target.value); }} onClick={e => e.stopPropagation()} className="flex-1 h-7 px-1 text-xs border border-app-border bg-app-bg text-app-text rounded">{['Laser', 'Inkjet', 'DICOM Thermal', 'Virtual', 'Other'].map(t => <option key={t} value={t}>{t}</option>)}</select>
                  <button type="button" onClick={handleAddPrinter} disabled={!newPrinterName.trim()} className="h-7 px-3 text-xs font-semibold bg-app-accent text-white rounded hover:opacity-90 disabled:opacity-40 flex items-center gap-1"><Plus className="w-3 h-3" /> Add</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="flex-1 overflow-auto flex flex-col items-center bg-gray-900/50 p-4 gap-4" onClick={e => e.stopPropagation()}>
        {printType === 'pcpndt' ? (
          <div style={{ width: 420 * zoom, minWidth: 420 * zoom }} className="bg-white shadow-2xl p-6">
            <div className="border-2 border-black p-4" style={{ fontSize: 10 * zoom }}>
              <div className="text-center font-bold" style={{ fontSize: 12 * zoom }}>{hospitalConfig.hospitalName}</div>
              <div className="text-center text-gray-500" style={{ fontSize: 9 * zoom }}>{[hospitalConfig.address1, hospitalConfig.city, hospitalConfig.state].filter(Boolean).join(', ')}</div>
              <hr className="my-2 border-black" />
              <div className="text-center font-bold underline" style={{ fontSize: 11 * zoom }}>Form F (PCPNDT)</div>
              <div className="text-center text-gray-500" style={{ fontSize: 8 * zoom }}>Pre-Conception & Pre-Natal Diagnostic Techniques Act, 1994</div>
              <table className="w-full mt-2 border-collapse" style={{ fontSize: 9 * zoom }}>
                <tbody>
                {[['Patient Name', patientName], ['Patient ID', patientId], ['Date', studyDate], ['Referred By', ''], ['Age / LMP', ''], ['Findings', ''], ['Result', '']].map(([l, v]) => (
                  <tr key={l}><td className="border border-black px-1 py-0.5 font-bold w-2/5">{l}</td><td className="border border-black px-1 py-0.5">{v || '—'}</td></tr>
                ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : capturing ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-app-accent text-lg font-bold mb-2">Capturing Pages…</div>
              <div className="text-app-text-muted text-sm">Page {captureProgress} of {totalPages}</div>
              <div className="w-48 h-2 bg-gray-700 rounded-full mt-3 overflow-hidden"><div className="h-full bg-app-accent rounded-full transition-all" style={{ width: `${(captureProgress / totalPages) * 100}%` }} /></div>
            </div>
          </div>
        ) : (
          pagesToShow.map((pageNum) => {
            const pageCaps = allPageCaptures[pageNum - 1] || [];
            return (
              <div key={`preview-page-${pageNum}`} className="flex-shrink-0 flex flex-col items-center mb-4">
                <div className="text-[10px] text-app-text-muted py-1 text-center">Page {pageNum} of {totalPages} — {localPaperSize} {localOrientation}</div>
                <div className="flex flex-col border border-gray-600 shadow-xl" style={{ width: `min(calc(98vw * ${zoom}), calc((100vh - ${toolbarH}px - 50px) * ${zoom} * ${(pw/ph).toFixed(4)}))`, aspectRatio: `${pw} / ${ph}` }}>
                  {settings.headerEnabled && (
                    <div style={{ padding: '4px 12px' }} className="border-b border-gray-700 flex items-center justify-between bg-gray-900 flex-shrink-0">
                      <div>{renderSlotPv(hospitalConfig.headerLayout.left, hospitalConfig.customHeaderLeft)}</div>
                      <div className="text-center">{renderSlotPv(hospitalConfig.headerLayout.center, hospitalConfig.customHeaderCenter)}</div>
                      <div className="text-right">{renderSlotPv(hospitalConfig.headerLayout.right, hospitalConfig.customHeaderRight)}</div>
                    </div>
                  )}
                  {settings.patientInfoEnabled && (
                    <div style={{ padding: '3px 12px', fontSize: '10px' }} className="bg-gray-900 border-b border-gray-700 flex justify-between text-gray-300 font-medium flex-shrink-0">
                      <span>Patient: {patientName}</span><span>ID: {patientId}</span><span>Date: {studyDate}</span><span>Page {pageNum}/{totalPages}</span>
                    </div>
                  )}
                  <div className="flex-1 min-h-0">
                    <div style={previewGridStyle} className="h-full">
                      {Array.from({ length: currentLayout.spots }).map((_, i) => {
                        const src = pageCaps[i];
                        const aStyle: React.CSSProperties = currentLayout.areas && areaNames[i] ? { gridArea: areaNames[i] } : {};
                        return (
                          <div key={i} className="bg-black overflow-hidden" style={aStyle}>
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
