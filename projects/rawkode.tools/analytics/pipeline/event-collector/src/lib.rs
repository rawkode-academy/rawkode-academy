use worker::*;
use serde::{Deserialize, Serialize};
use cloudevents::{Event, EventBuilder, EventBuilderV10};

mod utils;
mod parquet_writer;
mod buffer;

use buffer::EventBuffer;

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
        .run(req, env)
        .await
}

async fn handle_cloudevents(mut req: Request, ctx: RouteContext<()>) -> Result<Response> {
    utils::log_info("Processing single CloudEvent request");
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

    // Enrich events with Cloudflare data
    let cf_data = req.cf();
    utils::log_info("Enriching events with Cloudflare data");
    let enriched_events: Vec<Event> = events
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

    let cf_data = req.cf();
    let mut events = Vec::new();
    let mut parse_errors = 0;
    
    for (index, event_data) in batch.events.iter().enumerate() {
        match serde_json::from_value::<Event>(event_data.clone()) {
            Ok(mut event) => {
                event = enrich_event_with_cf_data(event, cf_data.cloned());
                events.push(event);
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

// Export the Durable Object
pub use buffer::EventBufferDurableObject;
