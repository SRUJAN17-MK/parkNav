import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The frontend talks to the Express API through the dev-server proxy, so the
// browser only ever sees one origin and no CORS setup is required.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    strictPort: true,
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET || 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
