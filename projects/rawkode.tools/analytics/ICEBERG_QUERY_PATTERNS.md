# Iceberg Query Patterns for Analytics Dashboards

## Overview

This document outlines optimized query patterns for analytics dashboards when using Apache Iceberg as the storage layer. These patterns leverage Iceberg's unique features like partition evolution, hidden partitioning, and time travel to provide efficient and flexible analytics queries.

## Core Query Patterns

### 1. Time-Series Aggregations

#### Pattern: Rolling Window Metrics
```sql
-- Hourly event counts with 7-day rolling window
WITH hourly_counts AS (
  SELECT 
    date_trunc('hour', timestamp) as hour,
    event_type,
    COUNT(*) as event_count
  FROM analytics.events
  WHERE timestamp >= current_timestamp - INTERVAL '7 days'
    AND timestamp < current_timestamp
  GROUP BY 1, 2
)
SELECT 
  hour,
  event_type,
  event_count,
  AVG(event_count) OVER (
    PARTITION BY event_type 
    ORDER BY hour 
    ROWS BETWEEN 23 PRECEDING AND CURRENT ROW
  ) as rolling_24h_avg
FROM hourly_counts
ORDER BY hour DESC, event_type;
```

**Iceberg Optimizations:**
- Partition pruning on timestamp column
- Metadata-only queries for recent partitions
- Column projection for required fields only

#### Pattern: Comparative Time Periods
```sql
-- Week-over-week comparison with Iceberg time travel
WITH current_week AS (
  SELECT 
    date_trunc('day', timestamp) as day,
    SUM(CAST(data->>'revenue' AS DECIMAL(10,2))) as revenue
  FROM analytics.events
  WHERE event_type = 'purchase.completed'
    AND timestamp >= current_date - INTERVAL '7 days'
    AND timestamp < current_date
  GROUP BY 1
),
previous_week AS (
  SELECT 
    date_trunc('day', timestamp) + INTERVAL '7 days' as day,
    SUM(CAST(data->>'revenue' AS DECIMAL(10,2))) as revenue
  FROM analytics.events FOR SYSTEM_TIME AS OF (current_timestamp - INTERVAL '7 days')
  WHERE event_type = 'purchase.completed'
    AND timestamp >= current_date - INTERVAL '14 days'
    AND timestamp < current_date - INTERVAL '7 days'
  GROUP BY 1
)
SELECT 
  c.day,
  c.revenue as current_revenue,
  p.revenue as previous_revenue,
  ROUND((c.revenue - p.revenue) / p.revenue * 100, 2) as growth_rate
FROM current_week c
LEFT JOIN previous_week p ON c.day = p.day
ORDER BY c.day;
```

### 2. Dimensional Analysis

#### Pattern: Multi-Dimensional Breakdowns
```sql
-- Event counts by multiple dimensions with drill-down capability
WITH base_metrics AS (
  SELECT 
    event_type,
    data->>'source' as source,
    data->>'cf_country' as country,
    data->>'cf_city' as city,
    date_trunc('day', timestamp) as day,
    COUNT(*) as event_count,
    COUNT(DISTINCT subject) as unique_users
  FROM analytics.events
  WHERE timestamp >= current_date - INTERVAL '30 days'
  GROUP BY 1, 2, 3, 4, 5
)
SELECT 
  day,
  event_type,
  source,
  country,
  ARRAY_AGG(DISTINCT city) FILTER (WHERE city IS NOT NULL) as cities,
  SUM(event_count) as total_events,
  SUM(unique_users) as total_users,
  ROUND(SUM(event_count)::NUMERIC / NULLIF(SUM(unique_users), 0), 2) as events_per_user
FROM base_metrics
GROUP BY ROLLUP(day, event_type, source, country)
HAVING day IS NOT NULL  -- Exclude grand total
ORDER BY day DESC, total_events DESC;
```

#### Pattern: Cohort Analysis
```sql
-- User cohort retention analysis
WITH user_cohorts AS (
  SELECT 
    subject as user_id,
    DATE(MIN(timestamp)) as cohort_date
  FROM analytics.events
  WHERE event_type = 'user.registered'
  GROUP BY 1
),
user_activity AS (
  SELECT 
    subject as user_id,
    DATE(timestamp) as activity_date
  FROM analytics.events
  WHERE event_type IN ('session.started', 'page.viewed')
  GROUP BY 1, 2
),
cohort_retention AS (
  SELECT 
    c.cohort_date,
    DATEDIFF('day', c.cohort_date, a.activity_date) as days_since_registration,
    COUNT(DISTINCT c.user_id) as active_users
  FROM user_cohorts c
  JOIN user_activity a ON c.user_id = a.user_id
  WHERE c.cohort_date >= current_date - INTERVAL '90 days'
  GROUP BY 1, 2
),
cohort_sizes AS (
  SELECT 
    cohort_date,
    COUNT(DISTINCT user_id) as cohort_size
  FROM user_cohorts
  WHERE cohort_date >= current_date - INTERVAL '90 days'
  GROUP BY 1
)
SELECT 
  r.cohort_date,
  r.days_since_registration,
  r.active_users,
  s.cohort_size,
  ROUND(r.active_users::NUMERIC / s.cohort_size * 100, 2) as retention_rate
FROM cohort_retention r
JOIN cohort_sizes s ON r.cohort_date = s.cohort_date
WHERE r.days_since_registration IN (0, 1, 7, 14, 30, 60, 90)
ORDER BY r.cohort_date DESC, r.days_since_registration;
```

### 3. Funnel Analysis

#### Pattern: Conversion Funnels
```sql
-- E-commerce conversion funnel with Iceberg's efficient filtering
WITH funnel_events AS (
  SELECT 
    subject as user_id,
    session_id,
    event_type,
    timestamp,
    data
  FROM analytics.events
  WHERE timestamp >= current_timestamp - INTERVAL '24 hours'
    AND event_type IN (
      'product.viewed',
      'cart.added',
      'checkout.started',
      'purchase.completed'
    )
),
user_funnel AS (
  SELECT 
    user_id,
    session_id,
    MAX(CASE WHEN event_type = 'product.viewed' THEN 1 ELSE 0 END) as viewed_product,
    MAX(CASE WHEN event_type = 'cart.added' THEN 1 ELSE 0 END) as added_to_cart,
    MAX(CASE WHEN event_type = 'checkout.started' THEN 1 ELSE 0 END) as started_checkout,
    MAX(CASE WHEN event_type = 'purchase.completed' THEN 1 ELSE 0 END) as completed_purchase,
    MIN(CASE WHEN event_type = 'product.viewed' THEN timestamp END) as first_view_time,
    MAX(CASE WHEN event_type = 'purchase.completed' THEN timestamp END) as purchase_time
  FROM funnel_events
  GROUP BY 1, 2
)
SELECT 
  COUNT(DISTINCT user_id) FILTER (WHERE viewed_product = 1) as step_1_users,
  COUNT(DISTINCT user_id) FILTER (WHERE added_to_cart = 1 AND viewed_product = 1) as step_2_users,
  COUNT(DISTINCT user_id) FILTER (WHERE started_checkout = 1 AND added_to_cart = 1) as step_3_users,
  COUNT(DISTINCT user_id) FILTER (WHERE completed_purchase = 1 AND started_checkout = 1) as step_4_users,
  ROUND(AVG(EXTRACT(EPOCH FROM (purchase_time - first_view_time))/60) FILTER (WHERE completed_purchase = 1), 2) as avg_conversion_time_minutes
FROM user_funnel;
```

### 4. Real-Time Metrics

#### Pattern: Live Dashboard Metrics
```sql
-- Real-time metrics combining recent streaming data with historical batch
WITH real_time_window AS (
  SELECT 
    date_trunc('minute', timestamp) as minute,
    event_type,
    COUNT(*) as event_count,
    COUNT(DISTINCT subject) as unique_users,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY CAST(data->>'duration' AS NUMERIC)) as p95_duration
  FROM analytics.events
  WHERE timestamp >= current_timestamp - INTERVAL '5 minutes'
  GROUP BY 1, 2
),
historical_baseline AS (
  SELECT 
    EXTRACT(HOUR FROM timestamp) * 60 + EXTRACT(MINUTE FROM timestamp) as minute_of_day,
    event_type,
    AVG(event_count) as avg_event_count,
    STDDEV(event_count) as stddev_event_count
  FROM (
    SELECT 
      date_trunc('minute', timestamp) as minute,
      EXTRACT(HOUR FROM timestamp) * 60 + EXTRACT(MINUTE FROM timestamp) as minute_of_day,
      event_type,
      COUNT(*) as event_count
    FROM analytics.events
    WHERE timestamp >= current_timestamp - INTERVAL '7 days'
      AND timestamp < current_timestamp - INTERVAL '5 minutes'
    GROUP BY 1, 2, 3
  ) historical
  GROUP BY 1, 2
)
SELECT 
  r.minute,
  r.event_type,
  r.event_count,
  r.unique_users,
  r.p95_duration,
  h.avg_event_count as historical_avg,
  CASE 
    WHEN h.stddev_event_count > 0 THEN 
      (r.event_count - h.avg_event_count) / h.stddev_event_count
    ELSE 0 
  END as z_score,
  CASE 
    WHEN ABS((r.event_count - h.avg_event_count) / h.stddev_event_count) > 3 THEN 'ANOMALY'
    WHEN ABS((r.event_count - h.avg_event_count) / h.stddev_event_count) > 2 THEN 'WARNING'
    ELSE 'NORMAL'
  END as status
FROM real_time_window r
LEFT JOIN historical_baseline h 
  ON EXTRACT(HOUR FROM r.minute) * 60 + EXTRACT(MINUTE FROM r.minute) = h.minute_of_day
  AND r.event_type = h.event_type
ORDER BY r.minute DESC, r.event_count DESC;
```

### 5. User Journey Analysis

#### Pattern: Sequential Event Patterns
```sql
-- Find common user paths through the application
WITH user_events AS (
  SELECT 
    subject as user_id,
    event_type,
    timestamp,
    LAG(event_type) OVER (PARTITION BY subject ORDER BY timestamp) as prev_event,
    LEAD(event_type) OVER (PARTITION BY subject ORDER BY timestamp) as next_event
  FROM analytics.events
  WHERE timestamp >= current_timestamp - INTERVAL '1 day'
    AND subject IS NOT NULL
),
event_sequences AS (
  SELECT 
    CONCAT(
      COALESCE(prev_event, 'START'),
      ' -> ',
      event_type,
      ' -> ',
      COALESCE(next_event, 'END')
    ) as sequence,
    COUNT(*) as occurrence_count
  FROM user_events
  GROUP BY 1
  HAVING COUNT(*) > 10  -- Filter out rare sequences
)
SELECT 
  sequence,
  occurrence_count,
  ROUND(occurrence_count::NUMERIC / SUM(occurrence_count) OVER () * 100, 2) as percentage
FROM event_sequences
ORDER BY occurrence_count DESC
LIMIT 20;
```

### 6. Performance Analytics

#### Pattern: Application Performance Metrics
```sql
-- Performance metrics with percentile calculations
WITH performance_data AS (
  SELECT 
    event_type,
    date_trunc('hour', timestamp) as hour,
    CAST(data->>'duration' AS NUMERIC) as duration_ms,
    CAST(data->>'size' AS NUMERIC) as payload_size,
    data->>'cf_colo' as edge_location
  FROM analytics.events
  WHERE timestamp >= current_timestamp - INTERVAL '24 hours'
    AND event_type LIKE '%.performance'
    AND data->>'duration' IS NOT NULL
),
hourly_metrics AS (
  SELECT 
    hour,
    event_type,
    edge_location,
    COUNT(*) as request_count,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_ms) as p50_duration,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) as p95_duration,
    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_ms) as p99_duration,
    AVG(duration_ms) as avg_duration,
    AVG(payload_size) as avg_payload_size
  FROM performance_data
  GROUP BY 1, 2, 3
)
SELECT 
  hour,
  event_type,
  edge_location,
  request_count,
  ROUND(p50_duration, 2) as p50_ms,
  ROUND(p95_duration, 2) as p95_ms,
  ROUND(p99_duration, 2) as p99_ms,
  ROUND(avg_duration, 2) as avg_ms,
  ROUND(avg_payload_size / 1024, 2) as avg_payload_kb,
  CASE 
    WHEN p95_duration > 1000 THEN 'CRITICAL'
    WHEN p95_duration > 500 THEN 'WARNING'
    ELSE 'GOOD'
  END as performance_status
FROM hourly_metrics
ORDER BY hour DESC, request_count DESC;
```

## Query Optimization Strategies

### 1. Partition Pruning
```sql
-- Always include partition predicates
WHERE timestamp >= current_date - INTERVAL '7 days'  -- Prunes old partitions
  AND event_type = 'specific.event'  -- Prunes by event type if partitioned
```

### 2. Column Projection
```sql
-- Only select needed columns
SELECT timestamp, event_type, subject  -- Good
-- vs
SELECT *  -- Bad - reads all columns
```

### 3. Predicate Pushdown
```sql
-- Apply filters early
WITH filtered_events AS (
  SELECT * FROM analytics.events
  WHERE event_type = 'purchase.completed'  -- Filter pushed to scan
    AND timestamp >= current_date - INTERVAL '30 days'
)
```

### 4. Metadata Queries
```sql
-- Use Iceberg metadata tables for statistics
SELECT 
  file_path,
  file_format,
  record_count,
  file_size_in_bytes
FROM analytics.events.files
WHERE partition.timestamp_day >= current_date - INTERVAL '7 days'
ORDER BY file_size_in_bytes DESC
LIMIT 10;
```

### 5. Incremental Processing
```sql
-- Track processed data using Iceberg snapshots
WITH last_processed AS (
  SELECT MAX(snapshot_id) as last_snapshot_id
  FROM analytics.processing_log
  WHERE job_name = 'hourly_aggregation'
),
new_data AS (
  SELECT *
  FROM analytics.events.incremental_scan(
    (SELECT last_snapshot_id FROM last_processed)
  )
)
SELECT 
  date_trunc('hour', timestamp) as hour,
  event_type,
  COUNT(*) as event_count
FROM new_data
GROUP BY 1, 2;
```

## Caching Strategies

### 1. Query Result Caching
```typescript
interface CacheKey {
  query: string;
  parameters: Record<string, any>;
  icebergSnapshot: string;
  partitionFilter: string;
}

interface CacheEntry {
  key: CacheKey;
  result: any;
  timestamp: number;
  ttl: number;
  size: number;
}
```

### 2. Materialized View Patterns
```sql
-- Create materialized aggregates for common queries
CREATE MATERIALIZED VIEW hourly_event_summary AS
SELECT 
  date_trunc('hour', timestamp) as hour,
  event_type,
  source,
  COUNT(*) as event_count,
  COUNT(DISTINCT subject) as unique_users,
  APPROX_PERCENTILE(CAST(data->>'duration' AS NUMERIC), 0.95) as p95_duration
FROM analytics.events
WHERE timestamp >= current_timestamp - INTERVAL '7 days'
GROUP BY 1, 2, 3;

-- Refresh incrementally
REFRESH MATERIALIZED VIEW hourly_event_summary
WHERE hour >= current_timestamp - INTERVAL '2 hours';
```

## Dashboard-Specific Patterns

### 1. Executive Dashboard
```sql
-- High-level KPIs with period comparisons
WITH kpi_metrics AS (
  SELECT 
    COUNT(DISTINCT subject) FILTER (WHERE event_type = 'session.started') as dau,
    COUNT(*) FILTER (WHERE event_type = 'purchase.completed') as transactions,
    SUM(CAST(data->>'revenue' AS NUMERIC)) FILTER (WHERE event_type = 'purchase.completed') as revenue,
    COUNT(*) FILTER (WHERE event_type = 'error.occurred') as errors
  FROM analytics.events
  WHERE timestamp >= current_date
),
previous_period AS (
  SELECT 
    COUNT(DISTINCT subject) FILTER (WHERE event_type = 'session.started') as dau,
    COUNT(*) FILTER (WHERE event_type = 'purchase.completed') as transactions,
    SUM(CAST(data->>'revenue' AS NUMERIC)) FILTER (WHERE event_type = 'purchase.completed') as revenue,
    COUNT(*) FILTER (WHERE event_type = 'error.occurred') as errors
  FROM analytics.events
  WHERE timestamp >= current_date - INTERVAL '1 day'
    AND timestamp < current_date
)
SELECT 
  k.*,
  ROUND((k.dau - p.dau)::NUMERIC / NULLIF(p.dau, 0) * 100, 2) as dau_change,
  ROUND((k.revenue - p.revenue)::NUMERIC / NULLIF(p.revenue, 0) * 100, 2) as revenue_change
FROM kpi_metrics k
CROSS JOIN previous_period p;
```

### 2. Real-Time Operations Dashboard
```sql
-- Live operational metrics
WITH RECURSIVE time_series AS (
  SELECT current_timestamp - INTERVAL '60 minutes' as ts
  UNION ALL
  SELECT ts + INTERVAL '1 minute'
  FROM time_series
  WHERE ts < current_timestamp
),
event_counts AS (
  SELECT 
    date_trunc('minute', timestamp) as minute,
    COUNT(*) as total_events,
    COUNT(*) FILTER (WHERE event_type LIKE 'error.%') as error_events,
    AVG(CAST(data->>'response_time' AS NUMERIC)) as avg_response_time
  FROM analytics.events
  WHERE timestamp >= current_timestamp - INTERVAL '60 minutes'
  GROUP BY 1
)
SELECT 
  t.ts as minute,
  COALESCE(e.total_events, 0) as events,
  COALESCE(e.error_events, 0) as errors,
  ROUND(COALESCE(e.avg_response_time, 0), 2) as avg_response_ms,
  CASE 
    WHEN e.error_events > 10 OR e.avg_response_time > 1000 THEN 'ALERT'
    WHEN e.error_events > 5 OR e.avg_response_time > 500 THEN 'WARNING'
    ELSE 'HEALTHY'
  END as status
FROM time_series t
LEFT JOIN event_counts e ON t.ts = e.minute
ORDER BY t.ts DESC;
```

## Best Practices

1. **Use Time-Based Partitioning**: Always partition by timestamp for efficient pruning
2. **Leverage Hidden Partitioning**: Let Iceberg handle partition evolution
3. **Implement Incremental Processing**: Use snapshot-based incremental reads
4. **Cache Aggressively**: Cache results with snapshot-based invalidation
5. **Monitor Query Performance**: Track query execution times and optimize
6. **Use Approximate Aggregations**: For large datasets, use HyperLogLog or similar
7. **Implement Query Timeouts**: Prevent runaway queries from impacting performance

## Conclusion

These query patterns provide a foundation for building efficient analytics dashboards on top of Apache Iceberg. The key is to leverage Iceberg's unique features while following standard query optimization practices. Regular monitoring and optimization of these patterns will ensure consistent performance as data volumes grow.