import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/test/**',
        'src/**/*.test.ts',
        'src/__tests__/**',
        'src/db/index.ts',
        'src/db/seed.ts',
        'src/db/schema.ts',
        'src/index.ts',
      ],
    },
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      '@ev-bike-rental/shared': '../../packages/shared/src/index.ts',
    },
  },
});
