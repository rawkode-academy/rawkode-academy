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

```sh {"name":"deploy"}
cuenv exec -e production bun x wrangler deploy --config ./wrangler.jsonc
```

Transcription uses the Cloudflare Workers AI binding with
`@cf/deepgram/nova-3`; no direct Deepgram API secret is required.
