import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The equipment API (https://kycl.in/api/api/equipments) does not send CORS
// headers for localhost, so in development we proxy it through Vite:
//   browser -> /kycl/api/api/equipments -> https://kycl.in/api/api/equipments
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    proxy: {
      '/kycl': {
        target: 'https://kycl.in',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/kycl/, ''),
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 1500,
  },
});
