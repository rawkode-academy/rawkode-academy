use crate::iceberg::metadata::*;
use crate::iceberg::catalog::{IcebergCatalog, CatalogError};
use chrono::{DateTime, Utc};
use std::collections::HashMap;
use uuid::Uuid;
use worker::*;

#[cfg(test)]
use proptest::prelude::*;

#[test]
fn should_create_initial_metadata_when_table_new() {
    // Given
    let table_location = "s3://bucket/events/page_view";
    let schema = serde_json::json!({
        "type": "struct",
        "schema-id": 0,
        "fields": [
            {"id": 1, "name": "id", "required": true, "type": "string"},
            {"id": 2, "name": "timestamp", "required": true, "type": "long"},
            {"id": 3, "name": "data", "required": false, "type": "string"}
        ]
    });
    let partition_spec = vec![
        PartitionField {
            source_id: 2,
            field_id: 1000,
            name: "year".to_string(),
            transform: "year".to_string(),
        },
        PartitionField {
            source_id: 2,
            field_id: 1001,
            name: "month".to_string(),
            transform: "month".to_string(),
        },
    ];
    let properties = HashMap::from([
        ("write.format.default".to_string(), "parquet".to_string()),
        ("commit.retry.num-retries".to_string(), "3".to_string()),
    ]);
    
    // When
    let runtime = tokio::runtime::Runtime::new().unwrap();
    let env = create_test_env();
    let iceberg_metadata = IcebergMetadata::new(&env, table_location.to_string());
    let metadata = runtime.block_on(async {
        iceberg_metadata.create_table("page_view", schema, partition_spec, properties).await.unwrap()
    });
    
    // Then
    assert_eq!(metadata.format_version, 2);
    assert_eq!(metadata.current_snapshot_id, None);
    assert_eq!(metadata.schemas.len(), 1);
    assert_eq!(metadata.snapshots.len(), 0);
    assert!(!metadata.table_uuid.is_empty());
    assert_eq!(metadata.partition_specs[0].fields.len(), 2);
}

#[test]
fn should_track_snapshot_lineage_when_commits_occur() {
    // Given
    let runtime = tokio::runtime::Runtime::new().unwrap();
    let env = create_test_env();
    let iceberg_metadata = IcebergMetadata::new(&env, "s3://bucket/test".to_string());
    
    runtime.block_on(async {
        let parent_metadata = create_test_table_metadata();
        
        // When - Create multiple snapshots
        let data_files1 = vec![create_test_data_file("file1.parquet", 100, 1024)];
        let metadata1 = iceberg_metadata.create_snapshot(&parent_metadata, data_files1, "append").await.unwrap();
        
        let data_files2 = vec![create_test_data_file("file2.parquet", 200, 2048)];
        let metadata2 = iceberg_metadata.create_snapshot(&metadata1, data_files2, "append").await.unwrap();
        
        // Then
        assert_eq!(metadata2.snapshots.len(), 2);
        assert_eq!(metadata2.current_snapshot_id, Some(metadata2.snapshots[1].snapshot_id));
        assert_eq!(metadata2.snapshots[1].parent_snapshot_id, Some(metadata1.snapshots[0].snapshot_id));
        assert_eq!(metadata2.snapshot_log.len(), 2);
        
        // Verify snapshot summaries
        let snapshot1 = &metadata2.snapshots[0];
        assert_eq!(snapshot1.summary.get("operation"), Some(&"append".to_string()));
        assert_eq!(snapshot1.summary.get("added-data-files"), Some(&"1".to_string()));
        assert_eq!(snapshot1.summary.get("added-records"), Some(&"100".to_string()));
        
        let snapshot2 = &metadata2.snapshots[1];
        assert_eq!(snapshot2.summary.get("added-records"), Some(&"200".to_string()));
    });
}

#[test]
fn should_validate_metadata_invariants() {
    // Given
    let runtime = tokio::runtime::Runtime::new().unwrap();
    let env = create_test_env();
    let iceberg_metadata = IcebergMetadata::new(&env, "s3://bucket/test".to_string());
    
    runtime.block_on(async {
        let mut metadata = create_test_table_metadata();
        
        // Test 1: Valid metadata passes all checks
        assert!(validate_metadata_invariants(&metadata));
        
        // Test 2: Missing schema fails validation
        metadata.schemas.clear();
        assert!(!validate_metadata_invariants(&metadata));
        metadata.schemas = vec![create_test_schema_json()];
        
        // Test 3: Invalid current schema ID fails
        metadata.current_schema_id = 999;
        assert!(!validate_metadata_invariants(&metadata));
        metadata.current_schema_id = 0;
        
        // Test 4: Invalid current snapshot ID fails
        metadata.current_snapshot_id = Some(999);
        assert!(!validate_metadata_invariants(&metadata));
        metadata.current_snapshot_id = None;
        
        // Test 5: Duplicate snapshot IDs fail
        let snapshot1 = create_test_snapshot(1, None);
        let snapshot2 = create_test_snapshot(1, None); // Same ID
        metadata.snapshots = vec![snapshot1, snapshot2];
        assert!(!validate_metadata_invariants(&metadata));
        
        // Test 6: Invalid partition spec ID fails
        metadata.snapshots.clear();
        metadata.default_spec_id = 999;
        assert!(!validate_metadata_invariants(&metadata));
        metadata.default_spec_id = 0;
        
        // Test 7: Empty table UUID fails
        metadata.table_uuid = String::new();
        assert!(!validate_metadata_invariants(&metadata));
    });
}

#[test]
fn should_handle_metadata_versioning() {
    // Given
    let runtime = tokio::runtime::Runtime::new().unwrap();
    let env = create_test_env();
    let iceberg_metadata = IcebergMetadata::new(&env, "s3://bucket/versioning-test".to_string());
    
    runtime.block_on(async {
        let initial_metadata = create_test_table_metadata();
        
        // When - Write multiple versions
        iceberg_metadata.write_metadata(&initial_metadata, "v1").await.unwrap();
        
        let mut v2_metadata = initial_metadata.clone();
        v2_metadata.last_updated_ms = Date::now().as_millis() as i64;
        let snapshot = create_test_snapshot(1, None);
        v2_metadata.snapshots.push(snapshot);
        v2_metadata.current_snapshot_id = Some(1);
        iceberg_metadata.write_metadata(&v2_metadata, "v2").await.unwrap();
        
        // Update version hint
        iceberg_metadata.update_version_hint("v2").await.unwrap();
        
        // Then - Read current should return v2
        let current = iceberg_metadata.read_current_metadata().await.unwrap();
        assert_eq!(current.current_snapshot_id, Some(1));
        assert_eq!(current.snapshots.len(), 1);
    });
}

#[test]
fn should_handle_concurrent_metadata_updates() {
    // Given
    let runtime = tokio::runtime::Runtime::new().unwrap();
    let env = create_test_env();
    let catalog = IcebergCatalog::new(env, "test-namespace".to_string());
    
    runtime.block_on(async {
        // Create initial table
        let metadata = IcebergMetadata::new(&catalog.env, "s3://bucket/concurrent-test".to_string());
        let initial = create_test_table_metadata();
        catalog.create_table("concurrent_test", initial).await.unwrap();
        
        // When - Simulate concurrent updates
        let snapshot1 = create_test_snapshot(1, None);
        let snapshot2 = create_test_snapshot(2, None);
        
        let update1 = catalog.commit_snapshot("concurrent_test", snapshot1, vec![]);
        let update2 = catalog.commit_snapshot("concurrent_test", snapshot2, vec![]);
        
        let results = futures::future::join(update1, update2).await;
        
        // Then - At least one should succeed
        let success_count = [results.0.is_ok(), results.1.is_ok()]
            .iter()
            .filter(|&&x| x)
            .count();
        assert!(success_count >= 1);
    });
}

#[test]
fn should_handle_manifest_file_operations() {
    // Given
    let runtime = tokio::runtime::Runtime::new().unwrap();
    let env = create_test_env();
    let iceberg_metadata = IcebergMetadata::new(&env, "s3://bucket/manifest-test".to_string());
    
    runtime.block_on(async {
        // When - Create manifest entries
        let data_files = vec![
            create_test_data_file("file1.parquet", 100, 1024),
            create_test_data_file("file2.parquet", 200, 2048),
        ];
        
        let manifest_entries: Vec<ManifestEntry> = data_files.into_iter()
            .map(|df| ManifestEntry {
                status: ManifestEntryStatus::Added,
                snapshot_id: 1,
                data_file: df,
            })
            .collect();
        
        // Write manifest file
        let manifest_path = iceberg_metadata.write_manifest_file(&manifest_entries, 1).await.unwrap();
        
        // Then
        assert!(manifest_path.contains("metadata/1-m0.avro"));
        
        // Create manifest file entry
        let manifest_file = iceberg_metadata.create_manifest_file_entry(
            manifest_path,
            &manifest_entries,
            1
        ).unwrap();
        
        assert_eq!(manifest_file.added_data_files_count, Some(2));
        assert_eq!(manifest_file.added_rows_count, Some(300));
        assert_eq!(manifest_file.partition_spec_id, 0);
        assert_eq!(manifest_file.partitions.len(), 5); // 5 partition fields
    });
}

#[test]
fn should_track_metadata_evolution() {
    // Given
    let runtime = tokio::runtime::Runtime::new().unwrap();
    let env = create_test_env();
    let iceberg_metadata = IcebergMetadata::new(&env, "s3://bucket/evolution-test".to_string());
    
    runtime.block_on(async {
        let mut metadata = create_test_table_metadata();
        
        // When - Simulate metadata evolution
        // 1. Add first snapshot
        let snapshot1 = create_test_snapshot(1, None);
        metadata.snapshots.push(snapshot1);
        metadata.current_snapshot_id = Some(1);
        metadata.snapshot_log.push(SnapshotLogEntry {
            timestamp_ms: Date::now().as_millis() as i64,
            snapshot_id: 1,
        });
        
        // 2. Add schema evolution
        let new_schema = serde_json::json!({
            "type": "struct",
            "schema-id": 1,
            "fields": [
                {"id": 1, "name": "id", "required": true, "type": "string"},
                {"id": 2, "name": "timestamp", "required": true, "type": "long"},
                {"id": 3, "name": "data", "required": false, "type": "string"},
                {"id": 4, "name": "category", "required": false, "type": "string"} // New field
            ]
        });
        metadata.schemas.push(new_schema);
        metadata.current_schema_id = 1;
        
        // 3. Add metadata log entry
        metadata.metadata_log.push(MetadataLogEntry {
            timestamp_ms: Date::now().as_millis() as i64,
            metadata_file: "s3://bucket/evolution-test/metadata/v2.metadata.json".to_string(),
        });
        
        // Then
        assert_eq!(metadata.schemas.len(), 2);
        assert_eq!(metadata.current_schema_id, 1);
        assert_eq!(metadata.snapshot_log.len(), 1);
        assert_eq!(metadata.metadata_log.len(), 1);
        assert!(validate_metadata_invariants(&metadata));
    });
}

// Property-based tests
#[cfg(test)]
mod property_tests {
    use super::*;
    use proptest::prelude::*;

    proptest! {
        #[test]
        fn should_maintain_invariants_when_random_operations(
            operations in prop::collection::vec(metadata_operation_strategy(), 1..100)
        ) {
            // Property: Metadata invariants hold after any sequence of operations
            let mut metadata = create_test_metadata();
            
            for op in operations {
                match op {
                    MetadataOperation::AddSnapshot(snapshot) => {
                        metadata.add_snapshot(snapshot);
                    }
                    MetadataOperation::AddSchema(schema) => {
                        metadata.schemas.push(schema);
                    }
                    MetadataOperation::UpdateProperty(key, value) => {
                        metadata.properties.insert(key, value);
                    }
                }
            }
            
            // Ensure basic invariants still hold
            prop_assert!(!metadata.table_uuid.is_empty());
            prop_assert!(metadata.last_sequence_number >= 0);
            prop_assert!(metadata.snapshots.len() <= 100); // Reasonable limit
        }

        #[test]
        fn should_preserve_snapshot_order_when_added(
            snapshot_count in 1..50usize
        ) {
            // Property: Snapshots maintain chronological order
            let mut metadata = create_test_metadata();
            
            for i in 0..snapshot_count {
                let parent_id = if i == 0 { None } else { Some(i as i64 - 1) };
                let snapshot = create_snapshot(i as i64, parent_id, vec![format!("file{}.parquet", i)]);
                metadata.add_snapshot(snapshot);
            }
            
            // Verify order
            for i in 1..metadata.snapshots.len() {
                prop_assert!(
                    metadata.snapshots[i].timestamp_ms >= metadata.snapshots[i-1].timestamp_ms
                );
            }
        }
    }

    // Strategy for generating metadata operations
    fn metadata_operation_strategy() -> impl Strategy<Value = MetadataOperation> {
        prop_oneof![
            // Add snapshot
            (0i64..1000, prop::option::of(0i64..1000)).prop_map(|(id, parent)| {
                MetadataOperation::AddSnapshot(create_test_snapshot(id, parent))
            }),
            // Add schema
            any::<u32>().prop_map(|id| {
                MetadataOperation::AddSchema(serde_json::json!({
                    "type": "struct",
                    "schema-id": id,
                    "fields": [
                        {"id": 1, "name": "id", "required": true, "type": "string"},
                        {"id": id + 1, "name": format!("field_{}", id), "required": false, "type": "string"}
                    ]
                }))
            }),
            // Update property
            ("[a-z]+", "[a-z0-9]+").prop_map(|(key, value)| {
                MetadataOperation::UpdateProperty(key, value)
            }),
        ]
    }
    
    #[test]
    fn should_handle_table_properties() {
        // Given
        let runtime = tokio::runtime::Runtime::new().unwrap();
        let env = create_test_env();
        let iceberg_metadata = IcebergMetadata::new(&env, "s3://bucket/properties-test".to_string());
        
        runtime.block_on(async {
            // When - Create table with properties
            let schema = create_test_schema_json();
            let properties = HashMap::from([
                ("write.format.default".to_string(), "parquet".to_string()),
                ("write.target-file-size-bytes".to_string(), "536870912".to_string()),
                ("write.metadata.compression-codec".to_string(), "gzip".to_string()),
                ("commit.retry.num-retries".to_string(), "3".to_string()),
                ("commit.retry.min-wait-ms".to_string(), "100".to_string()),
                ("write.parquet.compression-codec".to_string(), "snappy".to_string()),
            ]);
            
            let metadata = iceberg_metadata.create_table(
                "properties_test",
                schema,
                vec![],
                properties.clone()
            ).await.unwrap();
            
            // Then
            assert_eq!(metadata.properties.len(), 6);
            for (key, value) in properties {
                assert_eq!(metadata.properties.get(&key), Some(&value));
            }
        });
    }
    
    #[test]
    fn should_handle_sort_orders() {
        // Given
        let metadata = create_test_table_metadata();
        
        // Then - Default sort order
        assert_eq!(metadata.sort_orders.len(), 1);
        assert_eq!(metadata.default_sort_order_id, 0);
        
        // When - Add custom sort order
        let mut metadata = metadata;
        metadata.sort_orders.push(SortOrder {
            order_id: 1,
            fields: vec![
                SortField {
                    transform: "identity".to_string(),
                    source_id: 1, // id field
                    direction: "asc".to_string(),
                    null_order: "nulls-first".to_string(),
                },
                SortField {
                    transform: "bucket[16]".to_string(),
                    source_id: 3, // data field
                    direction: "desc".to_string(),
                    null_order: "nulls-last".to_string(),
                },
            ],
        });
        
        // Then
        assert_eq!(metadata.sort_orders.len(), 2);
        assert_eq!(metadata.sort_orders[1].fields.len(), 2);
        assert_eq!(metadata.sort_orders[1].fields[0].direction, "asc");
        assert_eq!(metadata.sort_orders[1].fields[1].transform, "bucket[16]");
    }
}

// Test helpers
fn create_test_env() -> Env {
    // Mock environment for testing
    unsafe { Env::from_raw(std::ptr::null_mut()) }
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

fn create_test_table_metadata() -> TableMetadata {
    TableMetadata {
        format_version: 2,
        table_uuid: Uuid::new_v4().to_string(),
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

fn create_test_snapshot(id: i64, parent_id: Option<i64>) -> Snapshot {
    Snapshot {
        snapshot_id: id,
        parent_snapshot_id: parent_id,
        timestamp_ms: Date::now().as_millis() as i64 + id,
        summary: {
            let mut summary = HashMap::new();
            summary.insert("operation".to_string(), "append".to_string());
            summary.insert("added-data-files".to_string(), "1".to_string());
            summary.insert("added-records".to_string(), "100".to_string());
            summary
        },
        manifest_list: format!("manifest-list-{}.avro", id),
        schema_id: Some(0),
    }
}

fn create_test_data_file(name: &str, records: i64, size: i64) -> DataFile {
    DataFile {
        file_path: format!("data/{}", name),
        file_format: FileFormat::Parquet,
        partition: HashMap::new(),
        record_count: records,
        file_size_in_bytes: size,
        column_sizes: HashMap::from([(1, size / 3), (2, size / 3), (3, size / 3)]),
        value_counts: HashMap::from([(1, records), (2, records), (3, records * 9 / 10)]),
        null_value_counts: HashMap::from([(1, 0), (2, 0), (3, records / 10)]),
        lower_bounds: HashMap::new(),
        upper_bounds: HashMap::new(),
        key_metadata: None,
        split_offsets: None,
        sort_order_id: None,
    }
}

fn validate_metadata_invariants(metadata: &TableMetadata) -> bool {
    // Check table UUID is not empty
    if metadata.table_uuid.is_empty() {
        return false;
    }
    
    // Check at least one schema exists
    if metadata.schemas.is_empty() {
        return false;
    }
    
    // Check current schema ID is valid
    if metadata.current_schema_id < 0 || metadata.current_schema_id >= metadata.schemas.len() as i32 {
        return false;
    }
    
    // Check current snapshot ID is valid if set
    if let Some(snapshot_id) = metadata.current_snapshot_id {
        if !metadata.snapshots.iter().any(|s| s.snapshot_id == snapshot_id) {
            return false;
        }
    }
    
    // Check for duplicate snapshot IDs
    let mut snapshot_ids = std::collections::HashSet::new();
    for snapshot in &metadata.snapshots {
        if !snapshot_ids.insert(snapshot.snapshot_id) {
            return false;
        }
    }
    
    // Check partition spec ID is valid
    if !metadata.partition_specs.iter().any(|spec| spec.spec_id == metadata.default_spec_id) {
        return false;
    }
    
    // Check snapshot lineage
    for snapshot in &metadata.snapshots {
        if let Some(parent_id) = snapshot.parent_snapshot_id {
            if !metadata.snapshots.iter().any(|s| s.snapshot_id == parent_id) {
                return false;
            }
        }
    }
    
    true
}

#[derive(Debug, Clone)]
enum MetadataOperation {
    AddSnapshot(Snapshot),
    AddSchema(Schema),
    UpdateProperty(String, String),
}