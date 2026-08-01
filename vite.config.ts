import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { resolveBasePath } from './build/basePath';

const base = resolveBasePath({
  githubActions: process.env.GITHUB_ACTIONS,
  repository: process.env.GITHUB_REPOSITORY,
});

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: [
        'favicon.svg',
        'icons/apple-touch-icon.png',
      ],
      manifest: {
        id: base,
        name: 'My家計簿',
        short_name: 'My家計簿',
        description: 'iPhoneで使う、自分専用の家計簿PWA',
        lang: 'ja-JP',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait-primary',
        background_color: '#f7f7f5',
        theme_color: '#f7f7f5',
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: `${base}index.html`,
        cleanupOutdatedCaches: true,
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
  },
});
