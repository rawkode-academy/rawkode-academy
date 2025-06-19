# Catalog Worker (Rust)

A Cloudflare Worker written in Rust that maintains a metadata catalog for analytics data stored in R2.

## Features

- **Automatic Discovery**: Scans R2 buckets to discover event types and partitions
- **Metadata Collection**: Aggregates row counts, file sizes, and time ranges from partition metadata
- **Cost Tracking**: Calculates R2 storage costs based on current pricing
- **Scheduled Updates**: Refreshes catalog every hour via cron trigger
- **Analytics Engine Integration**: Writes metadata to Analytics Engine for querying

## API Endpoints

- `GET /catalog` - Retrieve the current catalog
- `POST /catalog/refresh` - Manually trigger catalog refresh
- `GET /catalog/costs` - Get storage cost report

## Building

```bash
# Install dependencies
cargo build

# Build for Cloudflare Workers
npm install -g wrangler
wrangler build
```

## Development

```bash
# Run tests
cargo test

# Run with wrangler
wrangler dev
```

## Deployment

```bash
wrangler publish
```

## Configuration

The worker expects the following bindings in `wrangler.toml`:

- `ANALYTICS_SOURCE` - R2 bucket containing raw analytics data
- `ANALYTICS_CATALOG` - R2 bucket for storing catalog metadata
- `ANALYTICS_ENGINE` - Analytics Engine dataset for metadata queries

## Data Model

### Partition Structure
```
events/{event_type}/{year}/{month}/{day}/{hour}/
```

### Expected Metadata
Each file should have custom metadata:
- `row-count`: Number of rows in the file
- `min-event-time`: Earliest event timestamp (RFC3339)
- `max-event-time`: Latest event timestamp (RFC3339)
