import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyticsResolver } from './analytics';
import { DuckDBClient } from '../utils/duckdb-client';
import { QueryBuilder } from '../utils/query-builder';

// Mock DuckDBClient
vi.mock('../utils/duckdb-client', () => ({
  DuckDBClient: vi.fn().mockImplementation(() => ({
    initialize: vi.fn(),
    query: vi.fn(),
    close: vi.fn(),
  })),
}));

// Mock QueryBuilder
vi.mock('../utils/query-builder', () => ({
  QueryBuilder: vi.fn().mockImplementation(() => {
    const builder = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      build: vi.fn().mockReturnValue('SELECT * FROM events'),
    };
    return builder;
  }),
  addTimeRangeConditions: vi.fn(),
}));

describe('Analytics Resolvers', () => {
  let mockClient: any;
  let mockContext: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockClient = {
      initialize: vi.fn(),
      query: vi.fn(),
      close: vi.fn(),
    };
    
    vi.mocked(DuckDBClient).mockImplementation(() => mockClient);
    
    mockContext = {
      env: {
        ANALYTICS_SOURCE: {} as any,
        ANALYTICS_PROCESSED: {} as any,
        ANALYTICS_CATALOG: {} as any,
        ANALYTICS_ENGINE: {} as any,
        NODE_ENV: 'test',
      },
    };
  });

  describe('eventCounts', () => {
    it('should return event counts for a time range', async () => {
      const mockResults = [
        { event_type: 'page_view', count: 100 },
        { event_type: 'click', count: 50 },
      ];
      mockClient.query.mockResolvedValue(mockResults);

      const args = {
        timeRange: {
          start: '2024-01-01T00:00:00Z',
          end: '2024-01-31T23:59:59Z',
        },
      };

      const result = await analyticsResolver.eventCounts({}, args, mockContext);

      expect(mockClient.initialize).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalled();
      expect(mockClient.close).toHaveBeenCalled();
      
      expect(result).toEqual([
        { dimensions: JSON.stringify({ event_type: 'page_view' }), count: 100 },
        { dimensions: JSON.stringify({ event_type: 'click' }), count: 50 },
      ]);
    });

    it('should apply event type filter when provided', async () => {
      mockClient.query.mockResolvedValue([]);

      const args = {
        eventType: 'page_view',
        timeRange: {
          start: '2024-01-01T00:00:00Z',
          end: '2024-01-31T23:59:59Z',
        },
      };

      await analyticsResolver.eventCounts({}, args, mockContext);

      const queryBuilder = vi.mocked(QueryBuilder).mock.results[0].value;
      expect(queryBuilder.where).toHaveBeenCalledWith('type', '=', 'page_view');
    });

    it('should handle empty results', async () => {
      mockClient.query.mockResolvedValue([]);

      const args = {
        timeRange: {
          start: '2024-01-01T00:00:00Z',
          end: '2024-01-31T23:59:59Z',
        },
      };

      const result = await analyticsResolver.eventCounts({}, args, mockContext);

      expect(result).toEqual([]);
    });

    it('should handle query errors', async () => {
      mockClient.query.mockRejectedValue(new Error('Query failed'));

      const args = {
        timeRange: {
          start: '2024-01-01T00:00:00Z',
          end: '2024-01-31T23:59:59Z',
        },
      };

      await expect(
        analyticsResolver.eventCounts({}, args, mockContext)
      ).rejects.toThrow('Query failed');
      
      // Ensure close is still called on error
      expect(mockClient.close).toHaveBeenCalled();
    });

    it('should group by specified columns', async () => {
      const mockResults = [
        { event_type: 'page_view', source: 'web', count: 100 },
        { event_type: 'click', source: 'mobile', count: 50 },
      ];
      mockClient.query.mockResolvedValue(mockResults);

      const args = {
        groupBy: ['event_type', 'source'],
      };

      const result = await analyticsResolver.eventCounts({}, args, mockContext);

      const queryBuilder = vi.mocked(QueryBuilder).mock.results[0].value;
      expect(queryBuilder.select).toHaveBeenCalledWith('event_type', 'source', 'COUNT(*) as count');
      expect(queryBuilder.groupBy).toHaveBeenCalledWith('event_type', 'source');
      
      expect(result).toEqual([
        { dimensions: JSON.stringify({ event_type: 'page_view', source: 'web' }), count: 100 },
        { dimensions: JSON.stringify({ event_type: 'click', source: 'mobile' }), count: 50 },
      ]);
    });

    it('should filter out invalid columns from groupBy', async () => {
      mockClient.query.mockResolvedValue([]);

      const args = {
        groupBy: ['event_type', 'invalid_column', 'source'],
      };

      await analyticsResolver.eventCounts({}, args, mockContext);

      const queryBuilder = vi.mocked(QueryBuilder).mock.results[0].value;
      expect(queryBuilder.select).toHaveBeenCalledWith('event_type', 'source', 'COUNT(*) as count');
      expect(queryBuilder.groupBy).toHaveBeenCalledWith('event_type', 'source');
    });
  });

  describe('rawQuery', () => {
    it('should execute SELECT queries in non-production', async () => {
      const mockResults = [{ id: 1, name: 'test' }];
      mockClient.query.mockResolvedValue(mockResults);

      const args = {
        query: "SELECT * FROM read_parquet('s3://analytics-source/events/2024/*.parquet')",
      };

      const result = await analyticsResolver.rawQuery({}, args, mockContext);

      expect(mockClient.initialize).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith(args.query);
      expect(mockClient.close).toHaveBeenCalled();
      
      expect(result).toBe(JSON.stringify(mockResults, null, 2));
    });

    it('should reject queries in production environment', async () => {
      mockContext.env.NODE_ENV = 'production';

      const args = {
        query: 'SELECT * FROM events',
      };

      await expect(
        analyticsResolver.rawQuery({}, args, mockContext)
      ).rejects.toThrow('Raw queries are disabled in production for security reasons');
    });

    it('should reject non-SELECT queries', async () => {
      const args = {
        query: 'UPDATE events SET status = "deleted"',
      };

      await expect(
        analyticsResolver.rawQuery({}, args, mockContext)
      ).rejects.toThrow('Only SELECT queries are allowed');
    });

    it('should reject queries with forbidden keywords', async () => {
      const forbiddenQueries = [
        'SELECT * FROM events; DROP TABLE events',
        'SELECT * FROM events WHERE id = 1 OR DELETE FROM events',
        'SELECT * FROM events; INSERT INTO events VALUES (1, 2, 3)',
        'SELECT * FROM events UNION SELECT * FROM users',
      ];

      for (const query of forbiddenQueries) {
        await expect(
          analyticsResolver.rawQuery({}, { query }, mockContext)
        ).rejects.toThrow();
      }
    });

    it('should reject queries with suspicious patterns', async () => {
      const suspiciousQueries = [
        'SELECT * FROM events WHERE id = 1 OR 1=1 OR id = 2',
        'SELECT * FROM events -- DROP TABLE',
        'SELECT * FROM events /* comment */ DROP TABLE',
        'SELECT SLEEP(10)',
        'SELECT * FROM events WHERE name = CHAR(65,66,67)',
        'SELECT * FROM events WHERE id = 0x1234',
      ];

      for (const query of suspiciousQueries) {
        await expect(
          analyticsResolver.rawQuery({}, { query }, mockContext)
        ).rejects.toThrow('Query contains suspicious patterns');
      }
    });

    it('should reject queries not reading from allowed tables', async () => {
      const args = {
        query: 'SELECT * FROM secret_table',
      };

      await expect(
        analyticsResolver.rawQuery({}, args, mockContext)
      ).rejects.toThrow('Query must read from allowed analytics tables only');
    });

    it('should allow queries reading from analytics tables', async () => {
      mockClient.query.mockResolvedValue([]);

      const validQueries = [
        "SELECT * FROM read_parquet('s3://analytics-source/events/2024/*.parquet')",
        "SELECT * FROM read_parquet('s3://analytics-processed/aggregated/daily/*.parquet')",
      ];

      for (const query of validQueries) {
        await expect(
          analyticsResolver.rawQuery({}, { query }, mockContext)
        ).resolves.toBe('[]');
      }
    });

    it('should close client even on error', async () => {
      mockClient.query.mockRejectedValue(new Error('Query failed'));

      const args = {
        query: "SELECT * FROM read_parquet('s3://analytics-source/events/*.parquet')",
      };

      await expect(
        analyticsResolver.rawQuery({}, args, mockContext)
      ).rejects.toThrow('Query failed');
      
      expect(mockClient.close).toHaveBeenCalled();
    });
  });
});