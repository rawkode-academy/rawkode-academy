# Iceberg Analytics Test Strategy

## Executive Summary

This document outlines a comprehensive test strategy for implementing Apache Iceberg as the table format for the analytics platform. The strategy covers unit tests, integration tests, performance benchmarks, and operational testing to ensure reliability and correctness of the Iceberg implementation.

## Test Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Test Pyramid                              │
├─────────────────────────────────────────────────────────────┤
│  E2E Tests (10%)                                            │
│  - Full pipeline validation                                  │
│  - Cross-service integration                                 │
├─────────────────────────────────────────────────────────────┤
│  Integration Tests (20%)                                     │
│  - R2 Data Catalog interactions                              │
│  - Worker coordination                                       │
│  - Schema evolution scenarios                                │
├─────────────────────────────────────────────────────────────┤
│  Unit Tests (70%)                                           │
│  - Iceberg write operations                                 │
│  - Metadata management                                       │
│  - Parquet file generation                                  │
│  - Concurrent operations                                    │
└─────────────────────────────────────────────────────────────┘
```

## 1. Unit Tests for Iceberg Write Operations

### Test Categories

#### 1.1 Metadata Operations
```rust
#[cfg(test)]
mod iceberg_metadata_tests {
    use super::*;
    use proptest::prelude::*;

    #[test]
    fn should_create_initial_metadata_when_table_new() {
        // Given
        let table_location = "s3://bucket/events/page_view";
        let schema = create_test_schema();
        
        // When
        let metadata = IcebergMetadata::create_initial(table_location, schema);
        
        // Then
        assert_eq!(metadata.format_version(), 2);
        assert_eq!(metadata.current_snapshot_id(), None);
        assert_eq!(metadata.schemas().len(), 1);
    }

    #[test]
    fn should_track_snapshot_lineage_when_commits_occur() {
        // Given
        let mut metadata = create_test_metadata();
        let snapshot1 = create_snapshot("snap-1", vec!["file1.parquet"]);
        let snapshot2 = create_snapshot("snap-2", vec!["file2.parquet"]);
        
        // When
        metadata.add_snapshot(snapshot1);
        metadata.add_snapshot(snapshot2);
        
        // Then
        assert_eq!(metadata.snapshots().len(), 2);
        assert_eq!(metadata.current_snapshot_id(), Some("snap-2"));
        assert!(metadata.verify_snapshot_lineage());
    }

    proptest! {
        #[test]
        fn should_maintain_invariants_when_random_operations(
            operations in prop::collection::vec(metadata_operation_strategy(), 1..100)
        ) {
            // Property: Metadata invariants hold after any sequence of operations
            let mut metadata = create_test_metadata();
            
            for op in operations {
                op.apply(&mut metadata);
            }
            
            prop_assert!(metadata.validate_invariants());
            prop_assert!(metadata.snapshots().len() <= 100); // Snapshot retention
        }
    }
}
```

#### 1.2 Write Path Tests
```rust
#[cfg(test)]
mod iceberg_write_tests {
    use super::*;
    use cloudevents::Event;
    
    #[test]
    fn should_write_data_file_when_events_buffered() {
        // Given
        let writer = IcebergWriter::new(test_config());
        let events = generate_test_events(100);
        
        // When
        let data_file = writer.write_data_file(events).await.unwrap();
        
        // Then
        assert_eq!(data_file.record_count(), 100);
        assert!(data_file.file_size_bytes() > 0);
        assert_eq!(data_file.file_format(), FileFormat::Parquet);
        assert!(data_file.column_sizes().contains_key("raw_event"));
    }

    #[test]
    fn should_handle_schema_evolution_when_new_fields() {
        // Given
        let writer = IcebergWriter::new(test_config());
        let events_v1 = generate_events_with_schema_v1(50);
        let events_v2 = generate_events_with_schema_v2(50); // Has additional fields
        
        // When
        let file1 = writer.write_data_file(events_v1).await.unwrap();
        let file2 = writer.write_data_file(events_v2).await.unwrap();
        
        // Then
        assert!(writer.schemas_compatible(&file1, &file2));
    }

    #[test]
    fn should_enforce_row_group_size_when_writing_parquet() {
        // Given
        let config = test_config().with_row_group_size(1000);
        let writer = IcebergWriter::new(config);
        let events = generate_test_events(5000);
        
        // When
        let data_file = writer.write_data_file(events).await.unwrap();
        let parquet_metadata = read_parquet_metadata(&data_file.path());
        
        // Then
        assert_eq!(parquet_metadata.row_groups().len(), 5);
        for rg in parquet_metadata.row_groups() {
            assert_eq!(rg.num_rows(), 1000);
        }
    }
}
```

#### 1.3 Manifest File Tests
```rust
#[cfg(test)]
mod manifest_tests {
    use super::*;

    #[test]
    fn should_create_manifest_file_when_data_files_written() {
        // Given
        let data_files = vec![
            create_test_data_file("file1.parquet", 100),
            create_test_data_file("file2.parquet", 200),
        ];
        
        // When
        let manifest = ManifestFile::create(data_files);
        
        // Then
        assert_eq!(manifest.entries().len(), 2);
        assert_eq!(manifest.total_record_count(), 300);
        assert!(manifest.validate_checksums());
    }

    #[test]
    fn should_handle_deletes_when_manifest_updated() {
        // Given
        let mut manifest = create_test_manifest();
        let delete_file = create_delete_file("delete1.parquet", vec![1, 5, 10]);
        
        // When
        manifest.add_delete(delete_file);
        
        // Then
        assert_eq!(manifest.live_record_count(), manifest.total_record_count() - 3);
    }
}
```

## 2. Integration Tests for R2 Data Catalog

### Test Framework
```typescript
// tests/integration/iceberg-r2-catalog.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { R2DataCatalog } from '../../pipeline/catalog-worker/src/r2-catalog';

describe('Iceberg R2 Data Catalog Integration', () => {
    let catalog: R2DataCatalog;
    let testNamespace: string;

    beforeEach(async () => {
        testNamespace = `test_${Date.now()}`;
        catalog = await R2DataCatalog.create({
            bucket: 'test-analytics',
            prefix: testNamespace
        });
    });

    afterEach(async () => {
        await catalog.dropNamespace(testNamespace);
    });

    it('should register table when metadata written', async () => {
        // Given
        const tableId = 'events.page_view';
        const metadata = createTestMetadata();
        
        // When
        await catalog.createTable(tableId, metadata);
        
        // Then
        const tables = await catalog.listTables();
        expect(tables).toContain(tableId);
        
        const loadedMetadata = await catalog.loadTable(tableId);
        expect(loadedMetadata.currentSnapshotId).toBe(metadata.currentSnapshotId);
    });

    it('should handle concurrent metadata updates', async () => {
        // Given
        const tableId = 'events.concurrent_test';
        await catalog.createTable(tableId, createTestMetadata());
        
        // When - Simulate concurrent updates
        const updates = Array.from({ length: 10 }, (_, i) => 
            catalog.commitTransaction(tableId, {
                type: 'append',
                dataFiles: [`file${i}.parquet`]
            })
        );
        
        const results = await Promise.allSettled(updates);
        
        // Then
        const successCount = results.filter(r => r.status === 'fulfilled').length;
        expect(successCount).toBeGreaterThan(0);
        
        const metadata = await catalog.loadTable(tableId);
        expect(metadata.snapshots.length).toBe(successCount);
    });

    it('should maintain catalog consistency across workers', async () => {
        // Given
        const catalog1 = await R2DataCatalog.create(testConfig);
        const catalog2 = await R2DataCatalog.create(testConfig);
        
        // When
        await catalog1.createTable('table1', createTestMetadata());
        await catalog2.createTable('table2', createTestMetadata());
        
        // Then
        const tables1 = await catalog1.listTables();
        const tables2 = await catalog2.listTables();
        
        expect(tables1).toEqual(tables2);
        expect(tables1).toContain('table1');
        expect(tables1).toContain('table2');
    });
});
```

### Catalog Synchronization Tests
```rust
#[cfg(test)]
mod catalog_sync_tests {
    use super::*;

    #[tokio::test]
    async fn should_sync_catalog_when_r2_objects_change() {
        // Given
        let r2_client = create_test_r2_client();
        let catalog = IcebergCatalog::new(r2_client);
        
        // Simulate external table creation
        r2_client.put_object("catalog/table1/metadata.json", test_metadata()).await;
        
        // When
        catalog.sync().await.unwrap();
        
        // Then
        let tables = catalog.list_tables().await.unwrap();
        assert!(tables.contains(&"table1".to_string()));
    }

    #[tokio::test]
    async fn should_handle_stale_reads_when_catalog_updated() {
        // Given
        let catalog = create_test_catalog();
        let table_id = "events.test";
        
        // When - Simulate stale read scenario
        let metadata_v1 = catalog.load_table(table_id).await.unwrap();
        
        // Another worker updates
        simulate_external_update(table_id).await;
        
        // Then - Should detect version conflict
        let commit_result = catalog.commit_transaction(table_id, metadata_v1).await;
        assert!(matches!(commit_result, Err(CatalogError::VersionConflict)));
    }
}
```

## 3. Performance Tests

### Write Throughput Tests
```rust
#[cfg(test)]
mod performance_tests {
    use criterion::{black_box, criterion_group, criterion_main, Criterion};

    fn benchmark_iceberg_writes(c: &mut Criterion) {
        let runtime = tokio::runtime::Runtime::new().unwrap();
        
        c.bench_function("iceberg_write_1k_events", |b| {
            b.iter(|| {
                runtime.block_on(async {
                    let writer = IcebergWriter::new(test_config());
                    let events = generate_test_events(1000);
                    black_box(writer.write_data_file(events).await.unwrap());
                })
            })
        });

        c.bench_function("iceberg_write_10k_events", |b| {
            b.iter(|| {
                runtime.block_on(async {
                    let writer = IcebergWriter::new(test_config());
                    let events = generate_test_events(10000);
                    black_box(writer.write_data_file(events).await.unwrap());
                })
            })
        });
    }

    fn benchmark_manifest_operations(c: &mut Criterion) {
        c.bench_function("manifest_create_100_files", |b| {
            let data_files = (0..100)
                .map(|i| create_test_data_file(&format!("file{}.parquet", i), 1000))
                .collect::<Vec<_>>();
            
            b.iter(|| {
                black_box(ManifestFile::create(data_files.clone()));
            })
        });
    }

    criterion_group!(benches, benchmark_iceberg_writes, benchmark_manifest_operations);
    criterion_main!(benches);
}
```

### Query Latency Tests
```typescript
// tests/performance/query-latency.test.ts
describe('Iceberg Query Performance', () => {
    it('should maintain sub-100ms latency for metadata queries', async () => {
        // Given
        const catalog = await setupTestCatalog();
        const tableIds = await createTestTables(100);
        
        // When
        const latencies: number[] = [];
        for (const tableId of tableIds) {
            const start = performance.now();
            await catalog.loadTable(tableId);
            const end = performance.now();
            latencies.push(end - start);
        }
        
        // Then
        const p95 = percentile(latencies, 0.95);
        expect(p95).toBeLessThan(100); // 95th percentile < 100ms
    });

    it('should handle 1000 concurrent reads', async () => {
        // Given
        const catalog = await setupTestCatalog();
        const tableId = await createLargeTestTable();
        
        // When
        const start = performance.now();
        const reads = Array.from({ length: 1000 }, () => 
            catalog.loadTable(tableId)
        );
        await Promise.all(reads);
        const duration = performance.now() - start;
        
        // Then
        expect(duration).toBeLessThan(5000); // Complete within 5 seconds
    });
});
```

## 4. Data Integrity Tests

### Parquet Validation Tests
```rust
#[cfg(test)]
mod data_integrity_tests {
    use super::*;
    use arrow::record_batch::RecordBatch;
    use parquet::arrow::arrow_reader::ParquetRecordBatchReaderBuilder;

    #[test]
    fn should_validate_parquet_file_structure() {
        // Given
        let events = generate_test_events(100);
        let parquet_data = create_parquet_file(events);
        
        // When
        let reader = ParquetRecordBatchReaderBuilder::try_new(parquet_data).unwrap();
        let metadata = reader.metadata();
        
        // Then
        assert_eq!(metadata.file_metadata().version(), 1);
        assert_eq!(metadata.num_row_groups(), 1);
        assert!(metadata.file_metadata().created_by().unwrap().contains("iceberg-rust"));
    }

    #[test]
    fn should_verify_data_integrity_after_write() {
        // Given
        let original_events = generate_test_events(1000);
        let writer = IcebergWriter::new(test_config());
        
        // When
        let data_file = writer.write_data_file(original_events.clone()).await.unwrap();
        let read_events = read_parquet_file(&data_file.path());
        
        // Then
        assert_eq!(read_events.len(), original_events.len());
        for (original, read) in original_events.iter().zip(read_events.iter()) {
            assert_eq!(original.id(), read.id());
            assert_eq!(original.source(), read.source());
            assert_eq!(original.time(), read.time());
        }
    }

    proptest! {
        #[test]
        fn should_preserve_data_across_transformations(
            events in prop::collection::vec(event_strategy(), 1..1000)
        ) {
            // Property: Data integrity maintained through write/read cycle
            let writer = IcebergWriter::new(test_config());
            
            let data_file = writer.write_data_file(events.clone()).await.unwrap();
            let read_events = read_parquet_file(&data_file.path());
            
            prop_assert_eq!(events.len(), read_events.len());
            prop_assert!(verify_event_equality(&events, &read_events));
        }
    }
}
```

### Checksum Verification
```rust
#[test]
fn should_verify_checksums_when_reading_files() {
    // Given
    let data_file = create_test_data_file_with_checksum();
    
    // When
    let verification_result = verify_file_checksum(&data_file);
    
    // Then
    assert!(verification_result.is_ok());
    assert_eq!(
        verification_result.unwrap(),
        data_file.expected_checksum()
    );
}
```

## 5. Schema Evolution Tests

### Schema Compatibility Tests
```rust
#[cfg(test)]
mod schema_evolution_tests {
    use super::*;

    #[test]
    fn should_add_optional_field_when_schema_evolves() {
        // Given
        let schema_v1 = Schema::new(vec![
            Field::new("id", DataType::Utf8, false),
            Field::new("timestamp", DataType::Int64, false),
        ]);
        
        let schema_v2 = Schema::new(vec![
            Field::new("id", DataType::Utf8, false),
            Field::new("timestamp", DataType::Int64, false),
            Field::new("user_id", DataType::Utf8, true), // New optional field
        ]);
        
        // When
        let evolution = SchemaEvolution::analyze(&schema_v1, &schema_v2);
        
        // Then
        assert!(evolution.is_compatible());
        assert_eq!(evolution.changes().len(), 1);
        assert!(matches!(evolution.changes()[0], SchemaChange::AddField { .. }));
    }

    #[test]
    fn should_reject_incompatible_type_change() {
        // Given
        let schema_v1 = Schema::new(vec![
            Field::new("count", DataType::Int32, false),
        ]);
        
        let schema_v2 = Schema::new(vec![
            Field::new("count", DataType::Utf8, false), // Type change
        ]);
        
        // When
        let evolution = SchemaEvolution::analyze(&schema_v1, &schema_v2);
        
        // Then
        assert!(!evolution.is_compatible());
        assert!(evolution.breaking_changes().len() > 0);
    }

    #[test]
    fn should_handle_column_rename_with_mapping() {
        // Given
        let table = create_test_table();
        let rename_mapping = vec![("old_name", "new_name")];
        
        // When
        let result = table.evolve_schema(|builder| {
            builder.rename_columns(rename_mapping)
        });
        
        // Then
        assert!(result.is_ok());
        let new_schema = table.current_schema();
        assert!(!new_schema.has_field("old_name"));
        assert!(new_schema.has_field("new_name"));
    }
}
```

### Migration Tests
```typescript
describe('Schema Migration Tests', () => {
    it('should migrate existing data when schema evolves', async () => {
        // Given
        const table = await createTableWithSchema(schemaV1);
        await writeTestData(table, 1000);
        
        // When
        await table.evolveSchema(schemaV2);
        await writeTestData(table, 1000); // New data with v2 schema
        
        // Then
        const allData = await table.scan().execute();
        expect(allData.length).toBe(2000);
        
        // Verify old data has null for new fields
        const oldData = allData.slice(0, 1000);
        oldData.forEach(row => {
            expect(row.newField).toBeNull();
        });
        
        // Verify new data has values for new fields
        const newData = allData.slice(1000);
        newData.forEach(row => {
            expect(row.newField).toBeDefined();
        });
    });
});
```

## 6. Concurrent Write Handling Tests

### Optimistic Concurrency Tests
```rust
#[cfg(test)]
mod concurrency_tests {
    use super::*;
    use tokio::sync::Barrier;
    use std::sync::Arc;

    #[tokio::test]
    async fn should_handle_concurrent_commits_with_retry() {
        // Given
        let table = Arc::new(create_test_table());
        let barrier = Arc::new(Barrier::new(5));
        
        // When - 5 concurrent writers
        let handles = (0..5).map(|i| {
            let table = Arc::clone(&table);
            let barrier = Arc::clone(&barrier);
            
            tokio::spawn(async move {
                barrier.wait().await; // Synchronize start
                
                let data_file = create_test_data_file(&format!("writer{}.parquet", i), 100);
                table.append_files(vec![data_file]).await
            })
        });
        
        let results: Vec<_> = futures::future::join_all(handles).await;
        
        // Then
        let successful_commits = results.iter()
            .filter(|r| r.as_ref().unwrap().is_ok())
            .count();
        
        assert!(successful_commits >= 1); // At least one should succeed
        
        // Verify all data is present
        let total_files = table.current_snapshot().data_files().len();
        assert_eq!(total_files, successful_commits);
    }

    #[tokio::test]
    async fn should_detect_conflicts_when_concurrent_deletes() {
        // Given
        let catalog = create_test_catalog();
        let table_id = "concurrent_delete_test";
        
        // Create table with initial data
        let initial_files = vec![
            create_test_data_file("file1.parquet", 100),
            create_test_data_file("file2.parquet", 100),
        ];
        catalog.create_table(table_id, initial_files).await.unwrap();
        
        // When - Two workers try to delete the same file
        let delete1 = catalog.delete_files(table_id, vec!["file1.parquet"]);
        let delete2 = catalog.delete_files(table_id, vec!["file1.parquet"]);
        
        let (result1, result2) = tokio::join!(delete1, delete2);
        
        // Then - One should succeed, one should fail with conflict
        assert!(result1.is_ok() ^ result2.is_ok());
        
        let error = if result1.is_err() { result1 } else { result2 };
        assert!(matches!(error.unwrap_err(), CatalogError::ConcurrentModification));
    }
}
```

### Distributed Locking Tests
```typescript
describe('Distributed Lock Tests', () => {
    it('should acquire exclusive lock for schema changes', async () => {
        // Given
        const table = await createTestTable();
        const operations: Promise<any>[] = [];
        
        // When - Multiple schema changes
        for (let i = 0; i < 5; i++) {
            operations.push(
                table.evolveSchema(builder => 
                    builder.addColumn(`field_${i}`, 'string', true)
                )
            );
        }
        
        const results = await Promise.allSettled(operations);
        
        // Then - All should complete successfully (serialized by lock)
        results.forEach(result => {
            expect(result.status).toBe('fulfilled');
        });
        
        const schema = await table.currentSchema();
        expect(schema.fields).toHaveLength(originalFieldCount + 5);
    });
});
```

## 7. Worker Timeout and Retry Tests

### Timeout Handling Tests
```rust
#[cfg(test)]
mod timeout_tests {
    use super::*;
    use tokio::time::{timeout, Duration};

    #[tokio::test]
    async fn should_timeout_when_write_exceeds_limit() {
        // Given
        let writer = IcebergWriter::new(
            test_config().with_write_timeout(Duration::from_millis(100))
        );
        let large_batch = generate_test_events(100_000); // Large batch
        
        // When
        let result = timeout(
            Duration::from_millis(200),
            writer.write_data_file(large_batch)
        ).await;
        
        // Then
        assert!(result.is_err() || result.unwrap().is_err());
    }

    #[tokio::test]
    async fn should_checkpoint_progress_when_timeout_occurs() {
        // Given
        let writer = IcebergWriter::new(test_config());
        let events = generate_test_events(10_000);
        
        // When - Simulate timeout after partial write
        let checkpoint = writer.write_with_checkpoint(events, Duration::from_secs(1)).await;
        
        // Then
        match checkpoint {
            WriteResult::Partial { written, remaining } => {
                assert!(written > 0);
                assert!(remaining > 0);
                assert_eq!(written + remaining, 10_000);
            }
            WriteResult::Complete { .. } => {
                // OK if it completed fast enough
            }
        }
    }
}
```

### Retry Logic Tests
```typescript
describe('Worker Retry Behavior', () => {
    it('should retry transient failures with exponential backoff', async () => {
        // Given
        let attemptCount = 0;
        const mockR2 = {
            put: async () => {
                attemptCount++;
                if (attemptCount < 3) {
                    throw new Error('Transient network error');
                }
                return { success: true };
            }
        };
        
        const writer = new IcebergWriter({ r2Client: mockR2 });
        
        // When
        const result = await writer.writeWithRetry(testData);
        
        // Then
        expect(result.success).toBe(true);
        expect(attemptCount).toBe(3);
    });

    it('should respect maximum retry attempts', async () => {
        // Given
        const mockR2 = {
            put: async () => {
                throw new Error('Persistent failure');
            }
        };
        
        const writer = new IcebergWriter({ 
            r2Client: mockR2,
            maxRetries: 3
        });
        
        // When/Then
        await expect(writer.writeWithRetry(testData))
            .rejects.toThrow('Failed after 3 attempts');
    });
});
```

## 8. Compaction and Maintenance Tests

### Compaction Strategy Tests
```rust
#[cfg(test)]
mod compaction_tests {
    use super::*;

    #[test]
    fn should_identify_files_for_compaction() {
        // Given
        let manifest = create_manifest_with_files(vec![
            ("small1.parquet", 1_000_000),    // 1MB
            ("small2.parquet", 2_000_000),    // 2MB
            ("small3.parquet", 3_000_000),    // 3MB
            ("large1.parquet", 100_000_000),  // 100MB
        ]);
        
        let strategy = CompactionStrategy::default()
            .with_target_file_size(64_000_000) // 64MB target
            .with_min_file_count(2);
        
        // When
        let plan = strategy.plan_compaction(&manifest);
        
        // Then
        assert_eq!(plan.file_groups.len(), 1);
        assert_eq!(plan.file_groups[0].files.len(), 3); // Compact the 3 small files
        assert!(!plan.file_groups[0].files.contains(&"large1.parquet"));
    }

    #[tokio::test]
    async fn should_compact_small_files_into_larger() {
        // Given
        let table = create_test_table();
        for i in 0..10 {
            let small_file = create_test_data_file(&format!("small{}.parquet", i), 100);
            table.append_files(vec![small_file]).await.unwrap();
        }
        
        // When
        let compactor = Compactor::new(test_config());
        let result = compactor.compact_table(&table).await.unwrap();
        
        // Then
        assert!(result.files_removed >= 5);
        assert!(result.files_added <= 2);
        assert_eq!(result.records_affected, 1000); // 10 * 100
        
        let current_files = table.current_snapshot().data_files();
        assert!(current_files.len() < 10);
    }
}
```

### Maintenance Operation Tests
```typescript
describe('Table Maintenance Operations', () => {
    it('should expire old snapshots based on retention policy', async () => {
        // Given
        const table = await createTestTable();
        const retention = { maxSnapshotAgeMs: 7 * 24 * 60 * 60 * 1000 }; // 7 days
        
        // Create old snapshots
        for (let i = 0; i < 10; i++) {
            const timestamp = Date.now() - (i * 24 * 60 * 60 * 1000); // i days ago
            await table.appendWithTimestamp(testData, timestamp);
        }
        
        // When
        const expired = await table.expireSnapshots(retention);
        
        // Then
        expect(expired.length).toBe(3); // Snapshots older than 7 days
        expect(table.snapshots().length).toBe(7);
    });

    it('should clean orphaned files after failed writes', async () => {
        // Given
        const storage = new R2Storage(testBucket);
        
        // Simulate orphaned files
        await storage.put('data/orphan1.parquet', testData);
        await storage.put('data/orphan2.parquet', testData);
        
        const table = await catalog.loadTable('test_table');
        
        // When
        const cleaner = new OrphanFileCleaner(storage);
        const removed = await cleaner.removeOrphanFiles(table);
        
        // Then
        expect(removed).toContain('data/orphan1.parquet');
        expect(removed).toContain('data/orphan2.parquet');
    });
});
```

## Test Execution Plan

### Local Development
```bash
# Unit tests
just test-iceberg-unit

# Integration tests (requires R2 setup)
just test-iceberg-integration

# Performance benchmarks
just bench-iceberg

# Full test suite
just test-iceberg-all
```

### CI/CD Pipeline
```yaml
iceberg-tests:
  runs-on: ubuntu-latest
  strategy:
    matrix:
      test-suite: [unit, integration, performance]
  steps:
    - name: Run ${{ matrix.test-suite }} tests
      run: |
        just test-iceberg-${{ matrix.test-suite }}
        
    - name: Upload coverage
      if: matrix.test-suite == 'unit'
      uses: codecov/codecov-action@v3
      
    - name: Upload performance results
      if: matrix.test-suite == 'performance'
      uses: actions/upload-artifact@v3
      with:
        name: iceberg-benchmarks
        path: target/criterion
```

## Success Criteria

### Coverage Requirements
- Unit Tests: 85% line coverage, 80% branch coverage
- Integration Tests: All critical paths covered
- Performance Tests: Regression detection within 5%

### Performance Targets
- Write Throughput: >10,000 events/second per worker
- Metadata Query Latency: <100ms p95
- Compaction: Process 1GB in <60 seconds
- Snapshot Creation: <500ms for 1000 files

### Reliability Metrics
- Zero data loss under any failure scenario
- Successful recovery from all timeout conditions
- Correct conflict resolution in 100% of cases
- Schema evolution without downtime

## Monitoring and Observability

### Test Metrics Collection
```rust
#[derive(Debug, Serialize)]
struct TestMetrics {
    test_name: String,
    duration_ms: u64,
    operations_per_second: f64,
    memory_used_bytes: u64,
    success_rate: f64,
}

impl TestReporter {
    fn report_metrics(&self, metrics: TestMetrics) {
        // Send to monitoring system
        self.statsd.gauge("test.duration", metrics.duration_ms);
        self.statsd.gauge("test.ops_per_sec", metrics.operations_per_second);
        self.statsd.gauge("test.memory", metrics.memory_used_bytes);
        self.statsd.gauge("test.success_rate", metrics.success_rate);
    }
}
```

### Continuous Validation
- Synthetic tests run every 5 minutes in production
- Chaos testing monthly to verify failure handling
- Load testing before major releases
- Data validation jobs to ensure consistency

## Appendix: Test Data Generators

### Event Generator
```rust
pub fn event_strategy() -> impl Strategy<Value = Event> {
    (
        any::<String>(),
        any::<String>(),
        0u64..1_000_000,
        prop::option::of(any::<String>()),
    ).prop_map(|(id, source, timestamp, data)| {
        EventBuilderV10::new()
            .id(id)
            .source(source)
            .ty("test.event")
            .time(Utc.timestamp_millis_opt(timestamp as i64).unwrap())
            .data_with_schema("application/json", "1.0", data)
            .build()
            .unwrap()
    })
}
```

### Table Configuration Generator
```rust
pub fn table_config_strategy() -> impl Strategy<Value = TableConfig> {
    (
        1usize..100,
        1_000_000u64..100_000_000,
        prop::bool::ANY,
        1u32..10,
    ).prop_map(|(target_file_count, target_file_size, enable_compression, replication)| {
        TableConfig {
            target_file_count,
            target_file_size,
            enable_compression,
            replication_factor: replication,
            ..Default::default()
        }
    })
}
```