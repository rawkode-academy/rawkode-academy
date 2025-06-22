import { vi } from 'vitest';

// Mock global fetch
global.fetch = vi.fn();

// Mock Worker for DuckDB tests
global.Worker = vi.fn().mockImplementation(() => ({
  postMessage: vi.fn(),
  terminate: vi.fn(),
})) as any;

// Mock URL.createObjectURL
global.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');

// Mock Cloudflare Workers runtime globals
global.Response = Response;
global.Request = Request;
global.Headers = Headers;

// Add console output for test debugging
console.log('Starting test suite...');

// Cleanup after each test
afterEach(() => {
  vi.clearAllMocks();
});

// Final cleanup
afterAll(() => {
  console.log('Test suite completed.');
});