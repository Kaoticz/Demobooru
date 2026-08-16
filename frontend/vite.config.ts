import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// The dev server proxies /api to the backend so the browser never needs to
// know the backend origin. Inside Docker Compose the target is the backend
// service name; running Vite directly on the host, use localhost:8000.
const apiTarget = process.env.API_TARGET ?? 'http://localhost:8000';

// Polling is slower than native filesystem events but works on every host
// platform (including hosts whose inotify events do not reach the container).
// Disable with VITE_USE_POLLING=false on Linux hosts where events propagate.
const usePolling = process.env.VITE_USE_POLLING !== 'false';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5174,
    strictPort: true,
    watch: { usePolling },
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});
