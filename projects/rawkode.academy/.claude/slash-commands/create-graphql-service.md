---
name: create-graphql-service
description: Create a new GraphQL microservice with federation support
---

# Create GraphQL Service

You are going to help create a new GraphQL microservice for the Rawkode Academy platform that follows the established architecture patterns.

## Service Architecture Overview

Each service follows a three-layer architecture:
1. **Data Model** - Database schema using Drizzle ORM with Cloudflare D1
2. **Read Model** - GraphQL API using Pothos with Apollo Federation
3. **Write Model** (optional) - Either Hono HTTP API or Cloudflare Workflows

## Required Information

Ask the user for:
1. **Service name** (kebab-case, e.g., "video-comments", "user-preferences")
2. **Description** - What does this service manage?
3. **Data model** - What are the main tables and fields?
4. **Federation strategy**:
   - What new types does this service own?
   - What existing types does it extend (Video, Person, Show, Technology)?
   - What relationships does it manage?
5. **Write operations needed** (if any):
   - Simple CRUD? Use Hono
   - Complex workflows with retries? Use Cloudflare Workflows

## Implementation Steps

### Step 1: Create Directory Structure
```bash
mkdir -p platform/<service-name>/{data-model,read-model,write-model}
mkdir -p platform/<service-name>/data-model/{migrations,integrations}
mkdir -p platform/<service-name>/tests/integration
```

### Step 2: Create package.json
Location: `platform/<service-name>/package.json`

Use these dependencies:
```json
{
  "name": "<service-name>",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev --local --persist-to=.wrangler",
    "deploy": "wrangler deploy",
    "db:generate": "drizzle-kit generate",
    "db:push": "drizzle-kit push",
    "publish:schema": "bun run read-model/publish.ts",
    "test": "bun test",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@apollo/subgraph": "^2.10.2",
    "@graphql-tools/utils": "^10.8.6",
    "@paralleldrive/cuid2": "^2.2.2",
    "@pothos/core": "^4.6.0",
    "@pothos/plugin-directives": "^4.2.0",
    "@pothos/plugin-drizzle": "^0.8.1",
    "@pothos/plugin-federation": "^4.3.2",
    "@sindresorhus/slugify": "^2.2.1",
    "cloudflare:workers": "^0.5.0",
    "drizzle-orm": "^0.38.4",
    "drizzle-zod": "^0.6.1",
    "graphql": "^16.10.0",
    "graphql-scalars": "^1.24.2",
    "graphql-yoga": "^5.13.4",
    "hono": "^4.6.17",
    "zod": "^3.24.3"
  },
  "devDependencies": {
    "@biomejs/biome": "^1.9.4",
    "@cloudflare/workers-types": "^4.20250426.0",
    "@types/bun": "latest",
    "@types/node": "^22.15.2",
    "drizzle-kit": "^0.30.6",
    "wrangler": "^4.13.2"
  }
}
```

### Step 3: Create Data Model

#### data-model/schema.ts
```typescript
import { createId } from "@paralleldrive/cuid2";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// Define your tables based on user requirements
// Example:
export const <tableName>Table = sqliteTable("<table_name>", {
  id: text("id").primaryKey().$default(createId),
  // Add fields based on requirements
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$default(() => new Date()),
});
```

#### data-model/integrations/zod.ts
```typescript
import { createSelectSchema, createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import * as schema from "../schema";

// Generate Zod schemas from Drizzle tables
export const <TableName>Schema = createSelectSchema(schema.<tableName>Table);
export const Create<TableName> = createInsertSchema(schema.<tableName>Table);

// Add custom validations if needed
```

#### data-model/drizzle.config.ts
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

### Step 4: Create Read Model

#### read-model/schema.ts
```typescript
import schemaBuilder from "@pothos/core";
import directivesPlugin from "@pothos/plugin-directives";
import drizzlePlugin from "@pothos/plugin-drizzle";
import federationPlugin from "@pothos/plugin-federation";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import type { GraphQLSchema } from "graphql";
import * as dataSchema from "../data-model/schema.ts";

export interface PothosTypes {
  DrizzleSchema: typeof dataSchema;
}

export const getSchema = (env: Env): GraphQLSchema => {
  const db = drizzle(env.DB, { schema: dataSchema });

  const builder = new schemaBuilder<PothosTypes>({
    plugins: [directivesPlugin, drizzlePlugin, federationPlugin],
    drizzle: {
      client: db,
      schema: dataSchema,
    },
  });

  // Define your GraphQL types
  // If creating a new entity:
  const <typeName>Ref = builder.drizzleObject("<tableName>Table", {
    name: "<TypeName>",
    fields: (t) => ({
      id: t.exposeString("id"),
      // Add other fields
    }),
  });

  // Make it a federation entity if needed
  builder.asEntity(<typeName>Ref, {
    key: builder.selection<{ id: string }>("id"),
    resolveReference: async (<param>) =>
      await db.query.<tableName>Table.findFirst({
        where: eq(dataSchema.<tableName>Table.id, <param>.id),
      }).execute(),
  });

  // If extending an existing type (e.g., Video, Person):
  const videoRef = builder.externalRef(
    "Video",
    builder.selection<{ id: string }>("id")
  ).implement({
    externalFields: (t) => ({
      id: t.string(),
    }),
    fields: (t) => ({
      // Add new fields to the external type
    }),
  });

  // Define queries
  builder.queryType({
    fields: (t) => ({
      // Add your queries
    }),
  });

  return builder.toSubGraphSchema({
    linkUrl: "https://specs.apollo.dev/federation/v2.6",
    federationDirectives: ["@extends", "@external", "@key"],
  });
};
```

#### read-model/main.ts
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
```typescript
import { printSchemaWithDirectives } from "@graphql-tools/utils";
import { lexicographicSortSchema } from "graphql";
import { getSchema } from "./schema.ts";
import { writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Mock env for schema generation
const mockEnv = {
  DB: {} as any
};

const schemaAsString = printSchemaWithDirectives(
  lexicographicSortSchema(getSchema(mockEnv)),
  {
    pathToDirectivesInExtensions: [""],
  },
);

const __dirname = dirname(fileURLToPath(import.meta.url));
writeFileSync(`${__dirname}/schema.gql`, schemaAsString);
console.log("Schema published to read-model/schema.gql");
```

#### read-model/wrangler.jsonc
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
  
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "<service-name>-db",
      "database_id": "<will-be-set-after-creation>"
    }
  ]
}
```

### Step 5: Create Write Model (if needed)

#### For Simple CRUD - write-model/main.ts (Hono)
```typescript
import type { D1Database } from "@cloudflare/workers-types";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { Create<TableName> } from "../data-model/integrations/zod.ts";
import * as schema from "../data-model/schema.ts";

type Bindings = {
  DB: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>();

app.post("/", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  
  const newItem = Create<TableName>.safeParse(await c.req.json());
  
  if (newItem.success === false) {
    return c.json({ error: newItem.error.flatten() }, { status: 400 });
  }

  try {
    const result = await db
      .insert(schema.<tableName>Table)
      .values(newItem.data)
      .returning()
      .get();

    return c.json(
      {
        success: true,
        message: "Created successfully",
        data: result,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error creating:", error);
    return c.json(
      { error: "Failed to create" },
      { status: 500 },
    );
  }
});

export default app;
```

#### For Complex Workflows - write-model/workflow.ts
```typescript
import { WorkflowEntrypoint, WorkflowStep, type WorkflowEvent } from 'cloudflare:workers';
import { drizzle } from 'drizzle-orm/d1';
import { Create<TableName> } from "../data-model/integrations/zod";
import * as schema from "../data-model/schema";

type Env = {
  DB: D1Database;
};

type Params = {
  // Define your workflow parameters
};

export class <ServiceName>Workflow extends WorkflowEntrypoint<Env, Params> {
  async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
    // Step 1: Validate input
    const validatedData = await step.do(
      "validate input",
      async () => {
        // Validation logic
      }
    );

    // Step 2: Database operations with retry
    const result = await step.do(
      "database operation",
      {
        retries: {
          limit: 3,
          delay: "1 second",
          backoff: "exponential",
        },
        timeout: "30 seconds",
      },
      async () => {
        const db = drizzle(this.env.DB);
        // Database logic
      }
    );

    return { success: true, data: result };
  }
}
```

### Step 6: Create Tests

#### tests/integration/graphql-federation.test.ts
```typescript
import { describe, it, expect, beforeEach } from "bun:test";
import { createYoga } from "graphql-yoga";
import { drizzle } from "drizzle-orm/d1";
import { getSchema } from "../../read-model/schema";
import * as schema from "../../data-model/schema";

declare const env: { DB: D1Database };

describe("GraphQL Federation", () => {
  let yoga: ReturnType<typeof createYoga>;

  beforeEach(async () => {
    const db = drizzle(env.DB);
    
    // Clear and seed test data
    await db.delete(schema.<tableName>Table);
    
    yoga = createYoga({
      schema: getSchema(env),
      graphqlEndpoint: "/",
    });
  });

  it("should include federation directives", async () => {
    const query = `
      {
        _service {
          sdl
        }
      }
    `;

    const response = await yoga.fetch("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });

    const result = await response.json();
    expect(result.errors).toBeUndefined();
    
    const sdl = result.data._service.sdl;
    expect(sdl).toContain("@link");
    expect(sdl).toContain("https://specs.apollo.dev/federation/v2.6");
  });
});
```

### Step 7: Setup and Deployment

1. **Create D1 Database**:
   ```bash
   bun run wrangler d1 create <service-name>-db
   ```

2. **Update wrangler.jsonc** with the database ID from step 1

3. **Generate and run migrations**:
   ```bash
   bun run db:generate
   bun run wrangler d1 migrations apply <service-name>-db
   ```

4. **Test locally**:
   ```bash
   bun run dev
   ```

5. **Publish GraphQL schema**:
   ```bash
   bun run publish:schema
   ```

6. **Deploy**:
   ```bash
   bun run deploy
   ```

## Important Conventions

1. **Use Cloudflare D1** - Never use Turso/LibSQL for new services
2. **IDs use CUID2** - For unique, sortable identifiers
3. **Federation keys** - Always define for types that other services reference
4. **Minimal schemas** - Each service should own a focused domain
5. **Type extensions** - Use `externalRef` to extend types from other services
6. **Error handling** - Always validate with Zod and handle errors gracefully
7. **Testing** - Include federation tests to verify schema composition

## File Structure Summary

```
platform/<service-name>/
├── package.json
├── tsconfig.json
├── data-model/
│   ├── schema.ts
│   ├── drizzle.config.ts
│   ├── integrations/
│   │   └── zod.ts
│   └── migrations/
├── read-model/
│   ├── schema.ts
│   ├── main.ts
│   ├── publish.ts
│   ├── schema.gql (generated)
│   └── wrangler.jsonc
├── write-model/ (optional)
│   ├── main.ts (Hono) OR
│   ├── workflow.ts (Workflows)
│   └── wrangler.jsonc
└── tests/
    └── integration/
        └── graphql-federation.test.ts
```

Generate all the files following these patterns exactly. Ensure proper TypeScript types, error handling, and federation setup.