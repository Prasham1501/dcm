// Launcher script: ensures correct CWD before running Vite dev server
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { createServer } from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(__dirname);

const server = await createServer({
  root: __dirname,
  server: { host: '0.0.0.0', port: 5173 },
});
await server.listen();
server.printUrls();
