import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { createYoga } from 'graphql-yoga';
import { schema } from '@api/schema';
import { analyticsResolvers } from '@api/resolvers/analytics';
import { catalogResolvers } from '@api/resolvers/catalog';
import { createMockContext, createMockFetchResponse } from '../utils/test-helpers';

describe.skip('GraphQL API Integration Tests', () => {
  let yoga: ReturnType<typeof createYoga>;
  let mockContext: any;

  beforeAll(() => {
    // Mock fetch globally
    global.fetch = vi.fn();
    
    mockContext = createMockContext();
    
    // Create GraphQL Yoga instance for testing
    yoga = createYoga({
      schema: schema, // Use the GraphQL schema object directly
      resolvers: {
        Query: {
          ...analyticsResolvers.Query,
          ...catalogResolvers.Query,
        },
      },
      context: () => mockContext,
      graphqlEndpoint: '/',
    });
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe('Event Counts Query', () => {
    it('should execute eventCounts query successfully', async () => {
      // Mock DuckDB response
      mockContext.duckdb.query.mockResolvedValueOnce([
        { event_type: 'page_view', count: 150 },
        { event_type: 'click', count: 75 },
      ]);

      const query = `
        query {
          eventCounts(
            timeRange: { 
              start: "2024-01-01T00:00:00Z", 
              end: "2024-01-31T23:59:59Z" 
            }
          ) {
            eventType
            count
          }
        }
      `;

      const response = await yoga.fetch(
        new Request('http://localhost/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query }),
        })
      );

      const result = await response.json();
      
      expect(result.errors).toBeUndefined();
      expect(result.data.eventCounts).toHaveLength(2);
      expect(result.data.eventCounts[0]).toEqual({
        eventType: 'page_view',
        count: 150,
      });
    });

    it('should handle eventCounts with filters', async () => {
      mockContext.duckdb.query.mockResolvedValueOnce([
        { event_type: 'page_view', count: 100 },
      ]);

      const query = `
        query {
          eventCounts(
            timeRange: { 
              start: "2024-01-01T00:00:00Z", 
              end: "2024-01-31T23:59:59Z" 
            }
            filter: {
              eventTypes: ["page_view"]
              source: "web"
            }
          ) {
            eventType
            count
          }
        }
      `;

      const response = await yoga.fetch(
        new Request('http://localhost/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query }),
        })
      );

      const result = await response.json();
      
      expect(result.errors).toBeUndefined();
      expect(mockContext.duckdb.query).toHaveBeenCalledWith(
        expect.stringContaining("event_type IN ('page_view')")
      );
      expect(mockContext.duckdb.query).toHaveBeenCalledWith(
        expect.stringContaining("source = 'web'")
      );
    });
  });

  describe('Event Details Query', () => {
    it('should execute eventDetails query with pagination', async () => {
      mockContext.duckdb.query.mockResolvedValueOnce([
        {
          event_id: '123',
          event_type: 'page_view',
          time: '2024-01-15T10:30:00Z',
          source: 'web',
          data: '{"page": "/home"}',
        },
      ]);

      const query = `
        query {
          eventDetails(
            timeRange: { 
              start: "2024-01-01T00:00:00Z", 
              end: "2024-01-31T23:59:59Z" 
            }
            limit: 10
            offset: 0
          ) {
            eventId
            eventType
            time
            source
            data
          }
        }
      `;

      const response = await yoga.fetch(
        new Request('http://localhost/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query }),
        })
      );

      const result = await response.json();
      
      expect(result.errors).toBeUndefined();
      expect(result.data.eventDetails).toHaveLength(1);
      expect(result.data.eventDetails[0].data).toEqual({ page: '/home' });
    });
  });

  describe('Event Time Series Query', () => {
    it('should execute eventTimeSeries query', async () => {
      mockContext.duckdb.query.mockResolvedValueOnce([
        { time_bucket: '2024-01-15T10:00:00Z', count: 25 },
        { time_bucket: '2024-01-15T11:00:00Z', count: 30 },
      ]);

      const query = `
        query {
          eventTimeSeries(
            timeRange: { 
              start: "2024-01-15T00:00:00Z", 
              end: "2024-01-15T23:59:59Z" 
            }
            granularity: HOUR
          ) {
            labels
            datasets {
              label
              data
            }
          }
        }
      `;

      const response = await yoga.fetch(
        new Request('http://localhost/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query }),
        })
      );

      const result = await response.json();
      
      expect(result.errors).toBeUndefined();
      expect(result.data.eventTimeSeries.labels).toHaveLength(2);
      expect(result.data.eventTimeSeries.datasets[0].data).toEqual([25, 30]);
    });
  });

  describe('Catalog Query', () => {
    it('should execute catalog query', async () => {
      const mockCatalogData = {
        version: '1.0',
        generated_at: '2024-01-15T12:00:00Z',
        total_tables: 2,
        total_rows: 1000,
        total_size_bytes: 50000,
        tables: [
          {
            name: 'page_view',
            event_type: 'page_view',
            row_count: 800,
            size_bytes: 40000,
            partition_count: 5,
            earliest_partition: '2024-01-01T00:00:00Z',
            latest_partition: '2024-01-15T00:00:00Z',
            partitions: [],
          },
        ],
        storage_costs: {
          total_gb: 0.00005,
          cost_per_gb: 0.015,
          monthly_cost: 0.00000075,
        },
      };

      vi.mocked(global.fetch).mockResolvedValueOnce(
        createMockFetchResponse(mockCatalogData)
      );

      const query = `
        query {
          catalog {
            version
            generated_at
            total_tables
            total_rows
            total_size_bytes
            tables {
              name
              event_type
              row_count
              size_bytes
              partition_count
            }
            storage_costs {
              total_gb
              cost_per_gb
              monthly_cost
            }
          }
        }
      `;

      const response = await yoga.fetch(
        new Request('http://localhost/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query }),
        })
      );

      const result = await response.json();
      
      expect(result.errors).toBeUndefined();
      expect(result.data.catalog.total_tables).toBe(2);
      expect(result.data.catalog.tables).toHaveLength(1);
      expect(result.data.catalog.storage_costs.monthly_cost).toBe(0.00000075);
    });
  });

  describe('Error Handling', () => {
    it('should handle query syntax errors', async () => {
      const query = `
        query {
          invalidField
        }
      `;

      const response = await yoga.fetch(
        new Request('http://localhost/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query }),
        })
      );

      const result = await response.json();
      
      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toContain('Cannot query field');
    });

    it('should handle resolver errors', async () => {
      mockContext.duckdb.query.mockRejectedValueOnce(
        new Error('Database connection failed')
      );

      const query = `
        query {
          eventCounts(
            timeRange: { 
              start: "2024-01-01T00:00:00Z", 
              end: "2024-01-31T23:59:59Z" 
            }
          ) {
            eventType
            count
          }
        }
      `;

      const response = await yoga.fetch(
        new Request('http://localhost/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query }),
        })
      );

      const result = await response.json();
      
      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toContain('Database connection failed');
    });

    it('should validate required arguments', async () => {
      const query = `
        query {
          eventCounts {
            eventType
            count
          }
        }
      `;

      const response = await yoga.fetch(
        new Request('http://localhost/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query }),
        })
      );

      const result = await response.json();
      
      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toContain('required');
    });
  });

  describe('HTTP Methods', () => {
    it('should support GET requests', async () => {
      mockContext.duckdb.query.mockResolvedValueOnce([]);

      const query = encodeURIComponent(`
        query {
          eventCounts(
            timeRange: { 
              start: "2024-01-01T00:00:00Z", 
              end: "2024-01-31T23:59:59Z" 
            }
          ) {
            eventType
            count
          }
        }
      `);

      const response = await yoga.fetch(
        new Request(`http://localhost/?query=${query}`, {
          method: 'GET',
        })
      );

      const result = await response.json();
      
      expect(result.errors).toBeUndefined();
      expect(result.data.eventCounts).toEqual([]);
    });
  });
});