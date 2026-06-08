import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteCommonjs } from '@originjs/vite-plugin-commonjs';
import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';
const _require = createRequire(import.meta.url);

/**
 * Vite plugin to serve local DICOM files for development/testing.
 * Handles GET /api/dicom/serve-file.php?path=<absolute-path>
 * and GET /api/dicom/scan-local.php?dir=<directory>&limit=<n>
 */
function dicomServerPlugin() {
  // Shared serve-file handler so both the dev server and `vite preview`
  // (which serves the real production bundle) can stream local DICOM files.
  const serveFile = (req: any, res: any) => {
    const url = new URL(req.url || '', 'http://localhost');
    const filePath = url.searchParams.get('path');
    if (!filePath) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: 'Missing path parameter' }));
      return;
    }
    try {
      const resolved = path.resolve(filePath);
      if (!fs.existsSync(resolved)) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: 'File not found' }));
        return;
      }
      const stat = fs.statSync(resolved);
      res.setHeader('Content-Type', 'application/dicom');
      res.setHeader('Content-Length', stat.size);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.statusCode = 200;
      fs.createReadStream(resolved).pipe(res);
    } catch (err: any) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: err.message }));
    }
  };

  return {
    name: 'dicom-server',
    // Make serve-file available under `vite preview` too, so the production
    // bundle can be exercised end-to-end with real DICOM data.
    configurePreviewServer(server: any) {
      server.middlewares.use('/api/dicom/serve-file.php', serveFile);
    },
    configureServer(server: any) {
      server.middlewares.use('/api/dicom/serve-file.php', serveFile);

      // Scan a folder and extract patient/study metadata from DICOM headers
      server.middlewares.use('/api/dicom/scan-patients', (req: any, res: any) => {
        const url = new URL(req.url || '', 'http://localhost');
        const dirPath = url.searchParams.get('dir');
        const limit = parseInt(url.searchParams.get('limit') || '5000', 10);

        if (!dirPath) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: false, error: 'Missing dir parameter' }));
          return;
        }

        try {
          const resolved = path.resolve(dirPath);
          if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: 'Directory not found' }));
            return;
          }

          // Collect DICOM files — exclusion-based filter (skip known non-DICOM types)
          const NON_DICOM_RE = /\.(png|jpe?g|gif|bmp|webp|tiff?|pdf|txt|json|xml|html?|css|zip|rar|7z|gz|tar|exe|dll|msi|bat|sh|py|js|ts|csv|xlsx?|docx?|pptx?|ini|log|cfg|yaml|yml|md|sql|db|sqlite|mp[34]|avi|mov|mkv|wav|flac)$/i;
          const dicomFiles: string[] = [];
          function collectFiles(dir: string) {
            if (dicomFiles.length >= limit) return;
            try {
              const entries = fs.readdirSync(dir, { withFileTypes: true });
              for (const entry of entries) {
                if (dicomFiles.length >= limit) break;
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                  collectFiles(fullPath);
                } else if (entry.isFile()) {
                  const name = entry.name.toLowerCase();
                  if (name === 'dicomdir') continue;
                  if (NON_DICOM_RE.test(name)) continue;
                  dicomFiles.push(fullPath);
                }
              }
            } catch { /* skip unreadable dirs */ }
          }
          collectFiles(resolved);

          // Parse DICOM headers and group by StudyInstanceUID
          interface StudyGroup {
            patientName: string;
            patientId: string;
            age: string;
            sex: string;
            studyDate: string;
            studyDescription: string;
            modality: string;
            accessionNumber: string;
            referringPhysician: string;
            studyInstanceUID: string;
            files: string[];
          }

          const studies: Record<string, StudyGroup> = {};
          const dicomParserLib = _require('dicom-parser');

          function readTag(dataSet: any, tag: string): string {
            try { return (dataSet.string(tag) || '').trim(); } catch { return ''; }
          }

          // Parse DICOMDIR files for patient/study metadata and referenced image paths
          function parseDicomDir(filePath: string, fullBuffer: Buffer): Array<{studyUID: string; patientName: string; patientId: string; age: string; sex: string; studyDate: string; studyDescription: string; modality: string; accessionNumber: string; referringPhysician: string; referencedFiles: string[]}> {
            const results: any[] = [];
            try {
              const dataSet = dicomParserLib.parseDicom(new Uint8Array(fullBuffer));
              const dirRecSeq = dataSet.elements['x00041220'];
              if (!dirRecSeq || !dirRecSeq.items) return results;
              const dirBase = path.dirname(filePath);
              let currentPatient: any = {};
              let currentStudy: any = {};
              let currentSeries: any = {};
              for (const item of dirRecSeq.items) {
                const ds = item.dataSet;
                if (!ds) continue;
                const recType = (ds.string('x00041430') || '').trim().toUpperCase();
                if (recType === 'PATIENT') {
                  const rawName = (ds.string('x00100010') || '').replace(/\^/g, ' ').trim();
                  currentPatient = { patientName: rawName || 'Unknown', patientId: (ds.string('x00100020') || '').trim() || 'N/A', sex: (ds.string('x00100040') || '').trim() };
                } else if (recType === 'STUDY') {
                  const rawDate = (ds.string('x00080020') || '').trim();
                  let formattedDate = rawDate;
                  if (rawDate.length === 8) formattedDate = `${rawDate.slice(6, 8)}-${rawDate.slice(4, 6)}-${rawDate.slice(0, 4)}`;
                  currentStudy = { studyUID: (ds.string('x0020000d') || '').trim(), studyDate: formattedDate || new Date().toLocaleDateString(), studyDescription: (ds.string('x00081030') || '').trim(), accessionNumber: (ds.string('x00080050') || '').trim(), age: (ds.string('x00101010') || '').trim() };
                } else if (recType === 'SERIES') {
                  currentSeries = { modality: (ds.string('x00080060') || '').trim() || 'OT' };
                } else if (recType === 'IMAGE') {
                  const refFileId = (ds.string('x00041500') || '').trim();
                  if (refFileId) {
                    const refPath = path.join(dirBase, ...refFileId.split('\\'));
                    const studyUID = currentStudy.studyUID || `dicomdir-${path.basename(filePath)}-${results.length}`;
                    let entry = results.find((r: any) => r.studyUID === studyUID);
                    if (!entry) {
                      entry = { studyUID, patientName: currentPatient.patientName || 'Unknown', patientId: currentPatient.patientId || 'N/A', age: currentStudy.age || '', sex: currentPatient.sex || '', studyDate: currentStudy.studyDate || '', studyDescription: currentStudy.studyDescription || '', modality: currentSeries.modality || 'OT', accessionNumber: currentStudy.accessionNumber || '', referringPhysician: '', referencedFiles: [] };
                      results.push(entry);
                    }
                    if (fs.existsSync(refPath) && fs.statSync(refPath).isFile()) entry.referencedFiles.push(refPath);
                  }
                }
              }
              // If the DICOMDIR has no usable referenced files, drop it
              // entirely. The previous fallback synthesised a phantom
              // "OT" / "Unknown" study using the DICOMDIR file itself,
              // which polluted the patient list whenever a folder contained
              // a DICOMDIR alongside loose DICOM files.
            } catch { /* skip */ }
            return results;
          }

          /** Extract study metadata from a parsed DataSet and add to studies map. */
          function extractAndAddStudy(dataSet: any, studiesMap: Record<string, StudyGroup>, filePath: string): boolean {
            const rawStudyUID = readTag(dataSet, 'x0020000d');
            const rawName     = readTag(dataSet, 'x00100010');
            const rawPid      = readTag(dataSet, 'x00100020');
            if (!rawStudyUID && !rawName && !rawPid) return false;
            const studyUID = rawStudyUID || `unknown-${Object.keys(studiesMap).length}`;
            if (!studiesMap[studyUID]) {
              const rawDate = readTag(dataSet, 'x00080020');
              let formattedDate = rawDate;
              if (rawDate.length === 8) formattedDate = `${rawDate.slice(6,8)}-${rawDate.slice(4,6)}-${rawDate.slice(0,4)}`;
              studiesMap[studyUID] = {
                patientName: rawName.replace(/\^/g, ' ') || 'Unknown',
                patientId: rawPid || 'N/A',
                age: readTag(dataSet, 'x00101010') || '',
                sex: readTag(dataSet, 'x00100040') || '',
                studyDate: formattedDate || new Date().toLocaleDateString(),
                studyDescription: readTag(dataSet, 'x00081030') || '',
                modality: readTag(dataSet, 'x00080060') || 'OT',
                accessionNumber: readTag(dataSet, 'x00080050') || '',
                referringPhysician: readTag(dataSet, 'x00080090')?.replace(/\^/g, ' ') || '',
                studyInstanceUID: studyUID,
                files: [],
              };
            }
            studiesMap[studyUID].files.push(filePath.replace(/\\/g, '/'));
            return true;
          }

          /** Same as extractAndAddStudy but for the partial DataSet thrown
           *  by dicom-parser when the buffer is truncated. */
          function extractFromPartial(ds: any, studiesMap: Record<string, StudyGroup>, filePath: string): boolean {
            const uid  = (ds.string('x0020000d') || '').trim();
            const name = (ds.string('x00100010') || '').replace(/\^/g, ' ').trim();
            const pid  = (ds.string('x00100020') || '').trim();
            if (!uid && !name && !pid) return false;
            const suid = uid || `unknown-${Object.keys(studiesMap).length}`;
            if (!studiesMap[suid]) {
              const rd = (ds.string('x00080020') || '').trim();
              let fd = rd;
              if (rd.length === 8) fd = `${rd.slice(6,8)}-${rd.slice(4,6)}-${rd.slice(0,4)}`;
              studiesMap[suid] = {
                patientName: name || 'Unknown',
                patientId: pid || 'N/A',
                age: (ds.string('x00101010') || '').trim(),
                sex: (ds.string('x00100040') || '').trim(),
                studyDate: fd || new Date().toLocaleDateString(),
                studyDescription: (ds.string('x00081030') || '').trim(),
                modality: (ds.string('x00080060') || '').trim() || 'OT',
                accessionNumber: (ds.string('x00080050') || '').trim(),
                referringPhysician: (ds.string('x00080090') || '').replace(/\^/g, ' ').trim(),
                studyInstanceUID: suid,
                files: [],
              };
            }
            studiesMap[suid].files.push(filePath.replace(/\\/g, '/'));
            return true;
          }

          /** Full-file fallback — reads the entire file, handles both
           *  DICOMDIR and regular DICOM files that fail the 64 KB header parse. */
          function fullFileFallback(filePath: string, studiesMap: Record<string, StudyGroup>): void {
            const fullBuf = fs.readFileSync(filePath);
            const fullDs = dicomParserLib.parseDicom(new Uint8Array(fullBuf));
            const sop = (fullDs.string('x00020002') || '').trim();
            if (sop === '1.2.840.10008.1.3.10') {
              const entries = parseDicomDir(filePath, fullBuf);
              for (const entry of entries) {
                const suid = entry.studyUID;
                if (!studiesMap[suid]) {
                  studiesMap[suid] = { patientName: entry.patientName, patientId: entry.patientId, age: entry.age, sex: entry.sex, studyDate: entry.studyDate, studyDescription: entry.studyDescription, modality: entry.modality, accessionNumber: entry.accessionNumber, referringPhysician: entry.referringPhysician, studyInstanceUID: suid, files: [] };
                }
                for (const fp of entry.referencedFiles) {
                  const norm = fp.replace(/\\/g, '/');
                  if (!studiesMap[suid].files.includes(norm)) studiesMap[suid].files.push(norm);
                }
              }
            } else {
              extractAndAddStudy(fullDs, studiesMap, filePath);
            }
          }

          for (const filePath of dicomFiles) {
            try {
              // Read header for tag parsing (64KB covers most headers)
              const fd = fs.openSync(filePath, 'r');
              const headerSize = Math.min(fs.statSync(filePath).size, 65536);
              const buffer = Buffer.alloc(headerSize);
              fs.readSync(fd, buffer, 0, headerSize, 0);
              fs.closeSync(fd);

              const byteArray = new Uint8Array(buffer);
              const dataSet = dicomParserLib.parseDicom(byteArray, { untilTag: 'x7fe00010' });

              // DICOMDIR: parse directory records for patient metadata & referenced files
              const sopClassUID = readTag(dataSet, 'x00020002');
              if (sopClassUID === '1.2.840.10008.1.3.10') {
                const fullBuf = fs.readFileSync(filePath);
                const entries = parseDicomDir(filePath, fullBuf);
                for (const entry of entries) {
                  // Skip DICOMDIR entries that pointed at files we couldn't
                  // find on disk — they'd otherwise show up as ghost studies
                  // with zero images.
                  if (!entry.referencedFiles || entry.referencedFiles.length === 0) continue;
                  const suid = entry.studyUID;
                  if (!studies[suid]) {
                    studies[suid] = { patientName: entry.patientName, patientId: entry.patientId, age: entry.age, sex: entry.sex, studyDate: entry.studyDate, studyDescription: entry.studyDescription, modality: entry.modality, accessionNumber: entry.accessionNumber, referringPhysician: entry.referringPhysician, studyInstanceUID: suid, files: [] };
                  }
                  for (const fp of entry.referencedFiles) {
                    const norm = fp.replace(/\\/g, '/');
                    if (!studies[suid].files.includes(norm)) studies[suid].files.push(norm);
                  }
                }
                continue;
              }

              extractAndAddStudy(dataSet, studies, filePath);
            } catch (parseErr: any) {
              // 1) Use partial dataSet from truncated-buffer parse
              if (parseErr?.dataSet && extractFromPartial(parseErr.dataSet, studies, filePath)) {
                continue;
              }
              // 2) Full-file fallback: handles DICOMDIRs AND normal
              //    DICOM files that need more than 64 KB to parse.
              try { fullFileFallback(filePath, studies); } catch { /* truly unparseable — skip */ }
            }
          }

          const patients = Object.values(studies).map((s) => ({
            id: s.studyInstanceUID,
            patientId: s.patientId,
            patientName: s.patientName,
            age: s.age,
            sex: s.sex,
            studyDate: s.studyDate,
            studyDescription: s.studyDescription,
            modality: s.modality,
            accessionNumber: s.accessionNumber,
            referringPhysician: s.referringPhysician,
            images: s.files.length,
            printed: false,
            studyInstanceUID: s.studyInstanceUID,
            filePaths: s.files,
          }));

          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.statusCode = 200;
          res.end(JSON.stringify({
            success: true,
            directory: resolved,
            studyCount: patients.length,
            totalFiles: dicomFiles.length,
            patients,
          }));
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });

      // Import DICOM files to managed storage
      // POST /api/dicom/import-file  body: { filePaths: string[], destDir?: string }
      server.middlewares.use('/api/dicom/import-file', async (req: any, res: any) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ success: false, error: 'Method not allowed' }));
          return;
        }

        try {
          const body = await new Promise<string>((resolve, reject) => {
            let data = '';
            req.on('data', (chunk: any) => { data += chunk.toString(); });
            req.on('end', () => resolve(data));
            req.on('error', reject);
          });

          const { filePaths = [], destDir } = JSON.parse(body);
          if (!Array.isArray(filePaths) || filePaths.length === 0) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: 'No filePaths provided' }));
            return;
          }

          const os = await import('os');
          const managedDir = destDir
            ? path.resolve(destDir)
            : path.join(os.homedir(), 'dicom-storage');

          if (!fs.existsSync(managedDir)) {
            fs.mkdirSync(managedDir, { recursive: true });
          }

          const imported: string[] = [];
          const errors: string[] = [];

          for (const srcPath of filePaths) {
            try {
              const resolved = path.resolve(srcPath);
              if (!fs.existsSync(resolved)) {
                errors.push(`Not found: ${srcPath}`);
                continue;
              }
              const destFile = path.join(managedDir, path.basename(resolved));
              let finalDest = destFile;
              if (fs.existsSync(finalDest)) {
                const ext = path.extname(resolved);
                const base = path.basename(resolved, ext);
                finalDest = path.join(managedDir, `${base}-${Date.now()}${ext}`);
              }
              fs.copyFileSync(resolved, finalDest);
              imported.push(finalDest.replace(/\\/g, '/'));
            } catch (e: any) {
              errors.push(`${srcPath}: ${e.message}`);
            }
          }

          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.statusCode = 200;
          res.end(JSON.stringify({
            success: true,
            managedDir: managedDir.replace(/\\/g, '/'),
            imported,
            errors,
          }));
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });

      server.middlewares.use('/api/dicom/scan-local.php', (req: any, res: any) => {
        const url = new URL(req.url || '', 'http://localhost');
        const dirPath = url.searchParams.get('dir');
        const limit = parseInt(url.searchParams.get('limit') || '200', 10);

        if (!dirPath) {
          res.statusCode = 400;
          res.end(JSON.stringify({ success: false, error: 'Missing dir parameter' }));
          return;
        }

        try {
          const resolved = path.resolve(dirPath);
          if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
            res.statusCode = 404;
            res.end(JSON.stringify({ success: false, error: 'Directory not found' }));
            return;
          }

          const files: Array<{ path: string; filename: string; size: number }> = [];

          function scanDir(dir: string) {
            if (files.length >= limit) return;
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
              if (files.length >= limit) break;
              const fullPath = path.join(dir, entry.name);
              if (entry.isDirectory()) {
                scanDir(fullPath);
              } else if (entry.isFile()) {
                const name = entry.name.toLowerCase();
                if (name.endsWith('.dcm') || name.endsWith('.dicom') || !name.includes('.')) {
                  const stat = fs.statSync(fullPath);
                  files.push({
                    path: fullPath.replace(/\\/g, '/'),
                    filename: entry.name,
                    size: stat.size,
                  });
                }
              }
            }
          }

          scanDir(resolved);

          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.statusCode = 200;
          res.end(JSON.stringify({
            success: true,
            directory: resolved,
            count: files.length,
            files,
          }));
        } catch (err: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
    },
  };
}

/**
 * Vite plugin to patch cornerstone-tools drawLinkedTextBox at transform time.
 * Adds early return when textBox._hidden is true, preventing the dotted
 * callout line from rendering when annotation text is hidden.
 */
function cornerstoneHideTextPatchPlugin() {
  return {
    name: 'cornerstone-hide-text-patch',
    enforce: 'pre' as const,
    transform(code: string, id: string) {
      if (!id.includes('cornerstone-tools')) return null;
      const TARGET = 'function (context, element, textBox, text, handles, textBoxAnchorPoints, color, lineWidth, xOffset, yCenter) {\n  var pixelToCanvas';
      if (!code.includes(TARGET)) return null;
      const MARKER = 'if (textBox && textBox._hidden) return;';
      if (code.includes(MARKER)) return null;
      return code.replace(
        TARGET,
        'function (context, element, textBox, text, handles, textBoxAnchorPoints, color, lineWidth, xOffset, yCenter) {\n  if (textBox && textBox._hidden) return;\n  var pixelToCanvas'
      );
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    // REQUIRED for Cornerstone3D in Vite dev mode: vtk.js + the Emscripten
    // codec files (libjpeg-turbo, charls, openjpeg, openjph) and globalthis
    // are UMD/CommonJS modules. Without this plugin Vite's ESM rewrite serves
    // them raw and the browser throws
    //     "does not provide an export named 'default'"
    // viteCommonjs transforms them into proper ESM with a default export.
    //
    // CRITICAL: scope it to ONLY the cs3d codec/vtk packages. Left unscoped,
    // the plugin also rewrites the LEGACY cornerstone v2 CJS deps used by the
    // 2D viewer (cornerstone-core / cornerstone-tools / wado-image-loader)
    // and emits broken output (`import … from " + result.moduleId + "`),
    // 500-ing the 2D stack. Those legacy deps are pre-bundled fine by Vite's
    // default esbuild, so we must NOT touch them.
    viteCommonjs({
      include: [
        '@cornerstonejs/codec-libjpeg-turbo-8bit',
        '@cornerstonejs/codec-charls',
        '@cornerstonejs/codec-openjpeg',
        '@cornerstonejs/codec-openjph',
        '@kitware/vtk.js',
        'globalthis',
      ],
    }),
    dicomServerPlugin(),
    cornerstoneHideTextPatchPlugin(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Cornerstone3D ships its codec WASM + web workers via dynamic imports.
  // Vite's pre-bundler can't statically analyse those, so the cs3d packages
  // are excluded.
  // BUT: cs3d depends on `@kitware/vtk.js`, which does
  //     `import globalThis from 'globalthis'`
  // and `globalthis` is a CommonJS package with NO default export. When
  // Vite dev-pre-bundles vtk.js without globalthis it produces the runtime
  //     SyntaxError: ... globalthis ... does not provide an export named 'default'
  // Force-include both so esbuild pre-bundles them together with the
  // CJS→ESM interop applied across the whole graph.
  // vtk.js (a transitive dep of @cornerstonejs/core) imports a chain of
  // CommonJS packages — globalthis, fast-deep-equal, seedrandom, etc. — via
  // `import x from 'pkg'`. Vite's dev pre-bundler MUST process the whole
  // graph together so esbuild can rewrite those default imports against the
  // CJS `module.exports`. If we exclude cs3d/vtk.js from optimizeDeps, the
  // browser hits the raw CJS files and crashes with
  //     "does not provide an export named 'default'"
  //
  // So we INCLUDE cs3d core + tools + vtk.js (and force-include the known
  // problematic CJS deps), and only exclude `dicom-image-loader` because it
  // dynamically constructs Workers from runtime URLs that the pre-bundler
  // can't statically follow.
  // Official Cornerstone3D + Vite optimizeDeps shape. The dicom-image-loader
  // loads its codec workers/WASM via runtime URLs, so it must stay OUT of the
  // pre-bundle; dicom-parser is CJS so it must be pre-bundled. viteCommonjs
  // (above) handles the vtk.js/globalthis/codec CJS-default interop in dev.
  optimizeDeps: {
    exclude: [
      '@cornerstonejs/dicom-image-loader',
    ],
    include: [
      'dicom-parser',
    ],
  },
  // The cs3d decode workers + their JPEG/JLS/RLE WASM blobs must be emitted
  // to dist/assets so electron-builder's extraResources picks them up. The
  // workers are ESM modules — keep this format so they run inside Electron.
  worker: {
    format: 'es',
  },
  assetsInclude: ['**/*.wasm'],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 3000,
  },
  // Vitest config for the pure-logic unit tests under src/features/.../__tests__.
  // Uses happy-dom to keep the WebGL2 probe (and any other DOM helpers)
  // resolvable without a real browser. cs3d itself is never imported by
  // the tested modules, so no GPU is needed.
  // @ts-expect-error — `test` is a Vitest field, not part of Vite's config types.
  test: {
    environment: 'happy-dom',
    include: ['src/**/__tests__/**/*.test.{ts,tsx}'],
    globals: false,
  },
  server: {
    port: 5173,
    proxy: {
      // Proxy non-DICOM API calls to PHP/Apache when running.
      // Default = http://localhost (XAMPP's Apache port 80). Override
      // via env var VITE_API_PROXY if Apache lives elsewhere, e.g.:
      //   VITE_API_PROXY=http://localhost:8080 npm run dev
      // When unreachable we log a one-time hint instead of spamming
      // the console with ECONNREFUSED — usually means XAMPP's Apache
      // simply isn't started.
      '/api': {
        target: process.env.VITE_API_PROXY || 'http://127.0.0.1',
        changeOrigin: true,
        // Apache's docroot is C:\xampp\htdocs\ — the project lives at
        // C:\xampp\htdocs\dcm\, so a request to /api/cloud/x.php needs
        // to be rewritten to /dcm/api/cloud/x.php before it leaves Vite.
        // Override with VITE_API_PREFIX="" if your Apache vhost serves
        // the project at the document root.
        rewrite: (path: string) => (process.env.VITE_API_PREFIX ?? '/dcm') + path,
        // Don't proxy if handled by our middleware (serve-file + scan)
        bypass: (req: any) => {
          if (req.url?.startsWith('/api/dicom/serve-file.php') || req.url?.startsWith('/api/dicom/scan-local.php')) return req.url;
          return undefined;
        },
        configure: (proxy: any) => {
          let warned = false;
          proxy.on('error', (err: any, _req: any, res: any) => {
            if (err?.code === 'ECONNREFUSED' && !warned) {
              warned = true;
              // eslint-disable-next-line no-console
              console.warn(
                `\n[vite proxy] /api → ${process.env.VITE_API_PROXY || 'http://localhost'} is not reachable.\n` +
                `  → Start XAMPP's Apache, or set VITE_API_PROXY to wherever your PHP lives.\n`,
              );
            }
            if (res && !res.headersSent) {
              res.statusCode = 502;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok: false, error: 'PHP backend unreachable — start XAMPP Apache or set VITE_API_PROXY env var.' }));
            }
          });
        },
      },
    },
  },
});
