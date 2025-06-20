import { vi } from 'vitest';
import { DuckDBClient } from '@api/utils/duckdb-client';

/**
 * Creates a mock DuckDBClient for testing
 */
export function createMockDuckDBClient(queryResults: any[] = []) {
  const mockQuery = vi.fn();
  
  // Set up the mock to return different results for each call
  queryResults.forEach((result, index) => {
    mockQuery.mockResolvedValueOnce(result);
  });
  
  // Default to empty array for any additional calls
  mockQuery.mockResolvedValue([]);
  
  return {
    query: mockQuery,
    close: vi.fn(),
  } as unknown as DuckDBClient;
}

/**
 * Creates a mock context for testing GraphQL resolvers
 */
export function createMockContext(overrides: any = {}) {
  return {
    duckdb: createMockDuckDBClient(),
    env: {
      ANALYTICS_SOURCE_BUCKET: 'test-analytics-bucket',
      CATALOG_BUCKET: 'test-catalog-bucket',
      DB: {} as any,
      ...overrides.env,
    },
    ...overrides,
  };
}

/**
 * Creates a mock CloudEvent for testing
 */
export function createMockCloudEvent(overrides: any = {}) {
  return {
    specversion: '1.0',
    type: 'com.example.test',
    source: 'test-source',
    id: 'test-id-' + Math.random().toString(36).substr(2, 9),
    time: new Date().toISOString(),
    datacontenttype: 'application/json',
    data: {
      test: true,
    },
    ...overrides,
  };
}

/**
 * Creates mock Parquet data for testing
 */
export function createMockParquetData(eventType: string, count: number) {
  const events = [];
  const baseTime = new Date('2024-01-01T00:00:00Z');
  
  for (let i = 0; i < count; i++) {
    const time = new Date(baseTime.getTime() + i * 60000); // 1 minute apart
    events.push({
      event_id: `${eventType}-${i}`,
      event_type: eventType,
      time: time.toISOString(),
      source: 'test',
      data: JSON.stringify({
        index: i,
        test: true,
      }),
    });
  }
  
  return events;
}

/**
 * Creates a mock fetch response
 */
export function createMockFetchResponse(data: any, options: any = {}) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers(),
    json: vi.fn().mockResolvedValue(data),
    text: vi.fn().mockResolvedValue(JSON.stringify(data)),
    blob: vi.fn().mockResolvedValue(new Blob([JSON.stringify(data)])),
    arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
    formData: vi.fn().mockRejectedValue(new Error('Not implemented')),
    clone: vi.fn().mockReturnThis(),
    ...options,
  } as unknown as Response;
}

/**
 * Generates a time range for testing
 */
export function generateTimeRange(days: number = 7) {
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

/**
 * Asserts that a SQL query contains expected clauses
 */
export function assertSQLContains(query: string, expectedClauses: string[]) {
  const normalizedQuery = query.toLowerCase().replace(/\s+/g, ' ');
  
  for (const clause of expectedClauses) {
    const normalizedClause = clause.toLowerCase().replace(/\s+/g, ' ');
    if (!normalizedQuery.includes(normalizedClause)) {
      throw new Error(
        `Expected query to contain "${clause}" but got: ${query}`
      );
    }
  }
}

/**
 * Creates a mock R2 bucket for testing
 */
export function createMockR2Bucket() {
  const store = new Map<string, any>();
  
  return {
    put: vi.fn().mockImplementation(async (key: string, value: any) => {
      store.set(key, value);
      return { key };
    }),
    get: vi.fn().mockImplementation(async (key: string) => {
      const value = store.get(key);
      if (!value) return null;
      
      return {
        key,
        body: value,
        bodyUsed: false,
        arrayBuffer: () => Promise.resolve(value),
        text: () => Promise.resolve(value.toString()),
        json: () => Promise.resolve(JSON.parse(value.toString())),
      };
    }),
    delete: vi.fn().mockImplementation(async (key: string) => {
      store.delete(key);
    }),
    list: vi.fn().mockImplementation(async (options: any = {}) => {
      const keys = Array.from(store.keys());
      const filtered = options.prefix 
        ? keys.filter(k => k.startsWith(options.prefix))
        : keys;
        
      return {
        objects: filtered.map(key => ({ key })),
        truncated: false,
      };
    }),
    head: vi.fn().mockImplementation(async (key: string) => {
      return store.has(key) ? { key } : null;
    }),
  };
}

/**
 * Wait for all pending promises to resolve
 */
export async function flushPromises() {
  await new Promise(resolve => setImmediate(resolve));
}