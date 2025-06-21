use crate::errors::{CollectorError, CollectorResult};
use crate::parquet_writer::ParquetWriter;
use crate::utils::{log_error, log_info};
use cloudevents::{AttributesReader, Event};
use std::collections::HashMap;
use worker::*;

const DEFAULT_BUFFER_SIZE: usize = 1000;
const DEFAULT_TIMEOUT_MS: i64 = 60_000;
const MAX_BUFFER_SIZE: usize = 10_000;

pub struct EventBuffer {
    env: Env,
}

impl EventBuffer {
    pub fn new(env: &Env) -> Self {
        Self { env: env.clone() }
    }

    pub async fn add_events(&self, events: Vec<Event>) -> CollectorResult<()> {
        let request_id = uuid::Uuid::new_v4().to_string();
        log_info(&format!(
            "[{}] Adding {} events to buffer",
            request_id,
            events.len()
        ));

        // Group events by type
        let mut events_by_type: HashMap<String, Vec<Event>> = HashMap::new();
        for event in events {
            events_by_type
                .entry(event.ty().to_string())
                .or_default()
                .push(event);
        }

        log_info(&format!(
            "[{}] Grouped events into {} types",
            request_id,
            events_by_type.len()
        ));

        // Get DO binding with explicit error handling
        let buffer_do = match self.env.durable_object("EVENT_BUFFER_DO") {
            Ok(binding) => binding,
            Err(e) => {
                let error = CollectorError::DurableObjectAccess {
                    name: "EVENT_BUFFER_DO".to_string(),
                    source: e,
                };
                crate::errors::log_error_with_context(&error, &request_id);
                return Err(error);
            }
        };

        let total_event_types = events_by_type.len();
        let mut failures = 0;
        for (event_type, typed_events) in events_by_type {
            log_info(&format!(
                "[{}] Sending {} events of type '{}' to DO",
                request_id,
                typed_events.len(),
                event_type
            ));

            // Get DO stub with explicit error handling
            let stub = match buffer_do.id_from_name(&event_type) {
                Ok(id) => match id.get_stub() {
                    Ok(stub) => stub,
                    Err(e) => {
                        failures += 1;
                        log_error(&format!(
                            "[{}] Failed to get DO stub for type '{}': {}",
                            request_id, event_type, e
                        ));
                        continue; // Try other event types
                    }
                },
                Err(e) => {
                    failures += 1;
                    log_error(&format!(
                        "[{}] Failed to get DO ID for type '{}': {}",
                        request_id, event_type, e
                    ));
                    continue;
                }
            };

            // Serialize events
            let body = match serde_json::to_string(&typed_events) {
                Ok(json) => json,
                Err(e) => {
                    failures += 1;
                    log_error(&format!(
                        "[{}] Failed to serialize {} events: {}",
                        request_id,
                        typed_events.len(),
                        e
                    ));
                    continue;
                }
            };

            // Build request
            let request = match Request::new_with_init(
                &format!("http://do/{}/", event_type),
                RequestInit::new()
                    .with_method(Method::Post)
                    .with_body(Some(body.into())),
            ) {
                Ok(req) => req,
                Err(e) => {
                    failures += 1;
                    log_error(&format!(
                        "[{}] Failed to build request for type '{}': {}",
                        request_id, event_type, e
                    ));
                    continue;
                }
            };

            // Send to DO
            match stub.fetch_with_request(request).await {
                Ok(mut response) => {
                    if response.status_code() >= 400 {
                        let error_text = response
                            .text()
                            .await
                            .unwrap_or_else(|_| "Unable to read response".to_string());
                        failures += 1;
                        log_error(&format!(
                            "[{}] DO returned {} for type '{}': {}",
                            request_id,
                            response.status_code(),
                            event_type,
                            error_text
                        ));
                    } else {
                        // Consume the response body to ensure the connection completes
                        let _ = response.text().await;
                        log_info(&format!(
                            "[{}] Successfully sent events to DO for type '{}'",
                            request_id, event_type
                        ));
                    }
                }
                Err(e) => {
                    failures += 1;
                    log_error(&format!(
                        "[{}] Failed to call DO for type '{}': {}",
                        request_id, event_type, e
                    ));
                }
            }
        }

        // Return error if all attempts failed
        if failures > 0 && failures == total_event_types {
            Err(CollectorError::TooManyFailures {
                count: failures as u32,
            })
        } else {
            Ok(())
        }
    }
}

// Durable Object implementation with robust error handling
#[durable_object]
pub struct EventBufferDurableObject {
    state: State,
    env: Env,
}

#[durable_object]
impl DurableObject for EventBufferDurableObject {
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

        log_info(&format!("DO received request: {} {}", method, path));

        // Extract event type safely
        let path_parts: Vec<&str> = path.trim_start_matches('/').split('/').collect();
        let event_type = match path_parts.first() {
            Some(et) if !et.is_empty() => et.to_string(),
            _ => {
                log_error("No event type provided in path");
                return Response::error("Event type required", 400);
            }
        };

        // Initialize event type if needed
        match self.ensure_event_type(&event_type).await {
            Ok(_) => {}
            Err(e) => {
                log_error(&format!("Failed to initialize event type: {}", e));
                // Continue anyway - not critical
            }
        }

        match method {
            Method::Post => self.handle_post(req, &event_type).await,
            Method::Get => self.handle_get().await,
            Method::Delete => self.handle_delete().await,
            _ => Response::error("Method not allowed", 405),
        }
    }

    async fn alarm(&mut self) -> Result<Response> {
        // Get event type with proper error handling
        let event_type = match self.get_event_type().await {
            Ok(Some(et)) => et,
            Ok(None) => {
                let do_id = self.state.id().to_string();
                log_error(&format!(
                    "Alarm triggered for DO {} with no event type",
                    do_id
                ));
                // Clear alarm to prevent loops
                let _ = self.state.storage().delete_alarm().await;
                return Response::ok("Alarm cleared - no event type");
            }
            Err(e) => {
                log_error(&format!("Failed to get event type during alarm: {}", e));
                // Retry later
                let _ = self.state.storage().set_alarm(DEFAULT_TIMEOUT_MS).await;
                return Response::error("Storage error", 500);
            }
        };

        log_info(&format!("Alarm triggered for event type: {}", event_type));

        // Get buffered events count
        let event_count = match self.get_buffer_count().await {
            Ok(count) => count,
            Err(e) => {
                log_error(&format!("Failed to get buffer count: {}", e));
                // Retry later
                let _ = self.state.storage().set_alarm(DEFAULT_TIMEOUT_MS).await;
                return Response::error("Storage error", 500);
            }
        };

        if event_count > 0 {
            log_info(&format!("Flushing {} buffered events", event_count));
            match self.flush().await {
                Ok(_) => Response::ok("Alarm processed - events flushed"),
                Err(e) => {
                    log_error(&format!("Failed to flush during alarm: {}", e));
                    // Retry later
                    let _ = self.state.storage().set_alarm(DEFAULT_TIMEOUT_MS).await;
                    Err(e)
                }
            }
        } else {
            Response::ok("Alarm processed - no events to flush")
        }
    }
}

impl EventBufferDurableObject {
    async fn ensure_event_type(&mut self, event_type: &str) -> Result<()> {
        match self.state.storage().get::<String>("event_type").await {
            Ok(_) => Ok(()), // Already set
            Err(_) => {
                // Not set, initialize it
                self.state.storage().put("event_type", event_type).await?;
                log_info(&format!("DO initialized for event type: {}", event_type));
                Ok(())
            }
        }
    }

    async fn get_event_type(&self) -> Result<Option<String>> {
        match self.state.storage().get::<String>("event_type").await {
            Ok(val) => Ok(Some(val)),
            Err(_) => Ok(None), // Key doesn't exist
        }
    }

    async fn get_buffer_count(&self) -> Result<usize> {
        match self
            .state
            .storage()
            .get::<Vec<Event>>("buffered_events")
            .await
        {
            Ok(events) => Ok(events.len()),
            Err(_) => Ok(0), // Key doesn't exist
        }
    }

    async fn handle_post(&mut self, mut req: Request, event_type: &str) -> Result<Response> {
        // Parse body
        let body = match req.text().await {
            Ok(text) => text,
            Err(e) => {
                log_error(&format!("Failed to read request body: {}", e));
                return Response::error("Failed to read body", 400);
            }
        };

        // Parse events
        let events: Vec<Event> = match serde_json::from_str(&body) {
            Ok(evts) => evts,
            Err(e) => {
                log_error(&format!("Failed to parse events: {}", e));
                return Response::error("Invalid event data", 400);
            }
        };

        log_info(&format!(
            "DO received {} events for type '{}'",
            events.len(),
            event_type
        ));

        // Load and update buffer
        let mut buffered_events = match self
            .state
            .storage()
            .get::<Vec<Event>>("buffered_events")
            .await
        {
            Ok(evts) => evts,
            Err(_) => Vec::new(), // Key doesn't exist yet
        };

        let initial_count = buffered_events.len();
        buffered_events.extend(events);

        // Check buffer limits
        if buffered_events.len() > MAX_BUFFER_SIZE {
            return Response::error(
                format!("Buffer would exceed maximum size of {}", MAX_BUFFER_SIZE),
                507, // Insufficient Storage
            );
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
                "Buffer size {} reached threshold {}, flushing",
                buffered_events.len(),
                threshold
            ));
            match self.flush().await {
                Ok(_) => Response::ok("Events buffered and flushed"),
                Err(e) => {
                    log_error(&format!("Auto-flush failed: {}", e));
                    // Events are still buffered, so this is not a complete failure
                    Response::ok("Events buffered (flush failed)")
                }
            }
        } else {
            // Set alarm for future flush
            match self.set_flush_alarm().await {
                Ok(_) => {}
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
        let event_type = self.get_event_type().await.ok().flatten();
        let buffer_count = self.get_buffer_count().await.unwrap_or(0);

        let status = serde_json::json!({
            "event_type": event_type,
            "buffered_count": buffer_count,
            "max_buffer_size": MAX_BUFFER_SIZE,
            "buffer_threshold": self.get_buffer_threshold(),
        });

        Response::ok(status.to_string())
    }

    async fn handle_delete(&mut self) -> Result<Response> {
        let event_type = self.get_event_type().await.ok().flatten();
        log_info(&format!(
            "Manual flush requested for event type: {:?}",
            event_type
        ));

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

        match self.flush().await {
            Ok(_) => Response::ok(
                serde_json::json!({
                    "status": "flushed",
                    "message": format!("Successfully flushed {} events", event_count)
                })
                .to_string(),
            ),
            Err(e) => {
                log_error(&format!("Manual flush failed: {}", e));
                Response::error(format!("Flush failed: {}", e), 500)
            }
        }
    }

    async fn flush(&mut self) -> Result<()> {
        // Load events
        let mut buffered_events = match self
            .state
            .storage()
            .get::<Vec<Event>>("buffered_events")
            .await
        {
            Ok(evts) => evts,
            Err(_) => return Ok(()), // No events to flush
        };

        if buffered_events.is_empty() {
            return Ok(());
        }

        // Get event type
        let event_type = match self.get_event_type().await {
            Ok(Some(et)) => et,
            Ok(None) => {
                log_error("Cannot flush: event type not set");
                return Err(worker::Error::RustError("Event type not set".to_string()));
            }
            Err(e) => {
                log_error(&format!("Failed to get event type for flush: {}", e));
                return Err(e);
            }
        };

        log_info(&format!(
            "Starting flush of {} events for type '{}'",
            buffered_events.len(),
            event_type
        ));

        // Write to R2
        let writer = ParquetWriter::new(&self.env);
        let events_to_write = buffered_events.clone();

        match writer
            .write_events_to_r2(&events_to_write, &event_type)
            .await
        {
            Ok(_) => {
                log_info(&format!(
                    "Successfully wrote {} events to R2",
                    events_to_write.len()
                ));

                // Clear buffer
                buffered_events.clear();
                match self
                    .state
                    .storage()
                    .put("buffered_events", &buffered_events)
                    .await
                {
                    Ok(_) => {}
                    Err(e) => {
                        log_error(&format!("Failed to clear buffer after flush: {}", e));
                        // This is bad - we've written to R2 but can't clear the buffer
                        // Events might be duplicated on next flush
                    }
                }

                // Best-effort write to Analytics Engine
                if let Err(e) = writer
                    .write_events_to_analytics_engine(&events_to_write)
                    .await
                {
                    log_error(&format!("Failed to write to Analytics Engine: {}", e));
                }

                Ok(())
            }
            Err(e) => {
                log_error(&format!("Failed to write events to R2: {}", e));
                Err(e)
            }
        }
    }

    fn get_buffer_threshold(&self) -> usize {
        self.env
            .var("BUFFER_SIZE")
            .ok()
            .and_then(|v| v.to_string().parse::<usize>().ok())
            .unwrap_or(DEFAULT_BUFFER_SIZE)
            .min(MAX_BUFFER_SIZE)
    }

    async fn set_flush_alarm(&self) -> Result<()> {
        let timeout_ms = self
            .env
            .var("BUFFER_TIMEOUT_MS")
            .ok()
            .and_then(|v| v.to_string().parse::<i64>().ok())
            .unwrap_or(DEFAULT_TIMEOUT_MS);

        self.state.storage().set_alarm(timeout_ms).await
    }
}
