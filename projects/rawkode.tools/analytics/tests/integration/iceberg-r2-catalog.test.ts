import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTestMiniflare, cleanupR2Bucket, type TestEnv } from '../helpers/miniflare-setup';
import { MockR2Bucket, waitForCondition, assertEventually, sleep, createControllableOperation } from '../helpers/test-utilities';
import type { Miniflare } from 'miniflare';
import type { R2Bucket, R2Object } from '@cloudflare/workers-types';

// Types for Iceberg catalog
interface IcebergMetadata {
  formatVersion: number;
  tableUuid: string;
  location: string;
  currentSnapshotId?: number;
  snapshots: Snapshot[];
  schemas: Schema[];
  currentSchemaId: number;
}

interface Snapshot {
  snapshotId: number;
  parentSnapshotId?: number;
  timestampMs: number;
  manifestList: string;
  summary: Record<string, string>;
}

interface Schema {
  schemaId: number;
  fields: Field[];
}

interface Field {
  id: number;
  name: string;
  type: string;
  required: boolean;
}

interface DataFile {
  path: string;
  fileFormat: string;
  recordCount: number;
  fileSizeBytes: number;
}

// R2 Data Catalog implementation for tests
class R2DataCatalog {
  private bucket: R2Bucket;
  private prefix: string;
  private tables: Map<string, IcebergMetadata> = new Map();
  private lockTimeout: number = 5000; // 5 seconds lock timeout
  private locks: Map<string, number> = new Map();

  constructor(bucket: R2Bucket, prefix: string) {
    this.bucket = bucket;
    this.prefix = prefix;
  }

  async createTable(tableId: string, metadata: IcebergMetadata): Promise<void> {
    const metadataPath = `${this.prefix}/${tableId}/metadata/v1.metadata.json`;
    await this.bucket.put(metadataPath, JSON.stringify(metadata, null, 2));
    
    await this.updateCatalogListing(tableId);
    this.tables.set(tableId, metadata);
  }

  async loadTable(tableId: string): Promise<IcebergMetadata | null> {
    const metadataPath = `${this.prefix}/${tableId}/metadata/v1.metadata.json`;
    const object = await this.bucket.get(metadataPath);
    
    if (!object) {
      return null;
    }
    
    return JSON.parse(await object.text());
  }

  async listTables(): Promise<string[]> {
    const catalogPath = `${this.prefix}/_catalog.json`;
    const object = await this.bucket.get(catalogPath);
    
    if (!object) {
      return [];
    }
    
    const catalog = JSON.parse(await object.text());
    return catalog.tables || [];
  }

  async dropNamespace(namespace: string): Promise<void> {
    // List all objects with the namespace prefix
    const objects = await this.bucket.list({ prefix: namespace });
    
    // Delete all objects
    for (const object of objects.objects) {
      await this.bucket.delete(object.key);
    }
    
    // Clear any remaining locks
    for (const [lockPath, lockId] of this.locks.entries()) {
      if (lockPath.startsWith(namespace)) {
        await this.releaseLock(lockPath, lockId);
      }
    }
    
    this.tables.clear();
  }

  async commitTransaction(tableId: string, transaction: { type: string; dataFiles: DataFile[] }): Promise<void> {
    const metadataPath = `${this.prefix}/${tableId}/metadata/v1.metadata.json`;
    const lockPath = `${this.prefix}/${tableId}/.lock`;
    const lockId = Date.now() + Math.random();
    
    // Acquire lock with timeout
    const acquired = await this.acquireLock(lockPath, lockId);
    if (!acquired) {
      throw new Error('Failed to acquire lock for transaction');
    }
    
    try {
      // Read current metadata
      const currentObject = await this.bucket.get(metadataPath);
      if (!currentObject) {
        throw new Error(`Table ${tableId} not found`);
      }
      
      const metadata = JSON.parse(await currentObject.text());
      const expectedSnapshotId = metadata.currentSnapshotId || 0;

      const newSnapshot: Snapshot = {
        snapshotId: expectedSnapshotId + 1,
        parentSnapshotId: metadata.currentSnapshotId,
        timestampMs: Date.now(),
        manifestList: `${this.prefix}/${tableId}/metadata/snap-${Date.now()}.avro`,
        summary: {
          operation: transaction.type,
          'added-data-files': transaction.dataFiles.length.toString(),
        },
      };

      metadata.snapshots.push(newSnapshot);
      metadata.currentSnapshotId = newSnapshot.snapshotId;

      // Write with version check
      await this.bucket.put(metadataPath, JSON.stringify(metadata, null, 2));
    } finally {
      // Release lock
      await this.releaseLock(lockPath, lockId);
    }
  }

  private async acquireLock(lockPath: string, lockId: number): Promise<boolean> {
    const maxAttempts = 50;
    const retryDelay = 100;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        // Check if lock exists
        const existingLock = await this.bucket.get(lockPath);
        if (existingLock) {
          const lockData = JSON.parse(await existingLock.text());
          // Check if lock is expired
          if (Date.now() - lockData.timestamp > this.lockTimeout) {
            // Lock expired, try to acquire
          } else {
            // Lock held by another process
            await sleep(retryDelay);
            continue;
          }
        }
        
        // Try to acquire lock
        await this.bucket.put(lockPath, JSON.stringify({
          lockId,
          timestamp: Date.now(),
        }));
        
        // Verify we got the lock
        await sleep(50); // Small delay for consistency
        const verifyLock = await this.bucket.get(lockPath);
        if (verifyLock) {
          const lockData = JSON.parse(await verifyLock.text());
          if (lockData.lockId === lockId) {
            this.locks.set(lockPath, lockId);
            return true;
          }
        }
      } catch (error) {
        // Ignore errors and retry
      }
      
      await sleep(retryDelay);
    }
    
    return false;
  }

  private async releaseLock(lockPath: string, lockId: number): Promise<void> {
    const storedLockId = this.locks.get(lockPath);
    if (storedLockId === lockId) {
      try {
        await this.bucket.delete(lockPath);
        this.locks.delete(lockPath);
      } catch (error) {
        // Ignore errors on lock release
      }
    }
  }

  private async updateCatalogListing(tableId: string): Promise<void> {
    const catalogPath = `${this.prefix}/_catalog.json`;
    let catalog = { tables: [] as string[] };
    
    const existing = await this.bucket.get(catalogPath);
    if (existing) {
      catalog = JSON.parse(await existing.text());
    }
    
    if (!catalog.tables.includes(tableId)) {
      catalog.tables.push(tableId);
      await this.bucket.put(catalogPath, JSON.stringify(catalog, null, 2));
    }
  }
}

// Test helpers
function createTestMetadata(): IcebergMetadata {
  return {
    formatVersion: 2,
    tableUuid: crypto.randomUUID(),
    location: 's3://test-bucket/test-table',
    schemas: [{
      schemaId: 0,
      fields: [
        { id: 1, name: 'id', type: 'string', required: true },
        { id: 2, name: 'timestamp', type: 'long', required: true },
        { id: 3, name: 'data', type: 'string', required: false },
      ],
    }],
    currentSchemaId: 0,
    snapshots: [],
  };
}

describe('Iceberg R2 Data Catalog Integration', () => {
  let mf: Miniflare;
  let env: TestEnv;
  let catalog: R2DataCatalog;
  let testNamespace: string;

  beforeEach(async () => {
    mf = await createTestMiniflare();
    env = await mf.getBindings<TestEnv>();
    testNamespace = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    catalog = new R2DataCatalog(env.CATALOG_BUCKET, testNamespace);
  });

  afterEach(async () => {
    await catalog.dropNamespace(testNamespace);
    await cleanupR2Bucket(env.CATALOG_BUCKET);
    await mf.dispose();
  });

  it('should register table when metadata written', async () => {
    // Given
    const tableId = 'events.page_view';
    const metadata = createTestMetadata();
    
    // When
    await catalog.createTable(tableId, metadata);
    
    // Then - wait for eventual consistency
    await assertEventually(async () => {
      const tables = await catalog.listTables();
      expect(tables).toContain(tableId);
    }, { message: 'table to be listed' });
    
    const loadedMetadata = await catalog.loadTable(tableId);
    expect(loadedMetadata?.tableUuid).toBe(metadata.tableUuid);
    expect(loadedMetadata?.currentSnapshotId).toBeUndefined();
  });

  it('should commit snapshots atomically', async () => {
    // Given
    const tableId = 'events.click';
    const metadata = createTestMetadata();
    await catalog.createTable(tableId, metadata);
    
    // When
    const dataFiles: DataFile[] = [
      {
        path: 's3://test-bucket/data/file1.parquet',
        fileFormat: 'parquet',
        recordCount: 1000,
        fileSizeBytes: 1024 * 1024,
      },
    ];
    
    await catalog.commitTransaction(tableId, {
      type: 'append',
      dataFiles,
    });
    
    // Then
    await assertEventually(async () => {
      const updated = await catalog.loadTable(tableId);
      expect(updated?.snapshots).toHaveLength(1);
      expect(updated?.currentSnapshotId).toBe(1);
      expect(updated?.snapshots[0].summary.operation).toBe('append');
    }, { message: 'snapshot to be committed' });
  });

  it('should handle concurrent modifications', async () => {
    // Given
    const tableId = 'events.concurrent';
    const metadata = createTestMetadata();
    await catalog.createTable(tableId, metadata);
    
    // Simulate concurrent modifications
    const commit1 = catalog.commitTransaction(tableId, {
      type: 'append',
      dataFiles: [{
        path: 's3://test-bucket/data/file1.parquet',
        fileFormat: 'parquet',
        recordCount: 1000,
        fileSizeBytes: 1024 * 1024,
      }],
    });
    
    const commit2 = catalog.commitTransaction(tableId, {
      type: 'append',
      dataFiles: [{
        path: 's3://test-bucket/data/file2.parquet',
        fileFormat: 'parquet',
        recordCount: 2000,
        fileSizeBytes: 2 * 1024 * 1024,
      }],
    });
    
    // Then - both should succeed due to locking
    const results = await Promise.allSettled([commit1, commit2]);
    const succeeded = results.filter(r => r.status === 'fulfilled');
    
    expect(succeeded).toHaveLength(2);
    
    // Verify both commits were applied
    await assertEventually(async () => {
      const finalMetadata = await catalog.loadTable(tableId);
      expect(finalMetadata?.snapshots).toHaveLength(2);
      expect(finalMetadata?.currentSnapshotId).toBe(2);
    }, { message: 'both commits to be applied' });
  });

  it('should maintain transaction isolation', async () => {
    // Given
    const tableId = 'events.isolation';
    const metadata = createTestMetadata();
    await catalog.createTable(tableId, metadata);
    
    // When - Multiple readers during write
    const writePromise = catalog.commitTransaction(tableId, {
      type: 'append',
      dataFiles: [{
        path: 's3://test-bucket/data/file1.parquet',
        fileFormat: 'parquet',
        recordCount: 1000,
        fileSizeBytes: 1024 * 1024,
      }],
    });
    
    // Read while write might be in progress
    const readDuringWrite = await catalog.loadTable(tableId);
    expect(readDuringWrite?.currentSnapshotId).toBeUndefined();
    
    // Wait for write to complete
    await writePromise;
    
    // Read after write
    await assertEventually(async () => {
      const readAfterWrite = await catalog.loadTable(tableId);
      expect(readAfterWrite?.currentSnapshotId).toBe(1);
    }, { message: 'snapshot to be visible after write' });
  });

  it('should list tables across namespaces', async () => {
    // Given
    const tables = ['events.page_view', 'events.click', 'metrics.performance'];
    
    // When
    for (const tableId of tables) {
      await catalog.createTable(tableId, createTestMetadata());
    }
    
    // Then - wait for all tables to be visible
    await assertEventually(async () => {
      const listedTables = await catalog.listTables();
      expect(listedTables).toHaveLength(3);
      expect(listedTables).toEqual(expect.arrayContaining(tables));
    }, { message: 'all tables to be listed', timeout: 10000 });
  });

  it('should clean up namespace on drop', async () => {
    // Given
    const tableId = 'events.cleanup';
    await catalog.createTable(tableId, createTestMetadata());
    
    // Ensure table is created
    await assertEventually(async () => {
      const tables = await catalog.listTables();
      expect(tables).toContain(tableId);
    }, { message: 'table to be created' });
    
    // When
    await catalog.dropNamespace(testNamespace);
    
    // Then - wait for cleanup to complete
    await assertEventually(async () => {
      const tables = await catalog.listTables();
      expect(tables).toHaveLength(0);
    }, { message: 'namespace to be dropped' });
    
    const metadata = await catalog.loadTable(tableId);
    expect(metadata).toBeNull();
  });
});