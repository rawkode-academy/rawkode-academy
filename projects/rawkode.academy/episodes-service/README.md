---
shell: bash
---

# Episodes Service

## Local Development

### Database

```sh {"name":"dev-db"}
turso dev --port 2000
```

### Read Model

```sh {"name":"read-model"}
deno run --allow-all read-model/main.ts
```

### Checks, Formatting, & Linting

```sh {"name":"check"}
deno fmt --check
deno lint
```

## Deploy

### Data Model

```sh {"name":"deploy-data-model"}
export LIBSQL_URL="https://episodes-rawkodeacademy.turso.io"
export LIBSQL_TOKEN="op://sa.rawkode.academy/turso/platform-group/api-token"

op run -- deno --allow-all data-model/migrate.ts
```

### Read Model

```sh {"name":"deploy-read-model"}
deno run --allow-all jsr:@deno/deployctl deploy --prod --config=deployctl-read-model.json --org="Rawkode Academy"
deno run --allow-all read-model/schema.ts
bunx wgc subgraph publish people --namespace production --schema ./read-model/schema.gql --routing-url https://plt-episodes-r.deno.dev
```

### Write Model

```sh {"name":"deploy-write-model"}
export RESTATE_IDENTITY_KEY="op://sa.rawkode.academy/restate/identity-key"

deno run --allow-all jsr:@deno/deployctl deploy --config=deployctl-write-model.json --org="Rawkode Academy" --env=RESTATE_IDENTITY_KEY=${RESTATE_IDENTITY_KEY} --env=LIBSQL_URL=${LIBSQL_URL} --env=LIBSQL_TOKEN=${LIBSQL_TOKEN}

deno run -A --no-config 'npm:@restatedev/restate' deployments register https://plt-episodes-r.deno.dev/
```
