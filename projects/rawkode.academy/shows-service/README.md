# Shows Service

## Local Development

### Database

This dagger command will provision a libsql server and run the migrations.

```shell '{"name": "dev"}'
dagger call dev up
```

### Read Model

```shell '{"name": "read-model"}'
deno run --allow-env --allow-net read-model/index.ts
```

## Deploy

### Read Model

```shell '{"name": "deploy-read-model"}'
export LIBSQL_URL=""
export LIBSQL_TOKEN=""

deployctl deploy --config=deployctl-read-model.json --org="Rawkode Academy" --env=LIBSQL_URL=${LIBSQL_URL} --env=LIBSQL_TOKEN=${LIBSQL_TOKEN}

deno run -A read-model/getSchema.ts | rover subgraph check rawkode-academy-production@current --name shows --schema -

deno run -A read-model/getSchema.ts | rover subgraph publish rawkode-academy-production@current --routing-url https://plt-shows-r.deno.dev/ --name shows --schema -
```

### Write Model

```shell '{"name": "deploy-write-model"}'
export LIBSQL_URL=""
export LIBSQL_TOKEN=""
export RESTATE_IDENTITY_KEY=""

deployctl deploy --config=deployctl-write-model.json --org="Rawkode Academy" --env=RESTATE_IDENTITY_KEY=${RESTATE_IDENTITY_KEY} --env=LIBSQL_URL=${LIBSQL_URL} --env=LIBSQL_TOKEN=${LIBSQL_TOKEN}

deno run -A --no-config 'npm:@restatedev/restate' deployments register https://plt-shows-r.deno.dev/
```
