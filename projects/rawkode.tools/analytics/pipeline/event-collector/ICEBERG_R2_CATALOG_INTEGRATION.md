# Iceberg R2 Data Catalog Integration

## Overview

The event collector now supports Apache Iceberg table format with R2 Data Catalog integration. This enables efficient analytics on event data with features like:

- **Partition-aware buffering**: Events are automatically partitioned by type and hour
- **Automatic flushing**: Buffers flush at 2000 events or 30 seconds
- **Memory-aware processing**: Optimized for Cloudflare Workers constraints
- **REST API support**: Optional integration with R2 Data Catalog REST API

## Configuration

### Enable Iceberg Mode

Set the following environment variable in `wrangler.jsonc`:

```json
"USE_ICEBERG": "true"
```

### Catalog Configuration

The system supports two catalog modes:

#### 1. Direct R2 Catalog (Default)

When `R2_CATALOG_ENDPOINT` is not set or doesn't start with `http://` or `https://`, the system uses direct R2 access for catalog operations.

```json
"ICEBERG_NAMESPACE": "analytics",
"ICEBERG_TABLE_LOCATION": "analytics/events"
```

#### 2. REST API Catalog

To use the R2 Data Catalog REST API, configure:

```json
"R2_CATALOG_ENDPOINT": "https://your-catalog-api.example.com",
"R2_CATALOG_AUTH_TOKEN": "your-bearer-token", // Optional
"ICEBERG_NAMESPACE": "analytics"
```

### Buffer Configuration

```json
"ICEBERG_BUFFER_SIZE": "2000",        // Events per buffer before flush
"ICEBERG_BUFFER_TIMEOUT_MS": "30000", // Flush timeout in milliseconds
```

## Architecture

### Partition Strategy

Events are partitioned by:
- **Event Type**: Different event types go to separate partitions
- **Hour**: Events are grouped by hour (YYYY-MM-DD-HH format)

Example partition structure:
```
analytics/events/
├── data/
│   ├── type=page.view/year=2024/month=01/day=15/hour=14/
│   ├── type=user.signup/year=2024/month=01/day=15/hour=14/
│   └── type=api.call/year=2024/month=01/day=15/hour=14/
└── metadata/
    ├── v1.metadata.json
    ├── v2.metadata.json
    └── current
```

### Durable Object Buffering

Each partition gets its own Durable Object instance:
- **Partition Key**: `{event_type}/{hour_key}`
- **Buffer Limits**: Max 5000 events per buffer (Worker memory constraint)
- **Auto-flush**: Triggers at threshold or timeout

### Memory Management

The implementation is optimized for Workers constraints:
- **128MB memory limit**: Buffers are sized to stay within limits
- **50ms CPU limit**: Operations are chunked to avoid timeouts
- **Type-safe patterns**: Zero-cost abstractions for state management

## REST API Integration

When configured, the system uses the Iceberg REST Catalog API:

### Supported Operations

- **Create Table**: `POST /v1/namespaces/{namespace}/tables`
- **Load Table**: `GET /v1/namespaces/{namespace}/tables/{table}`
- **Commit Changes**: `POST /v1/namespaces/{namespace}/tables/{table}`
- **List Tables**: `GET /v1/namespaces/{namespace}/tables`
- **Drop Table**: `DELETE /v1/namespaces/{namespace}/tables/{table}`

### Authentication

If `R2_CATALOG_AUTH_TOKEN` is set, requests include:
```
Authorization: Bearer {token}
```

## Usage

### Send Events

Events are automatically routed to Iceberg when enabled:

```bash
# Single event
curl -X POST https://your-worker.workers.dev/events \
  -H "Content-Type: application/json" \
  -d '{
    "specversion": "1.0",
    "type": "page.view",
    "source": "website",
    "id": "123",
    "time": "2024-01-15T14:30:00Z",
    "data": {"page": "/home"}
  }'

# Batch events
curl -X POST https://your-worker.workers.dev/events/batch \
  -H "Content-Type: application/json" \
  -d '{
    "events": [
      {...},
      {...}
    ]
  }'
```

### Monitor Buffer Status

Check buffer status for a specific partition:

```bash
curl https://your-worker.workers.dev/debug/status/page.view
```

Response:
```json
{
  "partition_key": "page.view/2024-01-15-14",
  "buffered_count": 1523,
  "max_buffer_size": 5000,
  "buffer_threshold": 2000,
  "table_location": "analytics/events"
}
```

### Manual Flush

Force a buffer flush:

```bash
curl -X POST https://your-worker.workers.dev/debug/flush/page.view
```

## Table Schema

The Iceberg table uses the following schema:

```
analytics_events
├── id (string, required)
├── type (string, required)
├── source (string, required)
├── specversion (string, required)
├── time (timestamp, optional)
├── subject (string, optional)
├── datacontenttype (string, optional)
├── dataschema (string, optional)
├── data (string, optional)
├── extensions (map<string, string>, optional)
├── cf_colo (string, optional)
├── cf_country (string, optional)
├── cf_city (string, optional)
├── cf_continent (string, optional)
├── cf_postal_code (string, optional)
├── cf_region (string, optional)
├── cf_timezone (string, optional)
├── cf_http_protocol (string, optional)
├── cf_tls_version (string, optional)
├── cf_tls_cipher (string, optional)
├── year (int, required)
├── month (int, required)
├── day (int, required)
└── hour (int, required)
```

## Performance Considerations

1. **Buffer Size**: Larger buffers (2000 events) create more efficient Parquet files
2. **Partition Granularity**: Hour-based partitions balance file size and query performance
3. **Memory Usage**: Each Durable Object instance manages its own memory independently
4. **Compaction**: Set `COMPACTION_THRESHOLD` to control when small files are merged

## Troubleshooting

### Common Issues

1. **Buffer Full Error (507)**
   - Cause: Buffer exceeds 5000 event limit
   - Solution: Increase flush frequency or reduce event batch size

2. **Catalog Connection Failed**
   - Cause: Invalid REST API endpoint or authentication
   - Solution: Verify `R2_CATALOG_ENDPOINT` and `R2_CATALOG_AUTH_TOKEN`

3. **Partition Not Found**
   - Cause: Invalid event type or timestamp
   - Solution: Ensure events have valid `type` and `time` fields

### Debug Endpoints

- `/debug/status/{event_type}`: Check buffer status
- `/debug/flush/{event_type}`: Force buffer flush
- `/debug/list-r2`: List all files in R2 bucket

## Future Enhancements

1. **Schema Evolution**: Support for adding/modifying columns
2. **Compaction Service**: Automatic background file compaction
3. **Query Integration**: Direct query support via REST API
4. **Metrics Export**: Prometheus-compatible metrics endpoint