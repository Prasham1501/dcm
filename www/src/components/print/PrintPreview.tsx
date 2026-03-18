import { Printer, X, ZoomIn, ZoomOut, ChevronLeft, Users, Plus, Trash2, Check } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePrintStore } from '@/stores/printStore';
import { useViewerStore } from '@/stores/viewerStore';
import { useHospitalConfigStore, getFormattedAddress, renderPrintSlot } from '@/stores/hospitalConfigStore';
import { captureAllViewports } from '@/lib/viewerTools';

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
  const { currentLayout, patientName, patientId, studyDate, currentPage, totalPages, images, setCurrentPage } = useViewerStore();
  const hospitalConfig = useHospitalConfigStore();

  const [zoom, setZoom]                       = useState(1.0);
  const [currentPageCaptures, setCurrentPageCaptures] = useState<string[]>([]);
  const [printType, setPrintType]             = useState<'image' | 'pcpndt'>('image');
  const [printing, setPrinting]               = useState(false);
  const [capturingAll, setCapturingAll]       = useState(false);
  const [captureProgress, setCaptureProgress] = useState(0);

  const [localPaperSize, setLocalPaperSize]   = useState<PaperSize>(settings.paperSize as PaperSize);
  const [localOrientation, setLocalOrientation] = useState(settings.orientation);
  const [localCopies, setLocalCopies]         = useState(settings.copies);

  // Page selection: 'all' | 'current' | 'custom'
  const [pageMode, setPageMode]               = useState<'all' | 'current' | 'custom'>('all');
  const [customPageInput, setCustomPageInput] = useState('');
  const [allPageCaptures, setAllPageCaptures] = useState<string[][]>([]);

  // Show printer management panel
  const [showPrinterMgr, setShowPrinterMgr]   = useState(false);
  const [newPrinterName, setNewPrinterName]   = useState('');
  const [newPrinterDisplay, setNewPrinterDisplay] = useState('');
  const [newPrinterType, setNewPrinterType]   = useState('Laser');

  const isCR = images.some(img => img.description?.toUpperCase().includes('CR') || (img as any).modality?.toUpperCase() === 'CR');

  // Configured printers only
  const configuredPrinters = hospitalConfig.printers;
  const activePrinters     = configuredPrinters.filter(p => p.isActive);
  const defaultPrinter     = activePrinters.find(p => p.isDefault) || activePrinters[0];
  const [selectedPrinter, setSelectedPrinter] = useState(defaultPrinter?.name || '');

  // Capture current page on mount
  useEffect(() => {
    setCurrentPageCaptures(captureAllViewports());
  }, []);

  // Parse custom page input like "1,2,4-6"
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

  const selectedPages = (): number[] => {
    if (pageMode === 'current') return [currentPage];
    if (pageMode === 'custom') return parsePageList(customPageInput);
    // 'all'
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  };

  // Capture all pages sequentially
  const captureAllPagesFn = useCallback(async (): Promise<string[][]> => {
    const captures: string[][] = [];
    const origPage = currentPage;
    setCapturingAll(true);
    for (let p = 1; p <= totalPages; p++) {
      setCaptureProgress(p);
      setCurrentPage(p);
      await new Promise(r => setTimeout(r, 600)); // wait for viewport render
      captures[p - 1] = captureAllViewports();
    }
    setCurrentPage(origPage);
    setCapturingAll(false);
    return captures;
  }, [currentPage, totalPages, setCurrentPage]);

  // Dimensions
  const dims        = PAPER_DIMS[localPaperSize] || PAPER_DIMS.A4;
  const isLandscape = localOrientation === 'landscape';
  const pw          = isLandscape ? dims.h : dims.w;
  const ph          = isLandscape ? dims.w : dims.h;

  // Grid CSS
  const buildGridCss = () => {
    const l = currentLayout;
    let gridCols = l.gridTemplate?.columns ?? `repeat(${l.cols}, 1fr)`;
    let gridRows = l.gridTemplate?.rows   ?? `repeat(${l.rows}, 1fr)`;
    let gridAreas = l.areas ? `grid-template-areas: ${l.areas};` : '';
    return { gridCols, gridRows, gridAreas };
  };

  const buildHeaderHtml = () => {
    const l = renderPrintSlot(hospitalConfig.headerLayout.left,   hospitalConfig as any, hospitalConfig.customHeaderLeft);
    const c = renderPrintSlot(hospitalConfig.headerLayout.center, hospitalConfig as any, hospitalConfig.customHeaderCenter);
    const r = renderPrintSlot(hospitalConfig.headerLayout.right,  hospitalConfig as any, hospitalConfig.customHeaderRight);
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 15px;border-bottom:1px solid #ccc;font-size:10px"><div>${l}</div><div style="text-align:center">${c}</div><div style="text-align:right">${r}</div></div>`;
  };

  const buildFooterHtml = () => {
    const l = renderPrintSlot(hospitalConfig.footerLayout.left,   hospitalConfig as any, hospitalConfig.customFooterLeft);
    const c = renderPrintSlot(hospitalConfig.footerLayout.center, hospitalConfig as any, hospitalConfig.customFooterCenter);
    const r = renderPrintSlot(hospitalConfig.footerLayout.right,  hospitalConfig as any, hospitalConfig.customFooterRight);
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 15px;border-top:1px solid #ccc;font-size:8px;color:#999"><div>${l}</div><div style="text-align:center">${c}</div><div style="text-align:right">${r}</div></div>`;
  };

  const patientBar = () => settings.patientInfoEnabled
    ? `<div style="padding:4px 15px;background:#f5f5f5;border-bottom:1px solid #ccc;display:flex;justify-content:space-between;font-size:10px"><span><b>Patient:</b> ${patientName}</span><span><b>ID:</b> ${patientId}</span><span><b>Date:</b> ${studyDate}</span></div>`
    : '';

  const buildPageHtml = (pageCaptures: string[], pageIdx: number) => {
    const printImgs = autoFill(pageCaptures, currentLayout.spots, isCR);
    const { gridCols, gridRows, gridAreas } = buildGridCss();
    const areaNames = currentLayout.areas ? getAreaLetters(currentLayout.areas) : [];
    const imgsHtml = Array.from({ length: currentLayout.spots }).map((_, i) => {
      const src = printImgs[i];
      const areaAttr = currentLayout.areas && areaNames[i]
        ? `style="grid-area:${areaNames[i]};background:#000;display:flex;align-items:center;justify-content:center;overflow:hidden;border:${settings.borderEnabled ? '1px solid #ccc' : 'none'}"`
        : `style="background:#000;display:flex;align-items:center;justify-content:center;overflow:hidden;border:${settings.borderEnabled ? '1px solid #ccc' : 'none'}"`;
      return src
        ? `<div ${areaAttr}><img src="${src}" style="max-width:100%;max-height:100%;object-fit:contain" /></div>`
        : `<div ${areaAttr}><span style="color:#666;font-size:10px">${(pageIdx * currentLayout.spots) + i + 1}</span></div>`;
    }).join('');
    return `<div class="page">${settings.headerEnabled ? buildHeaderHtml() : ''}${patientBar()}<div class="grid">${imgsHtml}</div>${settings.footerEnabled ? buildFooterHtml() : ''}</div>`;
  };

  const buildPcpndtHtml = () => {
    const hosp = hospitalConfig.hospitalName || 'Hospital';
    const addr = [hospitalConfig.address1, hospitalConfig.city, hospitalConfig.state, hospitalConfig.pincode].filter(Boolean).join(', ');
    const rows = [
      ['Patient Name', patientName], ['Patient ID', patientId], ['Date of Examination', studyDate],
      ['Referred By', ''], ['Address', ''], ['Age / LMP', ''], ['No. of Children (M/F)', ''],
      ['Indication for Test', ''], ['Findings', ''], ['Result / Impression', ''],
    ];
    const rowsHtml = rows.map(([l, v]) => `<tr><td class="label">${l}</td><td class="val">${v || '&nbsp;'}</td></tr>`).join('');
    return `<!DOCTYPE html><html><head><title>PCPNDT Form F</title><style>
@page{size:A5 portrait;margin:8mm}body{margin:0;font-family:Arial,sans-serif;font-size:10pt}
.box{border:2px solid #000;padding:8px;min-height:170mm}h2{text-align:center;font-size:12pt;margin:3px 0}
h3{text-align:center;font-size:10pt;margin:2px 0}table{width:100%;border-collapse:collapse;margin-top:8px}
td{padding:3px 5px;border:1px solid #000;font-size:9pt}.label{font-weight:bold;width:40%}.val{min-height:16px}
.sig{margin-top:16mm;display:flex;justify-content:space-between}.sigLine{border-top:1px solid #000;width:60mm;margin-top:10mm}
@media print{body{-webkit-print-color-adjust:exact}}
</style></head><body><div class="box">
<h2>${hosp}</h2><h3>${addr}</h3>${hospitalConfig.phone ? `<p style="text-align:center;font-size:9pt;margin:2px 0">Tel: ${hospitalConfig.phone}</p>` : ''}
<hr style="margin:5px 0;border-top:1px solid #000"/>
<h3 style="text-decoration:underline">Form F (PCPNDT)</h3>
<p style="text-align:center;font-size:8pt;margin:2px 0">Pre-Conception &amp; Pre-Natal Diagnostic Techniques Act, 1994</p>
<table>${rowsHtml}</table>
<div class="sig"><div style="text-align:center"><div class="sigLine"></div><div style="font-size:8pt">Signature of Patient / Guardian</div></div>
<div style="text-align:center"><div class="sigLine"></div><div style="font-size:8pt">Signature &amp; Seal of Radiologist</div></div></div>
<p style="font-size:7pt;text-align:center;margin-top:4px">This record shall be maintained for a period of 2 years or such period as may be prescribed.</p>
</div><script>window.onload=function(){setTimeout(function(){window.print()},500)}</script></body></html>`;
  };

  const handlePrint = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (printCountRemaining <= 0) { alert('No prints remaining. Please recharge your print count.'); return; }
    setPrinting(true);
    updateSettings({ paperSize: localPaperSize, orientation: localOrientation, copies: localCopies, defaultPrinter: selectedPrinter });

    const printWin = window.open('', '_blank', 'width=900,height=1100');
    if (!printWin) { setPrinting(false); return; }

    if (printType === 'pcpndt') {
      printWin.document.write(buildPcpndtHtml());
    } else {
      const pages = selectedPages();
      let pageCaptures: string[][];

      if (pages.length === 1 && pages[0] === currentPage) {
        pageCaptures = [currentPageCaptures];
      } else {
        // Need to capture all selected pages
        const allCaptures = allPageCaptures.length === totalPages
          ? allPageCaptures
          : await captureAllPagesFn();
        setAllPageCaptures(allCaptures);
        pageCaptures = pages.map(p => allCaptures[p - 1] || []);
      }

      const pagesHtml = pageCaptures.map((caps, idx) => buildPageHtml(caps, pages[idx] - 1)).join('');
      printWin.document.write(`<!DOCTYPE html><html><head><title>DICOM Print</title>
<style>
@page{size:${localPaperSize} ${isLandscape ? 'landscape' : 'portrait'};margin:10mm}
body{margin:0;font-family:Arial,sans-serif}
.page{page-break-after:always;page-break-inside:avoid}
.page:last-child{page-break-after:auto}
.grid{display:grid;grid-template-columns:${buildGridCss().gridCols};grid-template-rows:${buildGridCss().gridRows};${buildGridCss().gridAreas}gap:2px;padding:10px 15px;height:calc(100vh - 120px)}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>${pagesHtml}<script>window.onload=function(){setTimeout(function(){window.print()},600)}</script></body></html>`);
    }

    printWin.document.close();
    addPrintJob({ patientName, studyDate, layout: `${currentLayout.spots} Spots`, copies: localCopies, paperSize: localPaperSize });
    for (let i = 0; i < localCopies; i++) decrementPrintCount();
    setPrinting(false);
    setShowPrintPreview(false);
  };

  // Preview grid style
  const previewGridStyle: React.CSSProperties = {
    display: 'grid', gap: '2px', width: '100%', height: `${(ph - 130) * zoom}px`,
    ...(currentLayout.areas ? {
      gridTemplateAreas: currentLayout.areas,
      gridTemplateColumns: currentLayout.gridTemplate?.columns ?? `repeat(${currentLayout.cols}, 1fr)`,
      gridTemplateRows:    currentLayout.gridTemplate?.rows   ?? `repeat(${currentLayout.rows}, 1fr)`,
    } : {
      gridTemplateColumns: `repeat(${currentLayout.cols}, 1fr)`,
      gridTemplateRows:    `repeat(${currentLayout.rows}, 1fr)`,
    }),
  };
  const areaNames = currentLayout.areas ? getAreaLetters(currentLayout.areas) : [];
  const displayImages = autoFill(currentPageCaptures, currentLayout.spots, isCR);
  const hasRealImages = displayImages.some(i => i && i !== '');

  const renderSlotPv = (slot: string, customText: string) => {
    switch (slot) {
      case 'logo': return hospitalConfig.logoDataUrl ? <img src={hospitalConfig.logoDataUrl} style={{ maxHeight: 30 * zoom, maxWidth: 80 * zoom, objectFit: 'contain' }} alt="Logo" /> : <span style={{ fontSize: 8 * zoom }} className="text-gray-400">[No Logo]</span>;
      case 'name': return <span style={{ fontSize: 9 * zoom, fontWeight: 600 }} className="text-gray-700">{hospitalConfig.hospitalName}</span>;
      case 'address': return <span style={{ fontSize: 7 * zoom }} className="text-gray-500">{getFormattedAddress(hospitalConfig as any)}{hospitalConfig.phone && ` | ${hospitalConfig.phone}`}</span>;
      case 'custom': return <span style={{ fontSize: 8 * zoom }} className="text-gray-500">{customText}</span>;
      default: return null;
    }
  };

  // Add printer
  const handleAddPrinter = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!newPrinterName.trim()) return;
    hospitalConfig.addPrinter({
      name: newPrinterName.trim(),
      displayName: newPrinterDisplay.trim() || newPrinterName.trim(),
      type: newPrinterType,
      isDefault: configuredPrinters.length === 0,
      isActive: true,
    });
    setNewPrinterName(''); setNewPrinterDisplay(''); setNewPrinterType('Laser');
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex flex-col z-50" onClick={e => e.stopPropagation()}>
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-app-header-bg border-b border-app-border flex-shrink-0 flex-wrap gap-2">
        {/* Left */}
        <div className="flex items-center gap-2">
          <button type="button" onClick={e => { e.stopPropagation(); setShowPrintPreview(false); navigate('/'); }} className="px-2 py-1 text-xs border border-app-border text-app-text-secondary bg-app-bg rounded hover:bg-app-hover flex items-center gap-1"><Users className="w-3 h-3" /> Patients</button>
          <button type="button" onClick={e => { e.stopPropagation(); setShowPrintPreview(false); }} className="px-2 py-1 text-xs border border-app-border text-app-text-secondary bg-app-bg rounded hover:bg-app-hover flex items-center gap-1"><ChevronLeft className="w-3 h-3" /> Viewer</button>
          <span className="text-xs text-app-text-muted">|</span>
          <Printer className="w-4 h-4 text-app-accent" />
          <span className="text-sm font-bold text-app-text">Print Preview</span>
          {capturingAll && <span className="text-[10px] text-yellow-500 animate-pulse">Capturing page {captureProgress}/{totalPages}…</span>}
          {!isCR && currentPageCaptures.some(i => !i || i === '') && <span className="text-[10px] text-green-500 bg-green-500/10 px-2 py-0.5 rounded">Auto-filled</span>}
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Print count */}
          <span className="text-xs text-app-text-secondary whitespace-nowrap">Prints: <span className={`font-bold ${printCountRemaining < 50 ? 'text-red-500' : 'text-green-600'}`}>{printCountRemaining}</span></span>

          {/* Zoom */}
          <button type="button" onClick={e => { e.stopPropagation(); setZoom(z => Math.max(0.3, z - 0.1)); }} className="p-1 text-app-text-secondary hover:bg-app-hover rounded"><ZoomOut className="w-4 h-4" /></button>
          <span className="text-xs text-app-text w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={e => { e.stopPropagation(); setZoom(z => Math.min(2.0, z + 0.1)); }} className="p-1 text-app-text-secondary hover:bg-app-hover rounded"><ZoomIn className="w-4 h-4" /></button>

          <div className="w-px h-5 bg-app-border" />

          {/* Paper size */}
          <select value={localPaperSize} onChange={e => { e.stopPropagation(); setLocalPaperSize(e.target.value as PaperSize); }} onClick={e => e.stopPropagation()} className="h-7 px-1 text-xs border border-app-border bg-app-bg text-app-text rounded">
            {PAPER_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          {/* Orientation */}
          <div className="flex rounded overflow-hidden border border-app-border">
            {(['portrait', 'landscape'] as const).map(o => (
              <button key={o} type="button" onClick={e => { e.stopPropagation(); setLocalOrientation(o); }} className={`px-2 py-1 text-[10px] font-bold transition-colors ${localOrientation === o ? 'bg-app-accent text-white' : 'bg-app-bg text-app-text-secondary hover:bg-app-hover'}`}>{o === 'portrait' ? 'P' : 'L'}</button>
            ))}
          </div>

          {/* Copies */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-app-text-muted">Copies:</span>
            <input type="number" min={1} max={10} value={localCopies} onChange={e => { e.stopPropagation(); setLocalCopies(Math.max(1, Math.min(10, Number(e.target.value)))); }} onClick={e => e.stopPropagation()} className="w-10 h-7 px-1 text-xs border border-app-border bg-app-bg text-app-text rounded text-center" />
          </div>

          {/* Page selection */}
          <div className="flex items-center gap-1 border border-app-border rounded overflow-hidden">
            {(['all', 'current', 'custom'] as const).map(m => (
              <button key={m} type="button" onClick={e => { e.stopPropagation(); setPageMode(m); }} className={`px-2 py-1 text-[10px] font-semibold whitespace-nowrap transition-colors ${pageMode === m ? 'bg-app-accent text-white' : 'bg-app-bg text-app-text-secondary hover:bg-app-hover'}`}>
                {m === 'all' ? `All (${totalPages})` : m === 'current' ? `Page ${currentPage}` : 'Custom'}
              </button>
            ))}
          </div>
          {pageMode === 'custom' && (
            <input type="text" value={customPageInput} onChange={e => { e.stopPropagation(); setCustomPageInput(e.target.value); }} onClick={e => e.stopPropagation()} placeholder="e.g. 1,3-5" className="w-24 h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded" />
          )}

          {/* Printer */}
          <div className="flex items-center gap-1">
            {activePrinters.length > 0 ? (
              <select value={selectedPrinter} onChange={e => { e.stopPropagation(); setSelectedPrinter(e.target.value); }} onClick={e => e.stopPropagation()} className="h-7 px-1 text-xs border border-app-border bg-app-bg text-app-text rounded max-w-[130px]">
                {activePrinters.map(p => <option key={p.name} value={p.name}>{p.displayName || p.name}</option>)}
              </select>
            ) : <span className="text-[10px] text-app-text-muted italic">Default printer</span>}
            <button type="button" onClick={e => { e.stopPropagation(); setShowPrinterMgr(v => !v); }} className={`h-7 px-2 text-[10px] border rounded transition-colors ${showPrinterMgr ? 'border-app-accent bg-app-accent/10 text-app-accent' : 'border-app-border text-app-text-secondary hover:bg-app-hover'}`} title="Manage printers">⚙</button>
          </div>

          {/* DICOM / PCPNDT toggle */}
          <div className="flex rounded overflow-hidden border border-app-border">
            <button type="button" onClick={e => { e.stopPropagation(); setPrintType('image'); }} className={`px-2 py-1 text-[10px] font-semibold transition-colors ${printType === 'image' ? 'bg-app-accent text-white' : 'bg-app-bg text-app-text-secondary hover:bg-app-hover'}`}>DICOM</button>
            <button type="button" onClick={e => { e.stopPropagation(); setPrintType('pcpndt'); }} className={`px-2 py-1 text-[10px] font-semibold transition-colors ${printType === 'pcpndt' ? 'bg-app-accent text-white' : 'bg-app-bg text-app-text-secondary hover:bg-app-hover'}`}>PCPNDT</button>
          </div>

          {/* Print button */}
          <button type="button" onClick={handlePrint} disabled={printing || capturingAll || printCountRemaining <= 0} className="px-4 py-1.5 text-xs font-semibold border-2 border-app-accent text-white bg-app-accent rounded hover:opacity-90 transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed">
            <Printer className="w-3 h-3" />
            {printing ? 'Printing…' : capturingAll ? 'Capturing…' : `Print${pageMode !== 'current' && totalPages > 1 ? ` (${selectedPages().length}p)` : ''}`}
          </button>

          <button type="button" onClick={e => { e.stopPropagation(); setShowPrintPreview(false); }} className="p-1 text-app-text-secondary hover:text-app-text"><X className="w-4 h-4" /></button>
        </div>
      </div>

      {/* ── Printer management panel ── */}
      {showPrinterMgr && (
        <div className="bg-app-surface border-b border-app-border px-4 py-3 flex-shrink-0" onClick={e => e.stopPropagation()}>
          <div className="flex items-start gap-6">
            {/* Existing printers */}
            <div className="flex-1">
              <h4 className="text-xs font-bold text-app-accent mb-2">Configured Printers</h4>
              {configuredPrinters.length === 0 ? (
                <p className="text-xs text-app-text-muted italic">No printers configured. Add one below.</p>
              ) : (
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
            {/* Add printer */}
            <div className="w-64">
              <h4 className="text-xs font-bold text-app-accent mb-2">Add Printer</h4>
              <div className="space-y-1.5">
                <input type="text" value={newPrinterName} onChange={e => { e.stopPropagation(); setNewPrinterName(e.target.value); }} onClick={e => e.stopPropagation()} placeholder="System printer name (exact)" className="w-full h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded" />
                <input type="text" value={newPrinterDisplay} onChange={e => { e.stopPropagation(); setNewPrinterDisplay(e.target.value); }} onClick={e => e.stopPropagation()} placeholder="Display name (optional)" className="w-full h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded" />
                <div className="flex gap-1">
                  <select value={newPrinterType} onChange={e => { e.stopPropagation(); setNewPrinterType(e.target.value); }} onClick={e => e.stopPropagation()} className="flex-1 h-7 px-1 text-xs border border-app-border bg-app-bg text-app-text rounded">
                    {['Laser', 'Inkjet', 'DICOM Thermal', 'Virtual', 'Other'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <button type="button" onClick={handleAddPrinter} disabled={!newPrinterName.trim()} className="h-7 px-3 text-xs font-semibold bg-app-accent text-white rounded hover:opacity-90 disabled:opacity-40 flex items-center gap-1"><Plus className="w-3 h-3" /> Add</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Preview area ── */}
      <div className="flex-1 overflow-auto flex items-start justify-center p-8 bg-gray-600" onClick={e => e.stopPropagation()}>
        {printType === 'pcpndt' ? (
          /* PCPNDT preview */
          <div style={{ width: 420 * zoom, minWidth: 420 * zoom }} className="bg-white shadow-2xl p-6">
            <div className="border-2 border-black p-4" style={{ fontSize: 10 * zoom }}>
              <div className="text-center font-bold" style={{ fontSize: 12 * zoom }}>{hospitalConfig.hospitalName}</div>
              <div className="text-center text-gray-500" style={{ fontSize: 9 * zoom }}>{[hospitalConfig.address1, hospitalConfig.city, hospitalConfig.state].filter(Boolean).join(', ')}</div>
              <hr className="my-2 border-black" />
              <div className="text-center font-bold underline" style={{ fontSize: 11 * zoom }}>Form F (PCPNDT)</div>
              <div className="text-center text-gray-500" style={{ fontSize: 8 * zoom }}>Pre-Conception & Pre-Natal Diagnostic Techniques Act, 1994</div>
              <table className="w-full mt-2 border-collapse" style={{ fontSize: 9 * zoom }}>
                {[['Patient Name', patientName], ['Patient ID', patientId], ['Date', studyDate], ['Referred By', ''], ['Age / LMP', ''], ['Findings', ''], ['Result', '']].map(([l, v]) => (
                  <tr key={l}><td className="border border-black px-1 py-0.5 font-bold w-2/5">{l}</td><td className="border border-black px-1 py-0.5">{v || '—'}</td></tr>
                ))}
              </table>
            </div>
          </div>
        ) : (
          /* DICOM image preview (current page) */
          <div style={{ width: pw * zoom, minWidth: pw * zoom, minHeight: ph * zoom }} className="bg-white shadow-2xl relative">
            {settings.headerEnabled && (
              <div style={{ padding: `${8 * zoom}px ${15 * zoom}px` }} className="border-b border-gray-300 flex items-center justify-between">
                <div>{renderSlotPv(hospitalConfig.headerLayout.left, hospitalConfig.customHeaderLeft)}</div>
                <div className="text-center">{renderSlotPv(hospitalConfig.headerLayout.center, hospitalConfig.customHeaderCenter)}</div>
                <div className="text-right">{renderSlotPv(hospitalConfig.headerLayout.right, hospitalConfig.customHeaderRight)}</div>
              </div>
            )}
            {settings.patientInfoEnabled && (
              <div style={{ padding: `${5 * zoom}px ${15 * zoom}px`, fontSize: 8 * zoom }} className="bg-gray-100 border-b border-gray-300 flex justify-between text-gray-700">
                <span><strong>Patient:</strong> {patientName}</span>
                {patientId && <span><strong>ID:</strong> {patientId}</span>}
                <span><strong>Date:</strong> {studyDate}</span>
                <span><strong>Layout:</strong> {currentLayout.spots} Spots</span>
                <span className="text-gray-400 text-[8px]">Showing page {currentPage}/{totalPages}</span>
              </div>
            )}
            <div style={{ padding: `${12 * zoom}px ${15 * zoom}px` }}>
              <div style={previewGridStyle}>
                {Array.from({ length: currentLayout.spots }).map((_, i) => {
                  const aStyle: React.CSSProperties = currentLayout.areas && areaNames[i] ? { gridArea: areaNames[i] } : {};
                  return (
                    <div key={i} className="bg-black rounded-sm flex items-center justify-center overflow-hidden" style={{ ...aStyle, border: settings.borderEnabled ? '1px solid #ccc' : 'none' }}>
                      {hasRealImages && displayImages[i]
                        ? <img src={displayImages[i]} className="w-full h-full object-contain" alt={`Image ${i + 1}`} />
                        : <div className="w-full h-full relative bg-gradient-to-b from-gray-900 to-black flex items-center justify-center">
                            <span style={{ fontSize: 7 * zoom }} className="text-gray-600">{i + 1}</span>
                          </div>
                      }
                    </div>
                  );
                })}
              </div>
            </div>
            {settings.footerEnabled && (
              <div style={{ padding: `${5 * zoom}px ${15 * zoom}px`, fontSize: 7 * zoom }} className="absolute bottom-0 left-0 right-0 border-t border-gray-300 flex justify-between items-center bg-white">
                <div>{renderSlotPv(hospitalConfig.footerLayout.left, hospitalConfig.customFooterLeft)}</div>
                <div className="text-center">{renderSlotPv(hospitalConfig.footerLayout.center, hospitalConfig.customFooterCenter)}</div>
                <div className="text-right">{renderSlotPv(hospitalConfig.footerLayout.right, hospitalConfig.customFooterRight)}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
