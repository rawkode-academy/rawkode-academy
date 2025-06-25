# RPC Gateway Service

A centralized RPC gateway for all write operations in the Rawkode Academy platform. This service uses Cloudflare Workers service bindings to directly communicate with write-model workers without requiring external URLs.

## Architecture

The RPC Gateway acts as a unified entry point for all write operations across the platform's microservices. It uses service bindings to directly invoke other Cloudflare Workers, providing:

- **Unified API**: Single endpoint for all write operations
- **Service Discovery**: Dynamic routing to appropriate write models
- **Consistent Error Handling**: Standardized error responses
- **Authentication**: Personal Access Token (PAT) validation via Zitadel
- **Observability**: Structured logging for all requests

## Usage

### Making RPC Calls

Send HTTP requests to `/rpc` using standard HTTP verbs:

```json
{
  "service": "casting-credits",
  "resource": "optional-resource-id",
  "params": {
    "personId": "123",
    "videoId": "456",
    "role": "host"
  }
}
```

The HTTP method determines the operation:
- **POST**: Create a new resource
- **GET**: Retrieve a resource (when services support it)
- **PUT**: Update a resource (when services support it)
- **PATCH**: Partially update a resource (when services support it)
- **DELETE**: Delete a resource (when services support it)

### Response Format

All responses follow a consistent format:

**Success:**
```json
{
  "success": true,
  "data": { ... }
}
```

**Error:**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": { ... }
  }
}
```

### Available Services

Check `/services` endpoint for a list of available services and their methods.

## Development

```bash
# Install dependencies
bun install

# Run locally
bun run dev

# Deploy to Cloudflare
bun run deploy
```

## Adding New Services

1. Deploy the write-model worker to Cloudflare
2. Add service binding in `wrangler.jsonc`:
   ```json
   {
     "binding": "NEW_SERVICE_WRITE",
     "service": "platform-new-service-write-model"
   }
   ```
3. Update `router.ts` to add the service to the registry:
   ```typescript
   "new-service": {
     binding: "NEW_SERVICE_WRITE",
     supportedMethods: ["POST", "GET", "PUT", "PATCH", "DELETE"]
   }
   ```

## Authentication

The RPC Gateway requires Personal Access Token (PAT) authentication via Zitadel. All requests must include a valid PAT in the Authorization header:

```
Authorization: Bearer <personal-access-token>
```

The gateway validates tokens by introspecting them against Zitadel's introspection endpoint.

### Token Claims Forwarding

The gateway extracts claims from the introspected token and forwards them to downstream services as headers:

- `X-User-Id`: The user's subject identifier (from `sub` claim)
- `X-Username`: The username associated with the token
- `X-Org-Id`: The organization ID (from `urn:zitadel:iam:org:id` claim)
- `X-Client-Id`: The client ID (useful for service accounts)

### Configuration Variables

- `ZITADEL_INTROSPECTION_URL`: The token introspection endpoint (default: `https://zitadel.rawkode.academy/oauth/v2/introspect`)

## Error Codes

- `VALIDATION_ERROR`: Invalid request format
- `SERVICE_NOT_FOUND`: Requested service doesn't exist
- `METHOD_NOT_ALLOWED`: HTTP method not supported by service
- `SERVICE_UNAVAILABLE`: Service binding not configured
- `SERVICE_ERROR`: Downstream service returned an error
- `UNAUTHORIZED`: Missing or invalid authentication
- `INTERNAL_ERROR`: Unexpected server error