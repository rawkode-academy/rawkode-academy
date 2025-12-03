# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the main Rawkode Academy project containing the website, API gateway, platform microservices, and supporting tools. All services run on Cloudflare Workers with D1 databases.

## Common Commands

### Environment Setup

Most directories have an `env.cue` file. Use `cuenv` for environment management:
```bash
cuenv task <name>              # Run task with environment variables loaded
cuenv exec <cmd>               # Run arbitrary command with env vars
```

### Platform Services (with `.projenrc.ts`)

```bash
bun run .projenrc.ts           # Regenerate projen-managed files
bunx wrangler d1 create <name> # Create new D1 database
bunx drizzle-kit generate      # Generate Drizzle migrations
bunx wrangler d1 migrations apply <db-name>  # Apply migrations
bunx wrangler deploy --config ./read-model/wrangler.jsonc   # Deploy read model
bunx wrangler deploy --config ./write-model/wrangler.jsonc  # Deploy write model
```

### Typical Service Tasks (via env.cue)

```bash
cuenv task install             # Install dependencies
cuenv task deploy              # Deploy all models
```

## Architecture

### Platform Services (`platform/`)

Services follow a CQRS pattern with read/write separation:

```
platform/<service-name>/
├── .projenrc.ts          # Projen configuration (defines service structure)
├── env.cue               # Environment and CI/CD tasks
├── data-model/           # Drizzle schema, migrations, database client
│   ├── schema.ts         # Database schema
│   ├── client.ts         # D1 client initialization
│   └── migrations/       # SQL migrations
├── read-model/           # GraphQL subgraph (Pothos + Yoga)
│   ├── schema.ts         # GraphQL schema with federation
│   ├── main.ts           # Worker entry point
│   └── wrangler.jsonc    # Cloudflare Worker config
└── write-model/          # Cloudflare Workflows for mutations
    ├── workflow.ts       # Workflow definitions
    ├── main.ts           # HTTP trigger entry point
    └── wrangler.jsonc    # Worker config
```

### Projen Service Generator (`generators/projen-platform-service/`)

Use projen to scaffold new platform services. The `PlatformService` class generates:
- Package.json with correct dependencies
- TypeScript and Biome configs
- Wrangler configurations with bindings
- README documentation

**Creating a new service:**

```typescript
// platform/<service-name>/.projenrc.ts
import { PlatformService } from '../../generators/projen-platform-service/src/';

const project = new PlatformService({
  serviceName: 'my-service',
  includeWriteModel: true,      // Optional: enables write model
  includeRpc: false,            // Optional: enables RPC service
  bindings: {
    d1Databases: [{
      binding: "DB",
      database_name: "platform-my-service",
      database_id: "<your-database-id>",
    }],
    workflows: [{                // Optional: for write model workflows
      binding: "myWorkflow",
      name: "my-workflow",
      class_name: "MyWorkflowClass",
    }],
  },
  additionalDependencies: {},    // Optional: extra npm deps
});

project.synth();
```

**Available binding types:** d1Databases, kvNamespaces, r2Buckets, services, workflows, secretStoreSecrets, sendEmail, ai, vars, crons

### GraphQL Federation

- Gateway runs at `api/` using GraphQL Hive Gateway
- Services expose subgraphs using `@pothos/plugin-federation`
- Service-to-service communication uses Cloudflare Service Bindings (zero-latency)
- Extend types from other services using `builder.externalRef()`

### Database

- **All new services must use Cloudflare D1** (not Turso/LibSQL)
- Database client initialized in `data-model/client.ts` using `drizzle-orm/d1`
- Zod schemas generated in `data-model/integrations/zod.ts` via `drizzle-zod`

## CI/CD

Pipelines defined in `env.cue` files:
- `default`: Runs on main branch (install → deploy)
- `pull-request`: Runs on PRs (install only)

Deployment uses `bunx wrangler deploy` with the appropriate wrangler.jsonc config.

## Key Patterns

### Cloudflare Workflows (Write Model)

Write operations use Cloudflare Workflows for durable execution:
- Validates input with Zod schemas
- Executes database operations with retry logic
- Returns workflow instance ID for status tracking

### GraphQL Schema Registration

Read models publish their schema for federation composition:
```bash
bun run read-model/publish.ts  # Generates schema.gql
```

## Related Documentation

- `platform/CLAUDE.md` - Detailed GraphQL microservices guide
- `website/CLAUDE.md` - Website design system and components
- Root `CLAUDE.md` - Monorepo overview and conventions
