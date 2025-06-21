use crate::iceberg::manifest::*;
use std::collections::HashMap;
use chrono::Utc;
use uuid::Uuid;

#[cfg(test)]
use proptest::prelude::*;

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
    assert_eq!(manifest.entries.len(), 2);
    assert_eq!(manifest.added_files_count, 2);
    assert_eq!(manifest.added_rows_count, 300);
    assert_eq!(manifest.total_record_count(), 300);
    assert!(manifest.validate_checksums());
}

#[test]
fn should_handle_deletes_when_manifest_updated() {
    // Given
    let data_files = vec![
        create_test_data_file("data1.parquet", 1000),
        create_test_data_file("data2.parquet", 2000),
    ];
    let mut manifest = ManifestFile::create(data_files);
    
    // Initial state
    assert_eq!(manifest.total_record_count(), 3000);
    assert_eq!(manifest.live_record_count(), 3000);
    
    // When
    let delete_file = create_delete_file("delete1.parquet", vec![1, 5, 10]);
    manifest.add_delete(delete_file);
    
    // Then
    assert_eq!(manifest.deleted_files_count, 1);
    assert_eq!(manifest.deleted_rows_count, 3);
    assert_eq!(manifest.total_record_count(), 3000); // Total unchanged
    assert_eq!(manifest.live_record_count(), 2997); // 3000 - 3 deletes
}

#[test]
fn should_track_manifest_entry_status() {
    // Given
    let data_file = create_test_data_file("test.parquet", 500);
    
    // When
    let entry = ManifestEntry {
        status: ManifestEntryStatus::Added,
        snapshot_id: Some(123),
        sequence_number: Some(1),
        data_file,
    };
    
    // Then
    assert!(matches!(entry.status, ManifestEntryStatus::Added));
    assert_eq!(entry.snapshot_id, Some(123));
    assert_eq!(entry.data_file.record_count, 500);
}

#[test]
fn should_create_delete_manifest() {
    // Given
    let delete_files = vec![
        create_delete_file("delete1.parquet", vec![1, 2, 3]),
        create_delete_file("delete2.parquet", vec![4, 5]),
    ];
    
    // When
    let manifest = ManifestFile::create_delete_manifest(delete_files);
    
    // Then
    assert!(matches!(manifest.content, ManifestContent::Deletes));
    assert_eq!(manifest.deleted_files_count, 2);
    assert_eq!(manifest.deleted_rows_count, 5);
    assert_eq!(manifest.entries.len(), 2);
}

#[test]
fn should_filter_data_files_by_status() {
    // Given
    let mut manifest = ManifestFile::create(vec![
        create_test_data_file("file1.parquet", 100),
        create_test_data_file("file2.parquet", 200),
    ]);
    
    // Mark one file as deleted
    manifest.entries[0].status = ManifestEntryStatus::Deleted;
    
    // When
    let active_files = manifest.data_files();
    
    // Then
    assert_eq!(active_files.len(), 1);
    assert_eq!(active_files[0].file_path, "data/file2.parquet");
}

#[test]
fn should_support_data_file_statistics() {
    // Given
    let mut data_file = DataFile::new(
        "stats_test.parquet".to_string(),
        FileFormat::Parquet,
        1000,
        10240,
    );
    
    let mut column_sizes = HashMap::new();
    column_sizes.insert("id".to_string(), 1024);
    column_sizes.insert("name".to_string(), 4096);
    
    let mut value_counts = HashMap::new();
    value_counts.insert("id".to_string(), 1000);
    value_counts.insert("name".to_string(), 950);
    
    let mut null_counts = HashMap::new();
    null_counts.insert("id".to_string(), 0);
    null_counts.insert("name".to_string(), 50);
    
    let lower_bounds = HashMap::new();
    let upper_bounds = HashMap::new();
    
    // When
    data_file = data_file.with_statistics(
        column_sizes.clone(),
        value_counts.clone(),
        null_counts.clone(),
        lower_bounds,
        upper_bounds,
    );
    
    // Then
    assert_eq!(data_file.column_sizes.unwrap().get("id"), Some(&1024));
    assert_eq!(data_file.value_counts.unwrap().get("name"), Some(&950));
    assert_eq!(data_file.null_value_counts.unwrap().get("name"), Some(&50));
}

#[test]
fn should_support_partitioned_data_files() {
    // Given
    let mut partition = HashMap::new();
    partition.insert("year".to_string(), "2024".to_string());
    partition.insert("month".to_string(), "01".to_string());
    partition.insert("day".to_string(), "15".to_string());
    
    let data_file = DataFile::new(
        "partitioned.parquet".to_string(),
        FileFormat::Parquet,
        500,
        5120,
    ).with_partition(partition.clone());
    
    // Then
    assert_eq!(data_file.partition.get("year"), Some(&"2024".to_string()));
    assert_eq!(data_file.partition.get("month"), Some(&"01".to_string()));
    assert_eq!(data_file.partition.get("day"), Some(&"15".to_string()));
}

#[test]
fn should_identify_delete_files() {
    // Given
    let data_file = create_test_data_file("data.parquet", 100);
    let position_delete = DataFile {
        content: FileContent::PositionDeletes,
        ..create_test_data_file("pos_delete.parquet", 10)
    };
    let equality_delete = DataFile {
        content: FileContent::EqualityDeletes,
        ..create_test_data_file("eq_delete.parquet", 5)
    };
    
    // Then
    assert!(!data_file.is_delete_file());
    assert!(position_delete.is_delete_file());
    assert!(equality_delete.is_delete_file());
}

#[test]
fn should_handle_large_manifests() {
    // Given
    let data_files: Vec<DataFile> = (0..1000)
        .map(|i| create_test_data_file(&format!("file{:04}.parquet", i), 100))
        .collect();
    
    // When
    let manifest = ManifestFile::create(data_files);
    
    // Then
    assert_eq!(manifest.entries.len(), 1000);
    assert_eq!(manifest.added_files_count, 1000);
    assert_eq!(manifest.added_rows_count, 100_000);
    assert_eq!(manifest.data_files().len(), 1000);
}

#[test]
fn should_serialize_and_deserialize_manifest() {
    // Given
    let data_files = vec![
        create_test_data_file("file1.parquet", 100),
        create_test_data_file("file2.parquet", 200),
    ];
    let manifest = ManifestFile::create(data_files);
    
    // When
    let json = serde_json::to_string(&manifest).unwrap();
    let deserialized: ManifestFile = serde_json::from_str(&json).unwrap();
    
    // Then
    assert_eq!(deserialized.entries.len(), manifest.entries.len());
    assert_eq!(deserialized.added_files_count, manifest.added_files_count);
    assert_eq!(deserialized.added_rows_count, manifest.added_rows_count);
    assert_eq!(deserialized.manifest_path, manifest.manifest_path);
}

#[test]
fn should_handle_manifest_entry_lifecycle() {
    // Given
    let mut manifest = ManifestFile::create(vec![
        create_test_data_file("file1.parquet", 100),
        create_test_data_file("file2.parquet", 200),
    ]);
    
    // Initial state - all files are added
    assert_eq!(manifest.added_files_count, 2);
    assert_eq!(manifest.existing_files_count, 0);
    assert_eq!(manifest.deleted_files_count, 0);
    
    // When - Mark first file as existing (from previous snapshot)
    manifest.entries[0].status = ManifestEntryStatus::Existing;
    manifest.added_files_count = 1;
    manifest.existing_files_count = 1;
    manifest.added_rows_count = 200;
    manifest.existing_rows_count = 100;
    
    // Then
    assert_eq!(manifest.total_record_count(), 300);
    assert_eq!(manifest.live_record_count(), 300);
    
    // When - Delete the existing file
    manifest.entries[0].status = ManifestEntryStatus::Deleted;
    manifest.existing_files_count = 0;
    manifest.deleted_files_count = 1;
    manifest.existing_rows_count = 0;
    manifest.deleted_rows_count = 100;
    
    // Then
    assert_eq!(manifest.total_record_count(), 200); // Only file2 remains
    assert_eq!(manifest.live_record_count(), 200);
}

#[test]
fn should_handle_manifest_with_partition_summaries() {
    // Given
    let mut partition = HashMap::new();
    partition.insert("year".to_string(), "2024".to_string());
    partition.insert("month".to_string(), "01".to_string());
    partition.insert("day".to_string(), "15".to_string());
    
    let data_files = vec![
        create_partitioned_data_file("part1.parquet", 1000, partition.clone()),
        create_partitioned_data_file("part2.parquet", 2000, partition.clone()),
    ];
    
    // When
    let manifest = ManifestFile::create(data_files);
    
    // Then
    assert_eq!(manifest.entries.len(), 2);
    for entry in &manifest.entries {
        assert_eq!(entry.data_file.partition.get("year"), Some(&"2024".to_string()));
        assert_eq!(entry.data_file.partition.get("month"), Some(&"01".to_string()));
        assert_eq!(entry.data_file.partition.get("day"), Some(&"15".to_string()));
    }
}

#[test]
fn should_validate_manifest_file_statistics() {
    // Given
    let mut data_file = create_test_data_file("stats.parquet", 1000);
    
    // Add comprehensive statistics
    let mut column_sizes = HashMap::new();
    column_sizes.insert("id".to_string(), 8000); // 8 bytes per record
    column_sizes.insert("name".to_string(), 20000); // 20 bytes per record
    column_sizes.insert("timestamp".to_string(), 8000);
    
    let mut value_counts = HashMap::new();
    value_counts.insert("id".to_string(), 1000);
    value_counts.insert("name".to_string(), 950); // Some nulls
    value_counts.insert("timestamp".to_string(), 1000);
    
    let mut null_counts = HashMap::new();
    null_counts.insert("id".to_string(), 0);
    null_counts.insert("name".to_string(), 50);
    null_counts.insert("timestamp".to_string(), 0);
    
    let mut nan_counts = HashMap::new();
    nan_counts.insert("float_col".to_string(), 5);
    
    let lower_bounds = HashMap::new();
    let upper_bounds = HashMap::new();
    
    // When
    data_file = data_file.with_statistics(
        column_sizes.clone(),
        value_counts.clone(),
        null_counts.clone(),
        lower_bounds,
        upper_bounds,
    );
    data_file.nan_value_counts = Some(nan_counts);
    
    // Then
    assert_eq!(data_file.column_sizes.as_ref().unwrap().get("id"), Some(&8000));
    assert_eq!(data_file.value_counts.as_ref().unwrap().get("name"), Some(&950));
    assert_eq!(data_file.null_value_counts.as_ref().unwrap().get("name"), Some(&50));
    assert_eq!(data_file.nan_value_counts.as_ref().unwrap().get("float_col"), Some(&5));
    
    // Verify file size calculation
    let total_column_size: i64 = column_sizes.values().sum();
    assert_eq!(total_column_size, 36000);
}

#[test]
fn should_handle_manifest_content_types() {
    // Test 1: Data manifest
    let data_manifest = ManifestFile::create(vec![
        create_test_data_file("data1.parquet", 100),
        create_test_data_file("data2.parquet", 200),
    ]);
    assert!(matches!(data_manifest.content, ManifestContent::Data));
    
    // Test 2: Delete manifest
    let delete_manifest = ManifestFile::create_delete_manifest(vec![
        create_delete_file("delete1.parquet", vec![1, 2, 3]),
        create_delete_file("delete2.parquet", vec![4, 5]),
    ]);
    assert!(matches!(delete_manifest.content, ManifestContent::Deletes));
    assert_eq!(delete_manifest.deleted_files_count, 2);
    assert_eq!(delete_manifest.deleted_rows_count, 5);
}

#[test]
fn should_support_equality_deletes() {
    // Given
    let equality_delete = DataFile {
        content: FileContent::EqualityDeletes,
        file_path: "equality_delete.parquet".to_string(),
        file_format: FileFormat::Parquet,
        partition: HashMap::new(),
        record_count: 10,
        file_size_in_bytes: 1024,
        column_sizes: None,
        value_counts: None,
        null_value_counts: None,
        nan_value_counts: None,
        lower_bounds: None,
        upper_bounds: None,
        key_metadata: None,
        split_offsets: None,
        equality_ids: Some(vec![1, 2]), // IDs of columns used for equality
        sort_order_id: None,
    };
    
    // Then
    assert!(equality_delete.is_delete_file());
    assert!(matches!(equality_delete.content, FileContent::EqualityDeletes));
    assert_eq!(equality_delete.equality_ids, Some(vec![1, 2]));
}

// Property-based tests
#[cfg(test)]
mod property_tests {
    use super::*;
    use proptest::prelude::*;
    
    proptest! {
        #[test]
        fn should_maintain_consistency_with_random_operations(
            file_count in 1..100usize,
            record_counts in prop::collection::vec(1..10000i64, 1..100)
        ) {
            // Property: Manifest statistics remain consistent
            let data_files: Vec<DataFile> = record_counts
                .into_iter()
                .enumerate()
                .map(|(i, count)| create_test_data_file(&format!("file{}.parquet", i), count))
                .take(file_count)
                .collect();
            
            let expected_total_records: i64 = data_files.iter()
                .map(|f| f.record_count)
                .sum();
            
            let manifest = ManifestFile::create(data_files.clone());
            
            prop_assert_eq!(manifest.entries.len(), file_count);
            prop_assert_eq!(manifest.added_files_count as usize, file_count);
            prop_assert_eq!(manifest.added_rows_count, expected_total_records);
            prop_assert_eq!(manifest.total_record_count(), expected_total_records);
            prop_assert!(manifest.validate_checksums());
        }
        
        #[test]
        fn should_handle_manifest_entry_status_transitions(
            transitions in prop::collection::vec(
                prop_oneof![
                    Just(ManifestEntryStatus::Added),
                    Just(ManifestEntryStatus::Existing),
                    Just(ManifestEntryStatus::Deleted),
                ],
                1..50
            )
        ) {
            // Property: Status transitions maintain consistency
            let mut manifest = ManifestFile::create(vec![
                create_test_data_file("test.parquet", 100)
            ]);
            
            for status in transitions {
                manifest.entries[0].status = status;
                
                // Verify invariants
                match status {
                    ManifestEntryStatus::Added => {
                        prop_assert!(manifest.added_files_count > 0);
                    }
                    ManifestEntryStatus::Deleted => {
                        // In real scenario, counts would be updated
                        prop_assert!(manifest.entries[0].status == ManifestEntryStatus::Deleted);
                    }
                    ManifestEntryStatus::Existing => {
                        // Existing files contribute to total but not added count
                        prop_assert!(manifest.entries.len() > 0);
                    }
                }
            }
        }
    }
}

// Test helper functions
fn create_test_data_file(name: &str, records: i64) -> DataFile {
    DataFile::new(
        format!("data/{}", name),
        FileFormat::Parquet,
        records,
        records * 1024, // Assume 1KB per record
    )
}

fn create_partitioned_data_file(name: &str, records: i64, partition: HashMap<String, String>) -> DataFile {
    DataFile::new(
        format!("data/{}", name),
        FileFormat::Parquet,
        records,
        records * 1024,
    ).with_partition(partition)
}

fn create_delete_file(name: &str, positions: Vec<i64>) -> DataFile {
    DataFile {
        content: FileContent::PositionDeletes,
        record_count: positions.len() as i64,
        ..create_test_data_file(name, positions.len() as i64)
    }
}

#[test]
fn should_handle_manifest_split_offsets() {
    // Given - Large file that needs splitting
    let mut data_file = create_test_data_file("large_file.parquet", 1_000_000);
    data_file.file_size_in_bytes = 1024 * 1024 * 1024; // 1GB
    
    // Add split offsets for parallel reading
    data_file.split_offsets = Some(vec![
        0,
        256 * 1024 * 1024,  // 256MB
        512 * 1024 * 1024,  // 512MB
        768 * 1024 * 1024,  // 768MB
    ]);
    
    // When
    let manifest = ManifestFile::create(vec![data_file]);
    
    // Then
    let file = &manifest.entries[0].data_file;
    assert!(file.split_offsets.is_some());
    assert_eq!(file.split_offsets.as_ref().unwrap().len(), 4);
}

#[test]
fn should_validate_manifest_path_generation() {
    // Given
    let manifest = ManifestFile::create(vec![]);
    
    // Then
    assert!(manifest.manifest_path.starts_with("manifest-"));
    assert!(manifest.manifest_path.ends_with(".avro"));
    
    // Verify UUID format in path
    let uuid_part = manifest.manifest_path
        .strip_prefix("manifest-")
        .and_then(|s| s.strip_suffix(".avro"))
        .unwrap();
    
    assert!(Uuid::parse_str(uuid_part).is_ok());
}