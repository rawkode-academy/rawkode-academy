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

```sh {"name":"migrate-production"}
export LIBSQL_URL="https://${SERVICE_NAME}-${LIBSQL_BASE_URL}"
export LIBSQL_TOKEN="op://sa.rawkode.academy/turso/platform-group/api-token"

op run -- deno --allow-all data-model/migrate.ts
```

### Read Model

```sh {"name":"deploy-read-model"}
epoch=$(date +%s)

podman image build --target=read-model --tag europe-west2-docker.pkg.dev/rawkode-academy-production/rawkode-academy/episodes-read:${epoch} .
podman image push europe-west2-docker.pkg.dev/rawkode-academy-production/rawkode-academy/episodes-read:${epoch}

gcloud run deploy episodes-read \
      --image=europe-west2-docker.pkg.dev/rawkode-academy-production/rawkode-academy/episodes-read:${epoch} \
      --region=europe-west2 \
      --use-http2 \
      --allow-unauthenticated \
      --cpu="1" --memory="512Mi" \
      --cpu-boost \
      --set-env-vars="SERVICE_NAME=episodes,LIBSQL_BASE_URL=rawkodeacademy.turso.io" \
      --set-secrets="LIBSQL_TOKEN=turso-platform-token-rw:latest"

deno run --allow-all read-model/publish.ts
bunx wgc subgraph publish episodes --namespace production --schema ./read-model/schema.gql --routing-url https://episodes-read-458678766461.europe-west2.run.app
```

### Write Model

```sh {"name":"deploy-write-model"}
epoch=$(date +%s)

podman image build --target=write-model --tag europe-west2-docker.pkg.dev/rawkode-academy-production/rawkode-academy/episodes-write:${epoch} .
podman image push europe-west2-docker.pkg.dev/rawkode-academy-production/rawkode-academy/episodes-write:${epoch}

gcloud run deploy episodes-write \
      --image=europe-west2-docker.pkg.dev/rawkode-academy-production/rawkode-academy/episodes-write:${epoch} \
      --tag v${epoch} \
      --region=europe-west2 \
      --use-http2 \
      --allow-unauthenticated \
      --cpu="1" --memory="512Mi" \
      --cpu-boost \
      --set-env-vars="SERVICE_NAME=episodes,LIBSQL_BASE_URL=rawkodeacademy.turso.io" \
      --set-secrets="LIBSQL_TOKEN=turso-platform-token-rw:latest,RESTATE_IDENTITY_KEY=restate-identity-key:latest"

deno run -A --no-config 'npm:@restatedev/restate' deployments register https://v${epoch}---episodes-write-wlnfqm3bkq-nw.a.run.app
```
