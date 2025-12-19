# email-service

A platform service for the Rawkode Academy.

## Components

This service includes: http

## Development

```bash
# Install dependencies
bun install

# Run development server (read-model)
bunx wrangler dev --config ./read-model/wrangler.jsonc

# Generate database migrations
bunx drizzle-kit generate

# Apply migrations
bunx wrangler d1 migrations apply DB --config ./read-model/wrangler.jsonc
```

## Deployment

```bash
bunx wrangler deploy --config ./read-model/wrangler.jsonc
```