# Runbook: Compaction Issues

## Overview
This runbook addresses compaction-related issues in the Iceberg analytics pipeline, including failures, performance problems, and optimization strategies.

## Alert: Compaction Failures

### Symptoms
- Alert: "Compaction failure rate > 0"
- Growing number of small files
- Degraded query performance
- Increased storage costs

### Immediate Actions

1. **Check Compaction Status**
   ```bash
   # View recent compaction attempts
   wrangler tail --format json | grep "compaction"
   ```

2. **Identify Failed Jobs**
   - Review error logs for specific failure reasons
   - Check for timeout errors
   - Look for permission issues

3. **Manual Compaction Trigger**
   ```bash
   # Force manual compaction
   curl -X POST https://analytics-event-collector.workers.dev/admin/compact \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"table": "events", "force": true}'
   ```

### Root Cause Analysis

1. **Resource Constraints**
   - Worker memory limits (128MB)
   - CPU time limits (10ms burst, 50ms total)
   - Concurrent operation limits

2. **File Size Issues**
   - Files too large for single operation
   - Too many files to process in one run
   - Corrupted files blocking compaction

3. **Configuration Problems**
   - COMPACTION_THRESHOLD set too high
   - TARGET_FILE_SIZE_MB unrealistic
   - Incompatible Iceberg settings

### Troubleshooting Steps

1. **Analyze File Distribution**
   ```bash
   # List files and sizes
   wrangler r2 object list analytics-source --prefix "analytics/events/data/"
   ```

2. **Check Worker Resources**
   ```bash
   # Monitor worker metrics during compaction
   wrangler tail --format json | grep -E "memory|cpu|duration"
   ```

3. **Validate Iceberg Metadata**
   - Check manifest integrity
   - Verify snapshot consistency
   - Look for orphaned files

## Alert: Compaction Backlog

### Symptoms
- File count > COMPACTION_THRESHOLD * 2
- Increasing query latency
- Storage growth exceeding projections

### Recovery Procedures

1. **Batch Compaction Strategy**
   ```javascript
   // Compact in smaller batches
   const batchSize = 10;
   const files = await listFiles();
   
   for (let i = 0; i < files.length; i += batchSize) {
     const batch = files.slice(i, i + batchSize);
     await compactBatch(batch);
   }
   ```

2. **Progressive Compaction**
   - Start with oldest files first
   - Target specific time ranges
   - Compact by partition if applicable

3. **Emergency Compaction**
   ```bash
   # Aggressive compaction settings
   curl -X POST https://analytics-event-collector.workers.dev/admin/compact \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "table": "events",
       "force": true,
       "aggressive": true,
       "targetFiles": 50
     }'
   ```

## Optimization Strategies

### 1. Tuning Compaction Parameters

```jsonc
// Optimal settings for different workloads

// High-volume, real-time
{
  "COMPACTION_THRESHOLD": "30",
  "TARGET_FILE_SIZE_MB": "64"
}

// Batch-oriented, large files
{
  "COMPACTION_THRESHOLD": "100",
  "TARGET_FILE_SIZE_MB": "256"
}

// Balanced approach
{
  "COMPACTION_THRESHOLD": "50",
  "TARGET_FILE_SIZE_MB": "128"
}
```

### 2. Scheduled Compaction

```javascript
// Implement scheduled compaction
export async function scheduled(event, env, ctx) {
  switch (event.cron) {
    case "0 2 * * *": // 2 AM daily
      await runCompaction(env, { mode: "daily" });
      break;
    case "0 3 * * 0": // 3 AM Sunday
      await runCompaction(env, { mode: "weekly", aggressive: true });
      break;
  }
}
```

### 3. Monitoring Best Practices

1. **File Metrics**
   - Track file count trends
   - Monitor size distribution
   - Alert on anomalies

2. **Performance Metrics**
   - Compaction duration
   - Files processed per run
   - Success/failure rates

3. **Cost Optimization**
   - Balance file size with query performance
   - Consider storage vs compute costs
   - Implement retention policies

## Prevention Measures

1. **Proactive Monitoring**
   - Set up trend alerts before hitting thresholds
   - Monitor file creation rate
   - Track compaction efficiency

2. **Regular Maintenance**
   - Schedule regular compaction windows
   - Clean up orphaned files
   - Update statistics regularly

3. **Testing**
   - Load test compaction under stress
   - Validate different file size scenarios
   - Test recovery procedures

## Escalation

If compaction issues persist:

1. **Level 1**: Increase compaction frequency
2. **Level 2**: Adjust file size targets
3. **Level 3**: Consider architecture changes (partitioning, bucketing)
4. **Level 4**: Engage Cloudflare support for Worker limits