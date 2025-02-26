---
runme:
  version: v3
shell: bash
---

# Transcription Service

## Local Development

### Checks, Formatting, & Linting

```sh {"name":"check"}
deno fmt --check
deno lint
```

## Deploy

### Write Model

```sh {"name":"deploy-write-model"}
epoch=$(date +%s)

podman image build --target=write-model --tag europe-west2-docker.pkg.dev/rawkode-academy-production/rawkode-academy/${SERVICE_NAME}-write:${epoch} .
podman image push europe-west2-docker.pkg.dev/rawkode-academy-production/rawkode-academy/${SERVICE_NAME}-write:${epoch}

gcloud run deploy ${SERVICE_NAME}-write \
      --image=europe-west2-docker.pkg.dev/rawkode-academy-production/rawkode-academy/${SERVICE_NAME}-write:${epoch} \
      --tag v${epoch} \
      --region=europe-west2 \
      --use-http2 \
      --allow-unauthenticated \
      --cpu="1" --memory="512Mi" \
      --cpu-boost \
      --set-env-vars="SERVICE_NAME=${SERVICE_NAME},CLOUDFLARE_ACCOUNT_ID=${CLOUDFLARE_ACCOUNT_ID},CLOUDFLARE_R2_BUCKET_NAME=${CLOUDFLARE_R2_BUCKET_NAME}" \
      --set-secrets="DEEPGRAM_API_KEY=deepgram-api-key:latest,RESTATE_IDENTITY_KEY=restate-identity-key:latest,CLOUDFLARE_R2_ACCESS_KEY=cloudflare-r2-videos-access-key:latest,CLOUDFLARE_R2_SECRET_KEY=cloudflare-r2-videos-secret-key:latest"

deno run -A --no-config 'npm:@restatedev/restate@1.1.2' deployments register https://v${epoch}---${SERVICE_NAME}-write-wlnfqm3bkq-nw.a.run.app
```
