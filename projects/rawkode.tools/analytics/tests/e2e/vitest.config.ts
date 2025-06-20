import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 60000, // 60 seconds for e2e tests
    hookTimeout: 30000, // 30 seconds for setup/teardown
    environment: 'node',
    globals: true,
    reporters: ['verbose'],
    logHeapUsage: true,
  },
});