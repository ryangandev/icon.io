import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// The design gallery (/design, development only) compares each component
// with the Figma export: its JSON and, when exported with previews, its PNG.
function figmaExport(): Plugin {
  const root = path.resolve(import.meta.dirname, '../design/figma');
  return {
    name: 'zumpo-figma-export',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__figma', (request, response, next) => {
        const file = path.join(root, decodeURIComponent(request.url ?? ''));
        if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) {
          next();
          return;
        }
        response.setHeader(
          'Content-Type',
          file.endsWith('.png') ? 'image/png' : 'application/json',
        );
        fs.createReadStream(file).pipe(response);
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), figmaExport()],
  server: {
    port: 3001,
  },
  build: {
    // The Express backend serves the built SPA as static files from
    // back/build/public, so emit directly there instead of building
    // into front/build and moving it afterwards.
    outDir: '../back/build/public',
    emptyOutDir: true,
    sourcemap: true,
  },
});
