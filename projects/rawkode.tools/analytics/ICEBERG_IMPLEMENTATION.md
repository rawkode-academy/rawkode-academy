# Apache Iceberg Implementation for Analytics Events

This document describes the Apache Iceberg implementation for the analytics event collection system using Cloudflare Workers and R2.

## Overview

The Iceberg implementation provides:
- ACID transactions for analytics data
- Time travel and version history
- Efficient partition pruning
- Schema evolution support
- Optimized query performance
- Compatibility with R2 Data Catalog

## Architecture

### Components

1. **IcebergEventBuffer**: Buffers events by partition (type/hour)
2. **IcebergWriter**: Writes Parquet files in Iceberg format
3. **IcebergMetadata**: Manages table metadata, manifests, and snapshots
4. **IcebergCompactor**: Combines small files into larger ones

### Data Flow

```
CloudEvents → Event Collector → Iceberg Buffer (DO) → Iceberg Writer → R2
                                       ↓
                                  Partition by:
                                  - Event Type
                                  - Year/Month/Day/Hour
```

## Table Schema

The Iceberg table schema includes:

### Core CloudEvents Fields
- `id` (string, required)
- `source` (string, required)
- `type` (string, required)
- `specversion` (string, required)
- `time` (timestamp microseconds, required)
- `subject` (string, optional)
- `datacontenttype` (string, optional)
- `dataschema` (string, optional)

### Data Fields
- `data` (map<string, string>)
- `extensions` (map<string, string>)

### Cloudflare Metadata
- `cf_colo`, `cf_country`, `cf_city`, `cf_continent`, `cf_region`
- `cf_timezone`, `cf_http_protocol`, `cf_tls_version`

### Analytics Metadata
- `ingested_at` (timestamp)
- `worker_version` (string)

### Partition Columns
- `year`, `month`, `day`, `hour` (computed from event time)

## Partitioning Strategy

Events are partitioned using a 5-level hierarchy:
1. Event Type (e.g., "page.view", "user.action")
2. Year (YYYY)
3. Month (MM)
4. Day (DD)
5. Hour (HH)

Example partition path:
```
analytics/events/data/type=page.view/year=2024/month=01/day=15/hour=14/
```

## Memory Management

To work within Cloudflare Workers constraints:

1. **Batch Sizes**: Limited to 5,000 events per batch
2. **Buffer Memory**: Maximum 50MB per worker invocation
3. **Row Groups**: 10,000 rows per Parquet row group
4. **Page Size**: 1MB data pages

## File Layout

```
analytics/events/
├── metadata/
│   ├── v1.metadata.json
│   ├── v2.metadata.json
│   ├── version-hint.text
│   ├── snap-{id}-1.avro (manifest lists)
│   └── {id}-m0.avro (manifests)
└── data/
    └── type={type}/year={y}/month={m}/day={d}/hour={h}/
        └── {timestamp}-{uuid}.parquet
```

## Configuration

Enable Iceberg mode by setting environment variables:

```toml
[vars]
USE_ICEBERG = "true"
ICEBERG_TABLE_LOCATION = "analytics/events"
ICEBERG_BUFFER_SIZE = "2000"
ICEBERG_BUFFER_TIMEOUT_MS = "30000"
```

## Compaction Strategy

Small files are compacted to improve query performance:

1. **Trigger**: When a partition has >10 files <32MB each
2. **Target Size**: 128MB per compacted file
3. **Frequency**: Run via scheduled worker
4. **Process**: 
   - Read small files
   - Combine into larger file
   - Create new snapshot
   - Mark old files as deleted

## Query Integration

The Iceberg tables can be queried via:
1. R2 Data Catalog (when available)
2. DuckDB with Iceberg extension
3. Apache Spark
4. Trino/Presto

Example DuckDB query:
```sql
SELECT 
    type,
    COUNT(*) as event_count,
    DATE_TRUNC('hour', time) as hour
FROM iceberg_scan('s3://analytics-source/analytics/events')
WHERE year = 2024 AND month = 1
GROUP BY type, hour
ORDER BY hour DESC;
```

## Advantages Over Raw Parquet

1. **ACID Guarantees**: Atomic commits prevent partial writes
2. **Schema Evolution**: Add/remove/rename columns without rewriting data
3. **Time Travel**: Query data as of any previous snapshot
4. **Efficient Pruning**: Skip irrelevant files using metadata
5. **Concurrent Writes**: Multiple workers can write safely
6. **Incremental Processing**: Track what data is new since last read

## Monitoring

Monitor the system via:
- Table metadata for file counts and sizes
- Snapshot history for write patterns
- Manifest files for partition statistics
- Worker logs for performance metrics

## Limitations

1. **Worker Memory**: Large compactions may need external processing
2. **Manifest Size**: Very large tables may have large manifest files
3. **Transaction Isolation**: Limited by Durable Object consistency
4. **Query Engine**: Requires Iceberg-compatible query engine

## Future Enhancements

1. **Bloom Filters**: Add bloom filters for point lookups
2. **Z-Order**: Implement Z-ordering for multi-dimensional clustering
3. **Incremental Compaction**: Compact only changed partitions
4. **Schema Registry**: Integrate with schema registry for evolution
5. **CDC Support**: Add change data capture for streaming updates