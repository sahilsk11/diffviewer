import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Both `vite` (dev) and `vite preview` (production-realistic local
// server, also what Playwright should hit if added) bind to PORT with
// strictPort:true so a taken port fails loudly instead of silently
// incrementing — test runners rely on the port they picked actually
// being the port the server bound to.
//
// The backend URL is read by app code via import.meta.env.VITE_API_BASE_URL.
// Vite inlines VITE_* values into the client bundle, so production changes
// require a rebuild. Use a same-origin /api path or a fetched runtime config
// file if a downstream app needs deploy-time backend switching.
const port = Number(process.env.PORT ?? 3000);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { tsconfigPaths: true },
  server: { port, strictPort: true, host: true },
  preview: { port, strictPort: true, host: true },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    globals: false,
  },
});
