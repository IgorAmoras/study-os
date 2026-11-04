import { defineConfig } from 'vite';

// Development is strictly loopback. To access from a tablet, serve the built app
// with STUDYOS_HOST=0.0.0.0 via the authenticated Node server instead.
export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: 'http://127.0.0.1:4317', changeOrigin: true },
      '/ws': { target: 'ws://127.0.0.1:4317', changeOrigin: true, ws: true },
    }
  },
  build: { outDir: 'dist', emptyOutDir: true, target: 'es2022' }
});
