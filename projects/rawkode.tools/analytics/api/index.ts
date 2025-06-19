import { createYoga } from 'graphql-yoga';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createContext } from './context';
import { schema } from './schema';
import type { Env } from './types';

const app = new Hono<{ Bindings: Env }>();

app.use('*', cors());

// GraphQL endpoint
const yoga = createYoga({
  schema,
  context: createContext,
  graphiql: {
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
  },
});

app.all('/graphql', async (c) => {
  const response = await yoga.fetch(c.req.raw, {
    env: c.env,
    executionContext: c.executionContext,
  });

  return new Response(response.body, response);
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
