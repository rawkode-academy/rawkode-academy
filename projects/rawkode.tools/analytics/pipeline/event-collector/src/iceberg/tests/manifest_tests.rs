use crate::iceberg::manifest::*;
use crate::iceberg::writer::FileFormat;
use std::collections::HashMap;

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

// Test helper functions
fn create_test_data_file(name: &str, records: i64) -> DataFile {
    DataFile::new(
        format!("data/{}", name),
        FileFormat::Parquet,
        records,
        records * 1024, // Assume 1KB per record
    )
}

fn create_delete_file(name: &str, positions: Vec<i64>) -> DataFile {
    DataFile {
        content: FileContent::PositionDeletes,
        record_count: positions.len() as i64,
        ..create_test_data_file(name, positions.len() as i64)
    }
}