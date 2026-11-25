import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { port: 5308, strictPort: true },
  preview: { port: 4308, strictPort: true },
});
