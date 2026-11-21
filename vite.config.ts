import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serviert das Repo unter https://<user>.github.io/gym-app/
const BASE = '/gym-app/';

const VERSION = `${new Date().toISOString().slice(0, 10)}${process.env.GITHUB_SHA ? ` (${process.env.GITHUB_SHA.slice(0, 7)})` : ''}`;

export default defineConfig({
  base: BASE,
  define: {
    __APP_VERSION__: JSON.stringify(VERSION),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Gym',
        short_name: 'Gym',
        description: 'Trainings-Tracker fürs Fitnessstudio',
        lang: 'de',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0e1013',
        theme_color: '#0e1013',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico,webmanifest}'],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
