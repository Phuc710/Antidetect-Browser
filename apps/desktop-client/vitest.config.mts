import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      shared: resolve(import.meta.dirname, '../../packages/shared/src/index.ts'),
      'fingerprint-generator': resolve(import.meta.dirname, '../../packages/fingerprint-generator/src/index.ts'),
      'fingerprint-injector': resolve(import.meta.dirname, '../../packages/fingerprint-injector/src/index.ts'),
      'header-generator': resolve(import.meta.dirname, '../../packages/header-generator/src/index.ts'),
      'generative-bayesian-network': resolve(import.meta.dirname, '../../packages/generative-bayesian-network/src/index.ts'),
      electron: resolve(import.meta.dirname, 'src/main/test/electron-stub.ts'),
    },
  },
  test: {
    server: {
      deps: {
        inline: ['fingerprint-generator', 'fingerprint-injector'],
      },
    },
    environment: 'node',
    globals: false,
    restoreMocks: true,
    include: [
      'src/main/**/*.unit.test.ts',
      'src/main/services/__tests__/*.test.ts',
      'src/renderer/**/*.test.{ts,tsx}',
    ],
    exclude: ['src/main/**/*.integration.test.ts'],
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
});
