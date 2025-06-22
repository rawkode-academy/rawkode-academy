import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DuckDBClient } from './duckdb-client';
import type { Env } from '../types';

// Mock the modules
vi.mock('@duckdb/duckdb-wasm', () => ({
  getJsDelivrBundles: vi.fn().mockReturnValue([
    {
      mainModule: 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm/dist/duckdb.wasm',
      mainWorker: 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm/dist/duckdb-browser.worker.js',
      pthreadWorker: 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm/dist/pthread.worker.js',
    },
  ]),
  selectBundle: vi.fn().mockResolvedValue({
    mainModule: 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm/dist/duckdb.wasm',
    mainWorker: 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm/dist/duckdb-browser.worker.js',
    pthreadWorker: 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm/dist/pthread.worker.js',
  }),
  ConsoleLogger: vi.fn().mockImplementation(() => ({})),
  AsyncDuckDB: vi.fn().mockImplementation(() => ({
    instantiate: vi.fn(),
    connect: vi.fn().mockResolvedValue({
      query: vi.fn(),
      close: vi.fn(),
    }),
    terminate: vi.fn(),
  })),
}));

// Mock Worker
global.Worker = vi.fn().mockImplementation(() => ({})) as any;
global.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');

describe('DuckDBClient', () => {
  let client: DuckDBClient;
  let mockEnv: Env;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockEnv = {
      ANALYTICS_SOURCE: {} as any,
      ANALYTICS_PROCESSED: {} as any,
      ANALYTICS_CATALOG: {} as any,
      ANALYTICS_ENGINE: {} as any,
      R2_ENDPOINT: 'https://test.r2.cloudflarestorage.com',
      R2_ACCESS_KEY_ID: 'test-access-key',
      R2_SECRET_ACCESS_KEY: 'test-secret-key',
    };
  });

  afterEach(async () => {
    if (client) {
      await client.close();
    }
  });

  describe('Initialization', () => {
    it('should create a client instance', () => {
      client = new DuckDBClient(mockEnv);
      expect(client).toBeInstanceOf(DuckDBClient);
    });

    it('should initialize DuckDB on first use', async () => {
      client = new DuckDBClient(mockEnv);
      
      const mockResult = {
        toArray: vi.fn().mockReturnValue([{ toJSON: () => ({ count: 1 }) }]),
      };
      
      const mockConnection = {
        query: vi.fn().mockResolvedValue(mockResult),
        close: vi.fn(),
      };
      
      const { AsyncDuckDB } = await import('@duckdb/duckdb-wasm');
      const mockAsyncDuckDB = vi.mocked(AsyncDuckDB).mock.results[0].value;
      mockAsyncDuckDB.connect = vi.fn().mockResolvedValue(mockConnection);
      
      await client.initialize();
      
      expect(AsyncDuckDB).toHaveBeenCalled();
      expect(mockAsyncDuckDB.instantiate).toHaveBeenCalled();
      expect(mockAsyncDuckDB.connect).toHaveBeenCalled();
    });

    it('should configure S3 settings during initialization', async () => {
      client = new DuckDBClient(mockEnv);
      
      const mockConnection = {
        query: vi.fn().mockResolvedValue({ toArray: () => [] }),
        close: vi.fn(),
      };
      
      const { AsyncDuckDB } = await import('@duckdb/duckdb-wasm');
      const mockAsyncDuckDB = vi.mocked(AsyncDuckDB).mock.results[0].value;
      mockAsyncDuckDB.connect = vi.fn().mockResolvedValue(mockConnection);
      
      await client.initialize();
      
      // Check S3 configuration queries
      const queries = mockConnection.query.mock.calls.map(call => call[0]);
      expect(queries).toContain('INSTALL httpfs;');
      expect(queries).toContain('LOAD httpfs;');
      expect(queries.some(q => q.includes('SET s3_region='))).toBe(true);
      expect(queries.some(q => q.includes('SET s3_endpoint='))).toBe(true);
      expect(queries.some(q => q.includes('SET s3_access_key_id='))).toBe(true);
    });
  });

  describe('Query Execution', () => {
    it('should execute a simple query', async () => {
      client = new DuckDBClient(mockEnv);
      
      const mockResults = [{ toJSON: () => ({ value: 42 }) }];
      const mockResult = {
        toArray: vi.fn().mockReturnValue(mockResults),
      };
      
      const mockConnection = {
        query: vi.fn().mockResolvedValue(mockResult),
        close: vi.fn(),
      };
      
      const { AsyncDuckDB } = await import('@duckdb/duckdb-wasm');
      const mockAsyncDuckDB = vi.mocked(AsyncDuckDB).mock.results[0].value;
      mockAsyncDuckDB.connect = vi.fn().mockResolvedValue(mockConnection);
      
      await client.initialize();
      const results = await client.query('SELECT 42 as value');
      
      expect(results).toEqual([{ value: 42 }]);
    });

    it('should handle query errors', async () => {
      client = new DuckDBClient(mockEnv);
      
      const mockConnection = {
        query: vi.fn().mockRejectedValue(new Error('Invalid SQL syntax')),
        close: vi.fn(),
      };
      
      const { AsyncDuckDB } = await import('@duckdb/duckdb-wasm');
      const mockAsyncDuckDB = vi.mocked(AsyncDuckDB).mock.results[0].value;
      mockAsyncDuckDB.connect = vi.fn().mockResolvedValue(mockConnection);
      
      await client.initialize();
      
      await expect(client.query('INVALID SQL')).rejects.toThrow('Query failed: Error: Invalid SQL syntax');
    });

    it('should handle empty results', async () => {
      client = new DuckDBClient(mockEnv);
      
      const mockResult = {
        toArray: vi.fn().mockReturnValue([]),
      };
      
      const mockConnection = {
        query: vi.fn().mockResolvedValue(mockResult),
        close: vi.fn(),
      };
      
      const { AsyncDuckDB } = await import('@duckdb/duckdb-wasm');
      const mockAsyncDuckDB = vi.mocked(AsyncDuckDB).mock.results[0].value;
      mockAsyncDuckDB.connect = vi.fn().mockResolvedValue(mockConnection);
      
      await client.initialize();
      const results = await client.query('SELECT * FROM non_existent_table');
      
      expect(results).toEqual([]);
    });

    it('should throw error if not initialized', async () => {
      client = new DuckDBClient(mockEnv);
      
      await expect(client.query('SELECT 1')).rejects.toThrow('DuckDB connection not initialized');
    });
  });

  describe('Connection Management', () => {
    it('should close connection properly', async () => {
      client = new DuckDBClient(mockEnv);
      
      const mockConnection = {
        query: vi.fn().mockResolvedValue({ toArray: () => [] }),
        close: vi.fn(),
      };
      
      const { AsyncDuckDB } = await import('@duckdb/duckdb-wasm');
      const mockAsyncDuckDB = vi.mocked(AsyncDuckDB).mock.results[0].value;
      mockAsyncDuckDB.connect = vi.fn().mockResolvedValue(mockConnection);
      mockAsyncDuckDB.terminate = vi.fn();
      
      await client.initialize();
      await client.close();
      
      expect(mockConnection.close).toHaveBeenCalled();
      expect(mockAsyncDuckDB.terminate).toHaveBeenCalled();
    });

    it('should handle multiple close calls gracefully', async () => {
      client = new DuckDBClient(mockEnv);
      
      await client.close();
      // Second close should not throw
      await expect(client.close()).resolves.not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should log and rethrow query errors', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      client = new DuckDBClient(mockEnv);
      
      const queryError = new Error('Query execution failed');
      const mockConnection = {
        query: vi.fn().mockRejectedValue(queryError),
        close: vi.fn(),
      };
      
      const { AsyncDuckDB } = await import('@duckdb/duckdb-wasm');
      const mockAsyncDuckDB = vi.mocked(AsyncDuckDB).mock.results[0].value;
      mockAsyncDuckDB.connect = vi.fn().mockResolvedValue(mockConnection);
      
      await client.initialize();
      
      await expect(client.query('SELECT 1')).rejects.toThrow('Query failed: Error: Query execution failed');
      expect(consoleErrorSpy).toHaveBeenCalledWith('DuckDB query error:', queryError);
      
      consoleErrorSpy.mockRestore();
    });

    it('should handle result conversion errors', async () => {
      client = new DuckDBClient(mockEnv);
      
      const mockResult = {
        toArray: vi.fn().mockImplementation(() => {
          throw new Error('Conversion failed');
        }),
      };
      
      const mockConnection = {
        query: vi.fn().mockResolvedValue(mockResult),
        close: vi.fn(),
      };
      
      const { AsyncDuckDB } = await import('@duckdb/duckdb-wasm');
      const mockAsyncDuckDB = vi.mocked(AsyncDuckDB).mock.results[0].value;
      mockAsyncDuckDB.connect = vi.fn().mockResolvedValue(mockConnection);
      
      await client.initialize();
      
      await expect(client.query('SELECT 1')).rejects.toThrow('Query failed: Error: Conversion failed');
    });
  });
});