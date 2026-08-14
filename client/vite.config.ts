import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Allow importing the built @boloss/shared package from the monorepo root.
    fs: { allow: ['..'] },
  },
  preview: { port: 4173 },
});
