# Analytics Platform Deployment Guide - Apache Iceberg Edition

## Prerequisites

1. **Cloudflare Account**
   - Workers enabled
   - R2 enabled with sufficient storage quota
   - Durable Objects enabled
   - Analytics Engine access (optional)

2. **Development Tools**
   ```bash
   # Wrangler CLI
   npm install -g wrangler
   
   # Rust toolchain (for Rust workers)
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   
   # Bun package manager
   curl -fsSL https://bun.sh/install | bash
   ```

3. **1Password CLI** (for secrets management)
   ```bash
   # Install from https://developer.1password.com/docs/cli/get-started/
   ```

4. **Dependencies Installation**
   ```bash
   # Install all dependencies
   bun install
   
   # Build Rust workers
   cd pipeline/event-collector && cargo build --release
   cd ../catalog-worker && cargo build --release
   cd ../compaction-worker && cargo build --release
   ```

## Infrastructure Setup

### 1. Create R2 Buckets for Iceberg Storage

```bash
# Run the setup script
./infrastructure/setup-r2.sh
```

This creates three buckets optimized for Iceberg:
- `analytics-source` - Iceberg data files (Parquet)
  - No lifecycle rules (Iceberg manages file lifecycle)
  - Stores actual event data in columnar format
- `analytics-processed` - Iceberg metadata and manifests
  - Stores table metadata, manifest lists, and manifest files
  - Critical for Iceberg table operations
- `analytics-catalog` - REST catalog data
  - Stores table locations and current metadata pointers
  - Essential for table discovery and management

### 2. Initialize Iceberg Tables

```bash
# Create the default namespace
curl -X POST https://analytics-catalog.your-domain.workers.dev/v1/namespaces \
  -H "Content-Type: application/json" \
  -d '{"namespace": ["default"], "properties": {}}'

# Create the events table
curl -X POST https://analytics-catalog.your-domain.workers.dev/v1/namespaces/default/tables \
  -H "Content-Type: application/json" \
  -d '{
    "name": "events",
    "location": "s3://analytics-source/tables/events",
    "schema": {
      "type": "struct",
      "fields": [
        {"id": 1, "name": "event_id", "required": true, "type": "string"},
        {"id": 2, "name": "timestamp", "required": true, "type": "timestamp"},
        {"id": 3, "name": "type", "required": true, "type": "string"},
        {"id": 4, "name": "source", "required": true, "type": "string"},
        {"id": 5, "name": "data", "required": false, "type": "string"}
      ]
    },
    "partition-spec": [
      {"name": "event_hour", "transform": "hour", "source-id": 2},
      {"name": "event_type", "transform": "identity", "source-id": 3}
    ],
    "properties": {
      "write.format.default": "parquet",
      "write.parquet.compression-codec": "snappy",
      "write.target-file-size-bytes": "134217728"
    }
  }'
```

### 3. Configure Secrets and Environment Variables

#### Iceberg Configuration
Set up Iceberg-specific environment variables:

```bash
# Enable Iceberg mode for all workers
export USE_ICEBERG=true
export ICEBERG_TABLE_LOCATION=analytics/events

# Configure buffer thresholds
export BUFFER_TIME_SECONDS=60      # Flush after 60 seconds
export BUFFER_SIZE_BYTES=1048576   # Flush after 1MB
export BUFFER_COUNT_THRESHOLD=1000  # Flush after 1000 events

# Set retry configuration
export MAX_RETRIES=10
export RETRY_BASE_DELAY_MS=100
export RETRY_MAX_DELAY_MS=60000
```

#### Event Collector Authentication
The event collector supports two authentication modes:

1. **Service Bindings** (Recommended for internal services)
   - No API key required
   - Secure worker-to-worker communication
   - Configured via wrangler.toml bindings

2. **HTTP API with Key** (For external access)
   ```bash
   # Generate a secure API key
   openssl rand -hex 32
   
   # Set the API key secret
   op run -- wrangler secret put ANALYTICS_API_KEY \
     --config pipeline/event-collector/wrangler.jsonc
   ```

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

The platform consists of five core workers plus monitoring:

### 1. Event Collector Worker (Rust)
Handles incoming CloudEvents and buffers them using Iceberg-aware Durable Objects.

```bash
cd pipeline/event-collector
# Deploy with Iceberg configuration
op run -- wrangler deploy --env production \
  --var USE_ICEBERG:true \
  --var ICEBERG_TABLE_LOCATION:analytics/events
```

**Key Features:**
- Iceberg table writer with ACID guarantees
- Automatic buffering and batching
- Schema evolution support
- Exactly-once semantics

### 2. Catalog Worker (Rust)
Implements the Iceberg REST catalog specification for table management.

```bash
cd pipeline/catalog-worker
op run -- wrangler deploy --env production
```

**Endpoints:**
- `GET /v1/namespaces` - List namespaces
- `GET /v1/namespaces/{namespace}/tables` - List tables
- `POST /v1/namespaces/{namespace}/tables` - Create table
- `GET /v1/namespaces/{namespace}/tables/{table}` - Get table metadata
- `POST /v1/tables/rename` - Rename table

### 3. Compaction Worker (Rust)
Optimizes Iceberg tables by merging small files and expiring snapshots.

```bash
cd pipeline/compaction-worker
op run -- wrangler deploy --env production
```

**Scheduled Tasks:**
- Runs every 6 hours via cron trigger
- Merges files smaller than 100MB
- Maintains optimal file sizes (128MB target)
- Expires snapshots older than 7 days

### 4. Analytics API Worker (TypeScript)
Provides GraphQL API with Iceberg-aware query optimization.

```bash
cd api
op run -- wrangler deploy --env production
```

**GraphQL Schema:**
- Event analytics with time-based queries
- Catalog operations for table management
- Time travel queries for historical data
- Performance metrics and monitoring

### 5. Health Monitor Worker (Rust)
Monitors all components and provides health endpoints.

```bash
cd monitoring/health-checker
op run -- wrangler deploy --env production
```

**Health Checks:**
- Component availability
- R2 bucket connectivity
- Durable Object health
- Query performance metrics

## Deploy All Workers

### Using the Justfile (Recommended)

```bash
# Deploy all workers to production
just deploy-all production

# Deploy specific component
just deploy-collector production
just deploy-catalog production
just deploy-compaction production
just deploy-api production
just deploy-health production
```

### Manual Deployment Script

```bash
#!/bin/bash
# deploy-all.sh

ENV=${1:-production}

echo "Deploying Analytics Platform (Iceberg) - Environment: $ENV"

# Build Rust workers
echo "Building Rust workers..."
(cd pipeline/event-collector && cargo build --release)
(cd pipeline/catalog-worker && cargo build --release)
(cd pipeline/compaction-worker && cargo build --release)
(cd monitoring/health-checker && cargo build --release)

# Deploy workers in order
echo "Deploying Event Collector..."
(cd pipeline/event-collector && wrangler deploy --env $ENV)

echo "Deploying Catalog Worker..."
(cd pipeline/catalog-worker && wrangler deploy --env $ENV)

echo "Deploying Compaction Worker..."
(cd pipeline/compaction-worker && wrangler deploy --env $ENV)

echo "Deploying Analytics API..."
(cd api && wrangler deploy --env $ENV)

echo "Deploying Health Monitor..."
(cd monitoring/health-checker && wrangler deploy --env $ENV)

echo "Deployment complete!"
```

Make executable and run:
```bash
chmod +x deploy-all.sh
op run -- ./deploy-all.sh production
```

## Environment-Specific Deployments

### Development Environment

```bash
# Use development buckets and relaxed limits
export ICEBERG_ENV=development
export BUFFER_TIME_SECONDS=10      # Faster flushing for testing
export BUFFER_SIZE_BYTES=10240     # 10KB for testing
export LOG_LEVEL=debug

# Deploy to development
just deploy-all development
```

### Staging Environment

```bash
# Use staging buckets with production-like settings
export ICEBERG_ENV=staging
export BUFFER_TIME_SECONDS=30
export BUFFER_SIZE_BYTES=524288    # 512KB
export LOG_LEVEL=info

# Deploy to staging
just deploy-all staging
```

### Production Environment

```bash
# Use production settings
export ICEBERG_ENV=production
export BUFFER_TIME_SECONDS=60
export BUFFER_SIZE_BYTES=1048576   # 1MB
export LOG_LEVEL=warn

# Deploy to production with confirmations
read -p "Deploy to PRODUCTION? (yes/no) " -n 3 -r
if [[ $REPLY =~ ^yes$ ]]; then
    just deploy-all production
fi
```

## Verify Deployment

### 1. Health Check All Components

```bash
# Check overall system health
curl https://analytics-health.your-domain.workers.dev/health

# Expected response:
# {
#   "status": "healthy",
#   "components": {
#     "collector": "healthy",
#     "catalog": "healthy",
#     "compaction": "healthy",
#     "api": "healthy",
#     "r2": "healthy"
#   },
#   "timestamp": "2024-01-20T12:00:00Z"
# }
```

### 2. Verify Iceberg Tables

```bash
# List all tables
curl https://analytics-catalog.your-domain.workers.dev/v1/namespaces/default/tables

# Get events table metadata
curl https://analytics-catalog.your-domain.workers.dev/v1/namespaces/default/tables/events

# Check table properties
curl https://analytics-catalog.your-domain.workers.dev/v1/namespaces/default/tables/events | jq '.properties'
```

### 3. Test Event Ingestion

```bash
# Send a test event
curl -X POST https://analytics.your-domain.workers.dev/events \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $ANALYTICS_API_KEY" \
  -d '{
    "specversion": "1.0",
    "type": "deployment.test",
    "source": "deployment-script",
    "id": "test-'$(date +%s)'",
    "time": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
    "data": {
      "message": "Deployment verification test"
    }
  }'

# Wait for buffer flush (60 seconds) or force flush
curl -X POST https://analytics.your-domain.workers.dev/debug/flush/deployment.test
```

### 4. Query Test Data

```bash
# Query via GraphQL
curl -X POST https://analytics-api.your-domain.workers.dev/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query { analytics { eventCounts(timeRange: { start: \"'$(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ)'\", end: \"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'\" }, eventTypes: [\"deployment.test\"]) { eventType count } } }"
  }'
```

### 5. Monitor Worker Logs

```bash
# Tail logs for each worker
wrangler tail --env production --format pretty analytics-event-collector
wrangler tail --env production --format pretty analytics-catalog
wrangler tail --env production --format pretty analytics-compaction
wrangler tail --env production --format pretty analytics-api
```

### 6. Configure Service Bindings for Internal Access

For Workers that need to send events internally:

```toml
# In your application's wrangler.toml
name = "your-application"

# Bind to the analytics collector
[[services]]
binding = "ANALYTICS"
service = "analytics-event-collector-production"

# Optional: Bind to catalog for direct table queries
[[services]]
binding = "ANALYTICS_CATALOG"
service = "analytics-catalog-production"
```

Then in your worker code:
```typescript
// Send CloudEvents via service binding
const event: CloudEvent = {
  specversion: "1.0",
  type: "user.action",
  source: "my-app",
  id: crypto.randomUUID(),
  time: new Date().toISOString(),
  datacontenttype: "application/json",
  data: {
    action: "clicked_button",
    userId: "user123",
    metadata: { buttonId: "cta-main" }
  }
};

const response = await env.ANALYTICS.fetch('https://internal/events', {
  method: 'POST',
  headers: { 'Content-Type': 'application/cloudevents+json' },
  body: JSON.stringify(event)
});

// Check response
if (!response.ok) {
  console.error('Failed to send event:', await response.text());
}
```

## Monitoring & Operations

### Real-time Monitoring Dashboard

```bash
# Start monitoring dashboard (requires tmux)
tmux new-session -d -s analytics-monitor

# Split into panes for each component
tmux send-keys -t analytics-monitor "wrangler tail analytics-event-collector-production" C-m
tmux split-window -t analytics-monitor -h
tmux send-keys -t analytics-monitor "wrangler tail analytics-catalog-production" C-m
tmux split-window -t analytics-monitor -v
tmux send-keys -t analytics-monitor "wrangler tail analytics-api-production" C-m
tmux select-pane -t analytics-monitor:0.0
tmux split-window -t analytics-monitor -v
tmux send-keys -t analytics-monitor "watch -n 5 'curl -s https://analytics-health.your-domain.workers.dev/health | jq .'" C-m

# Attach to monitoring session
tmux attach -t analytics-monitor
```

### Iceberg Table Maintenance

```bash
# Trigger manual compaction
curl -X POST https://analytics-compaction.your-domain.workers.dev/compact/events

# Expire old snapshots
curl -X POST https://analytics-catalog.your-domain.workers.dev/v1/namespaces/default/tables/events/snapshots/expire \
  -H "Content-Type: application/json" \
  -d '{"older_than_days": 7}'

# View table history
curl https://analytics-catalog.your-domain.workers.dev/v1/namespaces/default/tables/events/snapshots
```

### Cost Monitoring

```bash
# Get detailed cost breakdown
curl https://analytics-catalog.your-domain.workers.dev/v1/costs | jq .

# Monitor R2 usage
wrangler r2 bucket info analytics-source
wrangler r2 bucket info analytics-processed
wrangler r2 bucket info analytics-catalog
```

### Performance Metrics

```bash
# Query performance stats
curl https://analytics-api.your-domain.workers.dev/metrics

# Buffer statistics
curl https://analytics.your-domain.workers.dev/debug/status/all
```

## Troubleshooting

### Iceberg-Specific Issues

#### Table Not Found
```bash
# Check if table exists in catalog
curl https://analytics-catalog.your-domain.workers.dev/v1/namespaces/default/tables

# Verify table location in R2
wrangler r2 object list analytics-source --prefix tables/events/metadata/

# Re-register table if needed
curl -X POST https://analytics-catalog.your-domain.workers.dev/v1/namespaces/default/tables/events/register
```

#### Buffer Not Flushing
```bash
# Check buffer status
curl https://analytics.your-domain.workers.dev/debug/status/your-event-type

# Force flush
curl -X POST https://analytics.your-domain.workers.dev/debug/flush/your-event-type

# Check Durable Object alarms
wrangler tail analytics-event-collector-production --format json | grep "alarm"
```

#### Compaction Not Working
```bash
# Check compaction logs
wrangler tail analytics-compaction-production --format json | grep "compact"

# List small files that need compaction
curl https://analytics-catalog.your-domain.workers.dev/v1/namespaces/default/tables/events/files?max_size=10485760

# Manually trigger compaction
curl -X POST https://analytics-compaction.your-domain.workers.dev/compact/events?force=true
```

#### Query Performance Issues
```bash
# Check partition pruning effectiveness
curl -X POST https://analytics-api.your-domain.workers.dev/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "query { debug { queryPlan(sql: \"SELECT * FROM events WHERE timestamp > now() - interval 1 hour\") } }" }'

# View manifest cache stats
curl https://analytics-api.your-domain.workers.dev/cache/stats

# Clear manifest cache if stale
curl -X DELETE https://analytics-api.your-domain.workers.dev/cache/manifests
```

### Common Error Messages

#### "Snapshot not found"
- Table metadata might be corrupted
- Solution: Run snapshot recovery
```bash
curl -X POST https://analytics-catalog.your-domain.workers.dev/v1/namespaces/default/tables/events/recover
```

#### "Manifest file missing"
- File might have been deleted prematurely
- Solution: Rebuild manifest from data files
```bash
curl -X POST https://analytics-catalog.your-domain.workers.dev/v1/namespaces/default/tables/events/rebuild-manifests
```

#### "Optimistic concurrency check failed"
- Multiple writers conflicting
- Solution: Retry with backoff or check for stuck transactions
```bash
curl https://analytics-catalog.your-domain.workers.dev/v1/namespaces/default/tables/events/transactions
```

## Rollback Procedures

### Immediate Rollback (All Components)

```bash
#!/bin/bash
# rollback-all.sh

echo "Rolling back all analytics components..."

# Get previous deployment IDs
echo "Fetching previous deployments..."
COLLECTOR_ID=$(wrangler deployments list analytics-event-collector-production | grep -v "Active" | head -1 | awk '{print $1}')
CATALOG_ID=$(wrangler deployments list analytics-catalog-production | grep -v "Active" | head -1 | awk '{print $1}')
COMPACTION_ID=$(wrangler deployments list analytics-compaction-production | grep -v "Active" | head -1 | awk '{print $1}')
API_ID=$(wrangler deployments list analytics-api-production | grep -v "Active" | head -1 | awk '{print $1}')

# Rollback each component
echo "Rolling back Event Collector to $COLLECTOR_ID"
wrangler rollback $COLLECTOR_ID --env production

echo "Rolling back Catalog to $CATALOG_ID"
wrangler rollback $CATALOG_ID --env production

echo "Rolling back Compaction to $COMPACTION_ID"
wrangler rollback $COMPACTION_ID --env production

echo "Rolling back API to $API_ID"
wrangler rollback $API_ID --env production

echo "Rollback complete! Verify health:"
curl https://analytics-health.your-domain.workers.dev/health | jq .
```

### Data Recovery (Iceberg Time Travel)

```bash
# List available snapshots
curl https://analytics-catalog.your-domain.workers.dev/v1/namespaces/default/tables/events/snapshots

# Rollback table to specific snapshot
curl -X POST https://analytics-catalog.your-domain.workers.dev/v1/namespaces/default/tables/events/rollback \
  -H "Content-Type: application/json" \
  -d '{"snapshot_id": 1234567890123456789}'

# Or rollback to specific timestamp
curl -X POST https://analytics-catalog.your-domain.workers.dev/v1/namespaces/default/tables/events/rollback \
  -H "Content-Type: application/json" \
  -d '{"as_of_timestamp": "2024-01-20T10:00:00Z"}'
```

### Partial Rollback (Single Component)

```bash
# Rollback only the API layer (safe for read-only component)
wrangler deployments list analytics-api-production
wrangler rollback [deployment-id] --env production

# Rollback collector (stop new data ingestion first)
echo "WARNING: This will stop data collection. Continue? (yes/no)"
read confirm
if [[ $confirm == "yes" ]]; then
    wrangler rollback [collector-deployment-id] --env production
fi
```

## Disaster Recovery

### Complete System Recovery

1. **Restore R2 Buckets** (if deleted)
```bash
# Recreate buckets
./infrastructure/setup-r2.sh

# Restore from backup (if available)
rclone copy backup:analytics-source r2:analytics-source
rclone copy backup:analytics-catalog r2:analytics-catalog
```

2. **Rebuild Iceberg Metadata**
```bash
# Scan data files and rebuild table metadata
curl -X POST https://analytics-catalog.your-domain.workers.dev/v1/recovery/rebuild-all
```

3. **Verify Data Integrity**
```bash
# Run integrity checks
curl -X POST https://analytics-catalog.your-domain.workers.dev/v1/namespaces/default/tables/events/validate
```

4. **Resume Operations**
```bash
# Re-enable event collection
curl -X POST https://analytics.your-domain.workers.dev/admin/resume

# Verify system health
curl https://analytics-health.your-domain.workers.dev/health
```
