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
epoch=$(date +%s)

podman image build --target=read-model --tag europe-west2-docker.pkg.dev/rawkode-academy-production/rawkode-academy/${SERVICE_NAME}-read:${epoch} .
podman image push europe-west2-docker.pkg.dev/rawkode-academy-production/rawkode-academy/${SERVICE_NAME}-read:${epoch}

gcloud run deploy ${SERVICE_NAME}-read \
      --image=europe-west2-docker.pkg.dev/rawkode-academy-production/rawkode-academy/${SERVICE_NAME}-read:${epoch} \
      --region=europe-west2 \
      --use-http2 \
      --allow-unauthenticated \
      --cpu="1" --memory="512Mi" \
      --cpu-boost \
      --set-env-vars="SERVICE_NAME=${SERVICE_NAME},LIBSQL_BASE_URL=rawkodeacademy.turso.io" \
      --set-secrets="LIBSQL_TOKEN=turso-platform-token-rw:latest,SENTRY_DSN=${SERVICE_NAME}-read-sentry-dsn:latest"

deno run --allow-all read-model/publish.ts
bunx wgc subgraph publish ${SERVICE_NAME} --namespace production --schema ./read-model/schema.gql --routing-url https://${SERVICE_NAME}-read-458678766461.europe-west2.run.app
```
