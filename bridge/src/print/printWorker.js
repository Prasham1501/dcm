/**
 * PrintWorker - renders DICOM files to PNG, builds printable HTML, and sends
 * it to the configured Windows printer.
 */

const { BrowserWindow, dialog } = require('electron');
const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const { renderToPng, readMetadata } = require('../render/dicomRender');
const { buildPrintHtml } = require('../render/layoutBuilder');
const { resolveLayoutForJob } = require('../render/layoutUtils');
const { electronPageSize, pdfPageSize, isNamedSize } = require('../render/paperSizes');
const { resolveTargetPaper, resolveBranding, resolveLut } = require('./printResolve');

function clampCopies(value) {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, 99);
}

function orientationFromFilm(value) {
  const v = String(value || '').toUpperCase();
  if (v === 'LANDSCAPE') return 'landscape';
  if (v === 'PORTRAIT') return 'portrait';
  return null;
}

async function loadPrintHtml(win, html) {
  await win.loadURL('about:blank');
  await win.webContents.executeJavaScript(`
    document.open();
    document.write(${JSON.stringify(html)});
    document.close();
  `);
}

function hardenPrintWindow(win) {
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, url) => {
    if (url === 'about:blank') return;
    event.preventDefault();
  });
  win.webContents.on('devtools-opened', () => {
    try { win.webContents.closeDevTools(); } catch {}
  });
}

class PrintWorker {
  constructor({ logger, configStore }) {
    this.logger = logger;
    this.configStore = configStore;
  }

  async print(job) {
    const { slot, files } = job;
    const t0 = Date.now();

    const enriched = files.map((f) => {
      try {
        const meta = readMetadata(f.filepath);
        return { f, meta };
      } catch (e) {
        this.logger.warn(`[Print] readMetadata failed for ${f.filepath}: ${e?.exception || e?.message || String(e)}`);
        return { f, meta: { instanceNumber: 0 } };
      }
    });
    enriched.sort((a, b) => (a.meta.instanceNumber || 0) - (b.meta.instanceNumber || 0));

    const tmpDir = path.join(app.getPath('userData'), 'tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const tmpFiles = [];

    const images = [];
    let firstMeta = null;
    const tRender = Date.now();
    for (const { f, meta } of enriched) {
      try {
        const outFile = path.join(tmpDir, `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`);
        const result = renderToPng(f.filepath, this.logger, { maxDim: 800, outFile });
        if (result) {
          images.push(`file:///${result.replace(/\\/g, '/')}`);
          tmpFiles.push(result);
          if (!firstMeta) firstMeta = meta;
        }
      } catch (e) {
        this.logger.warn(`[Print] render failed for ${f.filepath}: ${e?.exception || e?.message || String(e)}`);
      }
    }
    this.logger.info(`[Print] rendered ${images.length} images in ${Date.now() - tRender}ms`);

    if (images.length === 0) throw new Error('no renderable images in job');

    const metadata = firstMeta || {};
    const { layout, orientation } = resolveLayoutForJob(slot.layoutId, images.length);
    const pages = Math.ceil(images.length / layout.spots);
    this.logger.info(`[Print] resolved layout=${layout.id} images=${images.length} spots=${layout.spots} pages=${pages}`);

    const branding = this.configStore ? resolveBranding(this.configStore.get(), slot) : null;
    const html = buildPrintHtml({ slot, images, metadata, branding, lut: resolveLut(slot) });
    return this._spoolHtml({
      slot,
      html,
      tmpDir,
      tmpFiles,
      pages,
      layoutId: layout.id,
      startedAt: t0,
      landscape: orientation === 'landscape',
    });
  }

  async printDirect(job) {
    const { slot, directPrint } = job;
    const t0 = Date.now();
    if (!directPrint || !directPrint.layout) throw new Error('direct print job missing Film Box layout');

    const tmpDir = path.join(app.getPath('userData'), 'tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const tmpFiles = [];
    const images = Array.from({ length: directPrint.layout.spots }, () => null);
    let firstMeta = null;

    const orderedBoxes = [...(directPrint.imageBoxes || [])].sort((a, b) => (a.position || 0) - (b.position || 0));
    const tRender = Date.now();
    for (const box of orderedBoxes) {
      if (!box.filepath) continue;
      try {
        const outFile = path.join(tmpDir, `direct-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`);
        const meta = readMetadata(box.filepath);
        const result = renderToPng(box.filepath, this.logger, { maxDim: 1200, outFile });
        if (result) {
          const idx = Math.max(0, Math.min(directPrint.layout.spots - 1, (box.position || 1) - 1));
          images[idx] = `file:///${result.replace(/\\/g, '/')}`;
          tmpFiles.push(result);
          if (!firstMeta) firstMeta = meta;
        }
      } catch (e) {
        this.logger.warn(`[Print] direct render failed for ${box.filepath}: ${e?.exception || e?.message || String(e)}`);
      }
    }
    this.logger.info(`[Print] direct rendered ${images.filter(Boolean).length}/${images.length} image boxes in ${Date.now() - tRender}ms`);

    if (!images.some(Boolean)) throw new Error('no renderable images in direct print job');

    const copies = clampCopies(directPrint.copies || 1);
    const pageSize = resolveTargetPaper(slot, directPrint.filmSizeId);
    const orientation = orientationFromFilm(directPrint.filmOrientation)
      || (directPrint.layout.cols > directPrint.layout.rows ? 'landscape' : 'portrait');
    const slotForPrint = { ...slot, copies, paperSize: pageSize };
    const metadata = firstMeta || {};
    const branding = this.configStore ? resolveBranding(this.configStore.get(), slot) : null;
    const html = buildPrintHtml({
      slot: slotForPrint,
      images,
      metadata,
      branding,
      layoutOverride: directPrint.layout,
      orientationOverride: orientation,
      fillEmptySlots: false,
      pageSizeOverride: pageSize,
      footerLayoutLabel: directPrint.layout.name || directPrint.layout.id,
      lut: resolveLut(slot),
    });

    const pages = Math.max(1, Math.ceil(images.length / directPrint.layout.spots));
    const physicalPages = pages * copies;
    this.logger.info(`[Print] direct layout=${directPrint.layout.name || directPrint.layout.id} copies=${copies} filmSize=${directPrint.filmSizeId || 'slot'} pageSize=${pageSize}`);
    return this._spoolHtml({
      slot: slotForPrint,
      html,
      tmpDir,
      tmpFiles,
      pages: physicalPages,
      layoutId: directPrint.layout.id,
      startedAt: t0,
      pageSizeOverride: pageSize,
      landscape: orientation === 'landscape',
    });
  }

  async _spoolHtml({ slot, html, tmpDir, tmpFiles, pages, layoutId, startedAt, pageSizeOverride, landscape = false }) {
    const tmpFile = path.join(tmpDir, `print-${Date.now()}.html`);
    fs.writeFileSync(tmpFile, html, 'utf8');
    this.logger.info(`[Print] HTML size=${(Buffer.byteLength(html) / 1024).toFixed(0)}KB file=${tmpFile}`);

    // ── Test-dump mode (set BRIDGE_TEST_DUMP=<dir>) ─────────────
    // For automated verification: write the final rendered HTML + a PDF to
    // the dump dir and skip the printer/dialog entirely. No effect in normal
    // operation (env var unset).
    const dumpDir = process.env.BRIDGE_TEST_DUMP;
    if (dumpDir) {
      try {
        if (!fs.existsSync(dumpDir)) fs.mkdirSync(dumpDir, { recursive: true });
        const stamp = `${layoutId}-${landscape ? 'L' : 'P'}-${Date.now()}`;
        const htmlOut = path.join(dumpDir, `dump-${stamp}.html`);
        fs.writeFileSync(htmlOut, html, 'utf8');
        const win = new BrowserWindow({
          show: false,
          webPreferences: {
            sandbox: false,
            webSecurity: false,
            nodeIntegration: false,
            contextIsolation: true,
            devTools: false,
          },
        });
        hardenPrintWindow(win);
        await loadPrintHtml(win, html);
        await win.webContents.executeJavaScript(
          "new Promise(r=>{const i=[...document.querySelectorAll('img')];if(!i.length)return r();let n=0;const d=()=>{if(++n>=i.length)r()};i.forEach(m=>{if(m.complete)d();else{m.addEventListener('load',d,{once:true});m.addEventListener('error',d,{once:true});}});setTimeout(r,3000);});"
        );
        const resolvedPageSize = pageSizeOverride || slot.paperSize;
        const pdf = await win.webContents.printToPDF({
          printBackground: true,
          landscape: isNamedSize(resolvedPageSize) ? landscape : false,
          pageSize: pdfPageSize(resolvedPageSize, landscape),
          preferCSSPageSize: true,
          margins: { top: 0, bottom: 0, left: 0, right: 0 },
        });
        fs.writeFileSync(path.join(dumpDir, `dump-${stamp}.pdf`), pdf);
        win.destroy();
        this.logger.info(`[Print] TEST DUMP html+pdf written to ${dumpDir} (${stamp})`);
      } catch (e) {
        this.logger.error(`[Print] test dump failed: ${e?.message || e}`);
      } finally {
        for (const f of [tmpFile, ...tmpFiles]) {
          try { if (f && fs.existsSync(f)) fs.unlinkSync(f); } catch (_) {}
        }
      }
      return { pages, layoutId };
    }

    const win = new BrowserWindow({
      show: false,
      webPreferences: {
        offscreen: false,
        sandbox: false,
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: false,
        devTools: false,
      },
    });
    hardenPrintWindow(win);

    try {
      const tLoad = Date.now();
      await loadPrintHtml(win, html);
      await win.webContents.executeJavaScript(`
        new Promise(resolve => {
          const imgs = Array.from(document.querySelectorAll('img'));
          if (imgs.length === 0) return resolve();
          let loaded = 0;
          const done = () => { if (++loaded >= imgs.length) resolve(); };
          imgs.forEach(img => {
            if (img.complete && img.naturalWidth > 0) { done(); return; }
            img.addEventListener('load', done, { once: true });
            img.addEventListener('error', done, { once: true });
          });
          setTimeout(resolve, 3000);
        });
      `);
      this.logger.info(`[Print] page loaded + images decoded in ${Date.now() - tLoad}ms`);

      const printerName = slot.windowsPrinterName || '';
      const isPdfPrinter = /print\s*to\s*pdf|pdf\s*printer/i.test(printerName);
      const resolvedPageSize = pageSizeOverride || slot.paperSize;
      const pageSize = electronPageSize(resolvedPageSize, landscape);
      // For named sizes (A4, etc.) pass landscape to Electron so the driver
      // rotates the page.  For custom DICOM film sizes the CSS @page already
      // uses explicit rotated mm dimensions, so tell Electron portrait to
      // avoid double-rotation.
      const electronLandscape = isNamedSize(resolvedPageSize) ? landscape : false;

      if (isPdfPrinter) {
        const pdfBuffer = await win.webContents.printToPDF({
          printBackground: true,
          landscape: electronLandscape,
          pageSize: pdfPageSize(resolvedPageSize, landscape),
          preferCSSPageSize: true,
          margins: { top: 0, bottom: 0, left: 0, right: 0 },
        });

        const pdfDir = path.join(app.getPath('documents'), 'OneClickzBridge');
        if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const defaultPath = path.join(pdfDir, `print-${slot.name}-${timestamp}.pdf`);

        const saveResult = await dialog.showSaveDialog({
          title: 'Save Print as PDF',
          defaultPath,
          filters: [{ name: 'PDF', extensions: ['pdf'] }],
        });

        if (!saveResult.canceled && saveResult.filePath) {
          await fs.promises.writeFile(saveResult.filePath, pdfBuffer);
          this.logger.info(`[Print] PDF saved to ${saveResult.filePath}`);
        } else {
          this.logger.info('[Print] PDF save cancelled by user');
        }
      } else {
        const tPrint = Date.now();
        await new Promise((resolve, reject) => {
          const opts = {
            silent: true,
            deviceName: printerName,
            color: true,
            margins: { marginType: 'none' },
            landscape: electronLandscape,
            pagesPerSheet: 1,
            collate: true,
            copies: slot.copies || 1,
            pageSize,
            printBackground: true,
          };
          this.logger.info(`[Print] sending to printer "${printerName}"`);
          win.webContents.print(opts, (success, errorType) => {
            if (success) {
              this.logger.info(`[Print] spooled to "${printerName}" in ${Date.now() - tPrint}ms`);
              resolve();
            } else {
              this.logger.error(`[Print] print failed: ${errorType}`);
              reject(new Error(errorType || 'print failed'));
            }
          });
        });
      }

      this.logger.info(`[Print] total pipeline ${Date.now() - startedAt}ms`);
      return { pages, layoutId };
    } finally {
      win.destroy();
      for (const f of [tmpFile, ...tmpFiles]) {
        try { if (f && fs.existsSync(f)) fs.unlinkSync(f); } catch (_) {}
      }
    }
  }
}

module.exports = { PrintWorker };
