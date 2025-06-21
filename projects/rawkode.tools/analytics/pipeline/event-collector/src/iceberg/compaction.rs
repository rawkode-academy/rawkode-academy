use crate::utils::{log_error, log_info};
use std::collections::HashMap;
use worker::*;

use super::metadata::{DataFile, IcebergMetadata, ManifestEntry, ManifestEntryStatus};

const MIN_FILES_FOR_COMPACTION: usize = 10;
const TARGET_FILE_SIZE_BYTES: i64 = 128 * 1024 * 1024; // 128MB
const MAX_COMPACTION_FILES: usize = 50; // Limit for Worker memory

/// Iceberg compaction strategy for Workers
pub struct IcebergCompactor {
    env: Env,
    table_location: String,
}

impl IcebergCompactor {
    pub fn new(env: &Env, table_location: String) -> Self {
        Self {
            env: env.clone(),
            table_location,
        }
    }

    /// Identify files that need compaction
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

    /// Execute a compaction plan (to be called by a scheduled worker)
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
        _bucket: &Bucket,
        file_path: &str,
    ) -> Result<Vec<cloudevents::Event>> {
        // In a real implementation, this would:
        // 1. Download the Parquet file from R2
        // 2. Use arrow-rs to read the file
        // 3. Convert rows back to CloudEvents
        // 
        // For Workers memory constraints, we might need to stream process
        // or use a separate compaction worker with more memory
        
        log_info(&format!("Would read events from: {}", file_path));
        
        // Placeholder - in production, implement proper Parquet reading
        Ok(Vec::new())
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
#[derive(Debug, Clone)]
pub struct CompactionPlan {
    pub partition_key: String,
    pub source_files: Vec<DataFile>,
    pub estimated_output_size: i64,
    pub estimated_output_records: i64,
}

/// Result of a compaction operation
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