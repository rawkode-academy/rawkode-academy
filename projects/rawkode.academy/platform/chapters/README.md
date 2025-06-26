---
runme:
  version: v3
shell: bash
---

# Chapters Service

## Local Development

### Database

```sh {"name":"create-d1-database"}
wrangler d1 create platform-chapters
```

```sh {"name":"apply-migrations"}
wrangler d1 migrations apply platform-chapters --local
```

### Read Model

```sh {"name":"read-model"}
cd read-model && wrangler dev --local --persist-to=../.wrangler
```

### Checks, Formatting, & Linting

```sh {"name":"check"}
deno fmt --check
deno lint
```

## Migration from Turso to D1

### Export Data from Turso

```sh {"name":"export-turso-data"}
export SERVICE_NAME=chapters
export LIBSQL_URL="https://${SERVICE_NAME}-rawkodeacademy.turso.io"
export LIBSQL_TOKEN="your-turso-token"

deno run --allow-all migrate-turso-to-d1.ts
```

### Import Data to D1

```sh {"name":"import-to-d1"}
wrangler d1 execute platform-chapters --file=chapters-export.sql
```

## Deploy

### Database Migrations

```sh {"name":"production-migrate"}
wrangler d1 migrations apply platform-chapters --remote
```

### Read Model

```sh {"name":"deploy-read-model"}
cd read-model && wrangler deploy

# Publish GraphQL schema
deno run --allow-all read-model/publish.ts
bunx wgc subgraph publish chapters --namespace production --schema ./read-model/schema.gql --routing-url https://chapters-read-model.your-subdomain.workers.dev
```
