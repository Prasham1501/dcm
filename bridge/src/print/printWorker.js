/**
 * PrintWorker — given a job (slot + .dcm files), renders each file to a
 * PNG data URL, builds a multi-page HTML print sheet, loads it into a
 * hidden BrowserWindow, and calls webContents.print() to send it to the
 * configured Windows printer.
 */

const { BrowserWindow } = require('electron');
const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const { renderToPng, readMetadata } = require('../render/dicomRender');
const { buildPrintHtml } = require('../render/layoutBuilder');
const { resolveLayoutForJob } = require('../render/layoutUtils');

class PrintWorker {
  constructor({ logger }) {
    this.logger = logger;
  }

  async print(job) {
    const { slot, files } = job;

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

    // Render each to PNG
    const images = [];
    let firstMeta = null;
    for (const { f, meta } of enriched) {
      try {
        const png = renderToPng(f.filepath, this.logger);
        if (png) {
          images.push(png);
          if (!firstMeta) firstMeta = meta;
        }
      } catch (e) {
        this.logger.warn(`[Print] render failed for ${f.filepath}: ${e?.exception || e?.message || String(e)}`);
      }
    }

    if (images.length === 0) {
      throw new Error('no renderable images in job');
    }

    const metadata = firstMeta || {};
    const { layout } = resolveLayoutForJob(slot.layoutId, images.length);
    const pages = Math.ceil(images.length / layout.spots);
    this.logger.info(`[Print] resolved layout=${layout.id} images=${images.length} spots=${layout.spots} pages=${pages}`);
    const html = buildPrintHtml({ slot, images, metadata });

    // Write HTML to a temp file instead of using a data URL
    // (large studies with many embedded PNGs exceed Electron's URL length limit)
    const tmpDir = path.join(app.getPath('userData'), 'tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const tmpFile = path.join(tmpDir, `print-${Date.now()}.html`);
    fs.writeFileSync(tmpFile, html, 'utf8');

    const win = new BrowserWindow({
      show: false,
      webPreferences: {
        offscreen: false,
        sandbox: true,
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    try {
      await win.loadFile(tmpFile);
      // Wait one frame for layout
      await new Promise((r) => setTimeout(r, 200));

      await new Promise((resolve, reject) => {
        const opts = {
          silent: true,
          deviceName: slot.windowsPrinterName,
          color: true,
          margins: { marginType: 'none' },
          landscape: false, // @page rule already specifies orientation
          pagesPerSheet: 1,
          collate: true,
          copies: slot.copies || 1,
          pageSize: slot.paperSize,
          printBackground: true,
        };
        win.webContents.print(opts, (success, errorType) => {
          if (success) resolve();
          else reject(new Error(errorType || 'print failed'));
        });
      });

      return { pages, layoutId: layout.id };
    } finally {
      win.destroy();
      // Clean up temp file
      try { if (tmpFile) fs.unlinkSync(tmpFile); } catch (_) {}
    }
  }
}

module.exports = { PrintWorker };
