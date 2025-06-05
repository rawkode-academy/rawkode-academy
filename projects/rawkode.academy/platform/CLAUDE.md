# GraphQL Microservices Guide

This guide explains how to add new GraphQL microservices to the Rawkode Academy platform. Our architecture uses WunderGraph Cosmo for GraphQL federation, enabling small, focused services that are composed into a unified API.

## Architecture Overview

- **GraphQL Federation**: We use WunderGraph Cosmo Router for federation (see `infrastructure/cosmo/`)
- **Microservice Pattern**: Each service is minimal and focused on a single domain
- **Read/Write Separation**: Services typically have separate read and write models
- **Deployment**: Services are deployed to Cloudflare Workers using Wrangler
- **Database**: All new services should use Cloudflare D1 with Drizzle ORM (Turso is being phased out)

## Service Structure

Each GraphQL microservice follows this directory structure:

```
platform/<service-name>/
├── Dockerfile
├── README.md
├── package.json           # Dependencies and scripts
├── deno.jsonc            # For Deno-based services
├── data-model/           # Database schema and migrations
│   ├── client.ts         # Database client setup
│   ├── drizzle.config.ts # Drizzle ORM configuration
│   ├── schema.ts         # Database schema definitions
│   ├── migrate.ts        # Migration runner
│   ├── seed.ts           # Seed data (optional)
│   ├── migrations/       # SQL migration files
│   └── integrations/
│       └── zod.ts        # Zod schemas for validation
├── read-model/           # GraphQL read API
│   ├── main.ts          # Worker entry point
│   ├── schema.ts        # GraphQL schema definition
│   ├── publish.ts       # Schema publishing script
│   └── wrangler.jsonc   # Cloudflare Worker config
└── write-model/         # Write operations (optional)
    ├── main.ts          # Restate service for writes
    └── test             # Test files
```

## Creating a New GraphQL Microservice

> **Important**: All new services must use Cloudflare D1 as the database. Turso/LibSQL is being phased out and should not be used for new services.

### 1. Create the Service Directory

```bash
mkdir -p platform/<service-name>/{data-model,read-model,write-model}
```

### 2. Set Up Dependencies (package.json)

```json
{
  "name": "<service-name>",
  "private": true,
  "dependencies": {
    "@apollo/subgraph": "^2.10.2",
    "@graphql-tools/utils": "^10.8.6",
    "@libsql/client": "^0.14.0",
    "@paralleldrive/cuid2": "^2.2.2",
    "@pothos/core": "^4.6.0",
    "@pothos/plugin-directives": "^4.2.0",
    "@pothos/plugin-drizzle": "^0.8.1",
    "@pothos/plugin-federation": "^4.3.2",
    "@sindresorhus/slugify": "^2.2.1",
    "cloudflare:workers": "^0.5.0",
    "drizzle-kit": "^0.30.6",
    "drizzle-orm": "^0.38.4",
    "drizzle-zod": "^0.6.1",
    "graphql": "^16.10.0",
    "graphql-scalars": "^1.24.2",
    "graphql-yoga": "^5.13.4",
    "zod": "^3.24.3"
  },
  "devDependencies": {
    "@biomejs/biome": "^1.9.4",
    "@cloudflare/workers-types": "^4.20250426.0",
    "@types/bun": "latest",
    "@types/node": "^22.15.2",
    "wrangler": "^4.13.2"
  }
}
```

### 3. Data Model Setup

#### data-model/schema.ts
Define your database schema using Drizzle ORM:

```typescript
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const exampleTable = sqliteTable("examples", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});
```

#### data-model/client.ts
Set up the database client for Cloudflare D1:

```typescript
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema.ts";

let db: ReturnType<typeof drizzle> | undefined;

export const getDatabase = (env: { DB: D1Database }) => {
  if (!db) {
    db = drizzle(env.DB, { schema });
  }
  
  return db;
};

export { db };
```

#### data-model/drizzle.config.ts
Configure Drizzle for Cloudflare D1:

```typescript
import type { Config } from "drizzle-kit";

export default {
  schema: "./data-model/schema.ts",
  out: "./data-model/migrations",
  dialect: "sqlite",
  driver: "d1-http",
  dbCredentials: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
    databaseId: process.env.CLOUDFLARE_DATABASE_ID!,
    token: process.env.CLOUDFLARE_D1_TOKEN!,
  },
} satisfies Config;
```

### 4. GraphQL Read Model

#### read-model/schema.ts
Define your GraphQL schema with federation support:

```typescript
import schemaBuilder from "@pothos/core";
import directivesPlugin from "@pothos/plugin-directives";
import drizzlePlugin from "@pothos/plugin-drizzle";
import federationPlugin from "@pothos/plugin-federation";
import { eq } from "drizzle-orm";
import type { GraphQLSchema } from "graphql";
import { getDatabase } from "../data-model/client.ts";
import * as dataSchema from "../data-model/schema.ts";

export interface PothosTypes {
  DrizzleSchema: typeof dataSchema;
}

const buildSchema = (env: { DB: D1Database }) => {
  const db = getDatabase(env);

  const builder = new schemaBuilder<PothosTypes>({
    plugins: [directivesPlugin, drizzlePlugin, federationPlugin],
    drizzle: {
      client: db,
    },
  });

  // Define your GraphQL type
  const exampleRef = builder.drizzleObject("exampleTable", {
    name: "Example",
    fields: (t) => ({
      id: t.exposeString("id"),
      name: t.exposeString("name"),
    }),
  });

  // Make it a federation entity
  builder.asEntity(exampleRef, {
    key: builder.selection<{ id: string }>("id"),
    resolveReference: (example) =>
      db.query.exampleTable
        .findFirst({
          where: eq(dataSchema.exampleTable.id, example.id),
        })
        .execute(),
  });

  // Define queries
  builder.queryType({
    fields: (t) => ({
      exampleById: t.field({
        type: exampleRef,
        args: {
          id: t.arg({
            type: "String",
            required: true,
          }),
        },
        resolve: (_root, args, _ctx) =>
          db.query.exampleTable
            .findFirst({
              where: eq(dataSchema.exampleTable.id, args.id),
            })
            .execute(),
      }),
    }),
  });

  return builder;
};

export const getSchema = (env: { DB: D1Database }): GraphQLSchema => {
  const builder = buildSchema(env);

  return builder.toSubGraphSchema({
    linkUrl: "https://specs.apollo.dev/federation/v2.6",
    federationDirectives: ["@extends", "@external", "@key"],
  });
};
```

#### read-model/main.ts
Worker entry point with D1 binding:

```typescript
import { createYoga } from "graphql-yoga";
import { getSchema } from "./schema.ts";

export interface Env {
  DB: D1Database;
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const yoga = createYoga({
      schema: getSchema(env),
      graphqlEndpoint: "/",
    });
    
    return yoga.fetch(request, env, ctx);
  },
};
```

#### read-model/publish.ts
Schema publishing script:

```typescript
import { printSchemaWithDirectives } from "@graphql-tools/utils";
import { lexicographicSortSchema } from "graphql";
import { getSchema } from "./schema.ts";
import { writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const schemaAsString = printSchemaWithDirectives(
  lexicographicSortSchema(getSchema()),
  {
    pathToDirectivesInExtensions: [""],
  },
);

const __dirname = dirname(fileURLToPath(import.meta.url));
writeFileSync(`${__dirname}/schema.gql`, schemaAsString);
```

#### read-model/wrangler.jsonc
Cloudflare Worker configuration:

```jsonc
{
  "$schema": "https://unpkg.com/wrangler/config-schema.json",
  "name": "<service-name>-read-model",
  "main": "./main.ts",

  "compatibility_date": "2025-04-05",
  "compatibility_flags": ["nodejs_compat"],

  "keep_vars": false,
  "minify": true,

  "observability": {
    "enabled": true,
    "head_sampling_rate": 1,
    "logs": {
      "enabled": true,
      "invocation_logs": true,
      "head_sampling_rate": 1
    }
  },

  "placement": {
    "mode": "smart"
  },

  "workers_dev": true,
  
  // D1 Database binding
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "<service-name>-db",
      "database_id": "<your-database-id>"
    }
  ]
}
```

### 5. Write Model (Optional)

For services that need write operations, use Cloudflare Workflows for durable execution:

#### write-model/workflow.ts
```typescript
import {
  WorkflowEntrypoint,
  WorkflowStep,
  WorkflowEvent,
} from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import { z } from "zod";
import { CreateExample } from "../data-model/integrations/zod.ts";
import { exampleTable } from "../data-model/schema.ts";

export interface Env {
  DB: D1Database;
}

type CreateExampleParams = z.infer<typeof CreateExample>;

export class ExampleWriteWorkflow extends WorkflowEntrypoint<
  Env,
  CreateExampleParams
> {
  async run(event: WorkflowEvent<CreateExampleParams>, step: WorkflowStep) {
    const db = drizzle(this.env.DB);

    // Step 1: Validate input
    const validatedData = await step.do(
      "validate input",
      async () => {
        try {
          return CreateExample.parse(event.payload);
        } catch (error) {
          throw new Error(`Validation failed: ${error.message}`);
        }
      }
    );

    // Step 2: Insert into database with retry logic
    const result = await step.do(
      "insert into database",
      {
        retries: {
          limit: 3,
          delay: "1 second",
          backoff: "exponential",
        },
        timeout: "30 seconds",
      },
      async () => {
        try {
          const inserted = await db
            .insert(exampleTable)
            .values(validatedData)
            .returning()
            .get();
          
          return inserted;
        } catch (error) {
          throw new Error(`Database insert failed: ${error.message}`);
        }
      }
    );

    // Step 3: Post-processing (optional)
    await step.do(
      "post-processing",
      async () => {
        // Perform any additional tasks like sending notifications,
        // updating caches, or triggering other workflows
        console.log(`Successfully created example with ID: ${result.id}`);
      }
    );

    return {
      success: true,
      data: result,
    };
  }
}
```

#### write-model/main.ts
```typescript
import type { ExampleWriteWorkflow } from "./workflow.ts";

export interface Env {
  DB: D1Database;
  EXAMPLE_WORKFLOW: Workflow<typeof ExampleWriteWorkflow>;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    // Parse request URL
    const url = new URL(request.url);
    
    // Handle workflow execution
    if (url.pathname === "/create" && request.method === "POST") {
      try {
        const data = await request.json();
        
        // Create a new workflow instance
        const instance = await env.EXAMPLE_WORKFLOW.create({
          id: crypto.randomUUID(),
          params: data,
        });
        
        // Return workflow instance details
        return new Response(
          JSON.stringify({
            success: true,
            workflowId: instance.id,
            status: await instance.status(),
          }),
          {
            headers: { "Content-Type": "application/json" },
          }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }
    
    // Handle workflow status check
    if (url.pathname.startsWith("/status/") && request.method === "GET") {
      const workflowId = url.pathname.split("/")[2];
      
      try {
        const instance = await env.EXAMPLE_WORKFLOW.get(workflowId);
        const status = await instance.status();
        
        return new Response(
          JSON.stringify({
            workflowId,
            status,
          }),
          {
            headers: { "Content-Type": "application/json" },
          }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({ error: "Workflow not found" }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }
    
    return new Response("Method not allowed", { status: 405 });
  },
};
```

#### write-model/wrangler.jsonc
```jsonc
{
  "$schema": "https://unpkg.com/wrangler/config-schema.json",
  "name": "<service-name>-write-model",
  "main": "./main.ts",

  "compatibility_date": "2025-04-05",
  "compatibility_flags": ["nodejs_compat"],

  "keep_vars": false,
  "minify": true,

  "observability": {
    "enabled": true,
    "head_sampling_rate": 1,
    "logs": {
      "enabled": true,
      "invocation_logs": true,
      "head_sampling_rate": 1
    }
  },

  "placement": {
    "mode": "smart"
  },

  "workers_dev": true,
  
  // D1 Database binding
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "<service-name>-db",
      "database_id": "<your-database-id>"
    }
  ],
  
  // Workflow binding
  "workflows": [
    {
      "name": "example-workflow",
      "binding": "EXAMPLE_WORKFLOW",
      "class_name": "ExampleWriteWorkflow",
      "script_name": "./workflow.ts"
    }
  ]
}
```

## Federation Best Practices

1. **Entity Keys**: Always define federation keys for types that need to be referenced by other services
2. **Minimal Schema**: Keep each service's schema minimal and focused on its domain
3. **Extend Types**: Use federation to extend types from other services rather than duplicating data
4. **Consistent Naming**: Use consistent naming conventions across services

## Extending Existing Types

To extend a type from another service:

```typescript
// Extend the Video type from the videos service
const videoRef = builder.externalRef("Video", 
  builder.selection<{ id: string }>("id")
);

// Add new fields to Video
builder.objectField(videoRef, "customField", (t) =>
  t.string({
    resolve: async (video) => {
      // Custom logic to resolve the field
      return "custom value";
    },
  })
);
```

## Testing

1. Create D1 database: `bun run wrangler d1 create <service-name>-db`
2. Run migrations: `bun run wrangler d1 migrations apply <service-name>-db`
3. Test locally: `bun run wrangler dev --local --persist-to=.wrangler`
4. Publish schema: `bun run read-model/publish.ts`
5. Deploy: `bun run wrangler deploy`

## Environment Variables

Required environment variables for local development:

- `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare account ID
- `CLOUDFLARE_DATABASE_ID`: The D1 database ID
- `CLOUDFLARE_D1_TOKEN`: Authentication token for D1

Note: In production, D1 databases are bound directly to Workers via wrangler.toml

## Common Patterns

### Pagination

```typescript
args: {
  limit: t.arg({ type: "Int", required: false }),
  offset: t.arg({ type: "Int", required: false }),
},
resolve: (_root, args, _ctx) =>
  db.query.exampleTable
    .findMany({
      limit: args.limit ?? 15,
      offset: args.offset ?? 0,
    })
    .execute(),
```

### Authentication Context

```typescript
interface Context {
  jwt: {
    payload: {
      sub: string;
      given_name: string;
      family_name: string;
      picture: string;
      email: string;
    };
  };
}

export interface PothosTypes {
  Context: Context;
  DrizzleSchema: typeof dataSchema;
}
```

### Custom Scalars

```typescript
import { DateResolver } from "graphql-scalars";

builder.addScalarType("Date", DateResolver);
```

## Deployment

Services are automatically deployed via CI/CD when changes are pushed. Each service should have:

1. A Dockerfile for containerized deployments
2. Wrangler configuration for Cloudflare Workers
3. Proper error handling and logging

## Monitoring

All services have observability enabled through Cloudflare Workers with:
- Request logging
- Error tracking
- Performance metrics

Check the Cloudflare dashboard for service metrics and logs.