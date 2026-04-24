import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@next-model/core': path.resolve(__dirname, '../core/src/index.ts'),
      '@next-model/conformance': path.resolve(__dirname, '../core/src/__tests__/conformance.ts'),
    },
  },
  test: {
    globals: true,
    include: ['src/**/*.{test,spec}.ts'],
    coverage: {
      include: ['src/**/*.ts'],
      exclude: ['src/__tests__/**'],
      thresholds: {
        lines: 75,
        statements: 75,
        functions: 80,
        branches: 60,
      },
    },
  },
});
