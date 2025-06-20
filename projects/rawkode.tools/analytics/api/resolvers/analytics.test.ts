import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyticsResolvers } from './analytics';
import { DuckDBClient } from '../utils/duckdb-client';

// Mock DuckDBClient
const mockQuery = vi.fn();
const mockDuckDB = {
  query: mockQuery,
} as unknown as DuckDBClient;

// Mock context
const mockContext = {
  duckdb: mockDuckDB,
  env: {
    ANALYTICS_SOURCE_BUCKET: 'test-analytics-bucket',
    CATALOG_BUCKET: 'test-catalog-bucket',
    DB: {} as any,
  },
};

describe('Analytics Resolvers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('eventCounts', () => {
    it('should return event counts for a time range', async () => {
      const mockResults = [
        { event_type: 'page_view', count: 100 },
        { event_type: 'click', count: 50 },
      ];
      mockQuery.mockResolvedValue(mockResults);

      const args = {
        timeRange: {
          start: '2024-01-01T00:00:00Z',
          end: '2024-01-31T23:59:59Z',
        },
      };

      const result = await analyticsResolvers.Query.eventCounts(
        {},
        args,
        mockContext
      );

      expect(mockQuery).toHaveBeenCalledTimes(1);
      expect(mockQuery.mock.calls[0][0]).toContain('SELECT event_type, COUNT(*) as count');
      expect(mockQuery.mock.calls[0][0]).toContain('GROUP BY event_type');
      expect(mockQuery.mock.calls[0][0]).toContain('ORDER BY count DESC');
      
      expect(result).toEqual([
        { eventType: 'page_view', count: 100 },
        { eventType: 'click', count: 50 },
      ]);
    });

    it('should apply filters when provided', async () => {
      mockQuery.mockResolvedValue([]);

      const args = {
        timeRange: {
          start: '2024-01-01T00:00:00Z',
          end: '2024-01-31T23:59:59Z',
        },
        filter: {
          eventTypes: ['page_view', 'click'],
          source: 'web',
        },
      };

      await analyticsResolvers.Query.eventCounts({}, args, mockContext);

      const query = mockQuery.mock.calls[0][0];
      expect(query).toContain("event_type IN ('page_view', 'click')");
      expect(query).toContain("source = 'web'");
    });

    it('should handle empty results', async () => {
      mockQuery.mockResolvedValue([]);

      const args = {
        timeRange: {
          start: '2024-01-01T00:00:00Z',
          end: '2024-01-31T23:59:59Z',
        },
      };

      const result = await analyticsResolvers.Query.eventCounts(
        {},
        args,
        mockContext
      );

      expect(result).toEqual([]);
    });

    it('should handle query errors', async () => {
      mockQuery.mockRejectedValue(new Error('Query failed'));

      const args = {
        timeRange: {
          start: '2024-01-01T00:00:00Z',
          end: '2024-01-31T23:59:59Z',
        },
      };

      await expect(
        analyticsResolvers.Query.eventCounts({}, args, mockContext)
      ).rejects.toThrow('Query failed');
    });
  });

  describe('eventDetails', () => {
    it('should return event details with pagination', async () => {
      const mockResults = [
        {
          event_id: '123',
          event_type: 'page_view',
          time: '2024-01-15T10:30:00Z',
          source: 'web',
          data: '{"page": "/home"}',
        },
      ];
      mockQuery.mockResolvedValue(mockResults);

      const args = {
        timeRange: {
          start: '2024-01-01T00:00:00Z',
          end: '2024-01-31T23:59:59Z',
        },
        limit: 10,
        offset: 0,
      };

      const result = await analyticsResolvers.Query.eventDetails(
        {},
        args,
        mockContext
      );

      expect(mockQuery).toHaveBeenCalledTimes(1);
      expect(mockQuery.mock.calls[0][0]).toContain('SELECT *');
      expect(mockQuery.mock.calls[0][0]).toContain('ORDER BY time DESC');
      expect(mockQuery.mock.calls[0][0]).toContain('LIMIT 10');
      expect(mockQuery.mock.calls[0][0]).toContain('OFFSET 0');

      expect(result).toEqual([
        {
          eventId: '123',
          eventType: 'page_view',
          time: '2024-01-15T10:30:00Z',
          source: 'web',
          data: { page: '/home' },
        },
      ]);
    });

    it('should use default pagination values', async () => {
      mockQuery.mockResolvedValue([]);

      const args = {
        timeRange: {
          start: '2024-01-01T00:00:00Z',
          end: '2024-01-31T23:59:59Z',
        },
      };

      await analyticsResolvers.Query.eventDetails({}, args, mockContext);

      const query = mockQuery.mock.calls[0][0];
      expect(query).toContain('LIMIT 100');
      expect(query).toContain('OFFSET 0');
    });

    it('should parse JSON data field', async () => {
      const mockResults = [
        {
          event_id: '123',
          event_type: 'click',
          time: '2024-01-15T10:30:00Z',
          source: 'web',
          data: '{"button": "submit", "form": "login"}',
        },
      ];
      mockQuery.mockResolvedValue(mockResults);

      const args = {
        timeRange: {
          start: '2024-01-01T00:00:00Z',
          end: '2024-01-31T23:59:59Z',
        },
      };

      const result = await analyticsResolvers.Query.eventDetails(
        {},
        args,
        mockContext
      );

      expect(result[0].data).toEqual({
        button: 'submit',
        form: 'login',
      });
    });

    it('should handle invalid JSON in data field', async () => {
      const mockResults = [
        {
          event_id: '123',
          event_type: 'error',
          time: '2024-01-15T10:30:00Z',
          source: 'web',
          data: 'invalid json',
        },
      ];
      mockQuery.mockResolvedValue(mockResults);

      const args = {
        timeRange: {
          start: '2024-01-01T00:00:00Z',
          end: '2024-01-31T23:59:59Z',
        },
      };

      const result = await analyticsResolvers.Query.eventDetails(
        {},
        args,
        mockContext
      );

      expect(result[0].data).toBe('invalid json');
    });
  });

  describe('eventTimeSeries', () => {
    it('should return time series data with hourly granularity', async () => {
      const mockResults = [
        { time_bucket: '2024-01-15T10:00:00Z', count: 25 },
        { time_bucket: '2024-01-15T11:00:00Z', count: 30 },
      ];
      mockQuery.mockResolvedValue(mockResults);

      const args = {
        timeRange: {
          start: '2024-01-15T00:00:00Z',
          end: '2024-01-15T23:59:59Z',
        },
        granularity: 'HOUR',
      };

      const result = await analyticsResolvers.Query.eventTimeSeries(
        {},
        args,
        mockContext
      );

      expect(mockQuery).toHaveBeenCalledTimes(1);
      expect(mockQuery.mock.calls[0][0]).toContain('date_trunc');
      expect(mockQuery.mock.calls[0][0]).toContain("'hour'");
      
      expect(result).toEqual({
        labels: ['2024-01-15T10:00:00Z', '2024-01-15T11:00:00Z'],
        datasets: [
          {
            label: 'Events',
            data: [25, 30],
          },
        ],
      });
    });

    it('should handle different granularities', async () => {
      mockQuery.mockResolvedValue([]);

      const testCases = [
        { granularity: 'DAY', expected: "'day'" },
        { granularity: 'WEEK', expected: "'week'" },
        { granularity: 'MONTH', expected: "'month'" },
      ];

      for (const testCase of testCases) {
        vi.clearAllMocks();
        
        const args = {
          timeRange: {
            start: '2024-01-01T00:00:00Z',
            end: '2024-12-31T23:59:59Z',
          },
          granularity: testCase.granularity as any,
        };

        await analyticsResolvers.Query.eventTimeSeries({}, args, mockContext);

        const query = mockQuery.mock.calls[0][0];
        expect(query).toContain(testCase.expected);
      }
    });

    it('should filter by event type when provided', async () => {
      mockQuery.mockResolvedValue([]);

      const args = {
        timeRange: {
          start: '2024-01-01T00:00:00Z',
          end: '2024-01-31T23:59:59Z',
        },
        filter: {
          eventTypes: ['page_view'],
        },
      };

      await analyticsResolvers.Query.eventTimeSeries({}, args, mockContext);

      const query = mockQuery.mock.calls[0][0];
      expect(query).toContain("event_type IN ('page_view')");
    });

    it('should default to HOUR granularity', async () => {
      mockQuery.mockResolvedValue([]);

      const args = {
        timeRange: {
          start: '2024-01-01T00:00:00Z',
          end: '2024-01-31T23:59:59Z',
        },
      };

      await analyticsResolvers.Query.eventTimeSeries({}, args, mockContext);

      const query = mockQuery.mock.calls[0][0];
      expect(query).toContain("'hour'");
    });
  });
});