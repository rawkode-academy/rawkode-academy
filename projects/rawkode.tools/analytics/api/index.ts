import { createYoga } from 'graphql-yoga';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createContext } from './context';
import { schema } from './schema';
import type { Env } from './types';

const app = new Hono<{ Bindings: Env }>();

// Configure CORS - only allow specific origins
app.use('*', async (c, next) => {
  const origin = c.req.header('Origin');
  const allowedOrigins = [
    'https://rawkode.academy',
    'https://www.rawkode.academy',
    'http://localhost:3000', // For local development
  ];
  
  // Add environment-specific origins if provided
  if (c.env.ALLOWED_ORIGINS) {
    const envOrigins = c.env.ALLOWED_ORIGINS.split(',');
    allowedOrigins.push(...envOrigins);
  }
  
  if (origin && allowedOrigins.includes(origin)) {
    c.header('Access-Control-Allow-Origin', origin);
    c.header('Access-Control-Allow-Credentials', 'true');
    c.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    c.header('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');
  }
  
  // Handle preflight requests
  if (c.req.method === 'OPTIONS') {
    return c.text('', 200);
  }
  
  await next();
});

// Rate limiting middleware
app.use('/graphql/*', async (c, next) => {
  const clientIp = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
  const apiKey = c.req.header('X-API-Key');
  
  // Create rate limit key based on IP and API key
  const rateLimitKey = `rate-limit:${apiKey || clientIp}`;
  const rateLimitWindow = 60; // 1 minute window
  const rateLimitMax = 100; // 100 requests per minute
  
  // Simple in-memory rate limiting (for production, use Cloudflare Rate Limiting or KV)
  const now = Date.now();
  const windowStart = Math.floor(now / (rateLimitWindow * 1000)) * (rateLimitWindow * 1000);
  
  // In production, this should use Cloudflare KV or Durable Objects
  // For now, we'll add a TODO comment
  // TODO: Implement proper rate limiting with Cloudflare KV or Rate Limiting Rules
  
  await next();
});

// API Key authentication middleware
app.use('/graphql/*', async (c, next) => {
  const apiKey = c.req.header('X-API-Key');
  
  if (!apiKey) {
    return c.json({ error: 'API key required' }, 401);
  }
  
  // Verify API key against environment variable
  const validApiKey = c.env.ANALYTICS_API_KEY;
  if (!validApiKey || apiKey !== validApiKey) {
    return c.json({ error: 'Invalid API key' }, 401);
  }
  
  await next();
});

app.all('/graphql', async (c) => {
  // Create yoga instance with environment-aware configuration
  const yoga = createYoga({
    schema,
    context: createContext,
    // Disable introspection in production
    introspection: c.env.NODE_ENV !== 'production',
    graphiql: c.env.NODE_ENV !== 'production' ? {
      defaultQuery: `# Welcome to Rawkode Analytics API
# 
# Example queries:

query GetEventCounts {
  analytics {
    eventCounts(
      timeRange: { start: "2024-01-01", end: "2024-12-31" }
      groupBy: ["event_type"]
    ) {
      dimensions
      count
    }
  }
}

query GetCatalog {
  catalog {
    tables {
      tableName
      eventType
      totalRows
      totalSizeBytes
      lastUpdated
    }
  }
}`,
    } : false,
  });

  const response = await yoga.fetch(c.req.raw, {
    env: c.env,
    executionContext: c.executionContext,
  });

  // Add security headers
  const headers = new Headers(response.headers);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('X-XSS-Protection', '1; mode=block');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // Add CSP header
  headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self';");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
});

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'healthy' });
});

// Catalog proxy
app.get('/catalog', async (c) => {
  try {
    const catalog = await c.env.ANALYTICS_CATALOG.get('catalog/tables.json');

    if (!catalog) {
      return c.json({ error: 'Catalog not found' }, 404);
    }

    const data = await catalog.json();
    return c.json(data);
  } catch (error) {
    console.error('Error fetching catalog:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default {
  fetch: app.fetch,
};
