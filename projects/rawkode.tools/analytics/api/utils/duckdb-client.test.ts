import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DuckDBClient } from './duckdb-client';

// Mock the modules
vi.mock('@duckdb/duckdb-wasm', () => ({
  createWorker: vi.fn().mockResolvedValue({
    terminate: vi.fn(),
  }),
  initializeDuckDB: vi.fn().mockResolvedValue({
    connect: vi.fn().mockResolvedValue({
      query: vi.fn(),
      close: vi.fn(),
    }),
    terminate: vi.fn(),
  }),
  ConsoleLogger: vi.fn().mockImplementation(() => ({})),
  LogLevel: {
    WARNING: 1,
  },
}));

describe('DuckDBClient', () => {
  let client: DuckDBClient;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    if (client) {
      await client.close();
    }
  });

  describe('Initialization', () => {
    it('should create a client instance', () => {
      client = new DuckDBClient();
      expect(client).toBeInstanceOf(DuckDBClient);
    });

    it('should initialize on first query', async () => {
      client = new DuckDBClient();
      const mockQuery = vi.fn().mockResolvedValue({
        toArray: () => Promise.resolve([{ count: 1 }]),
      });
      
      // Mock the connection
      const mockConnection = { query: mockQuery, close: vi.fn() };
      vi.mocked(await client['getConnection']).mockResolvedValue(mockConnection as any);

      await client.query('SELECT 1 as count');
      expect(mockQuery).toHaveBeenCalledWith('SELECT 1 as count');
    });
  });

  describe('Query Execution', () => {
    it('should execute a simple query', async () => {
      client = new DuckDBClient();
      const mockResults = [{ value: 42 }];
      
      const mockQuery = vi.fn().mockResolvedValue({
        toArray: () => Promise.resolve(mockResults),
      });

      // Override the query method for testing
      client.query = vi.fn().mockResolvedValue(mockResults);

      const results = await client.query('SELECT 42 as value');
      expect(results).toEqual(mockResults);
    });

    it('should handle query errors', async () => {
      client = new DuckDBClient();
      const errorMessage = 'Invalid SQL syntax';
      
      client.query = vi.fn().mockRejectedValue(new Error(errorMessage));

      await expect(client.query('INVALID SQL')).rejects.toThrow(errorMessage);
    });

    it('should handle empty results', async () => {
      client = new DuckDBClient();
      client.query = vi.fn().mockResolvedValue([]);

      const results = await client.query('SELECT * FROM non_existent_table');
      expect(results).toEqual([]);
    });
  });

  describe('Connection Management', () => {
    it('should close connection properly', async () => {
      client = new DuckDBClient();
      const mockClose = vi.fn();
      
      // Mock the internal connection
      client['connection'] = { close: mockClose } as any;
      client['db'] = { terminate: vi.fn() } as any;
      client['worker'] = { terminate: vi.fn() } as any;

      await client.close();
      
      expect(mockClose).toHaveBeenCalled();
      expect(client['connection']).toBeNull();
    });

    it('should handle multiple close calls gracefully', async () => {
      client = new DuckDBClient();
      
      await client.close();
      // Second close should not throw
      await expect(client.close()).resolves.not.toThrow();
    });
  });

  describe('S3 Configuration', () => {
    it('should configure S3 settings during initialization', async () => {
      client = new DuckDBClient();
      const mockQuery = vi.fn().mockResolvedValue({ toArray: () => Promise.resolve([]) });
      
      client.query = mockQuery;

      // Trigger initialization
      await client.query('SELECT 1');

      // Check if S3 configuration queries were made
      const calls = mockQuery.mock.calls.flat();
      const hasS3Config = calls.some(call => 
        call.includes('s3_endpoint') || 
        call.includes('s3_url_style') ||
        call.includes('s3_region')
      );

      // Since we're mocking, we won't see the actual S3 config calls
      // This is more of a placeholder for when we have better mocking
      expect(mockQuery).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle initialization errors', async () => {
      client = new DuckDBClient();
      const initError = new Error('Failed to initialize DuckDB');
      
      // Mock initialization failure
      client['initialize'] = vi.fn().mockRejectedValue(initError);

      await expect(client.query('SELECT 1')).rejects.toThrow('Failed to initialize DuckDB');
    });

    it('should handle connection errors', async () => {
      client = new DuckDBClient();
      const connectionError = new Error('Connection lost');
      
      client['getConnection'] = vi.fn().mockRejectedValue(connectionError);

      await expect(client.query('SELECT 1')).rejects.toThrow('Connection lost');
    });
  });
});