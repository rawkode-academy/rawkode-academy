import { describe, it, expect, vi, beforeEach } from 'vitest';
import { catalogResolver } from './catalog';

describe('Catalog Resolvers', () => {
  let mockContext: any;
  let mockCatalogObject: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockCatalogObject = {
      json: vi.fn(),
    };
    
    mockContext = {
      env: {
        ANALYTICS_SOURCE: {} as any,
        ANALYTICS_PROCESSED: {} as any,
        ANALYTICS_CATALOG: {
          get: vi.fn(),
        },
        ANALYTICS_ENGINE: {} as any,
      },
      executionContext: {} as ExecutionContext,
    };
  });

  describe('catalog query', () => {
    it('should fetch and return catalog summary', async () => {
      const mockCatalogData = {
        version: '1.0',
        lastUpdated: '2024-01-15T12:00:00Z',
        tables: [
          {
            tableName: 'page_view',
            eventType: 'page_view',
            totalRows: 500000,
            totalSizeBytes: 25000000,
            lastUpdated: '2024-01-15T00:00:00Z',
          },
        ],
      };

      mockCatalogObject.json.mockResolvedValue(mockCatalogData);
      mockContext.env.ANALYTICS_CATALOG.get.mockResolvedValue(mockCatalogObject);

      const result = await catalogResolver.getCatalog({}, {}, mockContext);

      expect(mockContext.env.ANALYTICS_CATALOG.get).toHaveBeenCalledWith('catalog/tables.json');
      expect(result).toEqual(mockCatalogData);
    });

    it('should handle missing catalog file', async () => {
      mockContext.env.ANALYTICS_CATALOG.get.mockResolvedValue(null);

      const result = await catalogResolver.getCatalog({}, {}, mockContext);

      expect(result).toBeNull();
    });

    it('should handle fetch errors', async () => {
      mockContext.env.ANALYTICS_CATALOG.get.mockRejectedValue(new Error('R2 error'));

      await expect(
        catalogResolver.getCatalog({}, {}, mockContext)
      ).rejects.toThrow('Failed to fetch catalog');
    });

    it('should handle JSON parsing errors', async () => {
      mockCatalogObject.json.mockRejectedValue(new Error('Invalid JSON'));
      mockContext.env.ANALYTICS_CATALOG.get.mockResolvedValue(mockCatalogObject);

      await expect(
        catalogResolver.getCatalog({}, {}, mockContext)
      ).rejects.toThrow('Failed to fetch catalog');
    });

    it('should log errors to console', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const error = new Error('Test error');
      
      mockContext.env.ANALYTICS_CATALOG.get.mockRejectedValue(error);

      await expect(
        catalogResolver.getCatalog({}, {}, mockContext)
      ).rejects.toThrow('Failed to fetch catalog');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error fetching catalog:', error);
      
      consoleErrorSpy.mockRestore();
    });

    it('should return catalog with nested table partitions', async () => {
      const mockCatalogData = {
        version: '1.0',
        lastUpdated: '2024-01-15T12:00:00Z',
        tables: [
          {
            tableName: 'click',
            eventType: 'click',
            totalRows: 100,
            totalSizeBytes: 1000,
            lastUpdated: '2024-01-02T00:00:00Z',
            partitions: [
              {
                path: 'events/click/2024/01/01/00/',
                year: 2024,
                month: 1,
                day: 1,
                hour: 0,
                fileCount: 1,
                rowCount: 50,
                sizeBytes: 500,
              },
              {
                path: 'events/click/2024/01/02/00/',
                year: 2024,
                month: 1,
                day: 2,
                hour: 0,
                fileCount: 1,
                rowCount: 50,
                sizeBytes: 500,
              },
            ],
          },
        ],
      };

      mockCatalogObject.json.mockResolvedValue(mockCatalogData);
      mockContext.env.ANALYTICS_CATALOG.get.mockResolvedValue(mockCatalogObject);

      const result = await catalogResolver.getCatalog({}, {}, mockContext);

      expect(result.tables[0].partitions).toHaveLength(2);
      expect(result.tables[0].partitions[0].path).toBe('events/click/2024/01/01/00/');
      expect(result.tables[0].partitions[1].path).toBe('events/click/2024/01/02/00/');
    });

    it('should handle empty catalog', async () => {
      const mockCatalogData = {
        version: '1.0',
        lastUpdated: '2024-01-15T12:00:00Z',
        tables: [],
      };

      mockCatalogObject.json.mockResolvedValue(mockCatalogData);
      mockContext.env.ANALYTICS_CATALOG.get.mockResolvedValue(mockCatalogObject);

      const result = await catalogResolver.getCatalog({}, {}, mockContext);

      expect(result.tables).toEqual([]);
    });
  });
});