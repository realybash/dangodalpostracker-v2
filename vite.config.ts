import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
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
      tailwindcss()
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
