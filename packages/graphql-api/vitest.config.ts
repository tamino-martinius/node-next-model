import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@next-model/core': path.resolve(__dirname, '../core/src/index.ts'),
    },
    // graphql has an ESM/CJS exports map; without dedupe vitest can load both
    // copies, which trips the "cannot use GraphQLSchema from another realm" check.
    dedupe: ['graphql'],
  },
  test: {
    globals: true,
    include: ['src/**/*.{test,spec}.ts'],
    coverage: {
      reporter: ['text', 'json-summary'],
      include: ['src/**/*.ts'],
      exclude: ['src/__tests__/**', 'src/index.ts'],
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 60,
      },
    },
  },
});
