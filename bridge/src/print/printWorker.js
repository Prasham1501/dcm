/**
 * PrintWorker — given a job (slot + .dcm files), renders each file to a
 * PNG data URL, builds a multi-page HTML print sheet, loads it into a
 * hidden BrowserWindow, and calls webContents.print() to send it to the
 * configured Windows printer.
 *
 * For PDF printers (e.g. "Microsoft Print to PDF"), uses printToPDF()
 * and saves via a file dialog instead.
 */

const { BrowserWindow, dialog } = require('electron');
const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const { renderToPng, readMetadata } = require('../render/dicomRender');
const { buildPrintHtml } = require('../render/layoutBuilder');
const { resolveLayoutForJob } = require('../render/layoutUtils');
const { ConfigStore } = require('../config/store');

class PrintWorker {
  constructor({ logger, configStore }) {
    this.logger = logger;
    this.configStore = configStore;
  }

  async print(job) {
    const { slot, files } = job;
    const t0 = Date.now();

    // Order by InstanceNumber, then by filename
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

    // Temp directory for rendered images
    const tmpDir = path.join(app.getPath('userData'), 'tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const tmpFiles = [];

    // Render each to a temp PNG file (downscaled to max 800px — sufficient for
    // A4 grid cells at 300 DPI and dramatically faster than 1200px)
    const images = [];
    let firstMeta = null;
    const tRender = Date.now();
    for (const { f, meta } of enriched) {
      try {
        const outFile = path.join(tmpDir, `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`);
        const result = renderToPng(f.filepath, this.logger, { maxDim: 800, outFile });
        if (result) {
          // Use file:// URL for the HTML page
          images.push(`file:///${result.replace(/\\/g, '/')}`);
          tmpFiles.push(result);
          if (!firstMeta) firstMeta = meta;
        }
      } catch (e) {
        this.logger.warn(`[Print] render failed for ${f.filepath}: ${e?.exception || e?.message || String(e)}`);
      }
    }
    this.logger.info(`[Print] rendered ${images.length} images in ${Date.now() - tRender}ms`);

    if (images.length === 0) {
      throw new Error('no renderable images in job');
    }

    const metadata = firstMeta || {};
    const { layout } = resolveLayoutForJob(slot.layoutId, images.length);
    const pages = Math.ceil(images.length / layout.spots);
    this.logger.info(`[Print] resolved layout=${layout.id} images=${images.length} spots=${layout.spots} pages=${pages}`);

    // Read branding from live config
    const branding = this.configStore ? this.configStore.get().branding : null;

    const html = buildPrintHtml({ slot, images, metadata, branding });

    const tmpFile = path.join(tmpDir, `print-${Date.now()}.html`);
    fs.writeFileSync(tmpFile, html, 'utf8');
    this.logger.info(`[Print] HTML size=${(Buffer.byteLength(html) / 1024).toFixed(0)}KB file=${tmpFile}`);

    const win = new BrowserWindow({
      show: false,
      webPreferences: {
        offscreen: false,
        sandbox: false,
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: false, // Allow loading file:// URLs for temp images
      },
    });

    try {
      const tLoad = Date.now();
      await win.loadFile(tmpFile);

      // Wait until every <img> in the page has decoded.
      // With file:// URLs instead of base64, this should be very fast.
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

      // Detect PDF-type printers (Microsoft Print to PDF, etc.)
      const printerName = slot.windowsPrinterName || '';
      const isPdfPrinter = /print\s*to\s*pdf|pdf\s*printer/i.test(printerName);

      if (isPdfPrinter) {
        // Use printToPDF and save to a file
        const pdfBuffer = await win.webContents.printToPDF({
          printBackground: true,
          landscape: false,
          pageSize: slot.paperSize,
          margins: { top: 0, bottom: 0, left: 0, right: 0 },
        });

        const pdfDir = path.join(app.getPath('documents'), 'AccurateBridge');
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
        // Physical printer — use webContents.print()
        const tPrint = Date.now();
        await new Promise((resolve, reject) => {
          const opts = {
            silent: true,
            deviceName: printerName,
            color: true,
            margins: { marginType: 'none' },
            landscape: false,
            pagesPerSheet: 1,
            collate: true,
            copies: slot.copies || 1,
            pageSize: slot.paperSize,
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

      this.logger.info(`[Print] total pipeline ${Date.now() - t0}ms`);
      return { pages, layoutId: layout.id };
    } finally {
      win.destroy();
      // Clean up temp files (HTML + images)
      for (const f of [tmpFile, ...tmpFiles]) {
        try { if (f && fs.existsSync(f)) fs.unlinkSync(f); } catch (_) {}
      }
    }
  }
}

module.exports = { PrintWorker };
