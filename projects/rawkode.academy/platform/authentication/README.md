# Authentication Service



## Overview

This is an RPC-based authentication service for the Rawkode Academy platform. It uses:

- **Authentication**: Better Auth for passkeys + GitHub OAuth
- **RPC**: Capnweb for efficient service-to-service communication
- **Database**: Cloudflare D1 (SQLite) with Drizzle ORM
- **Runtime**: Cloudflare Workers
- **Language**: TypeScript with strict mode

## Architecture

The service provides:
- **Better Auth Routes**: Sign-in, sign-out, passkey registration, OAuth callbacks
- **RPC Interface**: Type-safe RPC methods for internal service communication via Capnweb

## Service Structure

```
authentication/
├── data-model/          # Database schema and migrations
│   ├── better-auth.ts   # Better Auth configuration
│   ├── schema.ts        # Drizzle schema
│   └── migrations/      # SQL migrations
├── rpc/                 # RPC service
│   ├── main.ts          # Worker entry point
│   ├── rpc-service.ts   # Capnweb RPC methods
│   ├── auth-config.ts   # Better Auth factory
│   └── wrangler.jsonc   # Worker configuration
└── package.json
```

## Development

### Prerequisites

- Bun runtime
- Cloudflare account with D1 access
- Wrangler CLI

### Setup

1. Install dependencies:
   ```bash
   bun install
   ```

2. Create D1 database (if not already created):
   ```bash
   bun run wrangler d1 create platform-authentication
   ```

### Local Development

```bash
# Start the RPC service locally
cd rpc && bun run wrangler dev --local --persist-to=.wrangler
```

The service will be available at `http://localhost:8788`:
- Better Auth routes: `/sign-in/github`, `/sign-out`, `/session`, `/passkey/*`
- RPC endpoint: `/rpc` (for service bindings only)

### Schema Changes

1. Modify `data-model/schema.ts`
2. Generate migration:
   ```bash
   bun run drizzle-kit generate
   ```
3. Apply migration:
   ```bash
   bun run wrangler d1 migrations apply platform-authentication
   ```

### Using the Service

See [SERVICE_BINDING.md](./SERVICE_BINDING.md) for detailed documentation on:
- RPC interface and methods
- Capnweb integration
- Service binding configuration
- Client usage examples

## Deployment

Just merge to main, we got this.
