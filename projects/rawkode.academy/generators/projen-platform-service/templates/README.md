# {{ serviceNamePascal }} Service

{{ serviceDescription }}

## Overview

This is a GraphQL microservice that provides {{ serviceName }} functionality for the Rawkode Academy platform. It uses:

- **GraphQL Federation**: Apollo Federation v2 for schema composition
- **Database**: Cloudflare D1 (SQLite) with Drizzle ORM
- **Runtime**: Cloudflare Workers
- **Language**: TypeScript with strict mode

## Service Structure

```
{{ serviceName }}/
├── data-model/          # Database schema and migrations
├── read-model/          # GraphQL read API
{%- if includeWriteModel %}
├── write-model/         # Write operations via Cloudflare Workflows
{%- endif %}
└── package.json
```

## Development

### Prerequisites

- Bun runtime
- Cloudflare account with D1 access
- Wrangler CLI

### Setup

1. Install dependencies:
   ```bash
   bun install
   ```

2. Create D1 database (if not already created):
   ```bash
   bun run wrangler d1 create platform-{{ serviceName }}
   ```

### Local Development

```bash
# Start the read model locally
cd read-model && bun run wrangler dev --local --persist-to=.wrangler
{%- if includeWriteModel %}

# Start the write model locally (in another terminal)
cd write-model && bun run wrangler dev --local --persist-to=.wrangler
{%- endif %}
```

### Schema Changes

1. Modify `data-model/schema.ts`
2. Generate migration:
   ```bash
   bun run drizzle-kit generate
   ```
3. Apply migration:
   ```bash
   bun run wrangler d1 migrations apply platform-{{ serviceName }}
   ```
4. Update GraphQL schema in `read-model/schema.ts`

## Deployment

Just merge to main, we got this.
