use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;
use worker::*;

use crate::utils::{log_error, log_info};

/// Iceberg table metadata version
const ICEBERG_FORMAT_VERSION: i32 = 2;

/// Schema definition for Iceberg tables
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Schema {
    pub schema_id: i32,
    pub fields: Vec<Field>,
}

/// Field definition in a schema
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Field {
    pub id: i32,
    pub name: String,
    pub field_type: String,
    pub required: bool,
}

/// Iceberg FileFormat enum
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FileFormat {
    Avro,
    Orc,
    Parquet,
}

/// Iceberg DataFile representation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct DataFile {
    pub file_path: String,
    pub file_format: FileFormat,
    pub partition: HashMap<String, String>,
    pub record_count: i64,
    pub file_size_in_bytes: i64,
    pub column_sizes: HashMap<i32, i64>,
    pub value_counts: HashMap<i32, i64>,
    pub null_value_counts: HashMap<i32, i64>,
    pub lower_bounds: HashMap<i32, Vec<u8>>,
    pub upper_bounds: HashMap<i32, Vec<u8>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub key_metadata: Option<Vec<u8>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub split_offsets: Option<Vec<i64>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sort_order_id: Option<i32>,
}

/// Iceberg Manifest Entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ManifestEntry {
    pub status: ManifestEntryStatus,
    pub snapshot_id: i64,
    pub data_file: DataFile,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ManifestEntryStatus {
    Added,
    Existing,
    Deleted,
}

/// Iceberg Manifest File
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct ManifestFile {
    pub manifest_path: String,
    pub manifest_length: i64,
    pub partition_spec_id: i32,
    pub added_snapshot_id: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub added_data_files_count: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub existing_data_files_count: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub deleted_data_files_count: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub added_rows_count: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub existing_rows_count: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub deleted_rows_count: Option<i64>,
    pub partitions: Vec<PartitionFieldSummary>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PartitionFieldSummary {
    pub contains_null: bool,
    pub contains_nan: Option<bool>,
    pub lower_bound: Option<Vec<u8>>,
    pub upper_bound: Option<Vec<u8>>,
}

/// Iceberg Snapshot
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct Snapshot {
    pub snapshot_id: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_snapshot_id: Option<i64>,
    pub timestamp_ms: i64,
    pub summary: HashMap<String, String>,
    pub manifest_list: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub schema_id: Option<i32>,
}

/// Iceberg Table Metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct TableMetadata {
    pub format_version: i32,
    pub table_uuid: String,
    pub location: String,
    pub last_updated_ms: i64,
    pub last_column_id: i32,
    pub schema: serde_json::Value, // Simplified for now
    pub schemas: Vec<serde_json::Value>,
    pub current_schema_id: i32,
    pub partition_spec: Vec<PartitionField>,
    pub partition_specs: Vec<PartitionSpec>,
    pub default_spec_id: i32,
    pub last_partition_id: i32,
    pub properties: HashMap<String, String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub current_snapshot_id: Option<i64>,
    pub snapshots: Vec<Snapshot>,
    pub snapshot_log: Vec<SnapshotLogEntry>,
    pub metadata_log: Vec<MetadataLogEntry>,
    pub sort_orders: Vec<SortOrder>,
    pub default_sort_order_id: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct PartitionField {
    pub source_id: i32,
    pub field_id: i32,
    pub name: String,
    pub transform: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct PartitionSpec {
    pub spec_id: i32,
    pub fields: Vec<PartitionField>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct SnapshotLogEntry {
    pub timestamp_ms: i64,
    pub snapshot_id: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct MetadataLogEntry {
    pub timestamp_ms: i64,
    pub metadata_file: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct SortOrder {
    pub order_id: i32,
    pub fields: Vec<SortField>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct SortField {
    pub transform: String,
    pub source_id: i32,
    pub direction: String,
    pub null_order: String,
}

/// Iceberg metadata manager for handling table metadata in Workers
pub struct IcebergMetadata {
    env: Env,
    table_location: String,
}

impl Clone for IcebergMetadata {
    fn clone(&self) -> Self {
        Self {
            env: self.env.clone(),
            table_location: self.table_location.clone(),
        }
    }
}

impl IcebergMetadata {
    pub fn new(env: &Env, table_location: String) -> Self {
        Self {
            env: env.clone(),
            table_location,
        }
    }

    /// Initialize a new Iceberg table
    pub async fn create_table(
        &self,
        _table_name: &str,
        schema: serde_json::Value,
        partition_spec: Vec<PartitionField>,
        properties: HashMap<String, String>,
    ) -> Result<TableMetadata> {
        let table_uuid = Uuid::new_v4().to_string();
        let timestamp_ms = Date::now().as_millis() as i64;
        
        let metadata = TableMetadata {
            format_version: ICEBERG_FORMAT_VERSION,
            table_uuid: table_uuid.clone(),
            location: self.table_location.clone(),
            last_updated_ms: timestamp_ms,
            last_column_id: 25, // Based on our schema
            schema: schema.clone(),
            schemas: vec![schema],
            current_schema_id: 0,
            partition_spec: partition_spec.clone(),
            partition_specs: vec![PartitionSpec {
                spec_id: 0,
                fields: partition_spec,
            }],
            default_spec_id: 0,
            last_partition_id: 4, // We have 5 partition fields (0-4)
            properties,
            current_snapshot_id: None,
            snapshots: Vec::new(),
            snapshot_log: Vec::new(),
            metadata_log: Vec::new(),
            sort_orders: vec![SortOrder {
                order_id: 0,
                fields: vec![
                    SortField {
                        transform: "identity".to_string(),
                        source_id: 4, // time field
                        direction: "asc".to_string(),
                        null_order: "nulls-last".to_string(),
                    },
                ],
            }],
            default_sort_order_id: 0,
        };

        // Write initial metadata
        self.write_metadata(&metadata, "v1").await?;
        
        Ok(metadata)
    }

    /// Write table metadata to R2
    pub async fn write_metadata(
        &self,
        metadata: &TableMetadata,
        version: &str,
    ) -> Result<String> {
        let metadata_json = serde_json::to_string_pretty(metadata)
            .map_err(|e| Error::RustError(format!("Failed to serialize metadata: {}", e)))?;
        
        let metadata_path = format!("{}/metadata/{}.metadata.json", self.table_location, version);
        
        let bucket = self.env.bucket("ANALYTICS_SOURCE")?;
        bucket
            .put(&metadata_path, metadata_json.as_bytes().to_vec())
            .execute()
            .await?;
        
        log_info(&format!("Wrote table metadata to {}", metadata_path));
        
        Ok(metadata_path)
    }

    /// Create a new snapshot with data files
    pub async fn create_snapshot(
        &self,
        parent_metadata: &TableMetadata,
        data_files: Vec<DataFile>,
        operation: &str,
    ) -> Result<TableMetadata> {
        let snapshot_id = Date::now().as_millis() as i64;
        let timestamp_ms = snapshot_id;
        
        // Create manifest entries
        let manifest_entries: Vec<ManifestEntry> = data_files
            .into_iter()
            .map(|data_file| ManifestEntry {
                status: ManifestEntryStatus::Added,
                snapshot_id,
                data_file,
            })
            .collect();
        
        // Write manifest file
        let manifest_path = self.write_manifest_file(&manifest_entries, snapshot_id).await?;
        
        // Create manifest list
        let manifest_files = vec![self.create_manifest_file_entry(
            manifest_path,
            &manifest_entries,
            snapshot_id,
        )?];
        
        // Write manifest list
        let manifest_list_path = self.write_manifest_list(&manifest_files, snapshot_id).await?;
        
        // Create snapshot
        let mut summary = HashMap::new();
        summary.insert("operation".to_string(), operation.to_string());
        summary.insert("added-data-files".to_string(), manifest_entries.len().to_string());
        summary.insert("added-records".to_string(), 
            manifest_entries.iter().map(|e| e.data_file.record_count).sum::<i64>().to_string());
        summary.insert("added-files-size".to_string(),
            manifest_entries.iter().map(|e| e.data_file.file_size_in_bytes).sum::<i64>().to_string());
        
        let snapshot = Snapshot {
            snapshot_id,
            parent_snapshot_id: parent_metadata.current_snapshot_id,
            timestamp_ms,
            summary,
            manifest_list: manifest_list_path,
            schema_id: Some(parent_metadata.current_schema_id),
        };
        
        // Update metadata
        let mut new_metadata = parent_metadata.clone();
        new_metadata.last_updated_ms = timestamp_ms;
        new_metadata.current_snapshot_id = Some(snapshot_id);
        new_metadata.snapshots.push(snapshot);
        new_metadata.snapshot_log.push(SnapshotLogEntry {
            timestamp_ms,
            snapshot_id,
        });
        
        // Write new metadata version
        let version = format!("v{}", new_metadata.snapshots.len() + 1);
        let metadata_path = self.write_metadata(&new_metadata, &version).await?;
        
        new_metadata.metadata_log.push(MetadataLogEntry {
            timestamp_ms,
            metadata_file: metadata_path,
        });
        
        Ok(new_metadata)
    }

    /// Write manifest file
    async fn write_manifest_file(
        &self,
        entries: &[ManifestEntry],
        snapshot_id: i64,
    ) -> Result<String> {
        let manifest_json = serde_json::to_string(entries)
            .map_err(|e| Error::RustError(format!("Failed to serialize manifest: {}", e)))?;
        
        let manifest_path = format!(
            "{}/metadata/{}-m0.avro",
            self.table_location,
            snapshot_id
        );
        
        let bucket = self.env.bucket("ANALYTICS_SOURCE")?;
        bucket
            .put(&manifest_path, manifest_json.as_bytes().to_vec())
            .execute()
            .await?;
        
        Ok(manifest_path)
    }

    /// Write manifest list
    async fn write_manifest_list(
        &self,
        manifest_files: &[ManifestFile],
        snapshot_id: i64,
    ) -> Result<String> {
        let manifest_list_json = serde_json::to_string(manifest_files)
            .map_err(|e| Error::RustError(format!("Failed to serialize manifest list: {}", e)))?;
        
        let manifest_list_path = format!(
            "{}/metadata/snap-{}-1.avro",
            self.table_location,
            snapshot_id
        );
        
        let bucket = self.env.bucket("ANALYTICS_SOURCE")?;
        bucket
            .put(&manifest_list_path, manifest_list_json.as_bytes().to_vec())
            .execute()
            .await?;
        
        Ok(manifest_list_path)
    }

    /// Create manifest file entry
    fn create_manifest_file_entry(
        &self,
        manifest_path: String,
        entries: &[ManifestEntry],
        snapshot_id: i64,
    ) -> Result<ManifestFile> {
        let added_files = entries
            .iter()
            .filter(|e| matches!(e.status, ManifestEntryStatus::Added))
            .count() as i32;
        
        let added_rows = entries
            .iter()
            .filter(|e| matches!(e.status, ManifestEntryStatus::Added))
            .map(|e| e.data_file.record_count)
            .sum::<i64>();
        
        // Extract partition summaries
        let mut partition_summaries = Vec::new();
        for _ in 0..5 {
            // 5 partition fields
            partition_summaries.push(PartitionFieldSummary {
                contains_null: false,
                contains_nan: None,
                lower_bound: None,
                upper_bound: None,
            });
        }
        
        Ok(ManifestFile {
            manifest_path,
            manifest_length: entries.len() as i64 * 1024, // Rough estimate
            partition_spec_id: 0,
            added_snapshot_id: snapshot_id,
            added_data_files_count: Some(added_files),
            existing_data_files_count: Some(0),
            deleted_data_files_count: Some(0),
            added_rows_count: Some(added_rows),
            existing_rows_count: Some(0),
            deleted_rows_count: Some(0),
            partitions: partition_summaries,
        })
    }

    /// Read current table metadata
    pub async fn read_current_metadata(&self) -> Result<TableMetadata> {
        let bucket = self.env.bucket("ANALYTICS_SOURCE")?;
        
        // Try to read version hint
        let version_hint_path = format!("{}/metadata/version-hint.text", self.table_location);
        let current_version = match bucket.get(&version_hint_path).execute().await? {
            Some(object) => {
                let body = object
                    .body()
                    .ok_or_else(|| Error::RustError("Version hint has no body".to_string()))?;
                body.text().await?
            }
            None => "v1".to_string(),
        };
        
        // Read metadata file
        let metadata_path = format!("{}/metadata/{}.metadata.json", self.table_location, current_version);
        let metadata_object = bucket
            .get(&metadata_path)
            .execute()
            .await?
            .ok_or_else(|| Error::RustError("Metadata file not found".to_string()))?;
        
        let metadata_json = metadata_object
            .body()
            .ok_or_else(|| Error::RustError("Metadata has no body".to_string()))?
            .text()
            .await?;
        
        serde_json::from_str(&metadata_json)
            .map_err(|e| Error::RustError(format!("Failed to parse metadata: {}", e)))
    }

    /// Update version hint
    pub async fn update_version_hint(&self, version: &str) -> Result<()> {
        let version_hint_path = format!("{}/metadata/version-hint.text", self.table_location);
        
        let bucket = self.env.bucket("ANALYTICS_SOURCE")?;
        bucket
            .put(&version_hint_path, version.as_bytes().to_vec())
            .execute()
            .await?;
        
        Ok(())
    }
}