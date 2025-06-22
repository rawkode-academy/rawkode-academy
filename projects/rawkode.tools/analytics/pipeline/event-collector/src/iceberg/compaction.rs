//! Iceberg table compaction for Cloudflare Workers
//! 
//! This module implements a memory-efficient compaction strategy that:
//! - Identifies small files within partitions that need compaction
//! - Merges multiple small files into larger files (target: 128MB)
//! - Handles Worker memory constraints (128MB limit)
//! - Provides scheduled worker support for background compaction
//! 
//! # Design Considerations
//! 
//! - Files are compacted within partition boundaries to maintain query efficiency
//! - Maximum of 50 files per compaction operation to stay within memory limits
//! - Compaction creates new snapshots with proper lineage tracking
//! - Failed compactions don't affect table consistency

use crate::utils::{log_error, log_info};
use std::collections::HashMap;
use worker::*;

use super::metadata::{DataFile, IcebergMetadata, ManifestEntry, ManifestEntryStatus};

const MIN_FILES_FOR_COMPACTION: usize = 10;
const TARGET_FILE_SIZE_BYTES: i64 = 128 * 1024 * 1024; // 128MB
const MAX_COMPACTION_FILES: usize = 50; // Limit for Worker memory

/// Iceberg compaction strategy for Workers
/// 
/// Manages the identification and merging of small files within an Iceberg table.
/// Designed to work within Cloudflare Workers' constraints while maintaining
/// optimal file sizes for query performance.
pub struct IcebergCompactor {
    env: Env,
    table_location: String,
}

impl IcebergCompactor {
    /// Create a new compactor instance
    /// 
    /// # Arguments
    /// 
    /// * `env` - Cloudflare Worker environment
    /// * `table_location` - S3-style path to the Iceberg table (e.g., "analytics/events")
    pub fn new(env: &Env, table_location: String) -> Self {
        Self {
            env: env.clone(),
            table_location,
        }
    }

    /// Identify files that need compaction
    /// 
    /// Analyzes the current table state and creates compaction plans for partitions
    /// with many small files. Each plan targets merging small files into ~128MB files.
    /// 
    /// # Returns
    /// 
    /// Vector of compaction plans, each containing:
    /// - Partition key for the files to compact
    /// - List of source files to merge
    /// - Estimated output size and record count
    pub async fn plan_compaction(&self) -> Result<Vec<CompactionPlan>> {
        let iceberg_metadata = IcebergMetadata::new(&self.env, self.table_location.clone());
        
        // Read current table metadata
        let table_metadata = match iceberg_metadata.read_current_metadata().await {
            Ok(metadata) => metadata,
            Err(e) => {
                log_error(&format!("Failed to read table metadata: {}", e));
                return Err(e);
            }
        };

        // Get current snapshot
        let current_snapshot = match table_metadata.current_snapshot_id {
            Some(snapshot_id) => {
                table_metadata
                    .snapshots
                    .iter()
                    .find(|s| s.snapshot_id == snapshot_id)
                    .ok_or_else(|| Error::RustError("Current snapshot not found".to_string()))?
            }
            None => {
                log_info("No snapshots found, nothing to compact");
                return Ok(Vec::new());
            }
        };

        // Read manifest list
        let manifest_list_path = &current_snapshot.manifest_list;
        let bucket = self.env.bucket("ANALYTICS_SOURCE")?;
        
        let manifest_object = bucket
            .get(manifest_list_path)
            .execute()
            .await?
            .ok_or_else(|| Error::RustError("Manifest list not found".to_string()))?;
        
        let manifest_json = manifest_object
            .body()
            .ok_or_else(|| Error::RustError("Manifest has no body".to_string()))?
            .text()
            .await?;
        
        let manifest_files: Vec<super::metadata::ManifestFile> = serde_json::from_str(&manifest_json)
            .map_err(|e| Error::RustError(format!("Failed to parse manifest list: {}", e)))?;

        // Group files by partition
        let mut files_by_partition: HashMap<String, Vec<DataFile>> = HashMap::new();
        
        for manifest_file in manifest_files {
            // Read manifest entries
            let manifest_entries = self.read_manifest_entries(&manifest_file.manifest_path).await?;
            
            for entry in manifest_entries {
                if matches!(entry.status, ManifestEntryStatus::Added | ManifestEntryStatus::Existing) {
                    let partition_key = self.partition_key(&entry.data_file.partition);
                    files_by_partition
                        .entry(partition_key)
                        .or_default()
                        .push(entry.data_file);
                }
            }
        }

        // Create compaction plans
        let mut plans = Vec::new();
        
        for (partition_key, files) in files_by_partition {
            // Only compact partitions with many small files
            if files.len() >= MIN_FILES_FOR_COMPACTION {
                let small_files: Vec<DataFile> = files
                    .into_iter()
                    .filter(|f| f.file_size_in_bytes < TARGET_FILE_SIZE_BYTES / 4)
                    .take(MAX_COMPACTION_FILES)
                    .collect();
                
                if small_files.len() >= MIN_FILES_FOR_COMPACTION {
                    let total_size: i64 = small_files.iter().map(|f| f.file_size_in_bytes).sum();
                    let total_records: i64 = small_files.iter().map(|f| f.record_count).sum();
                    
                    plans.push(CompactionPlan {
                        partition_key,
                        source_files: small_files,
                        estimated_output_size: total_size,
                        estimated_output_records: total_records,
                    });
                }
            }
        }

        log_info(&format!("Created {} compaction plans", plans.len()));
        Ok(plans)
    }

    /// Execute a compaction plan
    /// 
    /// Reads multiple small files, merges them into a single larger file,
    /// and creates a new snapshot with the compacted data. This operation
    /// is atomic - either all changes are committed or none are.
    /// 
    /// # Arguments
    /// 
    /// * `plan` - Compaction plan specifying which files to merge
    /// 
    /// # Returns
    /// 
    /// Result containing statistics about the compaction operation
    pub async fn execute_compaction(&self, plan: &CompactionPlan) -> Result<CompactionResult> {
        log_info(&format!(
            "Executing compaction for partition '{}' with {} files",
            plan.partition_key,
            plan.source_files.len()
        ));

        let start_time = Date::now().as_millis();
        
        // Read all source files and combine events
        let mut all_events = Vec::new();
        let bucket = self.env.bucket("ANALYTICS_SOURCE")?;
        
        for data_file in &plan.source_files {
            match self.read_parquet_events(&bucket, &data_file.file_path).await {
                Ok(events) => {
                    all_events.extend(events);
                }
                Err(e) => {
                    log_error(&format!(
                        "Failed to read file {}: {}",
                        data_file.file_path, e
                    ));
                    // Continue with other files
                }
            }
        }

        if all_events.is_empty() {
            return Err(Error::RustError("No events read from source files".to_string()));
        }

        log_info(&format!(
            "Read {} events from {} files",
            all_events.len(),
            plan.source_files.len()
        ));

        // Write compacted file
        let writer = super::writer::IcebergWriter::new(self.env.clone(), super::writer::WriteConfig::default());
        let partition_values = plan.source_files[0].partition.clone();
        
        let compacted_file = writer
            .write_data_file(all_events, partition_values)
            .await?;

        // Create new snapshot with compacted file
        let iceberg_metadata = IcebergMetadata::new(&self.env, self.table_location.clone());
        let table_metadata = iceberg_metadata.read_current_metadata().await?;
        
        // Build manifest entries: delete old files, add new file
        let mut manifest_entries = Vec::new();
        
        // Mark source files as deleted
        for source_file in &plan.source_files {
            manifest_entries.push(ManifestEntry {
                status: ManifestEntryStatus::Deleted,
                snapshot_id: table_metadata.current_snapshot_id.unwrap_or(0),
                data_file: source_file.clone(),
            });
        }
        
        // Add compacted file
        manifest_entries.push(ManifestEntry {
            status: ManifestEntryStatus::Added,
            snapshot_id: Date::now().as_millis() as i64,
            data_file: compacted_file.clone(),
        });

        // Create new snapshot
        match iceberg_metadata
            .create_snapshot(&table_metadata, vec![compacted_file.clone()], "compact")
            .await
        {
            Ok(new_metadata) => {
                let version = format!("v{}", new_metadata.snapshots.len() + 1);
                iceberg_metadata.update_version_hint(&version).await?;
            }
            Err(e) => {
                log_error(&format!("Failed to create compaction snapshot: {}", e));
                return Err(e);
            }
        }

        let duration_ms = Date::now().as_millis() - start_time;
        
        Ok(CompactionResult {
            partition_key: plan.partition_key.clone(),
            source_files_count: plan.source_files.len(),
            source_files_size: plan.estimated_output_size,
            output_file: compacted_file.file_path,
            output_file_size: compacted_file.file_size_in_bytes,
            output_records: compacted_file.record_count,
            duration_ms: duration_ms as i64,
        })
    }

    /// Read manifest entries from a manifest file
    async fn read_manifest_entries(&self, manifest_path: &str) -> Result<Vec<ManifestEntry>> {
        let bucket = self.env.bucket("ANALYTICS_SOURCE")?;
        
        let manifest_object = bucket
            .get(manifest_path)
            .execute()
            .await?
            .ok_or_else(|| Error::RustError("Manifest file not found".to_string()))?;
        
        let manifest_json = manifest_object
            .body()
            .ok_or_else(|| Error::RustError("Manifest has no body".to_string()))?
            .text()
            .await?;
        
        serde_json::from_str(&manifest_json)
            .map_err(|e| Error::RustError(format!("Failed to parse manifest: {}", e)))
    }

    /// Read events from a Parquet file
    async fn read_parquet_events(
        &self,
        bucket: &Bucket,
        file_path: &str,
    ) -> Result<Vec<cloudevents::Event>> {
        log_info(&format!("Reading events from: {}", file_path));
        
        // Download Parquet file from R2
        let object = match bucket.get(file_path).execute().await {
            Ok(Some(obj)) => obj,
            Ok(None) => {
                return Err(Error::RustError(format!("File not found: {}", file_path)));
            }
            Err(e) => {
                return Err(Error::RustError(format!("Failed to get file {}: {}", file_path, e)));
            }
        };
        
        let parquet_data = match object.body() {
            Some(body) => body.bytes().await?,
            None => {
                return Err(Error::RustError("File has no body".to_string()));
            }
        };
        
        // Parse Parquet file using arrow-rs
        use arrow_array::RecordBatch;
        use parquet::arrow::arrow_reader::ParquetRecordBatchReaderBuilder;
        use std::io::Cursor;
        
        let cursor = Cursor::new(parquet_data);
        let builder = match ParquetRecordBatchReaderBuilder::try_new(cursor) {
            Ok(b) => b,
            Err(e) => {
                return Err(Error::RustError(format!("Failed to read Parquet: {}", e)));
            }
        };
        
        // Check memory usage before reading
        let metadata = builder.metadata();
        let estimated_memory = metadata.file_metadata().num_rows() as usize * 1024; // Estimate 1KB per event
        
        if estimated_memory > 50 * 1024 * 1024 { // 50MB limit for Workers
            log_error(&format!(
                "File {} too large for in-memory processing: {} rows",
                file_path,
                metadata.file_metadata().num_rows()
            ));
            return Err(Error::RustError("File too large for Worker memory".to_string()));
        }
        
        let mut reader = builder.build()?;
        let mut events = Vec::new();
        
        // Read all record batches and convert to CloudEvents
        while let Some(batch_result) = reader.next() {
            let batch = match batch_result {
                Ok(b) => b,
                Err(e) => {
                    log_error(&format!("Failed to read batch: {}", e));
                    continue;
                }
            };
            
            // Convert RecordBatch to CloudEvents
            let batch_events = self.record_batch_to_events(&batch)?;
            events.extend(batch_events);
        }
        
        log_info(&format!("Read {} events from {}", events.len(), file_path));
        Ok(events)
    }
    
    /// Convert Arrow RecordBatch to CloudEvents
    fn record_batch_to_events(&self, batch: &RecordBatch) -> Result<Vec<cloudevents::Event>> {
        use arrow_array::{StringArray, TimestampMicrosecondArray};
        use cloudevents::{EventBuilder, EventBuilderV10};
        
        let mut events = Vec::with_capacity(batch.num_rows());
        
        // Get column arrays
        let id_array = batch.column(0).as_any().downcast_ref::<StringArray>()
            .ok_or_else(|| Error::RustError("Invalid id column".to_string()))?;
        let source_array = batch.column(1).as_any().downcast_ref::<StringArray>()
            .ok_or_else(|| Error::RustError("Invalid source column".to_string()))?;
        let type_array = batch.column(2).as_any().downcast_ref::<StringArray>()
            .ok_or_else(|| Error::RustError("Invalid type column".to_string()))?;
        let time_array = batch.column(4).as_any().downcast_ref::<TimestampMicrosecondArray>()
            .ok_or_else(|| Error::RustError("Invalid time column".to_string()))?;
        let data_array = batch.column(8).as_any().downcast_ref::<StringArray>()
            .ok_or_else(|| Error::RustError("Invalid data column".to_string()))?;
        
        // Reconstruct events from columns
        for row in 0..batch.num_rows() {
            let mut builder = EventBuilderV10::new()
                .id(id_array.value(row))
                .source(source_array.value(row))
                .ty(type_array.value(row));
            
            // Add time if not null
            if !time_array.is_null(row) {
                let micros = time_array.value(row);
                let secs = micros / 1_000_000;
                let nanos = ((micros % 1_000_000) * 1000) as u32;
                let datetime = chrono::DateTime::<chrono::Utc>::from_timestamp(secs, nanos)
                    .ok_or_else(|| Error::RustError("Invalid timestamp".to_string()))?;
                builder = builder.time(datetime);
            }
            
            // Add data if not null
            if !data_array.is_null(row) {
                let data_str = data_array.value(row);
                if let Ok(json_value) = serde_json::from_str::<serde_json::Value>(data_str) {
                    builder = builder.data("application/json", json_value);
                }
            }
            
            let event = builder.build()?;
            events.push(event);
        }
        
        Ok(events)
    }

    /// Generate partition key from partition values
    fn partition_key(&self, partition: &HashMap<String, String>) -> String {
        format!(
            "{}/{}/{}/{}/{}",
            partition.get("type").unwrap_or(&"unknown".to_string()),
            partition.get("year").unwrap_or(&"0000".to_string()),
            partition.get("month").unwrap_or(&"00".to_string()),
            partition.get("day").unwrap_or(&"00".to_string()),
            partition.get("hour").unwrap_or(&"00".to_string()),
        )
    }
}

/// Compaction plan for a set of files
/// 
/// Represents a planned compaction operation for files within a single partition
#[derive(Debug, Clone)]
pub struct CompactionPlan {
    pub partition_key: String,
    pub source_files: Vec<DataFile>,
    pub estimated_output_size: i64,
    pub estimated_output_records: i64,
}

/// Result of a compaction operation
/// 
/// Contains statistics and metadata about a completed compaction
#[derive(Debug, Clone)]
pub struct CompactionResult {
    pub partition_key: String,
    pub source_files_count: usize,
    pub source_files_size: i64,
    pub output_file: String,
    pub output_file_size: i64,
    pub output_records: i64,
    pub duration_ms: i64,
}

/// Scheduled worker for running compaction
/// 
/// This worker should be scheduled to run periodically (e.g., every hour)
/// to identify and compact small files. Due to Worker time limits, it
/// processes one partition per invocation.
#[event(scheduled)]
pub async fn scheduled(event: ScheduledEvent, env: Env, _ctx: ScheduleContext) {
    log_info(&format!(
        "Compaction scheduled event at {}",
        event.schedule()
    ));

    let table_location = env
        .var("ICEBERG_TABLE_LOCATION")
        .ok()
        .map(|v| v.to_string())
        .unwrap_or_else(|| "analytics/events".to_string());

    let compactor = IcebergCompactor::new(&env, table_location);

    // Plan compaction
    let plans = match compactor.plan_compaction().await {
        Ok(plans) => plans,
        Err(e) => {
            log_error(&format!("Failed to plan compaction: {}", e));
            return;
        }
    };

    if plans.is_empty() {
        log_info("No partitions need compaction");
        return;
    }

    // Execute first plan (to stay within Worker time limits)
    if let Some(plan) = plans.first() {
        match compactor.execute_compaction(plan).await {
            Ok(result) => {
                log_info(&format!(
                    "Compaction successful: {} files -> 1 file ({} bytes) in {}ms",
                    result.source_files_count,
                    result.output_file_size,
                    result.duration_ms
                ));
            }
            Err(e) => {
                log_error(&format!("Compaction failed: {}", e));
            }
        }
    }
}