import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';

function externalizeSonnerStyles(): Plugin {
  return {
    name: 'maktab-externalize-sonner-styles',
    enforce: 'pre',
    transform(code, id) {
      if (!/[\\/]sonner[\\/]dist[\\/]index\.mjs(?:\?|$)/.test(id)) return null;
      const transformed = code.replace(/__insertCSS\("(?:[^"\\]|\\.)*"\);/, '');
      if (transformed === code) {
        throw new Error('Sonner inline CSS injection signature changed; review the desktop CSP integration.');
      }
      return { code: transformed, map: null };
    },
  };
}

function useCspSafeScrollLock(): Plugin {
  return {
    name: 'maktab-csp-safe-scroll-lock',
    enforce: 'pre',
    resolveId(source) {
      if (source !== 'react-remove-scroll-bar') return null;
      return path.resolve(__dirname, './src/lib/csp-remove-scroll-bar.tsx');
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    externalizeSonnerStyles(),
    useCspSafeScrollLock(),
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
    }),
    react(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/features': path.resolve(__dirname, './src/features'),
      '@/lib': path.resolve(__dirname, './src/lib'),
      '@/hooks': path.resolve(__dirname, './src/hooks'),
      '@/stores': path.resolve(__dirname, './src/stores'),
      '@/schemas': path.resolve(__dirname, './src/schemas'),
      '@/i18n': path.resolve(__dirname, './src/i18n'),
      '@/types': path.resolve(__dirname, './src/types'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    host: true,
    proxy: {
      '/local-api/v1': {
        target: process.env.VITE_LOCAL_API_PROXY_TARGET || 'http://127.0.0.1:4000',
        changeOrigin: true,
      },
      '/api/v1': {
        target: process.env.VITE_PLATFORM_API_PROXY_TARGET || 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
