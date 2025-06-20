// Test setup file for Vitest
import { beforeAll, afterAll, afterEach } from 'vitest';

// Mock environment variables for tests
process.env.NODE_ENV = 'test';

// Setup test environment
beforeAll(() => {
  // Add any global test setup here
  console.log('Starting test suite...');
});

// Cleanup after each test
afterEach(() => {
  // Clear any mocks or test data
});

// Global teardown
afterAll(() => {
  // Add any global cleanup here
  console.log('Test suite completed.');
});

// Mock fetch for tests (if needed)
global.fetch = vi.fn();

// Mock console methods to reduce noise in tests
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
};

// Optionally suppress console output during tests
if (process.env.SUPPRESS_CONSOLE === 'true') {
  console.log = vi.fn();
  console.error = vi.fn();
  console.warn = vi.fn();
}

// Export utilities for tests
export { originalConsole };