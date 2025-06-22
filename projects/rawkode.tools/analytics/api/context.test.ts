import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createContext } from './context';
import type { Env } from './types';

describe('createContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a context with environment variables', () => {
    const mockEnv: Env = {
      ANALYTICS_SOURCE: {} as any,
      ANALYTICS_PROCESSED: {} as any,
      ANALYTICS_CATALOG: {} as any,
      ANALYTICS_ENGINE: {} as any,
    };

    const mockExecutionContext = {} as ExecutionContext;

    const initialContext = {
      env: mockEnv,
      executionContext: mockExecutionContext,
    };

    const context = createContext(initialContext);

    expect(context).toHaveProperty('env');
    expect(context).toHaveProperty('executionContext');
    expect(context.env).toEqual(mockEnv);
    expect(context.executionContext).toEqual(mockExecutionContext);
  });

  it('should pass through all environment variables', () => {
    const mockEnv: Env = {
      ANALYTICS_SOURCE: {} as any,
      ANALYTICS_PROCESSED: {} as any,
      ANALYTICS_CATALOG: {} as any,
      ANALYTICS_ENGINE: {} as any,
      DUCKDB_WASM_URL: 'https://example.com/duckdb.wasm',
      R2_ENDPOINT: 'https://r2.example.com',
      R2_ACCESS_KEY_ID: 'test-access-key',
      R2_SECRET_ACCESS_KEY: 'test-secret-key',
      ANALYTICS_API_KEY: 'test-api-key',
      NODE_ENV: 'test',
      ALLOWED_ORIGINS: 'http://localhost:3000',
    };

    const mockExecutionContext = {} as ExecutionContext;

    const initialContext = {
      env: mockEnv,
      executionContext: mockExecutionContext,
    };

    const context = createContext(initialContext);

    expect(context.env).toBe(mockEnv);
    expect(context.env.DUCKDB_WASM_URL).toBe('https://example.com/duckdb.wasm');
    expect(context.env.R2_ENDPOINT).toBe('https://r2.example.com');
    expect(context.env.ANALYTICS_API_KEY).toBe('test-api-key');
  });

  it('should handle optional environment variables', () => {
    const mockEnv: Env = {
      ANALYTICS_SOURCE: {} as any,
      ANALYTICS_PROCESSED: {} as any,
      ANALYTICS_CATALOG: {} as any,
      ANALYTICS_ENGINE: {} as any,
      // All optional fields are undefined
    };

    const mockExecutionContext = {} as ExecutionContext;

    const initialContext = {
      env: mockEnv,
      executionContext: mockExecutionContext,
    };

    const context = createContext(initialContext);

    expect(context.env).toBe(mockEnv);
    expect(context.env.DUCKDB_WASM_URL).toBeUndefined();
    expect(context.env.R2_ENDPOINT).toBeUndefined();
    expect(context.env.ANALYTICS_API_KEY).toBeUndefined();
  });

  it('should create independent contexts for multiple calls', () => {
    const mockEnv1: Env = {
      ANALYTICS_SOURCE: {} as any,
      ANALYTICS_PROCESSED: {} as any,
      ANALYTICS_CATALOG: {} as any,
      ANALYTICS_ENGINE: {} as any,
      ANALYTICS_API_KEY: 'key1',
    };

    const mockEnv2: Env = {
      ANALYTICS_SOURCE: {} as any,
      ANALYTICS_PROCESSED: {} as any,
      ANALYTICS_CATALOG: {} as any,
      ANALYTICS_ENGINE: {} as any,
      ANALYTICS_API_KEY: 'key2',
    };

    const mockExecutionContext1 = {} as ExecutionContext;
    const mockExecutionContext2 = {} as ExecutionContext;

    const initialContext1 = {
      env: mockEnv1,
      executionContext: mockExecutionContext1,
    };

    const initialContext2 = {
      env: mockEnv2,
      executionContext: mockExecutionContext2,
    };

    const context1 = createContext(initialContext1);
    const context2 = createContext(initialContext2);

    expect(context1).not.toBe(context2);
    expect(context1.env).not.toBe(context2.env);
    expect(context1.env.ANALYTICS_API_KEY).toBe('key1');
    expect(context2.env.ANALYTICS_API_KEY).toBe('key2');
  });

  it('should preserve execution context', () => {
    const mockEnv: Env = {
      ANALYTICS_SOURCE: {} as any,
      ANALYTICS_PROCESSED: {} as any,
      ANALYTICS_CATALOG: {} as any,
      ANALYTICS_ENGINE: {} as any,
    };

    const mockExecutionContext = {
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn(),
    } as any;

    const initialContext = {
      env: mockEnv,
      executionContext: mockExecutionContext,
    };

    const context = createContext(initialContext);

    expect(context.executionContext).toBe(mockExecutionContext);
    expect(context.executionContext.waitUntil).toBe(mockExecutionContext.waitUntil);
    expect(context.executionContext.passThroughOnException).toBe(mockExecutionContext.passThroughOnException);
  });
});