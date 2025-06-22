use crate::errors::{CollectorError, CollectorResult};
use crate::utils::{log_error, log_info};
use chrono::{Datelike, Timelike, Utc};
use cloudevents::{AttributesReader, Event};
use std::collections::HashMap;
use worker::*;

use super::metadata::{IcebergMetadata, PartitionField};
use super::schema::{IcebergEventSchema, IcebergTableProperties};
use super::writer::{IcebergWriter, WriteConfig};

const DEFAULT_BUFFER_SIZE: usize = 1000; // Balanced for memory efficiency
const DEFAULT_TIMEOUT_MS: i64 = 30_000; // 30 seconds
const MAX_BUFFER_SIZE: usize = 2000; // Conservative limit for Worker memory
const ESTIMATED_EVENT_SIZE: usize = 2048; // Average event size in bytes

/// Iceberg-aware event buffer that writes to Iceberg tables
pub struct IcebergEventBuffer {
    env: Env,
}

impl IcebergEventBuffer {
    pub fn new(env: &Env, _table_location: String) -> Self {
        Self {
            env: env.clone(),
        }
    }

    pub async fn add_events(&self, events: Vec<Event>) -> CollectorResult<()> {
        let request_id = uuid::Uuid::new_v4().to_string();
        let event_count = events.len();
        let estimated_memory = event_count * ESTIMATED_EVENT_SIZE;
        
        log_info(&format!(
            "[{}] Adding {} events to Iceberg buffer (~{} KB)",
            request_id,
            event_count,
            estimated_memory / 1024
        ));
        
        // Check memory constraints before processing
        if estimated_memory > 10 * 1024 * 1024 { // 10MB limit for incoming batch
            return Err(CollectorError::ValidationError(
                format!("Event batch too large: {} events (~{} MB)", event_count, estimated_memory / 1024 / 1024)
            ));
        }

        // Group events by partition
        let partitioned_events = self.partition_events(events);
        
        log_info(&format!(
            "[{}] Partitioned events into {} groups",
            request_id,
            partitioned_events.len()
        ));

        // Get DO binding
        let buffer_do = match self.env.durable_object("ICEBERG_BUFFER_DO") {
            Ok(binding) => binding,
            Err(e) => {
                let error = CollectorError::DurableObjectAccess {
                    name: "ICEBERG_BUFFER_DO".to_string(),
                    source: e,
                };
                crate::errors::log_error_with_context(&error, &request_id);
                return Err(error);
            }
        };

        let total_partitions = partitioned_events.len();
        let mut failures = 0;

        for ((event_type, hour_key), events) in partitioned_events {
            let partition_key = format!("{}/{}", event_type, hour_key);
            log_info(&format!(
                "[{}] Sending {} events to partition '{}'",
                request_id,
                events.len(),
                partition_key
            ));

            // Get DO stub for this partition
            let stub = match buffer_do.id_from_name(&partition_key) {
                Ok(id) => match id.get_stub() {
                    Ok(stub) => stub,
                    Err(e) => {
                        failures += 1;
                        log_error(&format!(
                            "[{}] Failed to get DO stub for partition '{}': {}",
                            request_id, partition_key, e
                        ));
                        continue;
                    }
                },
                Err(e) => {
                    failures += 1;
                    log_error(&format!(
                        "[{}] Failed to get DO ID for partition '{}': {}",
                        request_id, partition_key, e
                    ));
                    continue;
                }
            };

            // Check partition size before sending
            let partition_memory = events.len() * ESTIMATED_EVENT_SIZE;
            if partition_memory > 5 * 1024 * 1024 { // 5MB limit per partition
                log_error(&format!(
                    "[{}] Partition '{}' too large: {} events (~{} MB)",
                    request_id, partition_key, events.len(), partition_memory / 1024 / 1024
                ));
                // Split large partitions into smaller chunks
                for chunk in events.chunks(500) {
                    let chunk_payload = PartitionedEventPayload {
                        events: chunk.to_vec(),
                        partition_key: partition_key.clone(),
                        event_type: event_type.clone(),
                        hour_key: hour_key.clone(),
                    };
                    
                    // Send chunk to DO
                    if let Err(e) = self.send_chunk_to_do(&request_id, &stub, &partition_key, &chunk_payload).await {
                        failures += 1;
                        log_error(&format!("[{}] Failed to send chunk: {}", request_id, e));
                    }
                }
                continue;
            }
            
            // Serialize events with partition info
            let payload = PartitionedEventPayload {
                events,
                partition_key: partition_key.clone(),
                event_type: event_type.clone(),
                hour_key,
            };

            let body = match serde_json::to_string(&payload) {
                Ok(json) => json,
                Err(e) => {
                    failures += 1;
                    log_error(&format!(
                        "[{}] Failed to serialize payload: {}",
                        request_id, e
                    ));
                    continue;
                }
            };

            // Send to DO
            let request = match Request::new_with_init(
                &format!("http://do/{}/", partition_key),
                RequestInit::new()
                    .with_method(Method::Post)
                    .with_body(Some(body.into())),
            ) {
                Ok(req) => req,
                Err(e) => {
                    failures += 1;
                    log_error(&format!(
                        "[{}] Failed to build request for partition '{}': {}",
                        request_id, partition_key, e
                    ));
                    continue;
                }
            };

            match stub.fetch_with_request(request).await {
                Ok(mut response) => {
                    if response.status_code() >= 400 {
                        let error_text = response
                            .text()
                            .await
                            .unwrap_or_else(|_| "Unable to read response".to_string());
                        failures += 1;
                        log_error(&format!(
                            "[{}] DO returned {} for partition '{}': {}",
                            request_id,
                            response.status_code(),
                            partition_key,
                            error_text
                        ));
                    } else {
                        // Consume response body to ensure connection completes
                        match response.text().await {
                            Ok(_) => {
                                log_info(&format!(
                                    "[{}] Successfully sent events to partition '{}'",
                                    request_id, partition_key
                                ));
                            }
                            Err(e) => {
                                log_error(&format!(
                                    "[{}] Failed to read response body for partition '{}': {}",
                                    request_id, partition_key, e
                                ));
                                failures += 1;
                            }
                        }
                    }
                }
                Err(e) => {
                    failures += 1;
                    log_error(&format!(
                        "[{}] Failed to call DO for partition '{}': {}",
                        request_id, partition_key, e
                    ));
                }
            }
        }

        if failures > 0 && failures == total_partitions {
            Err(CollectorError::TooManyFailures {
                count: failures as u32,
            })
        } else {
            Ok(())
        }
    }

    /// Send a chunk of events to a durable object
    async fn send_chunk_to_do(
        &self,
        request_id: &str,
        stub: &Stub,
        partition_key: &str,
        payload: &PartitionedEventPayload,
    ) -> Result<()> {
        let body = serde_json::to_string(payload)
            .map_err(|e| Error::RustError(format!("Failed to serialize payload: {}", e)))?;
            
        let request = Request::new_with_init(
            &format!("http://do/{}/", partition_key),
            RequestInit::new()
                .with_method(Method::Post)
                .with_body(Some(body.into())),
        )?;
        
        let mut response = stub.fetch_with_request(request).await?;
        
        if response.status_code() >= 400 {
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unable to read response".to_string());
            return Err(Error::RustError(format!(
                "DO returned {} for partition '{}': {}",
                response.status_code(),
                partition_key,
                error_text
            )));
        }
        
        // Consume response body to ensure connection completes
        match response.text().await {
            Ok(_) => {
                log_info(&format!(
                    "[{}] Successfully sent chunk to partition '{}'",
                    request_id, partition_key
                ));
                Ok(())
            }
            Err(e) => {
                log_error(&format!(
                    "[{}] Failed to read chunk response body for partition '{}': {}",
                    request_id, partition_key, e
                ));
                Err(Error::RustError(format!(
                    "Failed to read response body: {}",
                    e
                )))
            }
        }
    }

    /// Partition events by type and hour
    fn partition_events(&self, events: Vec<Event>) -> HashMap<(String, String), Vec<Event>> {
        let mut partitioned = HashMap::new();

        for event in events {
            let event_type = event.ty().to_string();
            
            // Get event time or use current time
            let event_time = event
                .time()
                .cloned()
                .unwrap_or_else(|| Utc::now());
            
            // Create hour-based partition key
            let hour_key = format!(
                "{:04}-{:02}-{:02}-{:02}",
                event_time.year(),
                event_time.month(),
                event_time.day(),
                event_time.hour()
            );

            partitioned
                .entry((event_type, hour_key))
                .or_insert_with(Vec::new)
                .push(event);
        }

        partitioned
    }
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
struct PartitionedEventPayload {
    events: Vec<Event>,
    partition_key: String,
    event_type: String,
    hour_key: String,
}

/// Durable Object for buffering events by partition
/// 
/// Memory-efficient design:
/// - Limits buffer size to prevent OOM in Workers
/// - Estimates memory usage and flushes proactively
/// - Chunks large payloads to avoid request size limits
#[durable_object]
pub struct IcebergBufferDurableObject {
    state: State,
    env: Env,
}

#[durable_object]
impl DurableObject for IcebergBufferDurableObject {
    fn new(state: State, env: Env) -> Self {
        Self { state, env }
    }

    async fn fetch(&mut self, req: Request) -> Result<Response> {
        let url = match req.url() {
            Ok(u) => u,
            Err(e) => {
                log_error(&format!("Invalid request URL: {}", e));
                return Response::error("Invalid URL", 400);
            }
        };

        let path = url.path();
        let method = req.method();

        log_info(&format!("Iceberg DO received request: {} {}", method, path));

        match method {
            Method::Post => self.handle_post(req).await,
            Method::Get => self.handle_get().await,
            Method::Delete => self.handle_flush().await,
            _ => Response::error("Method not allowed", 405),
        }
    }

    async fn alarm(&mut self) -> Result<Response> {
        let partition_key = self
            .state
            .storage()
            .get::<String>("partition_key")
            .await
            .ok()
            .unwrap_or_else(|| "unknown".to_string());
        
        log_info(&format!(
            "Iceberg buffer alarm triggered for partition '{}'",
            partition_key
        ));
        
        // Get buffer count before flush
        let buffer_count = self.get_buffer_count().await.unwrap_or(0);
        log_info(&format!(
            "Buffer contains {} events to flush",
            buffer_count
        ));
        
        if buffer_count == 0 {
            log_info("No events to flush, alarm completed");
            return Response::ok("Alarm processed - no events to flush");
        }
        
        match self.flush_to_iceberg().await {
            Ok(files_written) => {
                log_info(&format!(
                    "Alarm flush successful - wrote {} files for {} events",
                    files_written, buffer_count
                ));
                Response::ok(format!("Alarm processed - wrote {} files", files_written))
            }
            Err(e) => {
                log_error(&format!("Failed to flush during alarm: {}", e));
                // Retry later
                match self.state.storage().set_alarm(DEFAULT_TIMEOUT_MS).await {
                    Ok(_) => log_info(&format!(
                        "Retry alarm set for {} ms",
                        DEFAULT_TIMEOUT_MS
                    )),
                    Err(alarm_err) => log_error(&format!(
                        "Failed to set retry alarm: {}",
                        alarm_err
                    )),
                }
                Err(e)
            }
        }
    }
}

impl IcebergBufferDurableObject {
    async fn handle_post(&mut self, mut req: Request) -> Result<Response> {
        // Parse payload
        let payload: PartitionedEventPayload = match req.json().await {
            Ok(p) => p,
            Err(e) => {
                log_error(&format!("Failed to parse payload: {}", e));
                return Response::error("Invalid payload", 400);
            }
        };

        log_info(&format!(
            "Received {} events for partition '{}'",
            payload.events.len(),
            payload.partition_key
        ));

        // Store partition metadata
        match self.state.storage().put("partition_key", &payload.partition_key).await {
            Ok(_) => {}
            Err(e) => log_error(&format!("Failed to store partition key: {}", e)),
        }

        // Load existing buffer
        let mut buffered_events = match self
            .state
            .storage()
            .get::<Vec<Event>>("buffered_events")
            .await
        {
            Ok(evts) => evts,
            Err(_) => Vec::new(),
        };

        let initial_count = buffered_events.len();
        let new_events_count = payload.events.len();
        
        // Check if we would exceed buffer limits before adding
        let potential_buffer_size = initial_count + new_events_count;
        let estimated_buffer_memory = potential_buffer_size * ESTIMATED_EVENT_SIZE;
        
        if potential_buffer_size > MAX_BUFFER_SIZE {
            return Response::error(
                format!("Buffer would exceed maximum size of {} events", MAX_BUFFER_SIZE),
                507,
            );
        }
        
        if estimated_buffer_memory > 20 * 1024 * 1024 { // 20MB hard limit
            log_error(&format!(
                "Buffer memory limit exceeded: {} events (~{} MB)",
                potential_buffer_size,
                estimated_buffer_memory / 1024 / 1024
            ));
            // Force flush before accepting more events
            match self.flush_to_iceberg().await {
                Ok(_) => {},
                Err(e) => {
                    return Response::error(
                        format!("Buffer full and flush failed: {}", e),
                        507,
                    );
                }
            }
            // After flush, start with just the new events
            buffered_events = payload.events;
        } else {
            // Normal case: add events to existing buffer
            buffered_events.extend(payload.events);
        }

        // Save updated buffer
        match self
            .state
            .storage()
            .put("buffered_events", &buffered_events)
            .await
        {
            Ok(_) => {}
            Err(e) => {
                log_error(&format!("Failed to save buffer: {}", e));
                return Response::error("Failed to buffer events", 500);
            }
        }

        // Check if we should flush
        let threshold = self.get_buffer_threshold();
        if buffered_events.len() >= threshold {
            log_info(&format!(
                "Buffer size {} reached threshold {}, flushing to Iceberg",
                buffered_events.len(),
                threshold
            ));
            match self.flush_to_iceberg().await {
                Ok(files_written) => {
                    Response::ok(format!(
                        "Events buffered and flushed ({} files written)",
                        files_written
                    ))
                }
                Err(e) => {
                    log_error(&format!("Auto-flush failed: {}", e));
                    Response::ok("Events buffered (flush failed)")
                }
            }
        } else {
            // Set alarm for future flush
            match self.set_flush_alarm().await {
                Ok(_) => {
                    log_info(&format!(
                        "Alarm set for flush in {} ms",
                        self.env
                            .var("ICEBERG_BUFFER_TIMEOUT_MS")
                            .ok()
                            .and_then(|v| v.to_string().parse::<i64>().ok())
                            .unwrap_or(DEFAULT_TIMEOUT_MS)
                    ));
                }
                Err(e) => log_error(&format!("Failed to set alarm: {}", e)),
            }
            Response::ok(format!(
                "Events buffered ({} -> {})",
                initial_count,
                buffered_events.len()
            ))
        }
    }

    async fn handle_get(&self) -> Result<Response> {
        let partition_key = self
            .state
            .storage()
            .get::<String>("partition_key")
            .await
            .ok();
        let buffer_count = self.get_buffer_count().await.unwrap_or(0);
        
        let table_location = self.get_table_location();

        let status = serde_json::json!({
            "partition_key": partition_key,
            "buffered_count": buffer_count,
            "max_buffer_size": MAX_BUFFER_SIZE,
            "buffer_threshold": self.get_buffer_threshold(),
            "table_location": table_location,
        });

        Response::ok(status.to_string())
    }

    async fn handle_flush(&mut self) -> Result<Response> {
        let event_count = match self.get_buffer_count().await {
            Ok(count) => count,
            Err(e) => {
                return Response::error(format!("Failed to check buffer: {}", e), 500);
            }
        };

        if event_count == 0 {
            return Response::ok(
                serde_json::json!({
                    "status": "no_events",
                    "message": "No events to flush"
                })
                .to_string(),
            );
        }

        match self.flush_to_iceberg().await {
            Ok(files_written) => Response::ok(
                serde_json::json!({
                    "status": "flushed",
                    "message": format!("Successfully wrote {} events to {} Iceberg files", event_count, files_written)
                })
                .to_string(),
            ),
            Err(e) => {
                log_error(&format!("Manual flush failed: {}", e));
                Response::error(format!("Flush failed: {}", e), 500)
            }
        }
    }

    async fn flush_to_iceberg(&mut self) -> Result<usize> {
        // Load events
        let buffered_events = match self
            .state
            .storage()
            .get::<Vec<Event>>("buffered_events")
            .await
        {
            Ok(evts) => evts,
            Err(_) => return Ok(0),
        };

        if buffered_events.is_empty() {
            return Ok(0);
        }

        let partition_key = match self.state.storage().get::<String>("partition_key").await {
            Ok(key) => key,
            Err(_) => {
                log_error("Cannot flush: partition key not set");
                return Err(worker::Error::RustError("Partition key not set".to_string()));
            }
        };

        log_info(&format!(
            "Starting Iceberg flush of {} events for partition '{}'",
            buffered_events.len(),
            partition_key
        ));

        // Initialize Iceberg components
        let table_location = self.get_table_location();
        let iceberg_writer = IcebergWriter::new(self.env.clone(), WriteConfig::default());
        let iceberg_metadata = IcebergMetadata::new(&self.env, table_location.clone());

        // Ensure table exists
        let table_metadata = match self.ensure_table_exists(&iceberg_metadata).await {
            Ok(metadata) => metadata,
            Err(e) => {
                log_error(&format!("Failed to ensure table exists: {}", e));
                return Err(e);
            }
        };

        // Extract partition values from first event
        let partition_values = self.extract_partition_values(&buffered_events[0]);

        // Write data file
        let data_file = match iceberg_writer
            .write_data_file(buffered_events.clone(), partition_values)
            .await
        {
            Ok(file) => file,
            Err(e) => {
                log_error(&format!("Failed to write Iceberg data file: {}", e));
                return Err(e);
            }
        };

        // Create new snapshot
        match iceberg_metadata
            .create_snapshot(&table_metadata, vec![data_file], "append")
            .await
        {
            Ok(new_metadata) => {
                // Update version hint
                let version = format!("v{}", new_metadata.snapshots.len() + 1);
                match iceberg_metadata.update_version_hint(&version).await {
                    Ok(_) => log_info(&format!("Updated version hint to {}", version)),
                    Err(e) => log_error(&format!("Failed to update version hint: {}", e)),
                }
            }
            Err(e) => {
                log_error(&format!("Failed to create snapshot: {}", e));
                return Err(e);
            }
        }

        // Clear buffer
        match self
            .state
            .storage()
            .put("buffered_events", &Vec::<Event>::new())
            .await
        {
            Ok(_) => {}
            Err(e) => {
                log_error(&format!("Failed to clear buffer after flush: {}", e));
            }
        }

        Ok(1) // Number of files written
    }

    async fn ensure_table_exists(
        &self,
        iceberg_metadata: &IcebergMetadata,
    ) -> Result<super::metadata::TableMetadata> {
        // Try to read existing metadata
        match iceberg_metadata.read_current_metadata().await {
            Ok(metadata) => Ok(metadata),
            Err(_) => {
                // Table doesn't exist, create it
                log_info("Creating new Iceberg table for analytics events");
                
                let schema = IcebergEventSchema::create_event_schema();
                let schema_json = serde_json::json!({
                    "type": "struct",
                    "fields": schema.fields().iter().map(|f| {
                        serde_json::json!({
                            "id": f.name(),
                            "name": f.name(),
                            "required": !f.is_nullable(),
                            "type": format!("{:?}", f.data_type()).to_lowercase()
                        })
                    }).collect::<Vec<_>>()
                });

                let partition_spec = vec![
                    PartitionField {
                        source_id: 2, // type field
                        field_id: 1000,
                        name: "type".to_string(),
                        transform: "identity".to_string(),
                    },
                    PartitionField {
                        source_id: 20, // year field
                        field_id: 1001,
                        name: "year".to_string(),
                        transform: "identity".to_string(),
                    },
                    PartitionField {
                        source_id: 21, // month field
                        field_id: 1002,
                        name: "month".to_string(),
                        transform: "identity".to_string(),
                    },
                    PartitionField {
                        source_id: 22, // day field
                        field_id: 1003,
                        name: "day".to_string(),
                        transform: "identity".to_string(),
                    },
                    PartitionField {
                        source_id: 23, // hour field
                        field_id: 1004,
                        name: "hour".to_string(),
                        transform: "identity".to_string(),
                    },
                ];

                let properties = IcebergTableProperties::default_properties();

                iceberg_metadata
                    .create_table("analytics_events", schema_json, partition_spec, properties)
                    .await
            }
        }
    }

    fn extract_partition_values(&self, event: &Event) -> HashMap<String, String> {
        let mut values = HashMap::new();
        
        values.insert("type".to_string(), event.ty().to_string());
        
        let event_time = event.time().cloned().unwrap_or_else(|| Utc::now());
        values.insert("year".to_string(), event_time.year().to_string());
        values.insert("month".to_string(), format!("{:02}", event_time.month()));
        values.insert("day".to_string(), format!("{:02}", event_time.day()));
        values.insert("hour".to_string(), format!("{:02}", event_time.hour()));
        
        values
    }

    async fn get_buffer_count(&self) -> Result<usize> {
        match self
            .state
            .storage()
            .get::<Vec<Event>>("buffered_events")
            .await
        {
            Ok(events) => Ok(events.len()),
            Err(_) => Ok(0),
        }
    }

    fn get_buffer_threshold(&self) -> usize {
        self.env
            .var("ICEBERG_BUFFER_SIZE")
            .ok()
            .and_then(|v| v.to_string().parse::<usize>().ok())
            .unwrap_or(DEFAULT_BUFFER_SIZE)
            .min(MAX_BUFFER_SIZE)
    }

    fn get_table_location(&self) -> String {
        self.env
            .var("ICEBERG_TABLE_LOCATION")
            .ok()
            .map(|v| v.to_string())
            .unwrap_or_else(|| "analytics/events".to_string())
    }

    async fn set_flush_alarm(&self) -> Result<()> {
        let timeout_ms = self
            .env
            .var("ICEBERG_BUFFER_TIMEOUT_MS")
            .ok()
            .and_then(|v| v.to_string().parse::<i64>().ok())
            .unwrap_or(DEFAULT_TIMEOUT_MS);

        log_info(&format!(
            "Setting alarm with timeout: {} ms (parsed from env var or using default)",
            timeout_ms
        ));

        match self.state.storage().set_alarm(timeout_ms).await {
            Ok(_) => {
                log_info(&format!("Alarm successfully set for {} ms from now", timeout_ms));
                Ok(())
            }
            Err(e) => {
                log_error(&format!("Failed to set alarm: {}", e));
                Err(e)
            }
        }
    }
}