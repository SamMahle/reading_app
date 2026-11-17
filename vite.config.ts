import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';
import { APP_CONFIG } from './app.config.ts';

const alias = {
  '@': fileURLToPath(new URL('./src', import.meta.url)),
  '@content': fileURLToPath(new URL('./content', import.meta.url)),
};

export default defineConfig({
  // Relative base so the same build works at a domain root (Netlify) and
  // under a sub-path (GitHub Pages). Routing is hash-based.
  base: './',
  resolve: { alias },
  define: { __APP_VERSION__: JSON.stringify(APP_CONFIG.version) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['fonts/andika/*', 'icons/*'],
      manifest: {
        name: APP_CONFIG.name,
        short_name: APP_CONFIG.shortName,
        description: APP_CONFIG.description,
        display: 'standalone',
        orientation: 'any',
        start_url: './',
        scope: './',
        theme_color: APP_CONFIG.themeColor,
        background_color: APP_CONFIG.backgroundColor,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Precache everything: the app must cold-start with no network.
        globPatterns: ['**/*.{js,css,html,woff2,svg,png,ico,json,webmanifest,m4a,mp3,wav,txt}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        // Take control on the very first visit, so one online launch is enough.
        clientsClaim: true,
        navigateFallback: 'index.html',
      },
    }),
  ],
  // One bundle on purpose: the whole app is precached for offline use.
  build: { target: 'es2022', sourcemap: false, chunkSizeWarningLimit: 1500 },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    env: { TZ: 'UTC' },
    coverage: {
      provider: 'v8',
      include: ['src/engine/**/*.ts'],
      exclude: ['src/engine/types.ts'],
      reporter: ['text-summary', 'text'],
      thresholds: { lines: 95, statements: 95, functions: 95, branches: 85 },
    },
  },
});
