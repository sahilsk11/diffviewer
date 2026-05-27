import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Both `vite` (dev) and `vite preview` (production-realistic local
// server, also what Playwright should hit if added) bind to PORT with
// strictPort:true so a taken port fails loudly instead of silently
// incrementing — test runners rely on the port they picked actually
// being the port the server bound to.
//
// The frontend calls same-origin /api paths by default. In dev, Vite proxies
// those to the FastAPI backend so local and preview usage share one browser
// origin. API_PORT can override the backend port without rebuilding.
const port = Number(process.env.PORT ?? 3000);
const apiPort = Number(process.env.API_PORT ?? 8000);
const apiTarget = `http://127.0.0.1:${apiPort}`;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { tsconfigPaths: true },
  server: {
    port,
    strictPort: true,
    host: true,
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
      '/healthz': { target: apiTarget, changeOrigin: true },
    },
  },
  preview: { port, strictPort: true, host: true },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    globals: false,
  },
});
