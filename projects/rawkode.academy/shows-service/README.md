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

```shell '{"name": "deploy"}'
export LIBSQL_URL=""
export LIBSQL_TOKEN=""

deployctl deploy --org="Rawkode Academy" --project="plt-shows-r" --env=LIBSQL_URL=${LIBSQL_URL} --env=LIBSQL_TOKEN=${LIBSQL_TOKEN} --include=deno.json --include=data-model --include=./read-model --entrypoint=./read-model/index.ts
```
