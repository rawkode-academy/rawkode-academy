import { describe, it, expect, beforeEach } from 'vitest';

interface DataFile {
  path: string;
  sizeBytes: number;
  recordCount: number;
  createdAt: Date;
}

interface CompactionPlan {
  fileGroups: FileGroup[];
  estimatedOutputSize: number;
  estimatedDuration: number;
}

interface FileGroup {
  files: string[];
  totalSize: number;
  totalRecords: number;
}

interface CompactionResult {
  filesRemoved: number;
  filesAdded: number;
  recordsAffected: number;
  bytesCompacted: number;
  duration: number;
}

interface Snapshot {
  snapshotId: number;
  timestampMs: number;
  parentSnapshotId?: number;
  manifestList: string;
}

interface RetentionPolicy {
  maxSnapshotAgeMs?: number;
  minSnapshotsToKeep?: number;
  maxSnapshotsToKeep?: number;
}

class CompactionStrategy {
  private targetFileSize: number;
  private minFileCount: number;
  private maxFileSize: number;

  constructor(config: {
    targetFileSize?: number;
    minFileCount?: number;
    maxFileSize?: number;
  } = {}) {
    this.targetFileSize = config.targetFileSize || 64 * 1024 * 1024; // 64MB
    this.minFileCount = config.minFileCount || 2;
    this.maxFileSize = config.maxFileSize || 512 * 1024 * 1024; // 512MB
  }

  planCompaction(files: DataFile[]): CompactionPlan {
    const smallFiles = files.filter(f => f.sizeBytes < this.targetFileSize);
    const fileGroups: FileGroup[] = [];
    
    if (smallFiles.length < this.minFileCount) {
      return { fileGroups: [], estimatedOutputSize: 0, estimatedDuration: 0 };
    }

    // Group small files to reach target size
    let currentGroup: DataFile[] = [];
    let currentSize = 0;

    for (const file of smallFiles) {
      if (currentSize + file.sizeBytes > this.maxFileSize && currentGroup.length > 0) {
        // Start new group
        fileGroups.push(this.createFileGroup(currentGroup));
        currentGroup = [file];
        currentSize = file.sizeBytes;
      } else {
        currentGroup.push(file);
        currentSize += file.sizeBytes;
      }
    }

    // Add remaining files if they meet minimum count
    if (currentGroup.length >= this.minFileCount) {
      fileGroups.push(this.createFileGroup(currentGroup));
    }

    const estimatedOutputSize = fileGroups.reduce((sum, g) => sum + g.totalSize, 0);
    const estimatedDuration = Math.ceil(estimatedOutputSize / (50 * 1024 * 1024)); // 50MB/s

    return { fileGroups, estimatedOutputSize, estimatedDuration };
  }

  private createFileGroup(files: DataFile[]): FileGroup {
    return {
      files: files.map(f => f.path),
      totalSize: files.reduce((sum, f) => sum + f.sizeBytes, 0),
      totalRecords: files.reduce((sum, f) => sum + f.recordCount, 0),
    };
  }
}

class Compactor {
  private strategy: CompactionStrategy;

  constructor(strategy: CompactionStrategy) {
    this.strategy = strategy;
  }

  async compactFiles(files: DataFile[]): Promise<CompactionResult> {
    const startTime = Date.now();
    const plan = this.strategy.planCompaction(files);
    
    if (plan.fileGroups.length === 0) {
      return {
        filesRemoved: 0,
        filesAdded: 0,
        recordsAffected: 0,
        bytesCompacted: 0,
        duration: 0,
      };
    }

    let filesRemoved = 0;
    let filesAdded = 0;
    let recordsAffected = 0;
    let bytesCompacted = 0;

    for (const group of plan.fileGroups) {
      // Simulate compaction
      filesRemoved += group.files.length;
      filesAdded += 1;
      recordsAffected += group.totalRecords;
      bytesCompacted += group.totalSize;
      
      // Simulate I/O delay
      await new Promise(resolve => 
        setTimeout(resolve, Math.min(100, group.totalSize / 1024 / 1024))
      );
    }

    return {
      filesRemoved,
      filesAdded,
      recordsAffected,
      bytesCompacted,
      duration: Date.now() - startTime,
    };
  }
}

class OrphanFileCleaner {
  async findOrphanFiles(
    allFiles: string[],
    referencedFiles: Set<string>
  ): Promise<string[]> {
    return allFiles.filter(file => !referencedFiles.has(file));
  }

  async removeOrphanFiles(orphanFiles: string[]): Promise<number> {
    // Simulate file removal
    for (const file of orphanFiles) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    return orphanFiles.length;
  }
}

class SnapshotManager {
  async expireSnapshots(
    snapshots: Snapshot[],
    policy: RetentionPolicy
  ): Promise<Snapshot[]> {
    const now = Date.now();
    let eligibleForRemoval = [...snapshots];

    // Apply age-based retention
    if (policy.maxSnapshotAgeMs) {
      eligibleForRemoval = eligibleForRemoval.filter(
        s => now - s.timestampMs > policy.maxSnapshotAgeMs!
      );
    }

    // Ensure minimum snapshots are kept
    if (policy.minSnapshotsToKeep) {
      const toKeep = snapshots.length - eligibleForRemoval.length;
      if (toKeep < policy.minSnapshotsToKeep) {
        const keepCount = policy.minSnapshotsToKeep - toKeep;
        eligibleForRemoval = eligibleForRemoval.slice(keepCount);
      }
    }

    // Apply maximum snapshot limit
    if (policy.maxSnapshotsToKeep && snapshots.length > policy.maxSnapshotsToKeep) {
      const excess = snapshots.length - policy.maxSnapshotsToKeep;
      const oldestFirst = [...snapshots].sort((a, b) => a.timestampMs - b.timestampMs);
      eligibleForRemoval = oldestFirst.slice(0, excess);
    }

    return eligibleForRemoval;
  }
}

describe('Compaction Strategy Tests', () => {
  it('should identify files for compaction', () => {
    // Given
    const files: DataFile[] = [
      { path: 'small1.parquet', sizeBytes: 1_000_000, recordCount: 100, createdAt: new Date() },
      { path: 'small2.parquet', sizeBytes: 2_000_000, recordCount: 200, createdAt: new Date() },
      { path: 'small3.parquet', sizeBytes: 3_000_000, recordCount: 300, createdAt: new Date() },
      { path: 'large1.parquet', sizeBytes: 100_000_000, recordCount: 10000, createdAt: new Date() },
    ];
    
    const strategy = new CompactionStrategy({
      targetFileSize: 64_000_000,
      minFileCount: 2,
    });
    
    // When
    const plan = strategy.planCompaction(files);
    
    // Then
    expect(plan.fileGroups.length).toBe(1);
    expect(plan.fileGroups[0].files.length).toBe(3);
    expect(plan.fileGroups[0].files).not.toContain('large1.parquet');
    expect(plan.fileGroups[0].totalSize).toBe(6_000_000);
  });

  it('should respect maximum file size limit', () => {
    // Given
    const files: DataFile[] = Array.from({ length: 100 }, (_, i) => ({
      path: `file${i}.parquet`,
      sizeBytes: 10_000_000, // 10MB each
      recordCount: 1000,
      createdAt: new Date(),
    }));
    
    const strategy = new CompactionStrategy({
      targetFileSize: 64_000_000,
      maxFileSize: 128_000_000, // 128MB max
    });
    
    // When
    const plan = strategy.planCompaction(files);
    
    // Then
    plan.fileGroups.forEach(group => {
      expect(group.totalSize).toBeLessThanOrEqual(128_000_000);
      expect(group.files.length).toBeLessThanOrEqual(12); // 12 * 10MB = 120MB
    });
  });

  it('should not compact when minimum file count not met', () => {
    // Given
    const files: DataFile[] = [
      { path: 'single.parquet', sizeBytes: 1_000_000, recordCount: 100, createdAt: new Date() },
    ];
    
    const strategy = new CompactionStrategy({ minFileCount: 2 });
    
    // When
    const plan = strategy.planCompaction(files);
    
    // Then
    expect(plan.fileGroups.length).toBe(0);
  });
});

describe('Compactor Integration Tests', () => {
  it('should compact small files into larger ones', async () => {
    // Given
    const files: DataFile[] = Array.from({ length: 10 }, (_, i) => ({
      path: `small${i}.parquet`,
      sizeBytes: 5_000_000, // 5MB each
      recordCount: 500,
      createdAt: new Date(),
    }));
    
    const strategy = new CompactionStrategy({
      targetFileSize: 50_000_000, // 50MB target
    });
    const compactor = new Compactor(strategy);
    
    // When
    const result = await compactor.compactFiles(files);
    
    // Then
    expect(result.filesRemoved).toBe(10);
    expect(result.filesAdded).toBe(1);
    expect(result.recordsAffected).toBe(5000);
    expect(result.bytesCompacted).toBe(50_000_000);
    expect(result.duration).toBeGreaterThan(0);
  });

  it('should handle mixed file sizes efficiently', async () => {
    // Given
    const files: DataFile[] = [
      ...Array.from({ length: 20 }, (_, i) => ({
        path: `tiny${i}.parquet`,
        sizeBytes: 500_000, // 500KB
        recordCount: 50,
        createdAt: new Date(),
      })),
      ...Array.from({ length: 5 }, (_, i) => ({
        path: `medium${i}.parquet`,
        sizeBytes: 20_000_000, // 20MB
        recordCount: 2000,
        createdAt: new Date(),
      })),
    ];
    
    const strategy = new CompactionStrategy();
    const compactor = new Compactor(strategy);
    
    // When
    const result = await compactor.compactFiles(files);
    
    // Then
    expect(result.filesRemoved).toBeGreaterThan(0);
    expect(result.filesAdded).toBeLessThan(result.filesRemoved);
  });
});

describe('Maintenance Operations', () => {
  it('should expire old snapshots based on retention policy', async () => {
    // Given
    const snapshots: Snapshot[] = Array.from({ length: 10 }, (_, i) => ({
      snapshotId: i,
      timestampMs: Date.now() - (i * 24 * 60 * 60 * 1000), // i days ago
      parentSnapshotId: i > 0 ? i - 1 : undefined,
      manifestList: `manifest-${i}.avro`,
    }));
    
    const policy: RetentionPolicy = {
      maxSnapshotAgeMs: 7 * 24 * 60 * 60 * 1000, // 7 days
      minSnapshotsToKeep: 2,
    };
    
    const manager = new SnapshotManager();
    
    // When
    const expired = await manager.expireSnapshots(snapshots, policy);
    
    // Then
    expect(expired.length).toBe(3); // Snapshots 7, 8, 9 (older than 7 days)
    expect(expired.every(s => s.snapshotId >= 7)).toBe(true);
  });

  it('should respect minimum snapshots to keep', async () => {
    // Given
    const snapshots: Snapshot[] = Array.from({ length: 3 }, (_, i) => ({
      snapshotId: i,
      timestampMs: Date.now() - (30 * 24 * 60 * 60 * 1000), // 30 days ago
      manifestList: `manifest-${i}.avro`,
    }));
    
    const policy: RetentionPolicy = {
      maxSnapshotAgeMs: 7 * 24 * 60 * 60 * 1000, // 7 days
      minSnapshotsToKeep: 2,
    };
    
    const manager = new SnapshotManager();
    
    // When
    const expired = await manager.expireSnapshots(snapshots, policy);
    
    // Then
    expect(expired.length).toBe(1); // Keep at least 2 snapshots
  });

  it('should enforce maximum snapshot limit', async () => {
    // Given
    const snapshots: Snapshot[] = Array.from({ length: 100 }, (_, i) => ({
      snapshotId: i,
      timestampMs: Date.now() - (i * 60 * 60 * 1000), // i hours ago
      manifestList: `manifest-${i}.avro`,
    }));
    
    const policy: RetentionPolicy = {
      maxSnapshotsToKeep: 50,
    };
    
    const manager = new SnapshotManager();
    
    // When
    const expired = await manager.expireSnapshots(snapshots, policy);
    
    // Then
    expect(expired.length).toBe(50);
    expect(expired.every(s => s.snapshotId >= 50)).toBe(true); // Remove oldest
  });

  it('should clean orphaned files after failed writes', async () => {
    // Given
    const allFiles = [
      'data/file1.parquet',
      'data/file2.parquet',
      'data/orphan1.parquet',
      'data/orphan2.parquet',
      'data/file3.parquet',
    ];
    
    const referencedFiles = new Set([
      'data/file1.parquet',
      'data/file2.parquet',
      'data/file3.parquet',
    ]);
    
    const cleaner = new OrphanFileCleaner();
    
    // When
    const orphans = await cleaner.findOrphanFiles(allFiles, referencedFiles);
    const removed = await cleaner.removeOrphanFiles(orphans);
    
    // Then
    expect(orphans).toEqual(['data/orphan1.parquet', 'data/orphan2.parquet']);
    expect(removed).toBe(2);
  });

  it('should schedule maintenance operations efficiently', async () => {
    // Given
    type MaintenanceTask = 'compaction' | 'expireSnapshots' | 'cleanOrphans';
    
    interface MaintenanceSchedule {
      task: MaintenanceTask;
      priority: number;
      estimatedDuration: number;
    }
    
    const tasks: MaintenanceSchedule[] = [
      { task: 'compaction', priority: 1, estimatedDuration: 300 },
      { task: 'expireSnapshots', priority: 2, estimatedDuration: 50 },
      { task: 'cleanOrphans', priority: 3, estimatedDuration: 100 },
    ];
    
    // When - Sort by priority
    const scheduled = [...tasks].sort((a, b) => a.priority - b.priority);
    
    // Then
    expect(scheduled[0].task).toBe('compaction');
    expect(scheduled[1].task).toBe('expireSnapshots');
    expect(scheduled[2].task).toBe('cleanOrphans');
    
    const totalDuration = scheduled.reduce((sum, t) => sum + t.estimatedDuration, 0);
    expect(totalDuration).toBe(450);
  });
});

describe('Performance Impact Tests', () => {
  it('should minimize read impact during compaction', async () => {
    // Given
    const activeReaders = { count: 0 };
    
    const simulateRead = async () => {
      activeReaders.count++;
      await new Promise(resolve => setTimeout(resolve, 50));
      activeReaders.count--;
    };
    
    const simulateCompaction = async () => {
      // Check reader count before heavy I/O
      const readerSnapshot = activeReaders.count;
      
      if (readerSnapshot > 5) {
        // Delay compaction if too many readers
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Simulate compaction work
      await new Promise(resolve => setTimeout(resolve, 200));
    };
    
    // When - Concurrent reads and compaction
    const operations = [
      ...Array(10).fill(null).map(() => simulateRead()),
      simulateCompaction(),
    ];
    
    await Promise.all(operations);
    
    // Then
    expect(activeReaders.count).toBe(0); // All reads completed
  });

  it('should batch maintenance operations for efficiency', async () => {
    // Given
    const operationLog: string[] = [];
    
    const batchedMaintenance = async (operations: string[]) => {
      operationLog.push(`Starting batch of ${operations.length} operations`);
      
      // Process in parallel where possible
      const results = await Promise.all(
        operations.map(async (op) => {
          operationLog.push(`Processing ${op}`);
          await new Promise(resolve => setTimeout(resolve, 10));
          return `${op} completed`;
        })
      );
      
      operationLog.push('Batch completed');
      return results;
    };
    
    // When
    const operations = ['compact1', 'compact2', 'expire1', 'clean1'];
    await batchedMaintenance(operations);
    
    // Then
    expect(operationLog[0]).toBe('Starting batch of 4 operations');
    expect(operationLog[operationLog.length - 1]).toBe('Batch completed');
    expect(operationLog.filter(log => log.includes('Processing')).length).toBe(4);
  });
});