import { describe, it, expect, vi, beforeEach } from 'vitest';
import { catalogResolvers } from './catalog';

// Mock fetch
global.fetch = vi.fn();

// Mock context
const mockContext = {
  duckdb: {} as any,
  env: {
    ANALYTICS_SOURCE_BUCKET: 'test-analytics-bucket',
    CATALOG_BUCKET: 'test-catalog-bucket',
    DB: {} as any,
  },
};

describe('Catalog Resolvers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('catalog query', () => {
    it('should fetch and return catalog summary', async () => {
      const mockCatalogData = {
        version: '1.0',
        generated_at: '2024-01-15T12:00:00Z',
        total_tables: 3,
        total_rows: 1000000,
        total_size_bytes: 50000000,
        tables: [
          {
            name: 'page_view',
            event_type: 'page_view',
            row_count: 500000,
            size_bytes: 25000000,
            partition_count: 10,
            earliest_partition: '2024-01-01T00:00:00Z',
            latest_partition: '2024-01-15T00:00:00Z',
            partitions: [],
          },
        ],
        storage_costs: {
          total_gb: 0.05,
          cost_per_gb: 0.015,
          monthly_cost: 0.00075,
        },
      };

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue(mockCatalogData),
      };

      vi.mocked(global.fetch).mockResolvedValue(mockResponse as any);

      const result = await catalogResolvers.Query.catalog({}, {}, mockContext);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://test-catalog-bucket.r2.cloudflarestorage.com/catalog/summary.json'
      );
      
      expect(result).toEqual(mockCatalogData);
    });

    it('should handle fetch errors', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        statusText: 'Not Found',
      };

      vi.mocked(global.fetch).mockResolvedValue(mockResponse as any);

      await expect(
        catalogResolvers.Query.catalog({}, {}, mockContext)
      ).rejects.toThrow('Failed to fetch catalog: 404');
    });

    it('should handle network errors', async () => {
      vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'));

      await expect(
        catalogResolvers.Query.catalog({}, {}, mockContext)
      ).rejects.toThrow('Network error');
    });

    it('should handle JSON parsing errors', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockRejectedValue(new Error('Invalid JSON')),
      };

      vi.mocked(global.fetch).mockResolvedValue(mockResponse as any);

      await expect(
        catalogResolvers.Query.catalog({}, {}, mockContext)
      ).rejects.toThrow('Invalid JSON');
    });

    it('should construct correct R2 URL', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({}),
      };

      vi.mocked(global.fetch).mockResolvedValue(mockResponse as any);

      const customContext = {
        ...mockContext,
        env: {
          ...mockContext.env,
          CATALOG_BUCKET: 'custom-catalog-bucket',
        },
      };

      await catalogResolvers.Query.catalog({}, {}, customContext);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://custom-catalog-bucket.r2.cloudflarestorage.com/catalog/summary.json'
      );
    });

    it('should return catalog with nested table partitions', async () => {
      const mockCatalogData = {
        version: '1.0',
        generated_at: '2024-01-15T12:00:00Z',
        total_tables: 1,
        total_rows: 100,
        total_size_bytes: 1000,
        tables: [
          {
            name: 'click',
            event_type: 'click',
            row_count: 100,
            size_bytes: 1000,
            partition_count: 2,
            earliest_partition: '2024-01-01T00:00:00Z',
            latest_partition: '2024-01-02T00:00:00Z',
            partitions: [
              {
                path: 'events/click/2024/01/01/00/',
                year: 2024,
                month: 1,
                day: 1,
                hour: 0,
                file_count: 1,
                row_count: 50,
                size_bytes: 500,
                min_event_time: '2024-01-01T00:00:00Z',
                max_event_time: '2024-01-01T00:59:59Z',
              },
              {
                path: 'events/click/2024/01/02/00/',
                year: 2024,
                month: 1,
                day: 2,
                hour: 0,
                file_count: 1,
                row_count: 50,
                size_bytes: 500,
                min_event_time: '2024-01-02T00:00:00Z',
                max_event_time: '2024-01-02T00:59:59Z',
              },
            ],
          },
        ],
        storage_costs: {
          total_gb: 0.000001,
          cost_per_gb: 0.015,
          monthly_cost: 0.000000015,
        },
      };

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue(mockCatalogData),
      };

      vi.mocked(global.fetch).mockResolvedValue(mockResponse as any);

      const result = await catalogResolvers.Query.catalog({}, {}, mockContext);

      expect(result.tables[0].partitions).toHaveLength(2);
      expect(result.tables[0].partitions[0].path).toBe('events/click/2024/01/01/00/');
      expect(result.tables[0].partitions[1].path).toBe('events/click/2024/01/02/00/');
    });

    it('should handle empty catalog', async () => {
      const mockCatalogData = {
        version: '1.0',
        generated_at: '2024-01-15T12:00:00Z',
        total_tables: 0,
        total_rows: 0,
        total_size_bytes: 0,
        tables: [],
        storage_costs: {
          total_gb: 0,
          cost_per_gb: 0.015,
          monthly_cost: 0,
        },
      };

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue(mockCatalogData),
      };

      vi.mocked(global.fetch).mockResolvedValue(mockResponse as any);

      const result = await catalogResolvers.Query.catalog({}, {}, mockContext);

      expect(result.total_tables).toBe(0);
      expect(result.tables).toEqual([]);
      expect(result.storage_costs.monthly_cost).toBe(0);
    });
  });
});