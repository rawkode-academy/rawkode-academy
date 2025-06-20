import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createYoga } from 'graphql-yoga';

// Mock the dependencies
vi.mock('graphql-yoga', () => ({
  createYoga: vi.fn().mockReturnValue({
    handle: vi.fn(),
  }),
}));

vi.mock('./context', () => ({
  createContext: vi.fn().mockResolvedValue({
    duckdb: {},
    env: {},
  }),
}));

vi.mock('./schema', () => ({
  schema: 'type Query { test: String }',
}));

vi.mock('./resolvers/analytics', () => ({
  analyticsResolvers: {
    Query: {
      eventCounts: vi.fn(),
      eventDetails: vi.fn(),
      eventTimeSeries: vi.fn(),
    },
  },
}));

vi.mock('./resolvers/catalog', () => ({
  catalogResolvers: {
    Query: {
      catalog: vi.fn(),
    },
  },
}));

// Import after mocks are set up
import api from './index';

describe('API Index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should export a default object with fetch method', () => {
    expect(api).toBeDefined();
    expect(api.fetch).toBeDefined();
    expect(typeof api.fetch).toBe('function');
  });

  it('should create GraphQL Yoga instance on fetch', async () => {
    const mockRequest = new Request('http://localhost/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ test }' }),
    });

    const mockEnv = {
      ANALYTICS_SOURCE_BUCKET: 'test-bucket',
      CATALOG_BUCKET: 'catalog-bucket',
      DB: {} as any,
    };

    const mockCtx = {} as ExecutionContext;

    await api.fetch(mockRequest, mockEnv, mockCtx);

    expect(createYoga).toHaveBeenCalled();
  });

  it('should pass request to yoga.handle', async () => {
    const mockHandle = vi.fn().mockResolvedValue(new Response('OK'));
    vi.mocked(createYoga).mockReturnValue({
      handle: mockHandle,
    } as any);

    const mockRequest = new Request('http://localhost/graphql');
    const mockEnv = {} as any;
    const mockCtx = {} as ExecutionContext;

    const response = await api.fetch(mockRequest, mockEnv, mockCtx);

    expect(mockHandle).toHaveBeenCalledWith(mockRequest, mockEnv, mockCtx);
    expect(response).toBeInstanceOf(Response);
  });

  it('should configure GraphQL Yoga with correct options', async () => {
    const mockRequest = new Request('http://localhost/graphql');
    const mockEnv = {} as any;
    const mockCtx = {} as ExecutionContext;

    await api.fetch(mockRequest, mockEnv, mockCtx);

    const yogaConfig = vi.mocked(createYoga).mock.calls[0][0];
    
    expect(yogaConfig).toHaveProperty('schema');
    expect(yogaConfig).toHaveProperty('context');
    expect(yogaConfig).toHaveProperty('graphqlEndpoint', '/');
  });

  it('should merge resolvers correctly', async () => {
    const mockRequest = new Request('http://localhost/graphql');
    const mockEnv = {} as any;
    const mockCtx = {} as ExecutionContext;

    await api.fetch(mockRequest, mockEnv, mockCtx);

    const yogaConfig = vi.mocked(createYoga).mock.calls[0][0];
    const resolvers = yogaConfig.resolvers;

    expect(resolvers).toHaveProperty('Query');
    expect(resolvers.Query).toHaveProperty('eventCounts');
    expect(resolvers.Query).toHaveProperty('eventDetails');
    expect(resolvers.Query).toHaveProperty('eventTimeSeries');
    expect(resolvers.Query).toHaveProperty('catalog');
  });

  it('should handle different HTTP methods', async () => {
    const methods = ['GET', 'POST'];
    
    for (const method of methods) {
      vi.clearAllMocks();
      
      const mockRequest = new Request('http://localhost/graphql', {
        method,
      });
      const mockEnv = {} as any;
      const mockCtx = {} as ExecutionContext;

      await api.fetch(mockRequest, mockEnv, mockCtx);

      const mockHandle = vi.mocked(createYoga).mock.results[0].value.handle;
      expect(mockHandle).toHaveBeenCalledWith(mockRequest, mockEnv, mockCtx);
    }
  });

  it('should propagate errors from yoga.handle', async () => {
    const mockError = new Error('GraphQL error');
    const mockHandle = vi.fn().mockRejectedValue(mockError);
    
    vi.mocked(createYoga).mockReturnValue({
      handle: mockHandle,
    } as any);

    const mockRequest = new Request('http://localhost/graphql');
    const mockEnv = {} as any;
    const mockCtx = {} as ExecutionContext;

    await expect(api.fetch(mockRequest, mockEnv, mockCtx)).rejects.toThrow('GraphQL error');
  });

  it('should create context with environment variables', async () => {
    const { createContext } = await import('./context');
    
    const mockRequest = new Request('http://localhost/graphql');
    const mockEnv = {
      ANALYTICS_SOURCE_BUCKET: 'analytics-bucket',
      CATALOG_BUCKET: 'catalog-bucket',
      DB: {} as any,
    };
    const mockCtx = {} as ExecutionContext;

    await api.fetch(mockRequest, mockEnv, mockCtx);

    const yogaConfig = vi.mocked(createYoga).mock.calls[0][0];
    
    // Call the context function to verify it calls createContext
    await yogaConfig.context();
    
    expect(createContext).toHaveBeenCalledWith(mockEnv);
  });
});