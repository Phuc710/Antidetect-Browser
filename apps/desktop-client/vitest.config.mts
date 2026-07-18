import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      shared: resolve(import.meta.dirname, '../../packages/shared/src/index.ts'),
      electron: resolve(import.meta.dirname, 'src/main/test/electron-stub.ts'),
    },
  },
  test: {
    environment: 'node',
    globals: false,
    restoreMocks: true,
    include: [
      'src/main/**/*.unit.test.ts',
      'src/main/services/__tests__/*.test.ts',
    ],
    exclude: ['src/main/**/*.integration.test.ts'],
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
});
