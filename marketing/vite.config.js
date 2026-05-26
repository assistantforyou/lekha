import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  // Don't inherit the parent Next.js project's postcss/tailwind config.
  css: { postcss: {} },
});
