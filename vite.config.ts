/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Guide Dofus',
        short_name: 'Guide Dofus',
        description: 'Guides Ganymède sur iPhone, multi-personnages (usage personnel).',
        lang: 'fr',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '.',
        scope: '.',
        background_color: '#14161a',
        theme_color: '#14161a',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Seule la coquille de l'appli est mise en cache par le SW.
        // Les données de l'API sont gérées explicitement dans IndexedDB.
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: 'index.html',
        // Images des guides (DofusDB, Ganymède, imgur…) : mises en cache à la
        // première lecture pour fonctionner hors-ligne ensuite. Réponses
        // opaques (pas de CORS) acceptées.
        runtimeCaching: [
          {
            urlPattern: ({ request, sameOrigin }) => request.destination === 'image' && !sameOrigin,
            handler: 'CacheFirst',
            options: {
              cacheName: 'guide-images',
              cacheableResponse: { statuses: [0, 200] },
              expiration: {
                maxEntries: 1500,
                maxAgeSeconds: 60 * 60 * 24 * 90,
                purgeOnQuotaError: true,
              },
            },
          },
        ],
      },
    }),
  ],
  server: { host: true },
  preview: { host: true },
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
  },
});
