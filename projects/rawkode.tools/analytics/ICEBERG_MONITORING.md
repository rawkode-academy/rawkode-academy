# Iceberg Monitoring Setup

## Overview

This document outlines the monitoring strategy for the Apache Iceberg integration in the analytics pipeline. It defines key metrics, alert thresholds, dashboard requirements, and Service Level Objectives (SLOs) to ensure reliable operation of the Iceberg-based analytics system.

## Key Metrics to Track

### 1. Data Ingestion Metrics

#### Event Processing
- **Events Per Second (EPS)**: Rate of events being processed
  - Metric: `analytics.events.processed.rate`
  - Tags: `format:iceberg`, `table:events`
  
- **Event Batch Size**: Average number of events per batch
  - Metric: `analytics.batch.size`
  - Tags: `format:iceberg`

- **Event Processing Latency**: Time from event receipt to Iceberg write
  - Metric: `analytics.processing.latency`
  - Percentiles: p50, p95, p99

#### Buffer Performance
- **Buffer Fill Rate**: Percentage of buffer capacity used
  - Metric: `analytics.buffer.fill_rate`
  - Tags: `buffer_type:iceberg`

- **Buffer Flush Frequency**: How often buffers are flushed
  - Metric: `analytics.buffer.flush.count`
  - Tags: `trigger:timeout`, `trigger:size`

### 2. Iceberg Table Metrics

#### File Management
- **Active Data Files**: Number of data files in the table
  - Metric: `iceberg.table.files.count`
  - Tags: `table:events`, `file_type:data`

- **File Size Distribution**: Distribution of data file sizes
  - Metric: `iceberg.file.size.bytes`
  - Histogram buckets: 1MB, 10MB, 50MB, 100MB, 500MB

- **Manifest Files**: Number of manifest files
  - Metric: `iceberg.table.manifests.count`
  - Tags: `table:events`

#### Compaction Metrics
- **Compaction Runs**: Number of compaction operations
  - Metric: `iceberg.compaction.runs`
  - Tags: `status:success`, `status:failed`

- **Compaction Duration**: Time taken for compaction
  - Metric: `iceberg.compaction.duration.seconds`
  - Percentiles: p50, p95, p99

- **Files Compacted**: Number of files processed per compaction
  - Metric: `iceberg.compaction.files.processed`

- **Space Saved**: Bytes saved through compaction
  - Metric: `iceberg.compaction.bytes.saved`

### 3. Storage Metrics

#### R2 Storage
- **Storage Usage**: Total storage used
  - Metric: `r2.storage.bytes`
  - Tags: `bucket:analytics-source`

- **Object Count**: Number of objects in R2
  - Metric: `r2.objects.count`
  - Tags: `type:data`, `type:metadata`

- **R2 Operation Latency**: API operation latencies
  - Metric: `r2.operation.latency`
  - Tags: `operation:put`, `operation:get`, `operation:list`

#### Catalog Operations
- **Catalog Update Rate**: Frequency of catalog updates
  - Metric: `iceberg.catalog.updates.rate`

- **Catalog Sync Latency**: Time to sync catalog changes
  - Metric: `iceberg.catalog.sync.latency`

### 4. Query Performance Metrics

- **Query Count**: Number of queries executed
  - Metric: `iceberg.queries.count`
  - Tags: `query_type:scan`, `query_type:filter`

- **Query Latency**: Time to execute queries
  - Metric: `iceberg.query.latency`
  - Percentiles: p50, p95, p99

- **Files Scanned**: Number of files scanned per query
  - Metric: `iceberg.query.files.scanned`

- **Data Scanned**: Bytes scanned per query
  - Metric: `iceberg.query.bytes.scanned`

### 5. Error Metrics

- **Write Failures**: Failed write operations
  - Metric: `iceberg.writes.failed`
  - Tags: `error_type`

- **Compaction Failures**: Failed compaction operations
  - Metric: `iceberg.compaction.failed`
  - Tags: `error_reason`

- **Catalog Errors**: Catalog operation failures
  - Metric: `iceberg.catalog.errors`
  - Tags: `operation`, `error_code`

## Alert Thresholds

### Critical Alerts (P1 - Immediate Response Required)

1. **Data Loss Risk**
   - Condition: Buffer fill rate > 90% for > 5 minutes
   - Action: Immediate buffer flush and scale investigation

2. **Write Failures**
   - Condition: Write failure rate > 5% over 5 minutes
   - Action: Check R2 connectivity and permissions

3. **Catalog Unavailable**
   - Condition: Catalog update failures > 3 consecutive attempts
   - Action: Verify catalog endpoint and credentials

4. **Storage Critical**
   - Condition: R2 storage usage > 90% of quota
   - Action: Trigger emergency compaction or increase quota

### Warning Alerts (P2 - Response Within 1 Hour)

1. **High Latency**
   - Condition: p99 processing latency > 5 seconds for > 10 minutes
   - Action: Review buffer sizes and flush frequencies

2. **Compaction Backlog**
   - Condition: File count > COMPACTION_THRESHOLD * 2
   - Action: Manually trigger compaction if auto-compaction failed

3. **Query Performance Degradation**
   - Condition: p95 query latency > 2x baseline for > 15 minutes
   - Action: Analyze query patterns and file distribution

4. **High Error Rate**
   - Condition: Any error metric > 1% over 15 minutes
   - Action: Investigate error logs and patterns

### Info Alerts (P3 - Review Within 24 Hours)

1. **Inefficient File Sizes**
   - Condition: > 20% of files < 10MB or > 500MB
   - Action: Adjust compaction strategy

2. **Manifest Growth**
   - Condition: Manifest count > 100
   - Action: Plan manifest compaction

3. **Storage Growth Rate**
   - Condition: Storage growing > 10% daily
   - Action: Review retention policies

## Dashboard Requirements

### 1. Real-Time Operations Dashboard

**Purpose**: Monitor current system health and performance

**Panels**:
- Events per second (line chart, 5-minute window)
- Current buffer fill rate (gauge)
- Processing latency percentiles (heatmap)
- Active alerts (table)
- Recent errors (log stream)
- R2 operation latency (line chart)

**Refresh Rate**: 30 seconds

### 2. Iceberg Table Health Dashboard

**Purpose**: Track Iceberg table state and performance

**Panels**:
- File count trends (area chart, 24-hour window)
- File size distribution (histogram)
- Compaction history (timeline)
- Storage usage trends (line chart)
- Manifest file growth (line chart)
- Table statistics summary (stat panels)

**Refresh Rate**: 5 minutes

### 3. Query Performance Dashboard

**Purpose**: Monitor query patterns and performance

**Panels**:
- Query volume by type (bar chart)
- Query latency percentiles (line chart)
- Files scanned per query (histogram)
- Data scanned trends (area chart)
- Top queries by latency (table)
- Query error rate (line chart)

**Refresh Rate**: 1 minute

### 4. Capacity Planning Dashboard

**Purpose**: Long-term trends for capacity planning

**Panels**:
- Storage growth projection (line chart with forecast)
- Event volume trends (7-day, 30-day moving averages)
- Cost analysis (storage + operations)
- File count growth rate
- Compaction efficiency trends
- Resource utilization patterns

**Refresh Rate**: 1 hour

## Service Level Objectives (SLOs)

### 1. Data Freshness SLO
- **Objective**: 99.9% of events available for query within 2 minutes
- **Measurement**: Time from event timestamp to queryable in Iceberg
- **Error Budget**: 43 minutes per month

### 2. Query Performance SLO
- **Objective**: 95% of queries complete within 1 second
- **Measurement**: p95 query latency < 1000ms
- **Error Budget**: 36 hours per month

### 3. Data Durability SLO
- **Objective**: 99.999% data durability
- **Measurement**: No data loss events
- **Error Budget**: 26 seconds per month

### 4. System Availability SLO
- **Objective**: 99.95% write availability
- **Measurement**: Successful write percentage
- **Error Budget**: 22 minutes per month

### 5. Compaction Efficiency SLO
- **Objective**: Maintain < 100 active data files 95% of the time
- **Measurement**: File count measurements every 5 minutes
- **Error Budget**: 36 hours per month

## Monitoring Implementation

### 1. Metrics Collection
- Use Cloudflare Analytics Engine for metrics storage
- Implement custom metrics using Workers Analytics API
- Tag all metrics with environment and version

### 2. Alerting
- Configure alerts in Cloudflare Notifications
- Set up PagerDuty integration for P1 alerts
- Use Slack webhooks for P2/P3 alerts

### 3. Dashboards
- Implement dashboards using Grafana with Cloudflare data source
- Create mobile-responsive views for on-call access
- Export key metrics to status page

### 4. Log Aggregation
- Stream logs to Cloudflare Logpush
- Set up log retention for 30 days
- Create saved searches for common issues

## Operational Runbooks

### 1. High Buffer Fill Rate
See: [Runbook - Buffer Management](./runbooks/buffer-management.md)

### 2. Compaction Failures
See: [Runbook - Compaction Issues](./runbooks/compaction-issues.md)

### 3. Query Performance Degradation
See: [Runbook - Query Optimization](./runbooks/query-optimization.md)

### 4. Storage Issues
See: [Runbook - Storage Management](./runbooks/storage-management.md)

## Review and Updates

- **Weekly**: Review SLO performance and error budgets
- **Monthly**: Analyze trends and adjust thresholds
- **Quarterly**: Full monitoring strategy review
- **Post-Incident**: Update runbooks and alerts based on learnings