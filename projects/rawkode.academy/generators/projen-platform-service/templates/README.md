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
{%- if includeTests %}
├── tests/               # Test suite
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
   bun run wrangler d1 create {{ serviceName }}-db
   ```

3. Update `wrangler.jsonc` files with your database ID

4. Run migrations:
   ```bash
   bun run wrangler d1 migrations apply {{ serviceName }}-db
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
   bun run wrangler d1 migrations apply {{ serviceName }}-db
   ```
4. Update GraphQL schema in `read-model/schema.ts`
5. Publish schema:
   ```bash
   bun run publish:schema
   ```

## Deployment

Deploy to Cloudflare Workers:

```bash
# Deploy read model
bun run deploy:read
{%- if includeWriteModel %}

# Deploy write model
bun run deploy:write
{%- endif %}
```

## GraphQL Schema

The service exposes the following GraphQL types:

- `{{ graphqlTypeName }}`: Main entity type
{%- if extendsVideo %}
- Extends `Video` type from the videos service
{%- endif %}

### Example Queries

```graphql
query Get{{ graphqlTypeName }}ById {
  {{ serviceNameCamel }}ById(id: "...") {
    id
    createdAt
    updatedAt
  }
}
```
{%- if includeWriteModel %}

### Example Mutations

```graphql
mutation Create{{ graphqlTypeName }} {
  create{{ graphqlTypeName }}(input: {
    # Add your input fields here
  }) {
    id
    createdAt
  }
}
```
{%- endif %}

## Testing
{%- if includeTests %}

Run the test suite:

```bash
bun test
```

Tests include:
- Database schema validation
- GraphQL schema validation
- Integration tests
- Federation compatibility tests
{%- else %}

Tests have not been configured for this service.
{%- endif %}

## Environment Variables

- `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare account ID
- `CLOUDFLARE_DATABASE_ID`: The D1 database ID
- `CLOUDFLARE_D1_TOKEN`: Authentication token for D1

## Monitoring

Service metrics and logs are available in the Cloudflare dashboard under Workers & Pages.