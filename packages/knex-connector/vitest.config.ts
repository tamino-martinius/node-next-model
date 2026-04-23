import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@next-model/core': path.resolve(__dirname, '../core/src/index.ts'),
    },
  },
  test: {
    globals: true,
    include: ['src/**/*.{test,spec}.ts'],
    coverage: {
      include: ['src/**/*.ts'],
      exclude: ['src/__benchmark__/**', 'src/__tests__/**', 'src/__mocks__/**'],
    },
  },
});
