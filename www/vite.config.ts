import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
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
  return {
    name: 'dicom-server',
    configureServer(server: any) {
      server.middlewares.use('/api/dicom/serve-file.php', (req: any, res: any) => {
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
      });

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

          // Collect DICOM files
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
                  if (name.endsWith('.dcm') || name.endsWith('.dicom') || (!name.includes('.') && name !== 'dicomdir')) {
                    dicomFiles.push(fullPath);
                  }
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

              // Skip DICOMDIR files (Media Storage Directory Storage)
              const sopClassUID = readTag(dataSet, 'x00020002');
              if (sopClassUID === '1.2.840.10008.1.3.10') continue;

              // Skip files with no study UID and no patient-level tags
              const rawStudyUID = readTag(dataSet, 'x0020000d');
              if (!rawStudyUID && !readTag(dataSet, 'x00100010') && !readTag(dataSet, 'x00100020')) continue;

              const studyUID = rawStudyUID || `unknown-${Object.keys(studies).length}`;

              if (!studies[studyUID]) {
                const rawDate = readTag(dataSet, 'x00080020'); // YYYYMMDD
                let formattedDate = rawDate;
                if (rawDate.length === 8) {
                  formattedDate = `${rawDate.slice(6, 8)}-${rawDate.slice(4, 6)}-${rawDate.slice(0, 4)}`;
                }

                const rawName = readTag(dataSet, 'x00100010').replace(/\^/g, ' ');
                const rawAge = readTag(dataSet, 'x00101010'); // e.g. "045Y"

                studies[studyUID] = {
                  patientName: rawName || 'Unknown',
                  patientId: readTag(dataSet, 'x00100020') || 'N/A',
                  age: rawAge || '',
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

              studies[studyUID].files.push(filePath.replace(/\\/g, '/'));
            } catch {
              // Skip files that can't be parsed (not valid DICOM)
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
  plugins: [react(), dicomServerPlugin(), cornerstoneHideTextPatchPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 3000,
  },
  server: {
    port: 5173,
    proxy: {
      // Proxy non-DICOM API calls to PHP/Apache when running
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        // Don't proxy if handled by our middleware
        bypass: (req: any) => {
          if (req.url?.startsWith('/api/dicom/')) return req.url;
          return undefined;
        },
      },
    },
  },
});
