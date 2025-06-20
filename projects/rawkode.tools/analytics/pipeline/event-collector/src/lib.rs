use worker::*;
use serde::{Deserialize, Serialize};
use cloudevents::{Event, EventBuilder, EventBuilderV10};

mod utils;
mod parquet_writer;
mod buffer;
mod validation;

use buffer::EventBuffer;
use validation::{validate_event, validate_batch};

#[derive(Debug, Serialize, Deserialize)]
struct BatchEventsRequest {
    events: Vec<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
struct EventResponse {
    success: bool,
    events_received: usize,
}

#[derive(Debug, Serialize, Deserialize)]
struct ErrorResponse {
    error: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    details: Option<String>,
}

fn log_request(req: &Request) {
    utils::log_info(&format!(
        "{} - [{}], located at: {:?}",
        Date::now().to_string(),
        req.path(),
        req.cf(),
    ));
}

#[event(scheduled)]
pub async fn scheduled(_event: ScheduledEvent, env: Env, _ctx: ScheduleContext) {
    utils::log_info("Scheduled event triggered: Relying on Durable Object alarms for flushing.");

    // With Durable Objects, each object instance manages its own buffer and flushing via alarms.
    // A central scheduled flush is less critical. If you needed to force a flush on all
    // active objects, you would need a mechanism to track them (e.g., registering them in KV).
    // For this implementation, we'll rely on the DO alarms.
    // The `flush_all` method is a placeholder to demonstrate where you would
    // trigger a flush of all DOs if needed.
    let buffer = EventBuffer::new(&env);
    if let Err(e) = buffer.flush_all().await {
        utils::log_error(&format!("Error during scheduled flush_all call: {}", e));
    }
}

#[event(fetch)]
pub async fn main(req: Request, env: Env, _ctx: Context) -> Result<Response> {
    utils::set_panic_hook();
    log_request(&req);

    let router = Router::new();

    router
        .get("/health", |_req, _ctx| {
            Response::ok("{\"status\":\"healthy\"}")
        })
        // No authentication needed - this worker is only accessible via service bindings
        .post_async("/events", |req, ctx| async move {
            handle_cloudevents(req, ctx).await
        })
        .post_async("/events/batch", |req, ctx| async move {
            handle_batch_events(req, ctx).await
        })
        // Debug endpoints (should be removed in production)
        .get_async("/debug/status/:event_type", |_req, ctx| async move {
            let event_type = ctx.param("event_type").map(|s| s.to_string()).unwrap_or_else(|| "".to_string());
            debug_get_status(&event_type, ctx).await
        })
        .post_async("/debug/flush/:event_type", |_req, ctx| async move {
            let event_type = ctx.param("event_type").map(|s| s.to_string()).unwrap_or_else(|| "".to_string());
            debug_flush_buffer(&event_type, ctx).await
        })
        .get_async("/debug/test-r2", |_req, ctx| async move {
            debug_test_r2(ctx).await
        })
        .run(req, env)
        .await
}

async fn handle_cloudevents(mut req: Request, ctx: RouteContext<()>) -> Result<Response> {
    utils::log_info("Processing single CloudEvent request");
    
    // Check Content-Length header for payload size
    if let Ok(Some(content_length)) = req.headers().get("content-length") {
        if let Ok(length) = content_length.parse::<usize>() {
            const MAX_PAYLOAD_SIZE: usize = 10 * 1024 * 1024; // 10MB max for entire request
            if length > MAX_PAYLOAD_SIZE {
                utils::log_error(&format!("Request payload too large: {} bytes", length));
                return Ok(Response::from_json(&ErrorResponse {
                    error: "Payload too large".to_string(),
                    details: Some(format!("Maximum payload size is {} bytes", MAX_PAYLOAD_SIZE)),
                })?.with_status(413)); // 413 Payload Too Large
            }
        }
    }
    
    let body = req.text().await?;

    // Parse CloudEvents from HTTP request
    let events = match parse_cloudevents_http(&req, &body) {
        Ok(events) => {
            utils::log_info(&format!("Parsed {} CloudEvent(s) from request", events.len()));
            events
        },
        Err(e) => {
            utils::log_error(&format!("Failed to parse CloudEvent: {}", e));
            return Ok(Response::from_json(&ErrorResponse {
                error: "Invalid CloudEvent data".to_string(),
                details: Some(e.to_string()),
            })?.with_status(400));
        }
    };

    // Validate events
    let mut validated_events = Vec::new();
    for event in events {
        match validate_event(&event) {
            Ok(_) => validated_events.push(event),
            Err(e) => {
                utils::log_error(&format!("Event validation failed: {}", e));
                return Ok(Response::from_json(&ErrorResponse {
                    error: "Event validation failed".to_string(),
                    details: Some(e.to_string()),
                })?.with_status(400));
            }
        }
    }

    // Enrich events with Cloudflare data
    let cf_data = req.cf();
    utils::log_info("Enriching events with Cloudflare data");
    let enriched_events: Vec<Event> = validated_events
        .into_iter()
        .map(|event| enrich_event_with_cf_data(event, cf_data.cloned()))
        .collect();

    // Buffer events for batch writing to R2
    let buffer = EventBuffer::new(&ctx.env);
    match buffer.add_events(enriched_events.clone()).await {
        Ok(_) => {
            utils::log_info(&format!("Successfully buffered {} events", enriched_events.len()));
        },
        Err(e) => {
            utils::log_error(&format!("Failed to buffer events: {}", e));
            return Ok(Response::from_json(&ErrorResponse {
                error: "Failed to buffer events".to_string(),
                details: Some(e.to_string()),
            })?.with_status(500));
        }
    }

    Response::from_json(&EventResponse {
        success: true,
        events_received: enriched_events.len(),
    })
}

async fn handle_batch_events(mut req: Request, ctx: RouteContext<()>) -> Result<Response> {
    utils::log_info("Processing batch CloudEvents request");
    
    // Check Content-Length header for payload size
    if let Ok(Some(content_length)) = req.headers().get("content-length") {
        if let Ok(length) = content_length.parse::<usize>() {
            const MAX_PAYLOAD_SIZE: usize = 10 * 1024 * 1024; // 10MB max for entire request
            if length > MAX_PAYLOAD_SIZE {
                utils::log_error(&format!("Batch request payload too large: {} bytes", length));
                return Ok(Response::from_json(&ErrorResponse {
                    error: "Payload too large".to_string(),
                    details: Some(format!("Maximum payload size is {} bytes", MAX_PAYLOAD_SIZE)),
                })?.with_status(413)); // 413 Payload Too Large
            }
        }
    }
    let batch: BatchEventsRequest = match req.json::<BatchEventsRequest>().await {
        Ok(batch) => {
            utils::log_info(&format!("Received batch with {} events", batch.events.len()));
            batch
        },
        Err(e) => {
            utils::log_error(&format!("Failed to parse batch request: {}", e));
            return Ok(Response::from_json(&ErrorResponse {
                error: "Invalid batch format".to_string(),
                details: Some(e.to_string()),
            })?.with_status(400));
        }
    };

    // Validate batch size
    if let Err(e) = validate_batch(&batch.events) {
        utils::log_error(&format!("Batch validation failed: {}", e));
        return Ok(Response::from_json(&ErrorResponse {
            error: "Batch validation failed".to_string(),
            details: Some(e.to_string()),
        })?.with_status(400));
    }

    let cf_data = req.cf();
    let mut events = Vec::new();
    let mut parse_errors = 0;
    
    for (index, event_data) in batch.events.iter().enumerate() {
        match serde_json::from_value::<Event>(event_data.clone()) {
            Ok(event) => {
                // Validate event before enriching
                if let Err(e) = validate_event(&event) {
                    parse_errors += 1;
                    utils::log_error(&format!("Event validation failed at index {}: {}", index, e));
                    if parse_errors > 5 {
                        return Ok(Response::from_json(&ErrorResponse {
                            error: "Too many invalid events in batch".to_string(),
                            details: Some(format!("{} events failed validation", parse_errors)),
                        })?.with_status(400));
                    }
                    continue;
                }
                
                let enriched_event = enrich_event_with_cf_data(event, cf_data.cloned());
                events.push(enriched_event);
            }
            Err(e) => {
                parse_errors += 1;
                utils::log_error(&format!("Failed to parse event at index {}: {}", index, e));
                if parse_errors > 5 {
                    return Ok(Response::from_json(&ErrorResponse {
                        error: "Too many invalid events in batch".to_string(),
                        details: Some(format!("{} events failed to parse", parse_errors)),
                    })?.with_status(400));
                }
            }
        }
    }
    
    if parse_errors > 0 {
        utils::log_info(&format!("Parsed {}/{} events successfully ({} failures)", events.len(), batch.events.len(), parse_errors));
    } else {
        utils::log_info(&format!("Successfully parsed all {} events", events.len()));
    }

    // Buffer events
    let buffer = EventBuffer::new(&ctx.env);
    match buffer.add_events(events.clone()).await {
        Ok(_) => {
            utils::log_info(&format!("Successfully buffered {} events from batch", events.len()));
        },
        Err(e) => {
            utils::log_error(&format!("Failed to buffer batch events: {}", e));
            return Ok(Response::from_json(&ErrorResponse {
                error: "Failed to buffer events".to_string(),
                details: Some(e.to_string()),
            })?.with_status(500));
        }
    }

    Response::from_json(&EventResponse {
        success: true,
        events_received: events.len(),
    })
}

fn parse_cloudevents_http(_req: &Request, body: &str) -> Result<Vec<Event>> {
    // This is a simplified parser - in production you'd want to handle
    // all CloudEvents HTTP binding modes (structured, binary, batched)
    let events: Vec<Event> = if body.starts_with('[') {
        utils::log_info("Parsing batched CloudEvents from JSON array");
        // Batched mode
        serde_json::from_str(body)?
    } else {
        utils::log_info("Parsing single CloudEvent from JSON object");
        // Single event
        vec![serde_json::from_str(body)?]
    };

    Ok(events)
}

fn enrich_event_with_cf_data(event: Event, cf: Option<Cf>) -> Event {
    let mut builder = EventBuilderV10::from(event.clone());

    if let Some(cf_data) = cf {
        builder = builder.extension("cf_colo", cf_data.colo());
        if let Some(country) = cf_data.country() {
            builder = builder.extension("cf_country", country);
        }
        if let Some(city) = cf_data.city() {
            builder = builder.extension("cf_city", city);
        }
        if let Some(continent) = cf_data.continent() {
            builder = builder.extension("cf_continent", continent);
        }
        if let Some(postal_code) = cf_data.postal_code() {
            builder = builder.extension("cf_postal_code", postal_code);
        }
        if let Some(region) = cf_data.region() {
            builder = builder.extension("cf_region", region);
        }
        builder = builder.extension("cf_timezone", cf_data.timezone_name());
        builder = builder.extension("cf_http_protocol", cf_data.http_protocol());
        builder = builder.extension("cf_tls_version", cf_data.tls_version());
        builder = builder.extension("cf_tls_cipher", cf_data.tls_cipher());
    }

    builder.build().unwrap_or(event)
}

// Debug functions
async fn debug_get_status(event_type: &str, ctx: RouteContext<()>) -> Result<Response> {
    utils::log_info(&format!("Debug status check for event type: {}", event_type));
    
    if event_type.is_empty() {
        return Ok(Response::error("Event type required", 400)?);
    }
    
    let buffer_do = ctx.env.durable_object("EVENT_BUFFER_DO")?;
    let stub = buffer_do.id_from_name(event_type)?.get_stub()?;
    
    let mut response = stub.fetch_with_request(
        Request::new(&format!("http://do/{}/", event_type), Method::Get)?
    ).await?;
    
    let status = response.text().await?;
    Response::ok(status)
}

async fn debug_flush_buffer(event_type: &str, ctx: RouteContext<()>) -> Result<Response> {
    utils::log_info(&format!("Debug flush for event type: {}", event_type));
    
    if event_type.is_empty() {
        return Ok(Response::error("Event type required", 400)?);
    }
    
    let buffer_do = ctx.env.durable_object("EVENT_BUFFER_DO")?;
    let stub = buffer_do.id_from_name(event_type)?.get_stub()?;
    
    // Send a DELETE request to trigger flush
    let mut response = stub.fetch_with_request(
        Request::new_with_init(
            &format!("http://do/{}/flush", event_type),
            RequestInit::new().with_method(Method::Delete),
        )?
    ).await?;
    
    let result = response.text().await?;
    Response::ok(result)
}

async fn debug_test_r2(ctx: RouteContext<()>) -> Result<Response> {
    utils::log_info("Testing R2 bucket connection");
    
    // Try to access the bucket
    let bucket = match ctx.env.bucket("ANALYTICS_SOURCE") {
        Ok(b) => b,
        Err(e) => {
            return Ok(Response::error(format!("Failed to get bucket: {}", e), 500)?);
        }
    };
    
    // Try to write a test file
    let test_key = format!("_test/connection-test-{}.txt", Date::now().as_millis());
    let test_content = "R2 connection test successful";
    
    match bucket.put(&test_key, test_content.as_bytes().to_vec()).execute().await {
        Ok(_) => {
            utils::log_info(&format!("Successfully wrote test file: {}", test_key));
            
            // Try to list files in the bucket
            let list_result = bucket.list().execute().await;
            let list_info = match list_result {
                Ok(list) => {
                    format!("Bucket has {} objects", list.objects().len())
                }
                Err(e) => {
                    format!("Failed to list bucket: {}", e)
                }
            };
            
            // Clean up test file
            let _ = bucket.delete(&test_key).await;
            
            Response::ok(serde_json::json!({
                "status": "success",
                "test_file": test_key,
                "bucket_info": list_info
            }).to_string())
        }
        Err(e) => {
            utils::log_error(&format!("Failed to write test file: {}", e));
            Response::error(format!("R2 write failed: {}", e), 500)
        }
    }
}

// Export the Durable Object
pub use buffer::EventBufferDurableObject;
