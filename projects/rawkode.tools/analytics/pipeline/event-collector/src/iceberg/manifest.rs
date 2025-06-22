use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Manifest file containing a list of data files
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ManifestFile {
    pub manifest_path: String,
    pub manifest_length: i64,
    pub partition_spec_id: i32,
    pub content: ManifestContent,
    pub added_snapshot_id: i64,
    pub added_files_count: i32,
    pub existing_files_count: i32,
    pub deleted_files_count: i32,
    pub added_rows_count: i64,
    pub existing_rows_count: i64,
    pub deleted_rows_count: i64,
    pub entries: Vec<ManifestEntry>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum ManifestContent {
    Data,
    Deletes,
}

/// Entry in a manifest file
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ManifestEntry {
    pub status: ManifestEntryStatus,
    pub snapshot_id: Option<i64>,
    pub sequence_number: Option<i64>,
    pub data_file: DataFile,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum ManifestEntryStatus {
    Added,
    Existing,
    Deleted,
}

/// Data file metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DataFile {
    pub content: FileContent,
    pub file_path: String,
    pub file_format: FileFormat,
    pub partition: HashMap<String, String>,
    pub record_count: i64,
    pub file_size_in_bytes: i64,
    pub column_sizes: Option<HashMap<String, i64>>,
    pub value_counts: Option<HashMap<String, i64>>,
    pub null_value_counts: Option<HashMap<String, i64>>,
    pub nan_value_counts: Option<HashMap<String, i64>>,
    pub lower_bounds: Option<HashMap<String, Vec<u8>>>,
    pub upper_bounds: Option<HashMap<String, Vec<u8>>>,
    pub key_metadata: Option<Vec<u8>>,
    pub split_offsets: Option<Vec<i64>>,
    pub equality_ids: Option<Vec<i32>>,
    pub sort_order_id: Option<i32>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum FileContent {
    Data,
    PositionDeletes,
    EqualityDeletes,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum FileFormat {
    Avro,
    Orc,
    Parquet,
}

impl ManifestFile {
    /// Create a new manifest file from data files
    pub fn create(data_files: Vec<DataFile>) -> Self {
        let added_files_count = data_files.len() as i32;
        let added_rows_count: i64 = data_files.iter().map(|f| f.record_count).sum();
        
        let entries = data_files
            .into_iter()
            .map(|data_file| ManifestEntry {
                status: ManifestEntryStatus::Added,
                snapshot_id: None,
                sequence_number: None,
                data_file,
            })
            .collect();

        Self {
            manifest_path: format!("manifest-{}.avro", uuid::Uuid::new_v4()),
            manifest_length: 0, // Will be set when written
            partition_spec_id: 0,
            content: ManifestContent::Data,
            added_snapshot_id: 0, // Will be set when added to snapshot
            added_files_count,
            existing_files_count: 0,
            deleted_files_count: 0,
            added_rows_count,
            existing_rows_count: 0,
            deleted_rows_count: 0,
            entries,
        }
    }

    /// Add a delete file to the manifest
    pub fn add_delete(&mut self, delete_file: DataFile) {
        let record_count = delete_file.record_count;
        self.entries.push(ManifestEntry {
            status: ManifestEntryStatus::Added,
            snapshot_id: None,
            sequence_number: None,
            data_file: delete_file,
        });
        self.deleted_files_count += 1;
        self.deleted_rows_count += record_count;
    }

    /// Get the total record count
    pub fn total_record_count(&self) -> i64 {
        self.added_rows_count + self.existing_rows_count
    }

    /// Get the live record count (excluding deletes)
    pub fn live_record_count(&self) -> i64 {
        self.total_record_count() - self.deleted_rows_count
    }

    /// Validate checksums for all entries
    pub fn validate_checksums(&self) -> bool {
        // In a real implementation, this would verify checksums
        // For now, we'll return true
        true
    }

    /// Get all data files
    pub fn data_files(&self) -> Vec<&DataFile> {
        self.entries
            .iter()
            .filter(|e| matches!(e.status, ManifestEntryStatus::Added | ManifestEntryStatus::Existing))
            .map(|e| &e.data_file)
            .collect()
    }

    /// Create a manifest for delete files
    pub fn create_delete_manifest(delete_files: Vec<DataFile>) -> Self {
        let mut manifest = Self::create(vec![]);
        manifest.content = ManifestContent::Deletes;
        
        for delete_file in delete_files {
            manifest.add_delete(delete_file);
        }
        
        manifest
    }
}

impl DataFile {
    /// Create a new data file
    pub fn new(
        path: String,
        format: FileFormat,
        record_count: i64,
        file_size: i64,
    ) -> Self {
        Self {
            content: FileContent::Data,
            file_path: path,
            file_format: format,
            partition: HashMap::new(),
            record_count,
            file_size_in_bytes: file_size,
            column_sizes: None,
            value_counts: None,
            null_value_counts: None,
            nan_value_counts: None,
            lower_bounds: None,
            upper_bounds: None,
            key_metadata: None,
            split_offsets: None,
            equality_ids: None,
            sort_order_id: None,
        }
    }

    /// Set column statistics
    pub fn with_statistics(
        mut self,
        column_sizes: HashMap<String, i64>,
        value_counts: HashMap<String, i64>,
        null_value_counts: HashMap<String, i64>,
        lower_bounds: HashMap<String, Vec<u8>>,
        upper_bounds: HashMap<String, Vec<u8>>,
    ) -> Self {
        self.column_sizes = Some(column_sizes);
        self.value_counts = Some(value_counts);
        self.null_value_counts = Some(null_value_counts);
        self.lower_bounds = Some(lower_bounds);
        self.upper_bounds = Some(upper_bounds);
        self
    }

    /// Set partition information
    pub fn with_partition(mut self, partition: HashMap<String, String>) -> Self {
        self.partition = partition;
        self
    }

    /// Check if this is a delete file
    pub fn is_delete_file(&self) -> bool {
        matches!(self.content, FileContent::PositionDeletes | FileContent::EqualityDeletes)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_manifest_creation() {
        let data_files = vec![
            DataFile::new("file1.parquet".to_string(), FileFormat::Parquet, 100, 1024),
            DataFile::new("file2.parquet".to_string(), FileFormat::Parquet, 200, 2048),
        ];

        let manifest = ManifestFile::create(data_files);

        assert_eq!(manifest.added_files_count, 2);
        assert_eq!(manifest.added_rows_count, 300);
        assert_eq!(manifest.entries.len(), 2);
    }

    #[test]
    fn test_delete_handling() {
        let mut manifest = ManifestFile::create(vec![
            DataFile::new("data1.parquet".to_string(), FileFormat::Parquet, 1000, 10240),
        ]);

        let delete_file = DataFile::new("delete1.parquet".to_string(), FileFormat::Parquet, 50, 512);
        manifest.add_delete(delete_file);

        assert_eq!(manifest.total_record_count(), 1000);
        assert_eq!(manifest.live_record_count(), 950);
        assert_eq!(manifest.deleted_files_count, 1);
    }
}