# Runbook: Storage Management

## Overview
This runbook covers storage-related issues in the Iceberg analytics pipeline, including capacity management, cost optimization, and data retention.

## Alert: Storage Critical

### Symptoms
- Alert: "R2 storage usage > 90% of quota"
- Write failures due to storage limits
- Increased storage costs
- Performance degradation

### Immediate Actions

1. **Check Current Usage**
   ```bash
   # Get storage metrics
   wrangler r2 object list analytics-source --info
   ```

2. **Identify Large Objects**
   ```bash
   # Find files over 100MB
   wrangler r2 object list analytics-source | awk '$2 > 104857600'
   ```

3. **Emergency Cleanup**
   ```bash
   # Remove orphaned files (CAUTION: verify first)
   curl -X POST https://analytics-event-collector.workers.dev/admin/cleanup \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -d '{"mode": "orphaned", "dryRun": false}'
   ```

### Root Cause Analysis

1. **Storage Growth Analysis**
   ```javascript
   // Analyze storage growth patterns
   const analysis = await analyzeStorageGrowth({
     bucket: "analytics-source",
     timeRange: "30d",
     groupBy: "day"
   });
   
   console.log("Daily growth rate:", analysis.avgDailyGrowth);
   console.log("Projected full date:", analysis.projectedFullDate);
   ```

2. **Data Distribution**
   - Check data distribution by partition
   - Identify hotspots or uneven growth
   - Review retention policy effectiveness

3. **File Type Analysis**
   ```bash
   # Categorize storage by file type
   wrangler r2 object list analytics-source --prefix "analytics/events/" | \
     awk -F'/' '{print $NF}' | \
     awk -F'.' '{count[$NF]++; size[$NF]+=$2} END {
       for (ext in count) print ext, count[ext], size[ext]
     }'
   ```

## Storage Optimization Strategies

### 1. Aggressive Compaction

```javascript
// Reduce file count and optimize size
export async function aggressiveCompaction(env) {
  const config = {
    targetFileSize: 256 * 1024 * 1024, // 256MB
    minFilesToCompact: 5,
    maxFilesPerOperation: 50,
    compressionLevel: 9 // Maximum compression
  };
  
  await runCompaction(env, config);
}
```

### 2. Data Retention Implementation

```javascript
// Implement time-based retention
export async function enforceRetention(env, retentionDays = 90) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
  
  const expiredSnapshots = await table.snapshots()
    .filter(s => s.timestampMillis < cutoffDate.getTime());
  
  for (const snapshot of expiredSnapshots) {
    await table.expireSnapshot(snapshot.snapshotId).commit();
  }
  
  // Clean up orphaned files
  await table.removeOrphanFiles()
    .olderThan(cutoffDate)
    .execute();
}
```

### 3. Compression Optimization

```javascript
// Configure optimal compression
await table.updateProperties()
  .set("write.parquet.compression-codec", "zstd")
  .set("write.parquet.compression-level", "9")
  .set("write.parquet.page-size-bytes", "1048576")
  .set("write.parquet.dictionary-encoding", "true")
  .commit();
```

## Cost Management

### 1. Storage Tiering

```javascript
// Move old data to cheaper storage
export async function tierOldData(env) {
  const tieringPolicy = {
    hot: { maxAge: 7, storage: "standard" },
    warm: { maxAge: 30, storage: "infrequent" },
    cold: { maxAge: 90, storage: "archive" }
  };
  
  // Implement tiering logic
  for (const [tier, policy] of Object.entries(tieringPolicy)) {
    await moveDataToTier(env, tier, policy);
  }
}
```

### 2. Duplicate Detection

```javascript
// Find and remove duplicate data
export async function findDuplicates(env) {
  const hashes = new Map();
  const duplicates = [];
  
  const files = await listDataFiles(env);
  
  for (const file of files) {
    const hash = await calculateFileHash(file);
    if (hashes.has(hash)) {
      duplicates.push({
        original: hashes.get(hash),
        duplicate: file
      });
    } else {
      hashes.set(hash, file);
    }
  }
  
  return duplicates;
}
```

### 3. Storage Metrics and Reporting

```javascript
// Generate storage report
export async function generateStorageReport(env) {
  const report = {
    timestamp: new Date().toISOString(),
    totalStorage: 0,
    fileCount: 0,
    avgFileSize: 0,
    storageByPartition: {},
    compressionRatio: 0,
    orphanedFiles: 0,
    estimatedMonthlyCost: 0
  };
  
  // Populate report
  const files = await listAllFiles(env);
  report.fileCount = files.length;
  report.totalStorage = files.reduce((sum, f) => sum + f.size, 0);
  report.avgFileSize = report.totalStorage / report.fileCount;
  
  // Calculate costs (R2 pricing)
  const storageGB = report.totalStorage / (1024 ** 3);
  report.estimatedMonthlyCost = storageGB * 0.015; // $0.015 per GB/month
  
  return report;
}
```

## Cleanup Procedures

### 1. Orphaned File Cleanup

```javascript
// Safe orphaned file removal
export async function cleanupOrphanedFiles(env, dryRun = true) {
  const activeFiles = await table.currentSnapshot().allDataFiles();
  const allFiles = await listDataFiles(env);
  
  const orphaned = allFiles.filter(f => 
    !activeFiles.some(af => af.path === f.path)
  );
  
  console.log(`Found ${orphaned.length} orphaned files`);
  
  if (!dryRun) {
    for (const file of orphaned) {
      await deleteFile(env, file.path);
    }
  }
  
  return orphaned;
}
```

### 2. Metadata Cleanup

```javascript
// Clean up old metadata
export async function cleanupMetadata(env) {
  // Remove old snapshots
  const snapshots = await table.snapshots();
  const keepCount = 10; // Keep last 10 snapshots
  
  if (snapshots.length > keepCount) {
    const toRemove = snapshots
      .sort((a, b) => b.timestampMillis - a.timestampMillis)
      .slice(keepCount);
    
    for (const snapshot of toRemove) {
      await table.expireSnapshot(snapshot.snapshotId).commit();
    }
  }
  
  // Compact manifests
  await table.rewriteManifests().commit();
}
```

## Monitoring and Alerts

### 1. Storage Growth Alerts

```javascript
// Set up progressive storage alerts
const storageAlerts = [
  { threshold: 50, severity: "info", message: "Storage at 50% capacity" },
  { threshold: 70, severity: "warning", message: "Storage at 70% capacity" },
  { threshold: 85, severity: "critical", message: "Storage at 85% capacity" },
  { threshold: 95, severity: "emergency", message: "Storage critical - immediate action required" }
];
```

### 2. Cost Tracking

```javascript
// Track storage costs over time
export async function trackStorageCosts(env) {
  const dailyCost = await calculateDailyStorageCost(env);
  
  await env.ANALYTICS_ENGINE.writeDataPoint({
    metric: "storage.cost.daily",
    value: dailyCost,
    tags: {
      bucket: "analytics-source",
      currency: "USD"
    }
  });
}
```

## Prevention Measures

1. **Capacity Planning**
   - Monthly storage growth reviews
   - Quarterly capacity planning sessions
   - Automated growth projections

2. **Retention Automation**
   - Automated retention policy enforcement
   - Regular cleanup jobs
   - Partition-based expiration

3. **Cost Optimization**
   - Regular compression review
   - File size optimization
   - Storage tier automation

## Escalation

1. **Level 1**: Clean up orphaned files and old snapshots
2. **Level 2**: Implement aggressive retention policies
3. **Level 3**: Increase storage quota temporarily
4. **Level 4**: Architecture review for data reduction