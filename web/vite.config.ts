import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';

const DEV_API_PORT = 7420;

export default defineConfig({
  plugins: [react(), tailwind()],
  build: {
    rolldownOptions: {
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
  server: {
    proxy: {
      '/api': { target: `http://127.0.0.1:${DEV_API_PORT}`, changeOrigin: true },
    },
  },
});
