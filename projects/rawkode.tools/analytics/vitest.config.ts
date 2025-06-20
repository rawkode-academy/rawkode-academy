import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['node_modules', 'dist', 'build', 'target', 'pipeline/*/target'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules',
        'dist',
        'build',
        'target',
        '**/*.d.ts',
        '**/*.config.*',
        '**/__tests__/**',
        '**/*.test.*',
        '**/*.spec.*',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
    },
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '@api': path.resolve(__dirname, './api'),
      '@utils': path.resolve(__dirname, './api/utils'),
    },
  },
});