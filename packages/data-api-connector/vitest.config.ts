import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.{test,spec}.ts'],
    coverage: {
      include: ['src/**/*.ts'],
      exclude: ['src/__benchmark__/**', 'src/__tests__/**', 'src/__mocks__/**'],
    },
  },
});
