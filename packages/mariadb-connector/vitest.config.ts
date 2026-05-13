import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@next-model/core': path.resolve(__dirname, '../core/src/index.ts'),
      '@next-model/conformance': path.resolve(__dirname, '../core/src/__tests__/conformance.ts'),
      '@next-model/mysql-connector': path.resolve(__dirname, '../mysql-connector/src/index.ts'),
    },
  },
  test: {
    globals: true,
    include: ['src/**/*.{test,spec}.ts'],
    coverage: {
      reporter: ['text', 'json-summary'],
      include: ['src/**/*.ts'],
      exclude: ['src/__tests__/**', 'src/index.ts'],
      thresholds: {
        lines: 70,
        statements: 70,
        functions: 75,
        branches: 45,
      },
    },
  },
});
