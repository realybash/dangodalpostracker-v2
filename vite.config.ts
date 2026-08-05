import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import {defineConfig} from 'vite';

function optimizeLucide() {
  function camelToKebab(str: string) {
    return str
      .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
      .replace(/([a-zA-Z])([0-9])/g, "$1-$2")
      .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
      .toLowerCase();
  }

  return {
    name: 'optimize-lucide-react',
    transform(code: string, id: string) {
      if (!id.includes('/node_modules/') && (id.endsWith('.ts') || id.endsWith('.tsx') || id.endsWith('.js') || id.endsWith('.jsx'))) {
        if (code.includes('lucide-react')) {
          const transformed = code.replace(
            /import\s*\{([^}]+)\}\s*from\s*['"]lucide-react['"]/g,
            (_match, imports) => {
              const specifiers = imports.split(',').map((s: string) => s.trim()).filter(Boolean);
              const statements = specifiers.map((spec: string) => {
                const parts = spec.split(/\s+as\s+/);
                const importedName = parts[0].trim();
                const localName = parts[1] ? parts[1].trim() : importedName;
                const kebab = camelToKebab(importedName);
                return `import ${localName} from 'lucide-react/dist/esm/icons/${kebab}.js';`;
              });
              return statements.join('\n');
            }
          );
          return { code: transformed, map: null };
        }
      }
    }
  };
}

export default defineConfig(() => {
  return {
    plugins: [
      optimizeLucide(),
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        selfDestroying: true,
        devOptions: {
          enabled: false
        },
        manifest: {
          name: 'POS Tracker Pro',
          short_name: 'POS Tracker',
          description: 'A professional POS transaction tracker',
          theme_color: '#00B87A',
          background_color: '#ffffff',
          display: 'standalone',
          icons: [
            {
              src: 'https://cdn-icons-png.flaticon.com/512/5132/5132176.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'https://cdn-icons-png.flaticon.com/512/5132/5132176.png',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        },
        workbox: {
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            }
          ]
        }
      })
    ],
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      chunkSizeWarningLimit: 3500,
    },
    define: {
      'process.env.GOOGLE_MAPS_PLATFORM_KEY': JSON.stringify(process.env.GOOGLE_MAPS_PLATFORM_KEY || '')
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        'motion/react': path.resolve(__dirname, './src/lib/motion.tsx'),
        'framer-motion': path.resolve(__dirname, './src/lib/motion.tsx'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
