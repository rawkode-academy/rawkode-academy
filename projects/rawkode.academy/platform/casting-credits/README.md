---
runme:
  version: v3
shell: bash
---

# Casting Credits Service

## Local Development

### Database

```sh {"background":"true","name":"dev-db"}
turso dev --port 2000
```

### Read Model

```sh {"name":"read-model"}
# Restricting ENV not working right now:
# https://github.com/denoland/deno/pull/26758
# when we can, add --allow-env=$DENO_ALLOWED_ENV
deno run --allow-env --allow-write=./read-model/schema.gql --allow-net read-model/main.ts
```

### Checks, Formatting, & Linting

```sh {"name":"check"}
deno fmt --check
deno lint
```

## Deploy

### Data Model

```sh {"name":"dev-db"}
export LIBSQL_URL="https://${SERVICE_NAME}-${LIBSQL_BASE_URL}"
export LIBSQL_TOKEN="op://sa.rawkode.academy/turso/platform-group/api-token"

(cd data-model && op run -- deno --allow-all migrate.ts)
```

### Read Model

```sh {"name":"deploy-read-model"}
(cd read-model && bunx wrangler deploy --var SERVICE_NAME=${SERVICE_NAME} --var LIBSQL_BASE_URL=${LIBSQL_BASE_URL})

bun run read-model/publish.ts
bunx wgc subgraph publish ${SERVICE_NAME} --namespace production --schema ./read-model/schema.gql --routing-url https://${SERVICE_NAME}.api.rawkode.academy
```
