# Runbook: Query Optimization

## Overview
This runbook provides procedures for diagnosing and resolving query performance issues in the Iceberg analytics system.

## Alert: Query Performance Degradation

### Symptoms
- Alert: "p95 query latency > 2x baseline"
- User complaints about slow dashboards
- Timeout errors in query execution
- High CPU/memory usage during queries

### Immediate Actions

1. **Identify Slow Queries**
   ```bash
   # Check recent query performance
   wrangler tail --format json | grep "query_latency" | jq '.latency > 2000'
   ```

2. **Check Current Load**
   - Number of concurrent queries
   - Data volume being scanned
   - Active user sessions

3. **Quick Wins**
   - Clear query cache if stale
   - Restart query service if hung
   - Redirect traffic to backup endpoint if available

### Root Cause Analysis

1. **Query Pattern Analysis**
   ```sql
   -- Identify expensive query patterns
   SELECT 
     query_pattern,
     avg(latency) as avg_latency,
     count(*) as frequency,
     sum(bytes_scanned) as total_bytes
   FROM query_logs
   WHERE timestamp > now() - interval '1 hour'
   GROUP BY query_pattern
   ORDER BY avg_latency DESC
   LIMIT 10;
   ```

2. **File Scan Efficiency**
   - Check number of files scanned per query
   - Analyze partition pruning effectiveness
   - Review predicate pushdown success rate

3. **Table Statistics**
   - Verify statistics are up to date
   - Check data distribution
   - Look for data skew issues

## Common Performance Issues

### 1. Too Many Small Files

**Symptoms**: High file scan count, low bytes per file

**Solution**:
```bash
# Trigger aggressive compaction
curl -X POST https://analytics-event-collector.workers.dev/admin/compact \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"aggressive": true, "minFileSize": "50MB"}'
```

### 2. Missing Partition Pruning

**Symptoms**: Full table scans for time-range queries

**Solution**:
```javascript
// Ensure proper partition columns
const table = await catalog.loadTable("events");
await table.updateSpec()
  .addField("timestamp", "day")
  .commit();
```

### 3. Inefficient Data Layout

**Symptoms**: Random I/O patterns, poor cache hit rate

**Solution**:
```javascript
// Rewrite data with better clustering
await table.rewrite()
  .sort("timestamp", "event_type")
  .targetFileSize(128 * 1024 * 1024)
  .execute();
```

## Query Optimization Techniques

### 1. Index Utilization

```javascript
// Create bloom filters for high-cardinality columns
await table.updateProperties()
  .set("write.parquet.bloom-filter-enabled.column.user_id", "true")
  .set("write.parquet.bloom-filter-enabled.column.session_id", "true")
  .commit();
```

### 2. Query Rewriting

```javascript
// Before: Inefficient query
const slowQuery = `
  SELECT * FROM events 
  WHERE date_format(timestamp, 'yyyy-MM-dd') = '2024-01-15'
`;

// After: Optimized with partition pruning
const fastQuery = `
  SELECT * FROM events 
  WHERE timestamp >= '2024-01-15' 
    AND timestamp < '2024-01-16'
`;
```

### 3. Materialized Views

```javascript
// Create materialized view for common aggregations
await createMaterializedView({
  name: "hourly_event_counts",
  query: `
    SELECT 
      date_trunc('hour', timestamp) as hour,
      event_type,
      count(*) as event_count
    FROM events
    GROUP BY 1, 2
  `,
  refreshInterval: "1 hour"
});
```

## Performance Monitoring

### 1. Query Profiling

```javascript
// Enable query profiling
const result = await executeQuery(sql, {
  profile: true,
  explainAnalyze: true
});

console.log("Execution plan:", result.profile);
console.log("Time breakdown:", result.timings);
```

### 2. Metrics Collection

```javascript
// Track query metrics
const queryMetrics = {
  query_id: generateId(),
  start_time: Date.now(),
  query_text: sql,
  files_scanned: 0,
  bytes_scanned: 0,
  rows_returned: 0
};

// After execution
await analytics.track("query_executed", {
  ...queryMetrics,
  duration_ms: Date.now() - queryMetrics.start_time,
  success: true
});
```

### 3. Automated Optimization

```javascript
// Auto-optimize based on query patterns
export async function optimizeTableLayout(table, queryPatterns) {
  const analysis = await analyzeQueryPatterns(queryPatterns);
  
  if (analysis.shouldRepartition) {
    await table.updateSpec()
      .removeField("old_partition")
      .addField(analysis.suggestedPartition)
      .commit();
  }
  
  if (analysis.shouldReorder) {
    await table.rewrite()
      .sort(...analysis.suggestedSortOrder)
      .execute();
  }
}
```

## Cache Management

### 1. Query Result Cache

```javascript
// Implement query result caching
const cacheKey = crypto.createHash('md5')
  .update(sql + JSON.stringify(params))
  .digest('hex');

const cached = await cache.get(cacheKey);
if (cached && cached.timestamp > Date.now() - 300000) { // 5 min TTL
  return cached.result;
}
```

### 2. Metadata Cache

```javascript
// Warm metadata cache
await catalog.refreshTableMetadata("events");
await catalog.cacheTableStatistics("events");
```

## Escalation Procedures

### Level 1: Basic Optimization
- Update table statistics
- Clear stale cache entries
- Compact small files

### Level 2: Query Rewriting
- Analyze and rewrite slow queries
- Add appropriate indexes
- Implement query hints

### Level 3: Architecture Changes
- Consider partitioning strategy changes
- Implement materialized views
- Add query result caching layer

### Level 4: Infrastructure Scaling
- Increase Worker resources
- Implement query routing/sharding
- Consider dedicated query clusters

## Prevention Measures

1. **Regular Maintenance**
   - Schedule weekly statistics updates
   - Monitor query patterns for changes
   - Proactive compaction strategy

2. **Query Review Process**
   - Review new queries before production
   - Load test significant query changes
   - Maintain query performance baseline

3. **Monitoring and Alerts**
   - Track query latency percentiles
   - Alert on scan efficiency degradation
   - Monitor cache hit rates