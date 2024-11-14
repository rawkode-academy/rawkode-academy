---
runme:
  version: v3
shell: bash
---

# People Service

## Local Development

### Database

```sh {"background":"true","name":"dev-db"}
turso dev --port 2000
```

### Read Model

```shell {"name":"dev-read-model"}
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

```shell {"name":"deploy-data-model"}
export LIBSQL_URL="https://${SERVICE_NAME}-${LIBSQL_BASE_URL}"
export LIBSQL_TOKEN="op://sa.rawkode.academy/turso/platform-group/api-token"

cd ./data-model
op run -- deno run --allow-all ./migrate.ts
```

### Read Model

```shell {"name":"deploy-read-model"}
deno run --allow-all jsr:@deno/deployctl deploy --prod --config=deployctl-read-model.json --org="Rawkode Academy"
deno run --allow-all read-model/schema.ts
bunx wgc subgraph publish ${SERVICE_NAME} --namespace production --schema ./read-model/schema.gql --routing-url https://plt-${SERVICE_NAME}-r.deno.dev
```

### Write Model

```sh {"name":"deploy-write-model"}
export RESTATE_IDENTITY_KEY="op://sa.rawkode.academy/restate/identity-key"

deno run --allow-all jsr:@deno/deployctl deploy --config=deployctl-write-model.json --org="Rawkode Academy" --env=RESTATE_IDENTITY_KEY=${RESTATE_IDENTITY_KEY} --env=LIBSQL_URL=${LIBSQL_URL} --env=LIBSQL_TOKEN=${LIBSQL_TOKEN}

deno run -A --no-config 'npm:@restatedev/restate' deployments register https://plt-${SERVICE_NAME}-r.deno.dev/
```
