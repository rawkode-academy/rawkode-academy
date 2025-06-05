---
runme:
  version: v3
shell: bash
---

# Transcription Service

## API Authentication

This service requires API key authentication to prevent unauthorized usage. All requests must include an Authorization header with a Bearer token.

### Setting up the API Key

1. Generate a secure API key (e.g., using `openssl rand -hex 32`)
2. Set the API key as a Cloudflare Worker secret:
   ```bash
   wrangler secret put API_KEY
   ```
3. Enter your API key when prompted

### Making Authenticated Requests

Include the API key in the Authorization header:

```bash
curl -X POST https://your-worker-url/ \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"videoId": "video123", "language": "en"}'
```

### Security Notes

- Keep your API key secure and never commit it to version control
- Rotate API keys regularly
- Consider implementing multiple API keys for different clients in the future

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
      --project rawkode-academy-production \
      --image=europe-west2-docker.pkg.dev/rawkode-academy-production/rawkode-academy/${SERVICE_NAME}-write:${epoch} \
      --tag v${epoch} \
      --region=europe-west2 \
      --use-http2 \
      --allow-unauthenticated \
      --cpu="1" --memory="512Mi" \
      --cpu-boost \
      --set-env-vars="SERVICE_NAME=${SERVICE_NAME},CLOUDFLARE_ACCOUNT_ID=${CLOUDFLARE_ACCOUNT_ID},CLOUDFLARE_R2_BUCKET_NAME=${CLOUDFLARE_R2_BUCKET_NAME}" \
      --set-secrets="DEEPGRAM_API_KEY=deepgram-api-key:latest,RESTATE_IDENTITY_KEY=restate-identity-key:latest,CLOUDFLARE_R2_CONFIG=cloudflare-r2-content:latest"

deno run -A --no-config 'npm:@restatedev/restate@1.3.2' deployments register --yes https://v${epoch}---${SERVICE_NAME}-write-wlnfqm3bkq-nw.a.run.app
```
