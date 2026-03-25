import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/test/**', 'src/**/*.test.ts'],
    },
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      '@ev-bike-rental/shared': '../../packages/shared/src/index.ts',
    },
  },
});
