import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createContext } from './context';
import { DuckDBClient } from './utils/duckdb-client';

// Mock the DuckDBClient
vi.mock('./utils/duckdb-client', () => ({
  DuckDBClient: vi.fn().mockImplementation(() => ({
    query: vi.fn(),
    close: vi.fn(),
  })),
}));

describe('createContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a context with environment variables', async () => {
    const mockEnv = {
      ANALYTICS_SOURCE_BUCKET: 'test-analytics-bucket',
      CATALOG_BUCKET: 'test-catalog-bucket',
      DB: {} as any,
    };

    const context = await createContext(mockEnv);

    expect(context).toHaveProperty('duckdb');
    expect(context).toHaveProperty('env');
    expect(context.env).toEqual(mockEnv);
  });

  it('should create a DuckDBClient instance', async () => {
    const mockEnv = {
      ANALYTICS_SOURCE_BUCKET: 'analytics',
      CATALOG_BUCKET: 'catalog',
      DB: {} as any,
    };

    const context = await createContext(mockEnv);

    expect(DuckDBClient).toHaveBeenCalledTimes(1);
    expect(context.duckdb).toBeDefined();
  });

  it('should pass through all environment variables', async () => {
    const mockEnv = {
      ANALYTICS_SOURCE_BUCKET: 'source-bucket',
      CATALOG_BUCKET: 'catalog-bucket',
      DB: {} as any,
      CUSTOM_VAR: 'custom-value',
    } as any;

    const context = await createContext(mockEnv);

    expect(context.env).toBe(mockEnv);
    expect(context.env.ANALYTICS_SOURCE_BUCKET).toBe('source-bucket');
    expect(context.env.CATALOG_BUCKET).toBe('catalog-bucket');
    expect(context.env.CUSTOM_VAR).toBe('custom-value');
  });

  it('should handle missing environment variables', async () => {
    const mockEnv = {
      DB: {} as any,
    } as any;

    const context = await createContext(mockEnv);

    expect(context.env).toBe(mockEnv);
    expect(context.env.ANALYTICS_SOURCE_BUCKET).toBeUndefined();
    expect(context.env.CATALOG_BUCKET).toBeUndefined();
  });

  it('should create independent contexts for multiple calls', async () => {
    const mockEnv1 = {
      ANALYTICS_SOURCE_BUCKET: 'bucket1',
      CATALOG_BUCKET: 'catalog1',
      DB: {} as any,
    };

    const mockEnv2 = {
      ANALYTICS_SOURCE_BUCKET: 'bucket2',
      CATALOG_BUCKET: 'catalog2',
      DB: {} as any,
    };

    const context1 = await createContext(mockEnv1);
    const context2 = await createContext(mockEnv2);

    expect(context1).not.toBe(context2);
    expect(context1.duckdb).not.toBe(context2.duckdb);
    expect(context1.env).not.toBe(context2.env);
    expect(context1.env.ANALYTICS_SOURCE_BUCKET).toBe('bucket1');
    expect(context2.env.ANALYTICS_SOURCE_BUCKET).toBe('bucket2');
  });
});