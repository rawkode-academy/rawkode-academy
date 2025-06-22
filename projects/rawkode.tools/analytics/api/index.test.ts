import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Env } from './types';

describe('API Index', () => {
  let api: any;
  let mockHandlers: Map<string, (c: any) => any>;
  let mockMiddlewares: Array<{ path: string; handler: (c: any, next: any) => any }>;

  beforeEach(async () => {
    // Reset mocks
    vi.resetModules();
    mockHandlers = new Map();
    mockMiddlewares = [];

    // Mock Hono
    vi.doMock('hono', () => {
      const mockContext = (req: Request, env: any, executionCtx: any) => ({
        req: {
          raw: req,
          method: req.method,
          header: (name: string) => req.headers.get(name),
        },
        env,
        executionContext: executionCtx,
        header: vi.fn(),
        text: vi.fn((text: string, status: number) => new Response(text, { status })),
        json: vi.fn((data: any, status?: number) => new Response(JSON.stringify(data), { 
          status: status || 200,
          headers: { 'Content-Type': 'application/json' }
        })),
      });

      return {
        Hono: vi.fn().mockImplementation(() => ({
          use: vi.fn((path: string, handler?: any) => {
            if (typeof path === 'function') {
              mockMiddlewares.push({ path: '*', handler: path });
            } else if (handler) {
              mockMiddlewares.push({ path, handler });
            }
          }),
          all: vi.fn((path: string, handler: any) => {
            mockHandlers.set(`ALL:${path}`, handler);
          }),
          get: vi.fn((path: string, handler: any) => {
            mockHandlers.set(`GET:${path}`, handler);
          }),
          fetch: vi.fn(async (req: Request, env: any, executionCtx: any) => {
            const url = new URL(req.url);
            const path = url.pathname;
            const method = req.method;
            
            const c = mockContext(req, env, executionCtx);
            
            // Run middlewares
            for (const { path: middlewarePath, handler } of mockMiddlewares) {
              // Check if middleware applies to this path
              if (middlewarePath === '*' || path.startsWith(middlewarePath.replace('/*', ''))) {
                let nextCalled = false;
                const next = () => { nextCalled = true; };
                const result = await handler(c, next);
                if (result instanceof Response) {
                  return result;
                }
                if (!nextCalled) {
                  break;
                }
              }
            }
            
            // Find and run handler
            const handlerKey = `${method}:${path}`;
            const handler = mockHandlers.get(handlerKey) || mockHandlers.get(`ALL:${path}`);
            
            if (handler) {
              return await handler(c);
            }
            
            return new Response('Not Found', { status: 404 });
          }),
        })),
      };
    });

    // Mock other dependencies
    vi.doMock('graphql-yoga', () => ({
      createYoga: vi.fn().mockReturnValue({
        fetch: vi.fn().mockResolvedValue(new Response('GraphQL Response', {
          headers: { 'Content-Type': 'application/json' }
        })),
      }),
    }));

    vi.doMock('./context', () => ({
      createContext: vi.fn(),
    }));

    vi.doMock('./schema', () => ({
      schema: {},
    }));

    // Import the module after mocks are set up
    const module = await import('./index');
    api = module.default;
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('should export a default object with fetch method', () => {
    expect(api).toBeDefined();
    expect(api.fetch).toBeDefined();
    expect(typeof api.fetch).toBe('function');
  });

  it('should handle GraphQL requests at /graphql endpoint', async () => {
    const mockRequest = new Request('http://localhost/graphql', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-API-Key': 'test-key'
      },
      body: JSON.stringify({ query: '{ test }' }),
    });

    const mockEnv: Env = {
      ANALYTICS_SOURCE: {} as any,
      ANALYTICS_PROCESSED: {} as any,
      ANALYTICS_CATALOG: {} as any,
      ANALYTICS_ENGINE: {} as any,
      ANALYTICS_API_KEY: 'test-key',
    };

    const mockCtx = {} as ExecutionContext;

    const response = await api.fetch(mockRequest, mockEnv, mockCtx);
    
    expect(response).toBeInstanceOf(Response);
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('should enforce API key authentication', async () => {
    const mockRequest = new Request('http://localhost/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ test }' }),
    });

    const mockEnv: Env = {
      ANALYTICS_SOURCE: {} as any,
      ANALYTICS_PROCESSED: {} as any,
      ANALYTICS_CATALOG: {} as any,
      ANALYTICS_ENGINE: {} as any,
      ANALYTICS_API_KEY: 'valid-key',
    };

    const mockCtx = {} as ExecutionContext;

    // Test without API key
    const response = await api.fetch(mockRequest, mockEnv, mockCtx);
    expect(response.status).toBe(401);
    
    const json = await response.json();
    expect(json).toEqual({ error: 'API key required' });
  });

  it('should reject invalid API keys', async () => {
    const mockRequest = new Request('http://localhost/graphql', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-API-Key': 'invalid-key'
      },
      body: JSON.stringify({ query: '{ test }' }),
    });

    const mockEnv: Env = {
      ANALYTICS_SOURCE: {} as any,
      ANALYTICS_PROCESSED: {} as any,
      ANALYTICS_CATALOG: {} as any,
      ANALYTICS_ENGINE: {} as any,
      ANALYTICS_API_KEY: 'valid-key',
    };

    const mockCtx = {} as ExecutionContext;

    const response = await api.fetch(mockRequest, mockEnv, mockCtx);
    expect(response.status).toBe(401);
    
    const json = await response.json();
    expect(json).toEqual({ error: 'Invalid API key' });
  });

  it('should handle health check endpoint', async () => {
    const mockRequest = new Request('http://localhost/health', {
      method: 'GET',
    });

    const mockEnv: Env = {
      ANALYTICS_SOURCE: {} as any,
      ANALYTICS_PROCESSED: {} as any,
      ANALYTICS_CATALOG: {} as any,
      ANALYTICS_ENGINE: {} as any,
    };

    const mockCtx = {} as ExecutionContext;

    const response = await api.fetch(mockRequest, mockEnv, mockCtx);
    expect(response.status).toBe(200);
    
    const json = await response.json();
    expect(json).toEqual({ status: 'healthy' });
  });

  it('should handle catalog endpoint', async () => {
    const mockCatalogData = {
      tables: [
        {
          tableName: 'events',
          eventType: 'page_view',
          totalRows: 1000,
          totalSizeBytes: 100000,
        },
      ],
    };

    const mockEnv: Env = {
      ANALYTICS_SOURCE: {} as any,
      ANALYTICS_PROCESSED: {} as any,
      ANALYTICS_CATALOG: {
        get: vi.fn().mockResolvedValue({
          json: vi.fn().mockResolvedValue(mockCatalogData),
        }),
      } as any,
      ANALYTICS_ENGINE: {} as any,
    };

    const mockRequest = new Request('http://localhost/catalog', {
      method: 'GET',
    });

    const mockCtx = {} as ExecutionContext;

    const response = await api.fetch(mockRequest, mockEnv, mockCtx);
    expect(response.status).toBe(200);
    
    const json = await response.json();
    expect(json).toEqual(mockCatalogData);
  });

  it('should handle CORS preflight requests', async () => {
    const mockRequest = new Request('http://localhost/graphql', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://rawkode.academy',
      },
    });

    const mockEnv: Env = {
      ANALYTICS_SOURCE: {} as any,
      ANALYTICS_PROCESSED: {} as any,
      ANALYTICS_CATALOG: {} as any,
      ANALYTICS_ENGINE: {} as any,
    };

    const mockCtx = {} as ExecutionContext;

    const response = await api.fetch(mockRequest, mockEnv, mockCtx);
    expect(response.status).toBe(200);
    
    const text = await response.text();
    expect(text).toBe('');
  });

  it('should add security headers to GraphQL responses', async () => {
    const mockRequest = new Request('http://localhost/graphql', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-API-Key': 'test-key'
      },
      body: JSON.stringify({ query: '{ test }' }),
    });

    const mockEnv: Env = {
      ANALYTICS_SOURCE: {} as any,
      ANALYTICS_PROCESSED: {} as any,
      ANALYTICS_CATALOG: {} as any,
      ANALYTICS_ENGINE: {} as any,
      ANALYTICS_API_KEY: 'test-key',
    };

    const mockCtx = {} as ExecutionContext;

    const response = await api.fetch(mockRequest, mockEnv, mockCtx);
    
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    expect(response.headers.get('X-XSS-Protection')).toBe('1; mode=block');
    expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(response.headers.get('Permissions-Policy')).toBe('geolocation=(), microphone=(), camera=()');
    expect(response.headers.get('Content-Security-Policy')).toContain("default-src 'self'");
  });

  it('should allow environment-specific CORS origins', async () => {
    const mockRequest = new Request('http://localhost/graphql', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://custom.example.com',
      },
    });

    const mockEnv: Env = {
      ANALYTICS_SOURCE: {} as any,
      ANALYTICS_PROCESSED: {} as any,
      ANALYTICS_CATALOG: {} as any,
      ANALYTICS_ENGINE: {} as any,
      ALLOWED_ORIGINS: 'https://custom.example.com,https://another.example.com',
    };

    const mockCtx = {} as ExecutionContext;

    const response = await api.fetch(mockRequest, mockEnv, mockCtx);
    expect(response.status).toBe(200);
  });
});