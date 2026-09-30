import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_');
  // Pedidos ao Supabase: o endereço do projeto, ou qualquer *.supabase.co se não estiver definido
  const supabase = env.VITE_SUPABASE_URL ? escapar(env.VITE_SUPABASE_URL.replace(/\/$/, '')) : 'https://[^/]+\\.supabase\\.co';

  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        // Não recarrega sozinho: a app mostra "Nova versão disponível" (pode haver um formulário a meio)
        registerType: 'prompt',
        injectRegister: null,
        includeAssets: ['icone.svg', 'apple-touch-icon.png'],
        manifest: {
          id: '/',
          name: 'Liga recreativa',
          short_name: 'Liga',
          description: 'Tabelas, jogos, marcadores e resultados das competições, em tempo real.',
          lang: 'pt',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          background_color: '#F6F8F4',
          theme_color: '#1E6B45',
          categories: ['sports'],
          icons: [
            { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
            { src: '/pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
            { src: '/icone.svg', sizes: 'any', type: 'image/svg+xml' },
          ],
          shortcuts: [
            { name: 'Área da equipa', url: '/equipa', icons: [{ src: '/pwa-192.png', sizes: '192x192' }] },
            { name: 'Gestão da liga', url: '/admin', icons: [{ src: '/pwa-192.png', sizes: '192x192' }] },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
          // Qualquer endereço da app abre o index.html (a app é uma página só)
          navigateFallback: '/index.html',
          // /api/* é do servidor (funções do Cloudflare), nunca da app
          navigateFallbackDenylist: [/^\/api\//],
          // Receber e mostrar as notificações push (public/sw-notificacoes.js)
          importScripts: ['/sw-notificacoes.js'],
          cleanupOutdatedCaches: true,
          runtimeCaching: [
            {
              // Dados públicos: rede primeiro; sem rede, os últimos guardados.
              // Dados pessoais dos jogadores e emails dos responsáveis nunca ficam no aparelho.
              urlPattern: new RegExp(`^${supabase}/rest/v1/(?!jogadores_privado|responsaveis|rpc/)`),
              method: 'GET',
              handler: 'NetworkFirst',
              options: {
                cacheName: 'liga-dados',
                networkTimeoutSeconds: 6,
                expiration: { maxEntries: 300, maxAgeSeconds: 14 * 24 * 3600 },
                cacheableResponse: { statuses: [200] },
              },
            },
            {
              // Emblemas e fotos: cada ficheiro novo tem nome novo, por isso nunca muda
              urlPattern: new RegExp(`^${supabase}/storage/v1/object/public/`),
              handler: 'CacheFirst',
              options: {
                cacheName: 'liga-imagens',
                expiration: { maxEntries: 400, maxAgeSeconds: 90 * 24 * 3600 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\//,
              handler: 'StaleWhileRevalidate',
              options: { cacheName: 'liga-fontes-css' },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\//,
              handler: 'CacheFirst',
              options: {
                cacheName: 'liga-fontes',
                expiration: { maxEntries: 20, maxAgeSeconds: 365 * 24 * 3600 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
      }),
    ],
    test: { environment: 'node' },
  };
});
