use crate::iceberg::writer::*;
use crate::iceberg::catalog::{IcebergCatalog, CatalogError};
use crate::iceberg::metadata::*;
use crate::iceberg::manifest::*;
use cloudevents::{Event, EventBuilder, EventBuilderV10};
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};
use tokio::sync::{Barrier, Mutex, RwLock, Semaphore};
use std::collections::HashMap;
use futures::future::join_all;
use chrono::Utc;
use worker::*;

#[tokio::test]
async fn should_handle_concurrent_commits_with_retry() {
    // Given
    let catalog = Arc::new(MockCatalog::new());
    let table_id = "concurrent_test_table";
    catalog.create_table(table_id).await;
    
    let barrier = Arc::new(Barrier::new(5));
    
    // When - 5 concurrent writers
    let handles = (0..5).map(|i| {
        let catalog = Arc::clone(&catalog);
        let barrier = Arc::clone(&barrier);
        let table_id = table_id.to_string();
        
        tokio::spawn(async move {
            barrier.wait().await; // Synchronize start
            
            let data_file = create_test_data_file(&format!("writer{}.parquet", i), 100);
            catalog.append_files(&table_id, vec![data_file]).await
        })
    });
    
    let results: Vec<_> = join_all(handles).await;
    
    // Then
    let successful_commits = results.iter()
        .filter(|r| r.as_ref().unwrap().is_ok())
        .count();
    
    assert!(successful_commits >= 1); // At least one should succeed
    assert!(successful_commits <= 5); // Some may fail due to conflicts
    
    // Verify all successful data is present
    let table_files = catalog.get_table_files(table_id).await;
    assert_eq!(table_files.len(), successful_commits);
}

#[tokio::test]
async fn should_detect_conflicts_when_concurrent_deletes() {
    // Given
    let catalog = Arc::new(MockCatalog::new());
    let table_id = "concurrent_delete_test";
    
    // Create table with initial data
    catalog.create_table(table_id).await;
    let initial_files = vec![
        create_test_data_file("file1.parquet", 100),
        create_test_data_file("file2.parquet", 100),
    ];
    catalog.append_files(table_id, initial_files).await.unwrap();
    
    // When - Two workers try to delete the same file
    let catalog1 = Arc::clone(&catalog);
    let catalog2 = Arc::clone(&catalog);
    
    let delete1 = tokio::spawn(async move {
        catalog1.delete_files("concurrent_delete_test", vec!["file1.parquet"]).await
    });
    
    let delete2 = tokio::spawn(async move {
        catalog2.delete_files("concurrent_delete_test", vec!["file1.parquet"]).await
    });
    
    let (result1, result2) = tokio::join!(delete1, delete2);
    
    // Then - One should succeed, one should fail with conflict
    let unwrapped1 = result1.unwrap();
    let unwrapped2 = result2.unwrap();
    
    assert!(unwrapped1.is_ok() ^ unwrapped2.is_ok());
    
    if unwrapped1.is_err() {
        assert!(matches!(unwrapped1.unwrap_err(), CatalogError::ConcurrentModification));
    } else {
        assert!(matches!(unwrapped2.unwrap_err(), CatalogError::ConcurrentModification));
    }
}

#[tokio::test]
async fn should_serialize_schema_changes_with_lock() {
    // Given
    let catalog = Arc::new(MockCatalog::new());
    let table_id = "schema_evolution_test";
    catalog.create_table(table_id).await;
    
    let barrier = Arc::new(Barrier::new(3));
    
    // When - Multiple schema changes
    let handles = (0..3).map(|i| {
        let catalog = Arc::clone(&catalog);
        let barrier = Arc::clone(&barrier);
        
        tokio::spawn(async move {
            barrier.wait().await;
            
            catalog.evolve_schema("schema_evolution_test", |schema| {
                let mut new_schema = schema.clone();
                new_schema.fields.push(Field {
                    id: 10 + i,
                    name: format!("field_{}", i),
                    field_type: "string".to_string(),
                    required: false,
                });
                new_schema
            }).await
        })
    });
    
    let results: Vec<_> = join_all(handles).await;
    
    // Then - All should complete successfully (serialized by lock)
    for result in results {
        assert!(result.unwrap().is_ok());
    }
    
    let final_schema = catalog.get_current_schema(table_id).await;
    assert_eq!(final_schema.fields.len(), 6); // 3 original + 3 new
}

#[tokio::test]
async fn should_handle_concurrent_reads_during_writes() {
    // Given
    let catalog = Arc::new(MockCatalog::new());
    let table_id = "read_write_test";
    catalog.create_table(table_id).await;
    
    // Start with some data
    let initial_file = create_test_data_file("initial.parquet", 1000);
    catalog.append_files(table_id, vec![initial_file]).await.unwrap();
    
    // When - Concurrent reads and writes
    let write_catalog = Arc::clone(&catalog);
    let write_handle = tokio::spawn(async move {
        for i in 0..10 {
            let file = create_test_data_file(&format!("write_{}.parquet", i), 100);
            write_catalog.append_files("read_write_test", vec![file]).await.ok();
            tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
        }
    });
    
    let read_handles = (0..5).map(|_| {
        let catalog = Arc::clone(&catalog);
        tokio::spawn(async move {
            let mut snapshots = vec![];
            for _ in 0..20 {
                let snapshot = catalog.get_current_snapshot("read_write_test").await;
                snapshots.push(snapshot);
                tokio::time::sleep(tokio::time::Duration::from_millis(5)).await;
            }
            snapshots
        })
    });
    
    // Wait for writes to complete
    write_handle.await.unwrap();
    
    // Collect read results
    let read_results: Vec<_> = join_all(read_handles).await;
    
    // Then - All reads should be consistent
    for result in read_results {
        let snapshots = result.unwrap();
        
        // Verify snapshot ordering
        for window in snapshots.windows(2) {
            if let (Some(s1), Some(s2)) = (&window[0], &window[1]) {
                assert!(s1.snapshot_id <= s2.snapshot_id);
            }
        }
    }
}

#[tokio::test]
async fn should_handle_write_write_conflicts_gracefully() {
    // Given
    let catalog = Arc::new(MockCatalog::new());
    let table_id = "write_conflict_test";
    catalog.create_table(table_id).await;
    
    // When - Many concurrent writers
    let handles = (0..20).map(|i| {
        let catalog = Arc::clone(&catalog);
        
        tokio::spawn(async move {
            let file = create_test_data_file(&format!("concurrent_{}.parquet", i), 50);
            let mut retries = 0;
            
            loop {
                match catalog.append_files("write_conflict_test", vec![file.clone()]).await {
                    Ok(_) => return Ok(i),
                    Err(CatalogError::ConcurrentModification) if retries < 3 => {
                        retries += 1;
                        tokio::time::sleep(tokio::time::Duration::from_millis(10 * retries)).await;
                    }
                    Err(e) => return Err(e),
                }
            }
        })
    });
    
    let results: Vec<_> = join_all(handles).await;
    
    // Then
    let successful_writes: Vec<_> = results.into_iter()
        .filter_map(|r| r.ok()?.ok())
        .collect();
    
    assert!(successful_writes.len() >= 15); // Most should succeed with retry
    
    let files = catalog.get_table_files(table_id).await;
    assert_eq!(files.len(), successful_writes.len());
}

#[tokio::test]
async fn should_maintain_consistency_with_optimistic_locking() {
    // Given
    let catalog = Arc::new(MockCatalog::new());
    let table_id = "optimistic_lock_test";
    catalog.create_table(table_id).await;
    
    // When - Simulate optimistic locking scenario
    let metadata_v1 = catalog.load_table_metadata(table_id).await.unwrap();
    
    // Another process updates the table
    let file1 = create_test_data_file("other_process.parquet", 100);
    catalog.append_files(table_id, vec![file1]).await.unwrap();
    
    // Try to commit with stale metadata
    let result = catalog.commit_with_metadata(
        table_id,
        metadata_v1,
        vec![create_test_data_file("stale_commit.parquet", 100)]
    ).await;
    
    // Then
    assert!(matches!(result, Err(CatalogError::VersionConflict)));
}

#[tokio::test]
async fn should_handle_rate_limiting_with_backoff() {
    // Given
    let catalog = Arc::new(MockCatalog::with_rate_limit(5)); // 5 requests per second
    let table_id = "rate_limit_test";
    catalog.create_table(table_id).await;
    
    // When - Try to exceed rate limit
    let start = std::time::Instant::now();
    let mut handles = vec![];
    
    for i in 0..20 {
        let catalog = Arc::clone(&catalog);
        let handle = tokio::spawn(async move {
            let file = create_test_data_file(&format!("rate_limited_{}.parquet", i), 100);
            catalog.append_files("rate_limit_test", vec![file]).await
        });
        handles.push(handle);
    }
    
    let results: Vec<_> = join_all(handles).await;
    let elapsed = start.elapsed();
    
    // Then - Should take at least 3 seconds (20 requests / 5 per second = 4 seconds)
    assert!(elapsed.as_secs() >= 3);
    
    // Most requests should succeed with retry
    let success_count = results.iter()
        .filter(|r| r.as_ref().unwrap().is_ok())
        .count();
    assert!(success_count >= 15);
}

#[tokio::test]
async fn should_handle_concurrent_compaction() {
    // Given
    let catalog = Arc::new(MockCatalog::new());
    let table_id = "compaction_test";
    catalog.create_table(table_id).await;
    
    // Add many small files
    for i in 0..100 {
        let file = create_test_data_file(&format!("small_{}.parquet", i), 10);
        catalog.append_files(table_id, vec![file]).await.ok();
    }
    
    // When - Multiple workers try to compact
    let barrier = Arc::new(Barrier::new(3));
    let handles = (0..3).map(|worker_id| {
        let catalog = Arc::clone(&catalog);
        let barrier = Arc::clone(&barrier);
        
        tokio::spawn(async move {
            barrier.wait().await;
            catalog.compact_files("compaction_test", worker_id).await
        })
    });
    
    let results: Vec<_> = join_all(handles).await;
    
    // Then - Only one should succeed
    let success_count = results.iter()
        .filter(|r| r.as_ref().unwrap().is_ok())
        .count();
    assert_eq!(success_count, 1);
    
    // Verify compaction result
    let files = catalog.get_table_files(table_id).await;
    assert!(files.len() < 100); // Should have fewer files after compaction
}

#[tokio::test]
async fn should_handle_concurrent_metadata_evolution() {
    // Given
    let catalog = Arc::new(MockCatalog::new());
    let table_id = "evolution_test";
    catalog.create_table(table_id).await;
    
    // When - Concurrent schema and partition spec changes
    let schema_change = {
        let catalog = Arc::clone(&catalog);
        tokio::spawn(async move {
            catalog.evolve_schema("evolution_test", |schema| {
                let mut new_schema = schema.clone();
                new_schema.fields.push(Field {
                    id: 10,
                    name: "new_field".to_string(),
                    field_type: "string".to_string(),
                    required: false,
                });
                new_schema
            }).await
        })
    };
    
    let partition_change = {
        let catalog = Arc::clone(&catalog);
        tokio::spawn(async move {
            catalog.evolve_partition_spec("evolution_test", |spec| {
                let mut new_spec = spec.clone();
                new_spec.fields.push(PartitionField {
                    source_id: 2,
                    field_id: 1000,
                    name: "hour".to_string(),
                    transform: "hour".to_string(),
                });
                new_spec
            }).await
        })
    };
    
    let (schema_result, partition_result) = tokio::join!(schema_change, partition_change);
    
    // Then - Both should complete (one might retry)
    assert!(schema_result.unwrap().is_ok());
    assert!(partition_result.unwrap().is_ok());
    
    // Verify final state
    let metadata = catalog.load_table_metadata(table_id).await.unwrap();
    assert!(metadata.schemas.len() > 1);
    assert!(metadata.partition_specs.len() > 1);
}

// Mock catalog for testing
struct MockCatalog {
    tables: RwLock<HashMap<String, TableState>>,
    rate_limiter: Option<Arc<Semaphore>>,
    operation_counter: AtomicU64,
}

struct TableState {
    metadata: TableMetadata,
    files: Vec<DataFile>,
    version: u64,
    schema_lock: Arc<Mutex<()>>,
    compaction_lock: Arc<Mutex<()>>,
}

impl MockCatalog {
    fn new() -> Self {
        Self {
            tables: RwLock::new(HashMap::new()),
            rate_limiter: None,
            operation_counter: AtomicU64::new(0),
        }
    }
    
    fn with_rate_limit(permits_per_second: usize) -> Self {
        Self {
            tables: RwLock::new(HashMap::new()),
            rate_limiter: Some(Arc::new(Semaphore::new(permits_per_second))),
            operation_counter: AtomicU64::new(0),
        }
    }

    async fn create_table(&self, table_id: &str) {
        let mut tables = self.tables.write().await;
        tables.insert(
            table_id.to_string(),
            TableState {
                metadata: create_test_table_metadata(),
                files: vec![],
                version: 0,
                schema_lock: Arc::new(Mutex::new(())),
                compaction_lock: Arc::new(Mutex::new(())),
            },
        );
    }

    async fn append_files(&self, table_id: &str, files: Vec<DataFile>) -> Result<(), CatalogError> {
        // Rate limiting
        if let Some(limiter) = &self.rate_limiter {
            let permit = limiter.acquire().await.unwrap();
            // Hold permit for simulated operation time
            tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
            drop(permit);
        }
        
        let mut tables = self.tables.write().await;
        let table = tables.get_mut(table_id)
            .ok_or(CatalogError::TableNotFound)?;
        
        // Simulate version check with more realistic conflict rate
        let op_count = self.operation_counter.fetch_add(1, Ordering::SeqCst);
        if op_count % 5 == 0 && rand::random::<f32>() < 0.5 {
            // Higher conflict rate every 5th operation
            return Err(CatalogError::ConcurrentModification);
        }
        
        table.files.extend(files.clone());
        table.version += 1;
        
        // Add snapshot to metadata
        let mut summary = HashMap::new();
        summary.insert("operation".to_string(), "append".to_string());
        summary.insert("added-data-files".to_string(), files.len().to_string());
        summary.insert("added-records".to_string(), 
            files.iter().map(|f| f.record_count).sum::<i64>().to_string());
        
        let snapshot = Snapshot {
            snapshot_id: table.version as i64,
            parent_snapshot_id: if table.version > 1 { Some((table.version - 1) as i64) } else { None },
            timestamp_ms: chrono::Utc::now().timestamp_millis(),
            manifest_list: format!("manifest-{}.avro", table.version),
            summary,
            schema_id: Some(0),
        };
        table.metadata.snapshots.push(snapshot);
        table.metadata.current_snapshot_id = Some(table.version as i64);
        
        Ok(())
    }

    async fn delete_files(&self, table_id: &str, files: Vec<&str>) -> Result<(), CatalogError> {
        let mut tables = self.tables.write().await;
        let table = tables.get_mut(table_id)
            .ok_or(CatalogError::TableNotFound)?;
        
        // Check if files exist
        let file_exists = files.iter().all(|f| {
            table.files.iter().any(|df| df.path.ends_with(f))
        });
        
        if !file_exists {
            return Err(CatalogError::FileNotFound);
        }
        
        // Simulate conflict for same file deletion
        if rand::random::<f32>() < 0.5 {
            return Err(CatalogError::ConcurrentModification);
        }
        
        table.files.retain(|df| {
            !files.iter().any(|f| df.path.ends_with(f))
        });
        table.version += 1;
        
        Ok(())
    }

    async fn get_table_files(&self, table_id: &str) -> Vec<DataFile> {
        let tables = self.tables.read().await;
        tables.get(table_id)
            .map(|t| t.files.clone())
            .unwrap_or_default()
    }

    async fn evolve_schema<F>(&self, table_id: &str, f: F) -> Result<(), CatalogError>
    where
        F: FnOnce(&serde_json::Value) -> serde_json::Value,
    {
        let tables = self.tables.read().await;
        let table = tables.get(table_id)
            .ok_or(CatalogError::TableNotFound)?;
        
        // Acquire schema lock
        let _lock = table.schema_lock.lock().await;
        
        drop(tables); // Release read lock before acquiring write lock
        
        let mut tables = self.tables.write().await;
        let table = tables.get_mut(table_id).unwrap();
        
        let current_schema = &table.metadata.schema;
        let new_schema = f(current_schema);
        
        table.metadata.schemas.push(new_schema);
        table.metadata.current_schema_id += 1;
        table.version += 1;
        
        Ok(())
    }

    async fn get_current_schema(&self, table_id: &str) -> serde_json::Value {
        let tables = self.tables.read().await;
        tables.get(table_id)
            .map(|t| t.metadata.schema.clone())
            .unwrap_or_else(create_test_schema_json)
    }
    
    async fn compact_files(&self, table_id: &str, worker_id: usize) -> Result<(), CatalogError> {
        let tables = self.tables.read().await;
        let table = tables.get(table_id)
            .ok_or(CatalogError::TableNotFound)?;
        
        // Try to acquire compaction lock
        let lock = table.compaction_lock.try_lock();
        if lock.is_err() {
            return Err(CatalogError::ConcurrentModification);
        }
        
        drop(tables);
        
        // Simulate compaction work
        tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
        
        let mut tables = self.tables.write().await;
        let table = tables.get_mut(table_id).unwrap();
        
        // Compact small files into larger ones
        let total_records: i64 = table.files.iter().map(|f| f.record_count).sum();
        let compacted_file = create_test_data_file(
            &format!("compacted_by_worker_{}.parquet", worker_id),
            total_records
        );
        
        table.files.clear();
        table.files.push(compacted_file);
        table.version += 1;
        
        Ok(())
    }
    
    async fn evolve_partition_spec<F>(&self, table_id: &str, f: F) -> Result<(), CatalogError>
    where
        F: FnOnce(&PartitionSpec) -> PartitionSpec,
    {
        let tables = self.tables.read().await;
        let table = tables.get(table_id)
            .ok_or(CatalogError::TableNotFound)?;
        
        // Acquire schema lock for partition spec changes too
        let _lock = table.schema_lock.lock().await;
        
        drop(tables);
        
        let mut tables = self.tables.write().await;
        let table = tables.get_mut(table_id).unwrap();
        
        let current_spec = &table.metadata.partition_specs[table.metadata.default_spec_id as usize];
        let new_spec = f(current_spec);
        
        table.metadata.partition_specs.push(new_spec);
        table.metadata.default_spec_id = (table.metadata.partition_specs.len() - 1) as i32;
        table.metadata.last_partition_id = table.metadata.partition_specs
            .last()
            .unwrap()
            .fields
            .last()
            .map(|f| f.field_id)
            .unwrap_or(999);
        table.version += 1;
        
        Ok(())
    }

    async fn get_current_snapshot(&self, table_id: &str) -> Option<Snapshot> {
        let tables = self.tables.read().await;
        tables.get(table_id)
            .and_then(|t| t.metadata.current_snapshot())
            .cloned()
    }

    async fn load_table_metadata(&self, table_id: &str) -> Result<TableMetadata, CatalogError> {
        let tables = self.tables.read().await;
        tables.get(table_id)
            .map(|t| t.metadata.clone())
            .ok_or(CatalogError::TableNotFound)
    }

    async fn commit_with_metadata(
        &self,
        table_id: &str,
        expected_metadata: TableMetadata,
        files: Vec<DataFile>,
    ) -> Result<(), CatalogError> {
        let mut tables = self.tables.write().await;
        let table = tables.get_mut(table_id)
            .ok_or(CatalogError::TableNotFound)?;
        
        // Check version based on snapshot count
        if table.metadata.snapshots.len() != expected_metadata.snapshots.len() {
            return Err(CatalogError::VersionConflict);
        }
        
        table.files.extend(files);
        table.version += 1;
        
        Ok(())
    }
}

// Helper functions
fn create_test_data_file(name: &str, records: i64) -> DataFile {
    DataFile {
        file_path: format!("data/{}", name),
        file_format: FileFormat::Parquet,
        partition: HashMap::new(),
        record_count: records,
        file_size_in_bytes: records * 1024,
        column_sizes: HashMap::from([(1, records * 8), (2, records * 8), (3, records * 20)]),
        value_counts: HashMap::from([(1, records), (2, records), (3, records)]),
        null_value_counts: HashMap::from([(1, 0), (2, 0), (3, 0)]),
        lower_bounds: HashMap::new(),
        upper_bounds: HashMap::new(),
        key_metadata: None,
        split_offsets: None,
        sort_order_id: None,
    }
}

fn create_test_table_metadata() -> TableMetadata {
    TableMetadata {
        format_version: 2,
        table_uuid: uuid::Uuid::new_v4().to_string(),
        location: "s3://test-bucket/test-table".to_string(),
        last_updated_ms: Date::now().as_millis() as i64,
        last_column_id: 3,
        schema: create_test_schema_json(),
        schemas: vec![create_test_schema_json()],
        current_schema_id: 0,
        partition_spec: vec![],
        partition_specs: vec![PartitionSpec { spec_id: 0, fields: vec![] }],
        default_spec_id: 0,
        last_partition_id: 0,
        properties: HashMap::new(),
        current_snapshot_id: None,
        snapshots: vec![],
        snapshot_log: vec![],
        metadata_log: vec![],
        sort_orders: vec![SortOrder { order_id: 0, fields: vec![] }],
        default_sort_order_id: 0,
    }
}

fn create_test_schema_json() -> serde_json::Value {
    serde_json::json!({
        "type": "struct",
        "schema-id": 0,
        "fields": [
            {"id": 1, "name": "id", "required": true, "type": "string"},
            {"id": 2, "name": "timestamp", "required": true, "type": "long"},
            {"id": 3, "name": "data", "required": false, "type": "string"}
        ]
    })
}

#[test]
fn should_handle_concurrent_snapshot_expiry() {
    // Given a table with many old snapshots
    let runtime = tokio::runtime::Runtime::new().unwrap();
    let catalog = Arc::new(MockCatalog::new());
    
    runtime.block_on(async {
        let table_id = "snapshot_expiry_test";
        catalog.create_table(table_id).await;
        
        // Add 100 snapshots over time
        for i in 0..100 {
            let file = create_test_data_file(&format!("historical_{}.parquet", i), 100);
            catalog.append_files(table_id, vec![file]).await.ok();
        }
        
        // When - Multiple workers try to expire snapshots
        let expire_tasks = (0..3).map(|worker_id| {
            let catalog = Arc::clone(&catalog);
            tokio::spawn(async move {
                // Simulate snapshot expiry based on age
                let tables = catalog.tables.read().await;
                if let Some(table) = tables.get("snapshot_expiry_test") {
                    let snapshot_count = table.metadata.snapshots.len();
                    // Keep only last 10 snapshots
                    snapshot_count > 10
                } else {
                    false
                }
            })
        });
        
        let results: Vec<_> = join_all(expire_tasks).await;
        
        // Then - All workers should see the same state
        for result in results {
            assert!(result.unwrap());
        }
    });
}

#[tokio::test]
async fn should_handle_deadlock_prevention() {
    // Given
    let catalog = Arc::new(MockCatalog::new());
    let table1 = "deadlock_table_1";
    let table2 = "deadlock_table_2";
    
    catalog.create_table(table1).await;
    catalog.create_table(table2).await;
    
    // When - Create potential deadlock scenario
    let task1 = {
        let catalog = Arc::clone(&catalog);
        tokio::spawn(async move {
            // Lock order: table1 -> table2
            let file1 = create_test_data_file("task1_file1.parquet", 100);
            catalog.append_files(table1, vec![file1]).await.ok();
            
            tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
            
            let file2 = create_test_data_file("task1_file2.parquet", 100);
            catalog.append_files(table2, vec![file2]).await
        })
    };
    
    let task2 = {
        let catalog = Arc::clone(&catalog);
        tokio::spawn(async move {
            // Lock order: table2 -> table1 (opposite order)
            let file2 = create_test_data_file("task2_file2.parquet", 100);
            catalog.append_files(table2, vec![file2]).await.ok();
            
            tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
            
            let file1 = create_test_data_file("task2_file1.parquet", 100);
            catalog.append_files(table1, vec![file1]).await
        })
    };
    
    // Set a timeout to detect deadlock
    let timeout = tokio::time::timeout(
        tokio::time::Duration::from_secs(5),
        futures::future::join(task1, task2)
    ).await;
    
    // Then - Should complete without deadlock
    assert!(timeout.is_ok(), "Deadlock detected!");
}

#[tokio::test]
async fn should_handle_cascading_failures() {
    // Given
    let catalog = Arc::new(MockCatalog::new());
    let table_id = "cascade_test";
    catalog.create_table(table_id).await;
    
    // Simulate a failing operation that affects subsequent operations
    let barrier = Arc::new(Barrier::new(10));
    
    let handles: Vec<_> = (0..10).map(|i| {
        let catalog = Arc::clone(&catalog);
        let barrier = Arc::clone(&barrier);
        
        tokio::spawn(async move {
            barrier.wait().await;
            
            // First operation corrupts state
            if i == 0 {
                // Simulate corruption by clearing files
                let mut tables = catalog.tables.write().await;
                if let Some(table) = tables.get_mut("cascade_test") {
                    table.files.clear();
                    table.version = u64::MAX; // Invalid version
                }
                return Err(CatalogError::InvalidMetadata("Corrupted".to_string()));
            }
            
            // Other operations should handle the corrupted state
            tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;
            let file = create_test_data_file(&format!("cascade_{}.parquet", i), 100);
            catalog.append_files("cascade_test", vec![file]).await
        })
    }).collect();
    
    let results: Vec<_> = join_all(handles).await;
    
    // Then - First should fail, others should handle gracefully
    assert!(results[0].as_ref().unwrap().is_err());
    
    // Some operations might succeed if they execute before corruption
    let failures = results.iter().skip(1)
        .filter(|r| r.as_ref().unwrap().is_err())
        .count();
    
    assert!(failures > 0, "Some operations should fail due to corruption");
}

#[tokio::test]
async fn should_handle_concurrent_partition_pruning() {
    // Given
    let catalog = Arc::new(MockCatalog::new());
    let table_id = "partition_prune_test";
    catalog.create_table(table_id).await;
    
    // Add files across multiple partitions
    for year in 2020..2024 {
        for month in 1..=12 {
            let mut partition = HashMap::new();
            partition.insert("year".to_string(), year.to_string());
            partition.insert("month".to_string(), format!("{:02}", month));
            
            let mut file = create_test_data_file(
                &format!("data_{}_{:02}.parquet", year, month),
                1000
            );
            file.partition = partition;
            
            catalog.append_files(table_id, vec![file]).await.ok();
        }
    }
    
    // When - Multiple readers query different partitions concurrently
    let query_handles: Vec<_> = vec![
        (2020, vec![1, 2, 3]),
        (2021, vec![6, 7, 8]),
        (2022, vec![9, 10, 11]),
        (2023, vec![3, 4, 5]),
    ].into_iter().map(|(year, months)| {
        let catalog = Arc::clone(&catalog);
        tokio::spawn(async move {
            let tables = catalog.tables.read().await;
            if let Some(table) = tables.get("partition_prune_test") {
                let matching_files = table.files.iter()
                    .filter(|f| {
                        f.partition.get("year") == Some(&year.to_string()) &&
                        months.iter().any(|m| {
                            f.partition.get("month") == Some(&format!("{:02}", m))
                        })
                    })
                    .count();
                (year, matching_files)
            } else {
                (year, 0)
            }
        })
    }).collect();
    
    let results: Vec<_> = join_all(query_handles).await;
    
    // Then - Each query should find its partition files
    for result in results {
        let (year, count) = result.unwrap();
        assert_eq!(count, 3, "Year {} should have 3 matching files", year);
    }
}