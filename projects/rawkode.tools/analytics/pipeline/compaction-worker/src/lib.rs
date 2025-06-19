use arrow_schema::Schema;
use chrono::Utc;
use futures::{future::join_all, TryStreamExt};
use parquet::arrow::{ArrowWriter, ParquetRecordBatchStreamBuilder};
use parquet::file::properties::WriterProperties;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use worker::*;
use regex::Regex;
use std::io::Cursor;

struct CompactionCandidate {
    partition_path: String,
    files: Vec<Object>,
    total_size_bytes: u64,
}

#[derive(Debug, Serialize, Deserialize)]
struct CompactionResponse {
    success: bool,
    candidates_found: usize,
    partitions_compacted: usize,
}

#[derive(Debug, Serialize, Deserialize)]
struct CandidatesResponse {
    candidates: Vec<CandidateInfo>,
}

#[derive(Debug, Serialize, Deserialize)]
struct CandidateInfo {
    partition: String,
    file_count: usize,
    total_size_mb: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct ErrorResponse {
    error: String,
}

async fn merge_parquet_files(
    bucket: &Bucket,
    files: &[Object],
    output_key: &str,
) -> Result<()> {
    if files.is_empty() {
        return Ok(());
    }

    let mut all_batches = Vec::new();
    let mut schema: Option<Arc<Schema>> = None;

    // Read all files and collect record batches
    for file in files {
        if let Some(object) = bucket.get(file.key()).execute().await? {
            let body = object.body().ok_or_else(|| Error::RustError("Object has no body".to_string()))?;
            let bytes = body.bytes().await?;
            
            let builder = ParquetRecordBatchStreamBuilder::new(Cursor::new(bytes))
                .await
                .map_err(|e| Error::RustError(format!("Failed to create parquet reader: {}", e)))?;
            
            if schema.is_none() {
                schema = Some(builder.schema().clone());
            }
            
            let mut stream = builder.build()
                .map_err(|e| Error::RustError(format!("Failed to build stream: {}", e)))?;
            
            loop {
                match stream.try_next().await {
                    Ok(Some(batch)) => all_batches.push(batch),
                    Ok(None) => break,
                    Err(e) => return Err(Error::RustError(format!("Failed to read batch: {}", e))),
                }
            }
        }
    }

    if all_batches.is_empty() || schema.is_none() {
        return Ok(());
    }

    // Write merged file
    let schema = schema.unwrap();
    let props = WriterProperties::builder().build();
    let mut buffer = Vec::new();
    
    {
        let mut writer = ArrowWriter::try_new(&mut buffer, schema.clone(), Some(props))
            .map_err(|e| Error::RustError(format!("Failed to create writer: {}", e)))?;
        
        for batch in all_batches.iter() {
            writer.write(batch)
                .map_err(|e| Error::RustError(format!("Failed to write batch: {}", e)))?;
        }
        
        writer.close()
            .map_err(|e| Error::RustError(format!("Failed to close writer: {}", e)))?;
    }

    // Upload merged file with metadata
    let mut metadata = HashMap::new();
    metadata.insert("eventCount".to_string(), all_batches.len().to_string());
    metadata.insert("sourceFiles".to_string(), files.len().to_string());
    metadata.insert("compactedAt".to_string(), Utc::now().to_rfc3339());

    bucket.put(output_key, buffer)
        .custom_metadata(metadata)
        .execute()
        .await?;

    // Delete original files
    let delete_futures: Vec<_> = files.iter()
        .map(|file| bucket.delete(file.key()))
        .collect();
    
    join_all(delete_futures).await;

    Ok(())
}

async fn find_compaction_candidates(
    bucket: &Bucket,
    threshold_bytes: u64,
) -> Result<Vec<CompactionCandidate>> {
    let mut candidates: HashMap<String, CompactionCandidate> = HashMap::new();
    let mut cursor: Option<String> = None;

    loop {
        let mut list_options = bucket.list()
            .prefix("events/");
        
        if let Some(c) = cursor {
            list_options = list_options.cursor(c);
        }

        let listed = list_options.execute().await?;

        // Group files by partition
        for object in listed.objects() {
            let key = object.key();
            
            // Extract partition path
            let regex = Regex::new(r"^(events/[^/]+/year=\d+/month=\d+/day=\d+/hour=\d+)/").unwrap();
            if let Some(captures) = regex.captures(&key) {
                let partition_path = captures.get(1).unwrap().as_str().to_string();
                
                // Only consider files smaller than threshold for compaction
                if (object.size() as u64) < threshold_bytes {
                    let candidate = candidates.entry(partition_path.clone())
                        .or_insert_with(|| CompactionCandidate {
                            partition_path,
                            files: Vec::new(),
                            total_size_bytes: 0,
                        });
                    
                    let size = object.size() as u64;
                    candidate.files.push(object);
                    candidate.total_size_bytes += size;
                }
            }
        }

        if listed.truncated() {
            cursor = listed.cursor().map(|s| s.to_string());
        } else {
            break;
        }
    }

    // Filter to partitions with multiple small files
    Ok(candidates.into_values()
        .filter(|c| c.files.len() > 1)
        .collect())
}

async fn compact_partition(
    bucket: &Bucket,
    candidate: CompactionCandidate,
    target_size_bytes: u64,
) -> Result<()> {
    // Sort files by name to ensure consistent ordering
    let mut files = candidate.files;
    files.sort_by(|a, b| a.key().cmp(&b.key()));

    // Group files into batches that don't exceed target size
    let mut batches: Vec<Vec<Object>> = Vec::new();
    let mut current_batch: Vec<Object> = Vec::new();
    let mut current_batch_size: u64 = 0;

    for file in files {
        if current_batch_size + file.size() as u64 > target_size_bytes && !current_batch.is_empty() {
            batches.push(current_batch);
            current_batch = Vec::new();
            current_batch_size = 0;
        }

        current_batch_size += file.size() as u64;
        current_batch.push(file);
    }

    if current_batch.len() > 1 {
        batches.push(current_batch);
    }

    // Compact each batch
    for batch in batches {
        let timestamp = Utc::now().timestamp_millis();
        let uuid = uuid::Uuid::new_v4();
        let output_key = format!("{}/compacted_{}_{}.parquet", 
            candidate.partition_path, timestamp, uuid);

        match merge_parquet_files(bucket, &batch, &output_key).await {
            Ok(_) => {
                console_log!("Compacted {} files into {}", batch.len(), output_key);
            }
            Err(e) => {
                console_log!("Failed to compact batch in {}: {:?}", 
                    candidate.partition_path, e);
            }
        }
    }

    Ok(())
}

#[event(fetch)]
pub async fn main(req: Request, env: Env, _ctx: worker::Context) -> Result<Response> {
    console_error_panic_hook::set_once();
    
    let router = Router::new();

    router
        .post_async("/compact", |_req, ctx| async move {
            let bucket = ctx.bucket("ANALYTICS_SOURCE")?;
            let threshold_mb: f64 = ctx.var("COMPACTION_THRESHOLD_MB")
                .map(|s| s.to_string())
                .unwrap_or_else(|_| "10".to_string())
                .parse()
                .unwrap_or(10.0);
            let target_mb: f64 = ctx.var("COMPACTION_TARGET_MB")
                .map(|s| s.to_string())
                .unwrap_or_else(|_| "100".to_string())
                .parse()
                .unwrap_or(100.0);

            let threshold_bytes = (threshold_mb * 1024.0 * 1024.0) as u64;
            let target_bytes = (target_mb * 1024.0 * 1024.0) as u64;

            match find_compaction_candidates(&bucket, threshold_bytes).await {
                Ok(candidates) => {
                    let candidates_count = candidates.len();
                    let mut compacted_count = 0;
                    
                    for candidate in candidates {
                        if let Err(e) = compact_partition(&bucket, candidate, target_bytes).await {
                            console_log!("Error compacting partition: {:?}", e);
                        } else {
                            compacted_count += 1;
                        }
                    }

                    Response::from_json(&CompactionResponse {
                        success: true,
                        candidates_found: candidates_count,
                        partitions_compacted: compacted_count,
                    })
                }
                Err(e) => {
                    console_log!("Compaction error: {:?}", e);
                    Ok(Response::from_json(&ErrorResponse {
                        error: "Compaction failed".to_string(),
                    })?.with_status(500))
                }
            }
        })
        .get_async("/compact/candidates", |_req, ctx| async move {
            let bucket = ctx.bucket("ANALYTICS_SOURCE")?;
            let threshold_mb: f64 = ctx.var("COMPACTION_THRESHOLD_MB")
                .map(|s| s.to_string())
                .unwrap_or_else(|_| "10".to_string())
                .parse()
                .unwrap_or(10.0);

            let threshold_bytes = (threshold_mb * 1024.0 * 1024.0) as u64;

            match find_compaction_candidates(&bucket, threshold_bytes).await {
                Ok(candidates) => {
                    let candidates_info: Vec<CandidateInfo> = candidates.iter()
                        .map(|c| CandidateInfo {
                            partition: c.partition_path.clone(),
                            file_count: c.files.len(),
                            total_size_mb: format!("{:.2}", 
                                c.total_size_bytes as f64 / 1024.0 / 1024.0),
                        })
                        .collect();

                    Response::from_json(&CandidatesResponse {
                        candidates: candidates_info,
                    })
                }
                Err(e) => {
                    console_log!("Error finding candidates: {:?}", e);
                    Ok(Response::from_json(&ErrorResponse {
                        error: "Failed to find candidates".to_string(),
                    })?.with_status(500))
                }
            }
        })
        .run(req, env)
        .await
}

#[event(scheduled)]
pub async fn scheduled(_event: ScheduledEvent, env: Env, _ctx: ScheduleContext) {
    let bucket = match env.bucket("ANALYTICS_SOURCE") {
        Ok(b) => b,
        Err(e) => {
            console_log!("Failed to get R2 bucket: {:?}", e);
            return;
        }
    };

    let threshold_mb: f64 = env.var("COMPACTION_THRESHOLD_MB")
        .map(|s| s.to_string())
        .unwrap_or_else(|_| "10".to_string())
        .parse()
        .unwrap_or(10.0);
    let target_mb: f64 = env.var("COMPACTION_TARGET_MB")
        .map(|s| s.to_string())
        .unwrap_or_else(|_| "100".to_string())
        .parse()
        .unwrap_or(100.0);

    let threshold_bytes = (threshold_mb * 1024.0 * 1024.0) as u64;
    let target_bytes = (target_mb * 1024.0 * 1024.0) as u64;

    match find_compaction_candidates(&bucket, threshold_bytes).await {
        Ok(candidates) => {
            let candidates_count = candidates.len();
            for candidate in candidates {
                if let Err(e) = compact_partition(&bucket, candidate, target_bytes).await {
                    console_log!("Error compacting partition: {:?}", e);
                }
            }
            
            console_log!("Compaction completed: {} partitions processed", candidates_count);
        }
        Err(e) => {
            console_log!("Scheduled compaction error: {:?}", e);
        }
    }
}