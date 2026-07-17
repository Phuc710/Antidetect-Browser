import { resolve } from 'path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: ['shared'] })],
    resolve: {
      alias: {
        '@main': resolve('src/main'),
        '@shared': resolve('../../packages/shared/src'),
      },
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/main/index.ts'),
        },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin({ exclude: ['shared'] })],
    resolve: {
      alias: {
        '@preload': resolve('src/preload'),
        '@shared': resolve('../../packages/shared/src'),
      },
    },
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer'),
        '@shared': resolve('../../packages/shared/src'),
        '@': resolve('src/renderer'),
      },
    },
    plugins: [react()],
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/renderer/index.html'),
        },
      },
    },
  },
});
