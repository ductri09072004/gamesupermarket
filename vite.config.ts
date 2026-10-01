import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

/** Tăng số này khi thay file model/texture/hdri CÙNG TÊN để người chơi tải lại bản mới (cache cũ bị xoá). */
const ASSET_CACHE = 'game-assets-v1';
const GAME_ASSETS = /\/assets\/(models|textures|hdri|audio)\//;

export default defineConfig({
  base: './',
  build: {
    chunkSizeWarningLimit: 2000,
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Mini Mart Tycoon 3D',
        short_name: 'Mini Mart',
        description: 'Game vận hành tiệm tạp hoá góc nhìn thứ nhất trong hẻm phố Việt.',
        lang: 'vi',
        start_url: '.',
        scope: '.',
        display: 'fullscreen',
        display_override: ['fullscreen', 'standalone'],
        orientation: 'landscape',
        background_color: '#2a1b10',
        theme_color: '#2a1b10',
        categories: ['games'],
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Chỉ precache "vỏ" app (js/css/html/icon/font nhỏ + assets/manifest.json); ~75MB model + texture nạp lúc chơi rồi mới cache
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,json}'],
        globIgnores: ['assets/models/**', 'assets/textures/**', 'assets/hdri/**'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: GAME_ASSETS,
            handler: 'CacheFirst',
            options: {
              cacheName: ASSET_CACHE,
              expiration: { maxEntries: 600, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [200] },
              rangeRequests: true,
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts', cacheableResponse: { statuses: [0, 200] } },
          },
        ],
      },
    }),
  ],
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
