---
runme:
  version: v3
shell: bash
---

# Episodes Service

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

op run -- deno --allow-all data-model/migrate.ts
```

### Read Model

```sh {"name":"deploy-read-model"}
deno run --allow-all jsr:@deno/deployctl deploy --prod  --env=LIBSQL_URL=${LIBSQL_URL} --env=LIBSQL_TOKEN=${LIBSQL_TOKEN} --env=SERVICE_NAME=${SERVICE_NAME} --config=deployctl-read-model.json --org="Rawkode Academy"
deno run --allow-all read-model/publish.ts
```

### Write Model

```sh {"name":"deploy-write-model"}
export RESTATE_IDENTITY_KEY="op://sa.rawkode.academy/restate/identity-key"

deno run --allow-all jsr:@deno/deployctl deploy --config=deployctl-write-model.json --org="Rawkode Academy" --env=RESTATE_IDENTITY_KEY=${RESTATE_IDENTITY_KEY} --env=LIBSQL_URL=${LIBSQL_URL} --env=LIBSQL_TOKEN=${LIBSQL_TOKEN}

deno run -A --no-config 'npm:@restatedev/restate' deployments register https://plt-${SERVICE_NAME}-r.deno.dev/
```
