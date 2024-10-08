---
shell: bash
---

# People Service

## Local Development

### Database

This dagger command will provision a libsql server and run the migrations.

```shell '{"name": "dev"}'
dagger call dev up
```

### Read Model

```shell '{"name": "read-model"}'
deno run --allow-env --allow-read --allow-net read-model/main.ts
```

## Deploy

### Data Model

```shell {name=deploy-data-model}
export LIBSQL_TOKEN="op://sa.rawkode.academy/turso/platform-group/api-token"
export LIBSQL_URL="https://people-rawkodeacademy.turso.io"

cd data-model
op run -- deno run --allow-all migrate.ts
```


### Read Model

```shell '{"name": "deploy-read-model"}'
deno run --allow-all --no-config 'jsr:@deno/deployctl' deploy --config=deployctl-read-model.json --org="Rawkode Academy" --project plt-people-r --prod

bunx wgc subgraph publish people --namespace production --schema ./read-model/schema.graphql --routing-url https://plt-people-r.deno.dev
```

### Write Model

```shell '{"name": "deploy-write-model"}'
export LIBSQL_URL=""
export LIBSQL_TOKEN=""
export RESTATE_IDENTITY_KEY=""

deployctl deploy --config=deployctl-write-model.json --org="Rawkode Academy" --env=RESTATE_IDENTITY_KEY=${RESTATE_IDENTITY_KEY} --env=LIBSQL_URL=${LIBSQL_URL} --env=LIBSQL_TOKEN=${LIBSQL_TOKEN}

deno run -A --no-config 'npm:@restatedev/restate' deployments register https://plt-people-r.deno.dev/
```
