import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: Number(process.env.WEB_DEV_PORT ?? 5173),
    strictPort: true,
    proxy: {
      '/api': {
        target: process.env.WEB_API_TARGET ?? 'http://127.0.0.1:3000',
        changeOrigin: false
      },
      '/health': {
        target: process.env.WEB_API_TARGET ?? 'http://127.0.0.1:3000',
        changeOrigin: false
      }
    }
  }
});
