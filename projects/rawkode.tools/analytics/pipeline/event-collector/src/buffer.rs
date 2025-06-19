use worker::*;
use cloudevents::{Event, AttributesReader};
use std::collections::HashMap;
use crate::parquet_writer::ParquetWriter;
use crate::utils::{log_info, log_error};

pub struct EventBuffer {
    env: Env,
}

impl EventBuffer {
    pub fn new(env: &Env) -> Self {
        Self { env: env.clone() }
    }

    pub async fn add_events(&self, events: Vec<Event>) -> Result<()> {
        log_info(&format!("Adding {} events to buffer", events.len()));
        
        // Group events by type
        let mut events_by_type: HashMap<String, Vec<Event>> = HashMap::new();
        for event in events {
            events_by_type
                .entry(event.ty().to_string())
                .or_default()
                .push(event);
        }

        log_info(&format!("Grouped events into {} types", events_by_type.len()));

        let buffer_do = self.env.durable_object("EVENT_BUFFER_DO")?;

        for (event_type, typed_events) in events_by_type {
            log_info(&format!("Sending {} events of type '{}' to DO", typed_events.len(), event_type));
            
            // The DO instance is identified by its type.
            // This ensures all events of the same type go to the same DO instance.
            let stub = buffer_do.id_from_name(&event_type)?.get_stub()?;

            // Send the events to the Durable Object.
            let mut response = stub.fetch_with_request(
                Request::new_with_init(
                    &format!("http://do/{}/", event_type),
                    RequestInit::new()
                        .with_method(Method::Post)
                        .with_body(Some(serde_json::to_string(&typed_events)?.into())),
                )?,
            )
            .await?;
            
            if response.status_code() >= 400 {
                let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
                log_error(&format!("DO returned error {} for type '{}': {}", response.status_code(), event_type, error_text));
                return Err(worker::Error::RustError(format!("DO error: {}", error_text)));
            }
            
            log_info(&format!("Successfully sent events to DO for type '{}'", event_type));
        }

        Ok(())
    }

    pub async fn flush_all(&self) -> Result<()> {
        // This is a simplified approach. In a real-world scenario with many event types,
        // you would need a mechanism to discover all active DO instances.
        // For now, we assume we don't need to explicitly trigger a flush from the main worker,
        // as the DO's alarm handles it.
        // If an explicit flush of all DOs is needed, you'd typically have the DOs register
        // their existence in a central place (like KV) when they are first created.
        log_info("Relying on Durable Object alarms to flush buffers.");
        Ok(())
    }
}

// Durable Object implementation
#[durable_object]
pub struct EventBufferDurableObject {
    state: State,
    env: Env,
    event_type: Option<String>,
    buffered_events: Vec<Event>,
}

#[durable_object]
impl DurableObject for EventBufferDurableObject {
    fn new(state: State, env: Env) -> Self {
        Self {
            state,
            env,
            event_type: None,
            buffered_events: Vec::new(),
        }
    }

    async fn fetch(&mut self, mut req: Request) -> Result<Response> {
        let url = req.url()?;
        let path = url.path();
        
        log_info(&format!("DO received request: {} {}", req.method(), path));

        // Extract event type from path
        let event_type = path.trim_start_matches('/').trim_end_matches('/').to_string();
        
        if event_type.is_empty() {
            log_error("No event type provided in path");
            return Response::error("Event type required", 400);
        }

        // Set event type if not already set
        if self.event_type.is_none() {
            self.event_type = Some(event_type.clone());
            log_info(&format!("DO initialized for event type: {}", event_type));
        }

        match req.method() {
            Method::Post => {
                // Parse incoming events
                let body = req.text().await?;
                let events: Vec<Event> = match serde_json::from_str(&body) {
                    Ok(events) => events,
                    Err(e) => {
                        log_error(&format!("Failed to parse events: {}", e));
                        return Response::error("Invalid event data", 400);
                    }
                };

                log_info(&format!("DO received {} events for type '{}'", events.len(), event_type));

                // Add to buffer
                self.buffered_events.extend(events);
                
                // Check if we should flush
                let should_flush = self.buffered_events.len() >= 1000; // Flush at 1000 events
                
                if should_flush {
                    log_info(&format!("Buffer size ({}) reached threshold, flushing", self.buffered_events.len()));
                    if let Err(e) = self.flush().await {
                        log_error(&format!("Failed to flush events: {}", e));
                        return Response::error("Failed to flush events", 500);
                    }
                } else {
                    // Set alarm for periodic flush (5 minutes)
                    let alarm_time = Date::now().as_millis() as i64 + 300_000; // 5 minutes
                    self.state.storage().set_alarm(alarm_time).await?;
                    log_info(&format!("Set alarm for flush in 5 minutes. Current buffer size: {}", self.buffered_events.len()));
                }

                Response::ok("Events buffered")
            }
            Method::Get => {
                // Status endpoint
                let status = serde_json::json!({
                    "event_type": self.event_type,
                    "buffered_count": self.buffered_events.len(),
                });
                Response::ok(status.to_string())
            }
            _ => Response::error("Method not allowed", 405),
        }
    }

    async fn alarm(&mut self) -> Result<Response> {
        log_info(&format!("Alarm triggered for event type: {:?}", self.event_type));
        
        if !self.buffered_events.is_empty() {
            log_info(&format!("Flushing {} buffered events", self.buffered_events.len()));
            if let Err(e) = self.flush().await {
                log_error(&format!("Failed to flush events during alarm: {}", e));
                // Re-set alarm to retry
                let retry_time = Date::now().as_millis() as i64 + 60_000; // Retry in 1 minute
                self.state.storage().set_alarm(retry_time).await?;
                return Err(e);
            }
        }
        
        Response::ok("Alarm processed")
    }
}

impl EventBufferDurableObject {
    async fn flush(&mut self) -> Result<()> {
        if self.buffered_events.is_empty() {
            log_info("No events to flush");
            return Ok(());
        }

        let event_type = self.event_type.as_ref()
            .ok_or_else(|| worker::Error::RustError("Event type not set".to_string()))?;
        
        log_info(&format!("Starting flush of {} events for type '{}'", self.buffered_events.len(), event_type));

        // Write to storage
        let writer = ParquetWriter::new(&self.env);
        
        // Clone events for writing (so we can clear the buffer even if write fails)
        let events_to_write = self.buffered_events.clone();
        
        match writer.write_events_to_r2(&events_to_write, event_type).await {
            Ok(_) => {
                log_info(&format!("Successfully wrote {} events to R2", events_to_write.len()));
                // Clear buffer only on success
                self.buffered_events.clear();
                
                // Also write to Analytics Engine
                if let Err(e) = writer.write_events_to_analytics_engine(&events_to_write).await {
                    log_error(&format!("Failed to write to Analytics Engine: {}", e));
                    // Don't fail the flush if AE write fails
                }
            }
            Err(e) => {
                log_error(&format!("Failed to write events to R2: {}", e));
                return Err(e);
            }
        }

        Ok(())
    }
}