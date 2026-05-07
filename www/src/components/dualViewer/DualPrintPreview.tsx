import { useState, useEffect, useCallback } from 'react';
import { Printer, X, ZoomIn, ZoomOut, Plus, Trash2, Check } from 'lucide-react';
import { useDualViewerStore } from '@/stores/dualViewerStore';
import { usePrintStore } from '@/stores/printStore';
import { useHospitalConfigStore, getFormattedAddress, renderPrintSlot, buildBrandHeaderHtml } from '@/stores/hospitalConfigStore';
import { usePatientStore } from '@/stores/patientStore';
import { captureCornerstoneElementForPrintAsync, PrintOverlay } from '@/lib/printCapture';
import { fillEmptyPrintSlots } from '@/lib/printPageUtils';


async function captureViewport(panelId: string, viewportIndex: number): Promise<string | null> {
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

  return captureCornerstoneElementForPrintAsync(el, overlays);
}

async function capturePanelPage(panelId: string, spots: number, totalImages: number, currentPage: number): Promise<Array<string | null>> {
  const caps: (string | null)[] = [];
  const startIndex = (currentPage - 1) * spots;
  // Sequential — each call temporarily resizes the live canvas, parallel
  // would race.
  for (let i = 0; i < spots; i++) {
    if (startIndex + i < totalImages) {
      caps.push(await captureViewport(panelId, i));
    } else {
      caps.push(null);
    }
  }
  return caps;
}

function waitForDualViewportImages(panelId: string, spots: number): Promise<void> {
  return new Promise((resolve) => {
    let attempts = 0;
    const check = () => {
      let allReady = true;
      for (let i = 0; i < spots; i++) {
        const sel = `[data-dual-viewport-index="${panelId}-${i}"]`;
        const el = document.querySelector(sel);
        if (el) {
          const canvas = el.querySelector('canvas');
          if (!canvas) { allReady = false; break; }
        }
      }
      if (allReady || attempts > 20) {
        resolve();
      } else {
        attempts++;
        requestAnimationFrame(check);
      }
    };
    check();
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
const MM_TO_PX = 3.7795275591;

interface DualPrintPreviewProps { onClose: () => void; }

export function DualPrintPreview({ onClose }: DualPrintPreviewProps) {
  const { settings, updateSettings, addPrintJob, decrementPrintCount, printCountRemaining } = usePrintStore();
  const { panels, setPanelPage, dualFooterEnabled, dualFooterLayout, dualFooterFontSize, dualFooterFontColor, dualFooterBgColor, dualFooterBorderTopColor, dualFooterCustomLeft, dualFooterCustomCenter, dualFooterCustomRight } = useDualViewerStore();
  const hospitalConfig = useHospitalConfigStore();

  const leftPanel = panels.left;
  const rightPanel = panels.right;
  const totalDualPages = Math.max(leftPanel.totalPages, rightPanel.totalPages);
  const totalDualImages = leftPanel.totalImages + rightPanel.totalImages;
  const currentPage = Math.max(leftPanel.currentPage, rightPanel.currentPage);

  const [zoom, setZoom] = useState(1.0);
  const [printing, setPrinting] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [captureProgress, setCaptureProgress] = useState(0);
  const [captureTotal, setCaptureTotal] = useState(0);

  const [localPaperSize, setLocalPaperSize] = useState<PaperSize>(settings.paperSize as PaperSize);
  const [localOrientation, setLocalOrientation] = useState<'portrait' | 'landscape'>('landscape');
  const [localCopies, setLocalCopies] = useState(settings.copies);

  const [pageMode, setPageMode] = useState<'all' | 'current' | 'custom'>('all');
  const [customPageInput, setCustomPageInput] = useState('');
  const [allLeftCaptures, setAllLeftCaptures] = useState<string[][]>([]);
  const [allRightCaptures, setAllRightCaptures] = useState<string[][]>([]);

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
        for (let i = from; i <= to; i++) if (i >= 1 && i <= totalDualPages) pages.add(i);
      } else {
        const n = parseInt(trimmed);
        if (!isNaN(n) && n >= 1 && n <= totalDualPages) pages.add(n);
      }
    });
    return [...pages].sort((a, b) => a - b);
  }, [totalDualPages]);

  const selectedPages = useCallback((): number[] => {
    if (pageMode === 'current') return [currentPage];
    if (pageMode === 'custom') return parsePageList(customPageInput);
    return Array.from({ length: totalDualPages }, (_, i) => i + 1);
  }, [pageMode, currentPage, customPageInput, parsePageList, totalDualPages]);

  // Capture all pages on mount
  useEffect(() => {
    let cancelled = false;

    const captureAllPages = async () => {
      setCapturing(true);
      const store = useDualViewerStore.getState();
      const origLeftPage = store.panels.left.currentPage;
      const origRightPage = store.panels.right.currentPage;
      const pagesToCapture = Array.from({ length: totalDualPages }, (_, i) => i + 1);
      setCaptureTotal(pagesToCapture.length);

      const rawLeftCaptures: Array<Array<string | null>> = [];
      const rawRightCaptures: Array<Array<string | null>> = [];

      for (let idx = 0; idx < pagesToCapture.length; idx++) {
        if (cancelled) return;
        const p = pagesToCapture[idx];
        setCaptureProgress(idx + 1);

        // Set both panels to the target page (clamped internally)
        if (p <= leftPanel.totalPages) setPanelPage('left', p);
        if (p <= rightPanel.totalPages) setPanelPage('right', p);

        // Wait for viewports to render
        await waitForDualViewportImages('left', leftPanel.currentLayout.spots);
        await waitForDualViewportImages('right', rightPanel.currentLayout.spots);
        if (cancelled) return;
        await new Promise(r => setTimeout(r, 75));

        // Capture
        if (p <= leftPanel.totalPages) {
          rawLeftCaptures.push(await capturePanelPage('left', leftPanel.currentLayout.spots, leftPanel.totalImages, p));
        } else {
          rawLeftCaptures.push(Array(leftPanel.currentLayout.spots).fill(null));
        }

        if (p <= rightPanel.totalPages) {
          rawRightCaptures.push(await capturePanelPage('right', rightPanel.currentLayout.spots, rightPanel.totalImages, p));
        } else {
          rawRightCaptures.push(Array(rightPanel.currentLayout.spots).fill(null));
        }
      }

      // Restore original pages
      setPanelPage('left', origLeftPage);
      setPanelPage('right', origRightPage);
      await waitForDualViewportImages('left', leftPanel.currentLayout.spots);
      await waitForDualViewportImages('right', rightPanel.currentLayout.spots);
      await new Promise(r => setTimeout(r, 75));

      if (!cancelled) {
        setAllLeftCaptures(fillEmptyPrintSlots(rawLeftCaptures, leftPanel.currentLayout.spots));
        setAllRightCaptures(fillEmptyPrintSlots(rawRightCaptures, rightPanel.currentLayout.spots));
        setCapturing(false);
      }
    };

    void captureAllPages();
    return () => { cancelled = true; };
  }, []);

  const dims = PAPER_DIMS[localPaperSize] || PAPER_DIMS.A4;
  const isLandscape = localOrientation === 'landscape';
  const paperMmDims = PAPER_DIMS_MM[localPaperSize] || PAPER_DIMS_MM.A4;
  const sheetW_mm = isLandscape ? paperMmDims.h : paperMmDims.w;
  const sheetH_mm = isLandscape ? paperMmDims.w : paperMmDims.h;
  const previewMarginMm = hospitalConfig.printBlackBg ? 0 : PAGE_MARGIN_MM;
  const pw = (sheetW_mm - previewMarginMm * 2) * MM_TO_PX;
  const ph = (sheetH_mm - previewMarginMm * 2) * MM_TO_PX;

  const [viewportSize, setViewportSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const handler = () => setViewportSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const services = (hospitalConfig.servicesList || '').split('|').filter(Boolean);

  const renderSlotPv = (slot: string, customText: string) => {
    const fs = Math.max((dualFooterFontSize || 8) * 1.4, 11);
    const fc = dualFooterFontColor || '#666';
    switch (slot) {
      case 'logo': return hospitalConfig.logoDataUrl
        ? <img src={hospitalConfig.logoDataUrl} style={{ maxHeight: 30 * zoom, maxWidth: 80 * zoom, objectFit: 'contain' }} alt="Logo" />
        : <span style={{ fontSize: fs, color: fc, opacity: 0.6 }}>[No Logo]</span>;
      case 'name': return <span style={{ fontSize: fs, fontWeight: 600, color: fc }}>{hospitalConfig.hospitalName}</span>;
      case 'address': return <span style={{ fontSize: fs, color: fc }}>{getFormattedAddress(hospitalConfig as any)}{hospitalConfig.phone && ` | ${hospitalConfig.phone}`}</span>;
      case 'custom': return <span style={{ fontSize: fs, color: fc }}>{customText}</span>;
      default: return null;
    }
  };

  const renderBrandHeaderPv = () => {
    const logoPos = hospitalConfig.headerLogoPosition || 'left';
    const logoRadius = hospitalConfig.headerLogoShape === 'square' ? '6px' : '50%';
    const logoSz = (hospitalConfig.headerLogoSize || 60) * zoom * 0.6;
    const nameAlign = hospitalConfig.headerNameAlign || 'left';
    const svcAlign = hospitalConfig.headerServicesAlign || 'left';
    const addrAlign = hospitalConfig.headerAddressAlign || 'left';
    const contactAlign = hospitalConfig.headerContactAlign || 'left';
    const alignFlex = (a: string) => a === 'left' ? 'flex-start' : a === 'right' ? 'flex-end' : 'center';
    return (
    <div style={{ display: 'flex', alignItems: 'center', padding: `${3 * zoom}px ${8 * zoom}px`, gap: 6 * zoom, borderBottom: `2px solid ${hospitalConfig.headerBorderBottomColor || '#2563eb'}`, background: hospitalConfig.headerBgColor || '#fff', flexDirection: logoPos === 'right' ? 'row-reverse' : 'row' }} className="flex-shrink-0">
      {hospitalConfig.headerShowLogo !== false && (
      <div style={{ flex: '0 0 auto', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        {hospitalConfig.logoDataUrl ? (
          <img src={hospitalConfig.logoDataUrl} style={{ width: logoSz, height: logoSz, borderRadius: logoRadius, objectFit: 'cover' }} alt="Logo" />
        ) : (
          <span style={{ fontSize: 6 * zoom }} className="text-gray-400">[Logo]</span>
        )}
      </div>
      )}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', lineHeight: 1.3 }}>
        {hospitalConfig.headerShowName !== false && (
        <div style={{ marginBottom: 1 * zoom, textAlign: nameAlign as any }}>
          <span style={{ fontSize: hospitalConfig.headerNameFontSize * zoom * 0.7, fontWeight: 800, color: hospitalConfig.headerNameColor || '#1e3a5f' }}>{hospitalConfig.hospitalName}</span>
          {hospitalConfig.brandNameSecondary && <span style={{ fontSize: hospitalConfig.headerNameFontSize * zoom * 0.7, fontWeight: 400, color: hospitalConfig.headerSecondaryNameColor || '#2563eb', marginLeft: 3 * zoom }}>{hospitalConfig.brandNameSecondary}</span>}
        </div>
        )}
        {hospitalConfig.headerShowServices !== false && services.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: alignFlex(svcAlign), gap: 2 * zoom, fontSize: hospitalConfig.headerServicesFontSize * zoom * 0.7, fontWeight: 600, color: hospitalConfig.headerServicesColor || '#1a1a1a', flexWrap: 'wrap', marginBottom: 1 * zoom }}>
            {services.map((s, i) => (
              <span key={i}>{i > 0 && <span style={{ margin: `0 ${2 * zoom}px`, color: '#999' }}>|</span>}{s.trim()}</span>
            ))}
          </div>
        )}
        {hospitalConfig.headerShowAddress !== false && (
        <div style={{ fontSize: hospitalConfig.headerAddressFontSize * zoom * 0.7, color: hospitalConfig.headerAddressColor || '#2563eb', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: addrAlign as any }}>{getFormattedAddress(hospitalConfig as any).toUpperCase()}</div>
        )}
        {hospitalConfig.headerShowContact !== false && (hospitalConfig.phone || hospitalConfig.email || hospitalConfig.website) && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: alignFlex(contactAlign), gap: 6 * zoom, fontSize: hospitalConfig.headerContactFontSize * zoom * 0.7, color: hospitalConfig.headerContactColor || '#333', flexWrap: 'wrap', marginTop: 1 * zoom }}>
            {hospitalConfig.phone && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 * zoom }}><span style={{ color: '#16a34a' }}>☎</span>{hospitalConfig.phone}</span>}
            {hospitalConfig.email && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 * zoom }}><span style={{ color: '#ca8a04' }}>✉</span>{hospitalConfig.email}</span>}
            {hospitalConfig.website && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 * zoom }}><span style={{ color: '#2563eb' }}>🌐</span>{hospitalConfig.website}</span>}
          </div>
        )}
      </div>
    </div>
  );};

  const buildPrintHtml = useCallback((pagesToPrint: number[]) => {
    const leftGridCols = `repeat(${leftPanel.currentLayout.cols}, 1fr)`;
    const leftGridRows = `repeat(${leftPanel.currentLayout.rows}, 1fr)`;
    const rightGridCols = `repeat(${rightPanel.currentLayout.cols}, 1fr)`;
    const rightGridRows = `repeat(${rightPanel.currentLayout.rows}, 1fr)`;
    const borderCol = hospitalConfig.printBorderEnabled ? (hospitalConfig.printBorderColor || '#333') : 'transparent';
    const blackBg = hospitalConfig.printBlackBg;
    const pageBg = blackBg ? '#000' : '#fff';

    const buildHeaderHtml = () => buildBrandHeaderHtml(hospitalConfig as any);
    const buildPrintFooterHtml = () => {
      const l = renderPrintSlot(dualFooterLayout.left as any, hospitalConfig as any, dualFooterCustomLeft, true);
      const c = renderPrintSlot(dualFooterLayout.center as any, hospitalConfig as any, dualFooterCustomCenter, true);
      const r = renderPrintSlot(dualFooterLayout.right as any, hospitalConfig as any, dualFooterCustomRight, true);
      const bgCol = dualFooterBgColor || '#ffffff';
      const borderCol = dualFooterBorderTopColor || '#cccccc';
      const fontSize = Math.max((dualFooterFontSize || 8) * 1.4, 11);
      const fontColor = dualFooterFontColor || '#666666';
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 15px;border-top:1px solid ${borderCol};background:${bgCol};font-size:${fontSize}px;color:${fontColor}"><div>${l}</div><div style="text-align:center">${c}</div><div style="text-align:right">${r}</div></div>`;
    };

    const headerBorderCol = hospitalConfig.headerBorderBottomColor || '#2563eb';
    const wrapperBorder = hospitalConfig.printBorderEnabled ? `1px solid ${borderCol}` : 'none';
    const cellShadow = hospitalConfig.printBorderEnabled ? `box-shadow:inset 0 0 0 1px ${borderCol};` : '';

    const buildPanelMetadataHtml = (panel: typeof leftPanel, pageNum: number) => {
      if (!settings.patientInfoEnabled) return '';
      const matched = usePatientStore.getState().patients.find(p => p.patientId === panel.patientId && p.patientName === panel.patientName);
      const left: string[] = [];
      if (hospitalConfig.metadataPrintPatientName !== false) left.push(`<span style="white-space:nowrap"><b>Patient:</b> ${panel.patientName}</span>`);
      if (hospitalConfig.metadataPrintAge && matched?.age) left.push(`<span style="white-space:nowrap"><b>Age:</b> ${matched.age}</span>`);
      if (hospitalConfig.metadataPrintSex && matched?.sex) left.push(`<span style="white-space:nowrap"><b>Sex:</b> ${matched.sex}</span>`);
      if (hospitalConfig.metadataPrintPatientId) left.push(`<span style="white-space:nowrap"><b>ID:</b> ${panel.patientId}</span>`);
      if (hospitalConfig.metadataPrintModality && matched?.modality) left.push(`<span style="white-space:nowrap"><b>Mod:</b> ${matched.modality}</span>`);
      if (hospitalConfig.metadataPrintStudyName && matched?.studyDescription) left.push(`<span style="white-space:nowrap"><b>Study:</b> ${matched.studyDescription}</span>`);
      if (hospitalConfig.metadataPrintAccessNo && matched?.accessionNumber) left.push(`<span style="white-space:nowrap"><b>Acc#:</b> ${matched.accessionNumber}</span>`);
      if (hospitalConfig.metadataPrintRefBy && matched?.referringPhysician) left.push(`<span style="white-space:nowrap"><b>Ref:</b> ${matched.referringPhysician}</span>`);
      const right = [
        `<span style="white-space:nowrap"><b>Date:</b> ${panel.studyDate}</span>`,
        `<span style="white-space:nowrap"><b>Page</b> ${pageNum}/${totalDualPages}</span>`,
      ];
      return `<div style="padding:4px 6px;background:#111827;color:#d1d5db;border-bottom:1px solid ${headerBorderCol};display:flex;align-items:center;justify-content:space-between;gap:6px;font-size:9px;flex-shrink:0;overflow:hidden"><div style="display:flex;align-items:center;gap:6px;flex:1 1 auto;min-width:0;overflow:hidden">${left.join('')}</div><div style="display:flex;align-items:center;gap:6px;flex:0 0 auto">${right.join('')}</div></div>`;
    };

    const buildPanelGridHtml = (captures: string[], gridCols: string, gridRows: string, panel: typeof leftPanel, pageNum: number) => {
      const imgsHtml = captures.map(src => {
        const inner = src ? `<img src="${src}" style="width:100%;height:100%;object-fit:contain" />` : '';
        return `<div style="background:#000;display:flex;align-items:center;justify-content:center;overflow:hidden;min-height:0;padding:3px;${cellShadow}">${inner}</div>`;
      }).join('');
      return `<div style="flex:1;display:flex;flex-direction:column;min-height:0;overflow:hidden;border-right:1px dashed #555">` +
        `${settings.headerEnabled ? buildHeaderHtml() : ''}` +
        `<div style="border:${wrapperBorder};display:flex;flex-direction:column;flex:1;min-height:0;overflow:hidden">` +
          `${buildPanelMetadataHtml(panel, pageNum)}` +
          `<div style="flex:1;display:grid;grid-template-columns:${gridCols};grid-template-rows:${gridRows};gap:2px;min-height:0;overflow:hidden;padding:2px">${imgsHtml}</div>` +
        `</div>` +
        `${dualFooterEnabled ? buildPrintFooterHtml() : ''}` +
        `</div>`;
    };

    const pagesHtml = pagesToPrint.map((pageNum) => {
      const leftCaps = allLeftCaptures[pageNum - 1] || [];
      const rightCaps = allRightCaptures[pageNum - 1] || [];
      return `<div class="page" style="background:${pageBg}"><div style="flex:1;display:flex;gap:0;min-height:0;overflow:hidden">${buildPanelGridHtml(leftCaps, leftGridCols, leftGridRows, leftPanel, pageNum)}${buildPanelGridHtml(rightCaps, rightGridCols, rightGridRows, rightPanel, pageNum)}</div></div>`;
    }).join('');

    const paperMm = PAPER_DIMS_MM[localPaperSize] || PAPER_DIMS_MM.A4;
    const sheetW = isLandscape ? paperMm.h : paperMm.w;
    const sheetH = isLandscape ? paperMm.w : paperMm.h;
    const marginMm = blackBg ? 0 : PAGE_MARGIN_MM;
    const pageW = sheetW - marginMm * 2;
    const pageH = sheetH - marginMm * 2;

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>DICOM Print - ${leftPanel.patientName} vs ${rightPanel.patientName}</title><style>@page{size:${localPaperSize} ${isLandscape ? 'landscape' : 'portrait'};margin:${marginMm}mm}*{box-sizing:border-box}html,body{margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background:${pageBg};width:${pageW}mm}.page{page-break-after:always;page-break-inside:avoid;display:flex;flex-direction:column;width:${pageW}mm;height:${pageH}mm;overflow:hidden}.page:last-child{page-break-after:auto}img{display:block;image-rendering:-webkit-optimize-contrast;image-rendering:high-quality}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body>${pagesHtml}</body></html>`;
  }, [allLeftCaptures, allRightCaptures, leftPanel, rightPanel, settings, hospitalConfig, localPaperSize, isLandscape, dualFooterEnabled, dualFooterLayout, dualFooterFontSize, dualFooterFontColor, dualFooterBgColor, dualFooterBorderTopColor, dualFooterCustomLeft, dualFooterCustomCenter, dualFooterCustomRight]);

  const handlePrint = async () => {
    if (activePrinters.length === 0) { alert('No printers configured. Please add a printer in Config or Printer Settings.'); return; }
    if (printCountRemaining <= 0) { alert('No prints remaining.'); return; }
    if (allLeftCaptures.length === 0 && allRightCaptures.length === 0) { alert('Still capturing pages, please wait.'); return; }
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
        printStarted = result.success;
        if (!result.success) console.error('Print failed:', result.error);
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

      const jobName = leftPanel.patientName + ' vs ' + rightPanel.patientName;
      const jobLayout = 'Dual ' + leftPanel.currentLayout.spots + '+' + rightPanel.currentLayout.spots;
      addPrintJob({ patientName: jobName, studyDate: leftPanel.studyDate, layout: jobLayout, copies: localCopies, paperSize: localPaperSize });
      for (let i = 0; i < localCopies; i++) decrementPrintCount();
      // Mark patient as printed — broadcast via IPC so all windows (including main) get the update
      if (electronAPI?.invoke) {
        electronAPI.invoke('mark-patient-printed', { patientId: leftPanel.patientId, patientName: leftPanel.patientName }).catch(() => {});
      }
      const { patients, editPatient } = usePatientStore.getState();
      const matchedPatient = patients.find(p => p.patientId === leftPanel.patientId && p.patientName === leftPanel.patientName);
      if (matchedPatient) editPatient(matchedPatient.id, { printed: true });
      onClose();
    } catch (e) {
      console.error('Print error:', e);
      alert('Printing failed. Check the printer configuration and try again.');
    } finally {
      setPrinting(false);
    }
  };

  const renderPanelMetadataPv = (panel: typeof leftPanel, pageNum: number) => {
    if (!settings.patientInfoEnabled) return null;
    const matched = usePatientStore.getState().patients.find(p => p.patientId === panel.patientId && p.patientName === panel.patientName);
    return (
      <div style={{ padding: '4px 6px', fontSize: '9px', borderBottom: `1px solid ${hospitalConfig.headerBorderBottomColor || '#2563eb'}`, gap: 6, justifyContent: 'space-between', overflow: 'hidden' }} className="bg-gray-900 flex items-center text-gray-300 font-medium flex-shrink-0">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '1 1 auto', minWidth: 0, overflow: 'hidden' }}>
          {hospitalConfig.metadataPrintPatientName !== false && <span style={{ whiteSpace: 'nowrap' }}>Patient: {panel.patientName}</span>}
          {hospitalConfig.metadataPrintAge && matched?.age && <span style={{ whiteSpace: 'nowrap' }}>Age: {matched.age}</span>}
          {hospitalConfig.metadataPrintSex && matched?.sex && <span style={{ whiteSpace: 'nowrap' }}>Sex: {matched.sex}</span>}
          {hospitalConfig.metadataPrintPatientId && <span style={{ whiteSpace: 'nowrap' }}>ID: {panel.patientId}</span>}
          {hospitalConfig.metadataPrintModality && matched?.modality && <span style={{ whiteSpace: 'nowrap' }}>Mod: {matched.modality}</span>}
          {hospitalConfig.metadataPrintStudyName && matched?.studyDescription && <span style={{ whiteSpace: 'nowrap' }}>Study: {matched.studyDescription}</span>}
          {hospitalConfig.metadataPrintAccessNo && matched?.accessionNumber && <span style={{ whiteSpace: 'nowrap' }}>Acc#: {matched.accessionNumber}</span>}
          {hospitalConfig.metadataPrintRefBy && matched?.referringPhysician && <span style={{ whiteSpace: 'nowrap' }}>Ref: {matched.referringPhysician}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '0 0 auto' }}>
          <span style={{ whiteSpace: 'nowrap' }}>Date: {panel.studyDate}</span>
          <span style={{ whiteSpace: 'nowrap' }}>Page {pageNum}/{totalDualPages}</span>
        </div>
      </div>
    );
  };

  const renderPanelGrid = (captures: string[], layout: typeof leftPanel.currentLayout, panel: typeof leftPanel, isLast: boolean, pageNum: number) => {
    const borderColor = hospitalConfig.printBorderEnabled ? (hospitalConfig.printBorderColor || '#333') : 'transparent';
    const wrapperBorder = hospitalConfig.printBorderEnabled ? `1px solid ${borderColor}` : 'none';
    return (
      <div
        className="flex flex-col flex-1 min-h-0 overflow-hidden"
        style={{ borderRight: isLast ? 'none' : '1px dashed #555' }}
      >
        {settings.headerEnabled && renderBrandHeaderPv()}
        <div style={{ border: wrapperBorder, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {renderPanelMetadataPv(panel, pageNum)}
          <div style={{
            display: 'grid', gap: '2px', flex: 1, minHeight: 0, padding: '2px', backgroundColor: '#374151',
            gridTemplateColumns: `repeat(${layout.cols}, 1fr)`,
            gridTemplateRows: `repeat(${layout.rows}, 1fr)`,
          }} className="h-full">
            {captures.map((src, i) => (
              <div key={i} className="bg-black flex items-center justify-center overflow-hidden" style={{ boxShadow: hospitalConfig.printBorderEnabled ? `inset 0 0 0 1px ${borderColor}` : 'none', padding: 3, minHeight: 0 }}>
                {src ? <img src={src} className="w-full h-full object-contain" alt="" /> : <span className="text-gray-600 text-[10px]">Empty</span>}
              </div>
            ))}
          </div>
        </div>
        {dualFooterEnabled && (
          <div
            style={{
              padding: '6px 15px',
              fontSize: `${Math.max((dualFooterFontSize || 8) * 1.4, 11)}px`,
              color: dualFooterFontColor || '#666',
              borderTop: `1px solid ${dualFooterBorderTopColor || '#555'}`,
              background: dualFooterBgColor || undefined,
            }}
            className="flex justify-between items-center flex-shrink-0"
          >
            <div>{renderSlotPv(dualFooterLayout.left, dualFooterCustomLeft)}</div>
            <div className="text-center">{renderSlotPv(dualFooterLayout.center, dualFooterCustomCenter)}</div>
            <div className="text-right">{renderSlotPv(dualFooterLayout.right, dualFooterCustomRight)}</div>
          </div>
        )}
      </div>
    );
  };

  const toolbarH = showPrinterMgr ? 190 : 55;
  const pagesToShow = selectedPages();

  const handleAddPrinter = () => {
    if (!newPrinterName.trim()) return;
    hospitalConfig.addPrinter({ name: newPrinterName.trim(), displayName: newPrinterDisplay.trim() || newPrinterName.trim(), type: newPrinterType, isDefault: configuredPrinters.length === 0, isActive: true });
    setNewPrinterName(''); setNewPrinterDisplay(''); setNewPrinterType('Laser');
  };

  return (
    <div className="fixed inset-0 bg-black flex flex-col z-[1000]">
      <div className="flex items-center justify-between px-3 py-1.5 bg-app-header-bg border-b border-app-border flex-shrink-0 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="px-2 py-1 text-xs border border-app-border text-app-text-secondary bg-app-bg rounded hover:bg-app-hover flex items-center gap-1"><X className="w-3 h-3" /> Back</button>
          <Printer className="w-5 h-5 text-app-accent" />
          <span className="text-sm font-bold text-app-text">Print Preview</span>
          {capturing && <span className="text-[10px] text-yellow-500 animate-pulse">Capturing page {captureProgress}/{captureTotal}…</span>}
          {!capturing && <span className="text-xs text-app-text-muted">{totalDualPages} page{totalDualPages > 1 ? 's' : ''} · {totalDualImages} images</span>}
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
            {(['all', 'current', 'custom'] as const).map(m => (<button key={m} onClick={() => setPageMode(m)} className={`px-2 py-1 text-[10px] font-semibold whitespace-nowrap transition-colors ${pageMode === m ? 'bg-app-accent text-white' : 'bg-app-bg text-app-text-secondary hover:bg-app-hover'}`}>{m === 'all' ? `All (${totalDualPages})` : m === 'current' ? `Page ${currentPage}` : 'Custom'}</button>))}
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
            const leftCaps = allLeftCaptures[pageNum - 1] || [];
            const rightCaps = allRightCaptures[pageNum - 1] || [];
            const availW = viewportSize.w * 0.95;
            const availH = viewportSize.h - toolbarH - 80;
            const fitScale = Math.min(availW / pw, availH / ph);
            const totalScale = fitScale * zoom;
            return (
              <div key={`preview-page-${pageNum}`} className="flex-shrink-0 flex flex-col items-center mb-4">
                <div className="text-xs text-app-text-muted py-1 text-center">Page {pageNum} of {totalDualPages} — {localPaperSize} {localOrientation}</div>
                <div style={{ width: pw * totalScale, height: ph * totalScale, position: 'relative' }}>
                <div className="flex flex-col border border-gray-600 shadow-xl" style={{ width: pw, height: ph, position: 'absolute', top: 0, left: 0, transform: `scale(${totalScale})`, transformOrigin: 'top left', background: hospitalConfig.printBlackBg ? '#000' : '#fff' }}>
                  <div style={{ display: 'flex', gap: 0, flex: 1, minHeight: 0, overflow: 'hidden' }}>
                    {renderPanelGrid(leftCaps, leftPanel.currentLayout, leftPanel, false, pageNum)}
                    {renderPanelGrid(rightCaps, rightPanel.currentLayout, rightPanel, true, pageNum)}
                  </div>
                </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
