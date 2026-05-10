import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
//
// We intentionally do NOT use vite-plugin-pwa for now: with Vite 8 + Rolldown
// it currently hangs after generating dist/. Instead we ship a static
// `public/manifest.webmanifest` so the app remains installable. Adding a
// service worker for offline support is captured in the README roadmap.
export default defineConfig({
  plugins: [react()],
});
