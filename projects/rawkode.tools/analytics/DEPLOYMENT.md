# Analytics Platform Deployment Guide

## Prerequisites

1. **Cloudflare Account**
   - Workers enabled
   - R2 enabled
   - Analytics Engine access (optional)

2. **1Password CLI** (for secrets management)
   ```bash
   # Install from https://developer.1password.com/docs/cli/get-started/
   ```

3. **Bun Package Manager**
   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```

4. **Node.js Dependencies**
   ```bash
   bun install
   ```

## Infrastructure Setup

### 1. Create R2 Buckets and Configure Lifecycle Rules

```bash
./infrastructure/setup-r2.sh
```

This creates three buckets:
- `analytics-source` - Raw event storage (no lifecycle rules)
- `analytics-processed` - Processed data (90-day retention for /processed/, 7-day for /temp/)
- `analytics-catalog` - Metadata storage (no lifecycle rules)

### 2. Configure Secrets

Each worker may require different secrets. Use 1Password with the `op run` command wrapper:

#### Event Collector API Key
Since the event collector will only be accessed via service bindings (not HTTP), no API key is required. The service binding provides secure worker-to-worker communication without authentication.

#### R2 Access Credentials (for DuckDB-based API)
Get R2 credentials from Cloudflare Dashboard:

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → R2
2. Click "Manage R2 API Tokens" → "Create API Token"
3. Configure the token:
   - Name: `analytics-api-r2-access`
   - Permissions: Object Read & Write (or Read-only for analytics)
   - Specify bucket: Select your analytics buckets
   - TTL: Set expiration or leave unlimited
4. Click "Create API Token"
5. Copy the credentials shown:
   - Access Key ID
   - Secret Access Key
   - Endpoint URL (format: `https://<account_id>.r2.cloudflarestorage.com`)

Set the secrets:
```bash
# Set R2 Access Key ID
op run -- bunx wrangler secret put R2_ACCESS_KEY_ID --config wrangler-api.toml
# Paste the Access Key ID when prompted

# Set R2 Secret Access Key
op run -- bunx wrangler secret put R2_SECRET_ACCESS_KEY --config wrangler-api.toml
# Paste the Secret Access Key when prompted

# Set R2 Endpoint
op run -- bunx wrangler secret put R2_ENDPOINT --config wrangler-api.toml
# Paste your endpoint URL (e.g., https://1234567890.r2.cloudflarestorage.com)
```

#### List and Verify Secrets
```bash
# List secrets for a worker
op run -- bunx wrangler secret list
op run -- bunx wrangler secret list --config wrangler-api.toml

# Delete a secret if needed
op run -- bunx wrangler secret delete SECRET_NAME
```

## Deploy Workers

The platform consists of four workers:

### 1. Event Collector Worker
Handles incoming events and buffers them before writing to R2.

```bash
op run -- bunx wrangler deploy
```

### 2. Catalog Worker
Manages metadata and schema information.

```bash
op run -- bunx wrangler deploy --config wrangler-catalog.toml
```

### 3. Compaction Worker
Optimizes Parquet files by merging small files.

```bash
op run -- bunx wrangler deploy --config wrangler-compaction.toml
```

### 4. Analytics API Worker
Provides GraphQL API for querying data.

```bash
op run -- bunx wrangler deploy --config wrangler-api.toml
```

## Deploy All at Once

Create a deployment script or use npm scripts:

```bash
# Add to package.json scripts section:
"deploy:all": "npm run deploy && npm run deploy:catalog && npm run deploy:compaction && npm run deploy:api",
"deploy:catalog": "wrangler deploy --config wrangler-catalog.toml",
"deploy:compaction": "wrangler deploy --config wrangler-compaction.toml",
"deploy:api": "wrangler deploy --config wrangler-api.toml"
```

Then deploy everything:
```bash
op run -- bun run deploy:all
```

## Environment-Specific Deployments

### Development
```bash
op run -- bunx wrangler deploy --env development
```

### Production
```bash
op run -- bunx wrangler deploy --env production
```

## Verify Deployment

### 1. Check Worker Status
```bash
op run -- bunx wrangler tail
```

### 2. List R2 Buckets
```bash
op run -- bunx wrangler r2 bucket list
```

### 3. Check Lifecycle Rules
```bash
op run -- bunx wrangler r2 bucket lifecycle list analytics-processed
```

### 4. Configure Service Bindings

Since the event collector is only accessible via service bindings, you need to configure other workers to bind to it:

```toml
# In your application's wrangler.toml that needs to send events:
[[services]]
binding = "ANALYTICS"
service = "analytics-event-collector"
```

Then in your worker code:
```javascript
// Send events via service binding
const response = await env.ANALYTICS.fetch('https://internal/events', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    events: [{
      event_type: "page_view",
      timestamp: new Date().toISOString(),
      data: { url: request.url }
    }]
  })
});
```

## Monitoring

### View Logs
```bash
# Real-time logs for a specific worker
op run -- bunx wrangler tail analytics-event-collector

# Historical logs
op run -- bunx wrangler tail analytics-event-collector --format json
```

### Check R2 Usage
Monitor storage costs and usage through the Cloudflare dashboard or API.

## Troubleshooting

### Worker Not Deploying
1. Check wrangler.toml configuration
2. Verify account permissions
3. Ensure all dependencies are installed

### R2 Access Issues
1. Verify bucket names match configuration
2. Check R2 bucket bindings in wrangler.toml
3. Ensure secrets are properly set

### Lifecycle Rules Not Working
1. Verify rule syntax with `wrangler r2 bucket lifecycle list`
2. Check prefix paths match your data structure
3. Remember rules only apply to new objects

## Rollback

To rollback a deployment:
```bash
# List deployments
op run -- bunx wrangler deployments list

# Rollback to specific version
op run -- bunx wrangler rollback [deployment-id]
```
