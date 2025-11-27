# {{ serviceNamePascal }} Service

## Overview

This is a GraphQL microservice that provides {{ serviceName }} functionality for the Rawkode Academy platform. It uses:

{%- if includeReadModel %}
- **GraphQL Federation**: Apollo Federation v2 for schema composition
{%- endif %}
{%- if includeDataModel %}
- **Database**: Cloudflare D1 (SQLite) with Drizzle ORM
{%- endif %}
- **Runtime**: Cloudflare Workers
- **Language**: TypeScript with strict mode

## Service Structure

```
{{ serviceName }}/
{%- if includeDataModel %}
├── data-model/          # Database schema and migrations
{%- endif %}
{%- if includeReadModel %}
├── read-model/          # GraphQL read API
{%- endif %}
{%- if includeWriteModel %}
├── write-model/         # Write operations via Cloudflare Workflows
{%- endif %}
└── package.json
```

## Development

### Prerequisites

- Bun runtime
{%- if includeDataModel %}
- Cloudflare account with D1 access
{%- endif %}
- Wrangler CLI

### Setup

1. Install dependencies:
   ```bash
   bun install
   ```
{%- if includeDataModel %}

2. Create D1 database (if not already created):
   ```bash
   bun run wrangler d1 create platform-{{ serviceName }}
   ```
{%- endif %}

### Local Development

```bash
{%- if includeReadModel %}
# Start the read model locally
cd read-model && bun run wrangler dev --local --persist-to=.wrangler
{%- endif %}
{%- if includeWriteModel %}

# Start the write model locally (in another terminal)
cd write-model && bun run wrangler dev --local --persist-to=.wrangler
{%- endif %}
```
{%- if includeDataModel %}

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
{%- if includeReadModel %}
4. Update GraphQL schema in `read-model/schema.ts`
{%- endif %}
{%- endif %}

## Deployment

Just merge to main, we got this.
