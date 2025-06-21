# Runbook: Buffer Management

## Overview
This runbook covers procedures for managing event buffer issues in the Iceberg analytics pipeline.

## Alert: High Buffer Fill Rate

### Symptoms
- Alert: "Buffer fill rate > 90% for > 5 minutes"
- Potential data loss if buffer overflows
- Increased processing latency

### Immediate Actions

1. **Check Current Buffer Status**
   ```bash
   # View buffer metrics
   wrangler tail --format json | grep "buffer_fill_rate"
   ```

2. **Force Buffer Flush**
   ```bash
   # Trigger manual flush via API
   curl -X POST https://analytics-event-collector.workers.dev/admin/flush \
     -H "Authorization: Bearer $ADMIN_TOKEN"
   ```

3. **Verify Flush Success**
   - Check R2 for new data files
   - Monitor buffer fill rate dropping
   - Confirm no data loss

### Root Cause Analysis

1. **Check Event Volume**
   - Is there an unusual spike in events?
   - Are specific event types causing the surge?

2. **Review Buffer Configuration**
   - Current ICEBERG_BUFFER_SIZE setting
   - ICEBERG_BUFFER_TIMEOUT_MS value
   - Consider if settings need adjustment

3. **Investigate Downstream Issues**
   - R2 write latency
   - Network connectivity
   - Iceberg catalog responsiveness

### Long-term Solutions

1. **Scale Buffer Size**
   ```jsonc
   // Update wrangler.jsonc
   "ICEBERG_BUFFER_SIZE": "5000", // Increase from 2000
   ```

2. **Implement Backpressure**
   - Add rate limiting for event ingestion
   - Implement client-side retry logic

3. **Optimize Flush Frequency**
   - Reduce ICEBERG_BUFFER_TIMEOUT_MS for more frequent flushes
   - Balance between file size and latency

## Alert: Buffer Flush Failures

### Symptoms
- Failed flush operations
- Growing buffer size
- Error logs indicating write failures

### Troubleshooting Steps

1. **Check R2 Permissions**
   ```bash
   # Test R2 write access
   wrangler r2 object put analytics-source/test.txt --file ./test.txt
   ```

2. **Verify Iceberg Table State**
   - Check catalog accessibility
   - Verify table metadata is valid
   - Look for corrupted manifest files

3. **Review Error Logs**
   ```bash
   # Get detailed error logs
   wrangler tail --format pretty | grep -E "ERROR|FAIL"
   ```

### Recovery Procedures

1. **Manual Data Recovery**
   - Export buffered events to backup location
   - Clear buffer and restart
   - Replay events from backup

2. **Reset Buffer State**
   ```bash
   # Clear Durable Object state (CAUTION: potential data loss)
   wrangler durable-objects reset EVENT_BUFFER_DO
   ```

## Prevention Measures

1. **Monitoring**
   - Set up graduated alerts (50%, 70%, 90% thresholds)
   - Track buffer performance trends
   - Regular capacity planning reviews

2. **Testing**
   - Load test buffer capacity regularly
   - Simulate failure scenarios
   - Validate recovery procedures

3. **Documentation**
   - Keep buffer configuration documented
   - Maintain event volume baselines
   - Document any custom buffer settings