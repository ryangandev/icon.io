import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
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
