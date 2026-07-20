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
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
