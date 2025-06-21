use crate::iceberg::writer::*;
use crate::iceberg::catalog::*;
use crate::iceberg::metadata::*;
use cloudevents::{Event, EventBuilder, EventBuilderV10};
use std::sync::Arc;
use tokio::sync::{Barrier, Mutex, RwLock};
use std::collections::HashMap;
use futures::future::join_all;

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

// Mock catalog for testing
struct MockCatalog {
    tables: RwLock<HashMap<String, TableState>>,
}

struct TableState {
    metadata: IcebergMetadata,
    files: Vec<DataFile>,
    version: u64,
    schema_lock: Arc<Mutex<()>>,
}

impl MockCatalog {
    fn new() -> Self {
        Self {
            tables: RwLock::new(HashMap::new()),
        }
    }

    async fn create_table(&self, table_id: &str) {
        let mut tables = self.tables.write().await;
        tables.insert(
            table_id.to_string(),
            TableState {
                metadata: create_test_metadata(),
                files: vec![],
                version: 0,
                schema_lock: Arc::new(Mutex::new(())),
            },
        );
    }

    async fn append_files(&self, table_id: &str, files: Vec<DataFile>) -> Result<(), CatalogError> {
        let mut tables = self.tables.write().await;
        let table = tables.get_mut(table_id)
            .ok_or(CatalogError::TableNotFound)?;
        
        // Simulate version check
        if rand::random::<f32>() < 0.3 {
            // 30% chance of conflict in tests
            return Err(CatalogError::ConcurrentModification);
        }
        
        table.files.extend(files);
        table.version += 1;
        
        // Add snapshot to metadata
        let snapshot = Snapshot {
            snapshot_id: table.version as i64,
            parent_snapshot_id: if table.version > 1 { Some((table.version - 1) as i64) } else { None },
            sequence_number: table.version as i64,
            timestamp_ms: chrono::Utc::now().timestamp_millis(),
            manifest_list: format!("manifest-{}.avro", table.version),
            summary: SnapshotSummary {
                operation: "append".to_string(),
                properties: HashMap::new(),
            },
            schema_id: Some(0),
        };
        table.metadata.add_snapshot(snapshot);
        
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
        F: FnOnce(&Schema) -> Schema,
    {
        let tables = self.tables.read().await;
        let table = tables.get(table_id)
            .ok_or(CatalogError::TableNotFound)?;
        
        // Acquire schema lock
        let _lock = table.schema_lock.lock().await;
        
        drop(tables); // Release read lock before acquiring write lock
        
        let mut tables = self.tables.write().await;
        let table = tables.get_mut(table_id).unwrap();
        
        let current_schema = table.metadata.current_schema()
            .ok_or(CatalogError::SchemaNotFound)?;
        
        let new_schema = f(current_schema);
        table.metadata.schemas.push(new_schema);
        table.metadata.current_schema_id += 1;
        table.version += 1;
        
        Ok(())
    }

    async fn get_current_schema(&self, table_id: &str) -> Schema {
        let tables = self.tables.read().await;
        tables.get(table_id)
            .and_then(|t| t.metadata.current_schema())
            .cloned()
            .unwrap_or_else(create_test_schema)
    }

    async fn get_current_snapshot(&self, table_id: &str) -> Option<Snapshot> {
        let tables = self.tables.read().await;
        tables.get(table_id)
            .and_then(|t| t.metadata.current_snapshot())
            .cloned()
    }

    async fn load_table_metadata(&self, table_id: &str) -> Result<IcebergMetadata, CatalogError> {
        let tables = self.tables.read().await;
        tables.get(table_id)
            .map(|t| t.metadata.clone())
            .ok_or(CatalogError::TableNotFound)
    }

    async fn commit_with_metadata(
        &self,
        table_id: &str,
        expected_metadata: IcebergMetadata,
        files: Vec<DataFile>,
    ) -> Result<(), CatalogError> {
        let mut tables = self.tables.write().await;
        let table = tables.get_mut(table_id)
            .ok_or(CatalogError::TableNotFound)?;
        
        // Check version
        if table.metadata.last_sequence_number != expected_metadata.last_sequence_number {
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
        path: format!("data/{}", name),
        file_format: FileFormat::Parquet,
        record_count: records,
        file_size_bytes: records * 1024,
        column_sizes: HashMap::new(),
        value_counts: HashMap::new(),
        null_value_counts: HashMap::new(),
        lower_bounds: HashMap::new(),
        upper_bounds: HashMap::new(),
        key_metadata: None,
    }
}

fn create_test_metadata() -> IcebergMetadata {
    IcebergMetadata::create_initial(
        "s3://test-bucket/test-table".to_string(),
        create_test_schema(),
    )
}

fn create_test_schema() -> Schema {
    Schema {
        schema_id: 0,
        fields: vec![
            Field {
                id: 1,
                name: "id".to_string(),
                field_type: "string".to_string(),
                required: true,
            },
            Field {
                id: 2,
                name: "timestamp".to_string(),
                field_type: "long".to_string(),
                required: true,
            },
            Field {
                id: 3,
                name: "data".to_string(),
                field_type: "string".to_string(),
                required: false,
            },
        ],
    }
}