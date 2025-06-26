# People Service



## Overview

This is a GraphQL microservice that provides people functionality for the Rawkode Academy platform. It uses:

- **GraphQL Federation**: Apollo Federation v2 for schema composition
- **Database**: Cloudflare D1 (SQLite) with Drizzle ORM
- **Runtime**: Cloudflare Workers
- **Language**: TypeScript with strict mode

## Service Structure

```
people/
├── data-model/          # Database schema and migrations
├── read-model/          # GraphQL read API
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
   bun run wrangler d1 create people-db
   ```

3. Update `wrangler.jsonc` files with your database ID

4. Run migrations:
   ```bash
   bun run wrangler d1 migrations apply people-db
   ```

### Local Development

```bash
# Start the read model locally
cd read-model && bun run wrangler dev --local --persist-to=.wrangler
```

### Schema Changes

1. Modify `data-model/schema.ts`
2. Generate migration:
   ```bash
   bun run drizzle-kit generate
   ```
3. Apply migration:
   ```bash
   bun run wrangler d1 migrations apply people-db
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
```

## GraphQL Schema

The service exposes the following GraphQL types:

- ``: Main entity type

### Example Queries

```graphql
query GetById {
  peopleById(id: "...") {
    id
    createdAt
    updatedAt
  }
}
```

## Testing

Tests have not been configured for this service.

## Environment Variables

- `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare account ID
- `CLOUDFLARE_DATABASE_ID`: The D1 database ID
- `CLOUDFLARE_D1_TOKEN`: Authentication token for D1

## Monitoring

Service metrics and logs are available in the Cloudflare dashboard under Workers & Pages.