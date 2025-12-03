# Analytics Service

CloudEvents-based analytics service using Cloudflare Workers and Durable Objects for buffered event collection.

## Development

```bash
cuenv task dev    # Start local development server
cuenv task deploy # Deploy to Cloudflare
```

## Usage

### HTTP Endpoint (Auto-detects Region)

```bash
POST /track
Content-Type: application/json

{
  "specversion": "1.0",
  "type": "com.rawkode.page.view",
  "source": "/blog/post",
  "id": "uuid",
  "time": "2024-01-01T00:00:00Z",
  "data": { ... }
}
```

### RPC Method (From Service Binding)

```typescript
// Pass region explicitly
await env.ANALYTICS.trackEvent(event, { region: "us" });

// Or pass Cloudflare metadata
await env.ANALYTICS.trackEvent(event, {
  cf: {
    continent: request.cf?.continent,
    colo: request.cf?.colo,
    country: request.cf?.country,
  }
});
```

## Architecture

Events are buffered in region-specific Durable Objects (`buffer-us`, `buffer-eu`, etc.) and flushed to Grafana Cloud via OTLP every 5 minutes.
