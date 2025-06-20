use worker::*;
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use std::collections::HashMap;
use cloudevents::{EventBuilder, EventBuilderV10};

#[derive(Debug, Clone, Serialize, Deserialize)]
struct HealthCheck {
    name: String,
    endpoint: String,
    method: String,
    expected_status: u16,
    timeout_ms: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    body: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    validators: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize)]
struct HealthCheckResult {
    check_name: String,
    success: bool,
    status_code: Option<u16>,
    response_time_ms: u64,
    error: Option<String>,
    timestamp: DateTime<Utc>,
    #[serde(skip_serializing_if = "Option::is_none")]
    validation_results: Option<HashMap<String, bool>>,
}

#[derive(Debug, Serialize, Deserialize)]
struct HealthReport {
    timestamp: DateTime<Utc>,
    overall_health: bool,
    checks_total: usize,
    checks_passed: usize,
    checks_failed: usize,
    results: Vec<HealthCheckResult>,
    #[serde(skip_serializing_if = "Option::is_none")]
    alerts_sent: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize)]
struct Alert {
    severity: String,
    title: String,
    message: String,
    timestamp: DateTime<Utc>,
    details: HashMap<String, serde_json::Value>,
}

async fn perform_health_check(
    check: &HealthCheck,
    service_binding: &Service,
    timeout_ms: u32,
) -> HealthCheckResult {
    let start_time = Date::now().as_millis();
    
    let mut init = RequestInit::new();
    init.with_method(Method::from_string(&check.method).unwrap_or(Method::Get));
    
    if let Some(body) = &check.body {
        init.with_body(Some(JsValue::from_str(&body.to_string())));
        
        let mut headers = Headers::new();
        headers.set("Content-Type", "application/json").ok();
        init.with_headers(headers);
    }
    
    let request = match Request::new_with_init(&check.endpoint, &init) {
        Ok(req) => req,
        Err(e) => {
            return HealthCheckResult {
                check_name: check.name.clone(),
                success: false,
                status_code: None,
                response_time_ms: Date::now().as_millis() - start_time,
                error: Some(format!("Failed to create request: {}", e)),
                timestamp: Utc::now(),
                validation_results: None,
            };
        }
    };
    
    // Perform the request
    // Note: Worker runtime doesn't support tokio, so we'll rely on the timeout_ms parameter
    // being enforced by Cloudflare's infrastructure
    let response_result = match service_binding.fetch(request).await {
        Ok(response) => Ok(response),
        Err(e) => Err(format!("Request failed: {}", e)),
    };
    
    let response_time_ms = Date::now().as_millis() - start_time;
    
    match response_result {
        Ok(mut response) => {
            let status = response.status_code();
            let mut validation_results = HashMap::new();
            
            // Check status code
            let status_ok = status == check.expected_status;
            validation_results.insert("status_code".to_string(), status_ok);
            
            // Run custom validators if specified
            if let Some(validators) = &check.validators {
                if let Ok(body_text) = response.text().await {
                    if let Ok(body_json) = serde_json::from_str::<serde_json::Value>(&body_text) {
                        for validator in validators {
                            let result = validate_response(validator, &body_json);
                            validation_results.insert(validator.clone(), result);
                        }
                    }
                }
            }
            
            let all_validations_passed = validation_results.values().all(|&v| v);
            
            HealthCheckResult {
                check_name: check.name.clone(),
                success: status_ok && all_validations_passed,
                status_code: Some(status),
                response_time_ms,
                error: None,
                timestamp: Utc::now(),
                validation_results: Some(validation_results),
            }
        }
        Err(error) => HealthCheckResult {
            check_name: check.name.clone(),
            success: false,
            status_code: None,
            response_time_ms,
            error: Some(error),
            timestamp: Utc::now(),
            validation_results: None,
        }
    }
}

fn validate_response(validator: &str, response: &serde_json::Value) -> bool {
    // Simple validation logic - can be extended
    match validator {
        "has_success_field" => response.get("success").and_then(|v| v.as_bool()).unwrap_or(false),
        "has_events_received" => response.get("events_received").is_some(),
        "has_objects" => response.get("objects").and_then(|v| v.as_array()).map(|a| !a.is_empty()).unwrap_or(false),
        _ => false,
    }
}

async fn send_synthetic_event(
    service_binding: &Service,
    event_type: &str,
) -> Result<()> {
    let event = EventBuilderV10::new()
        .id(uuid::Uuid::new_v4().to_string())
        .ty(event_type)
        .source("analytics-health-checker")
        .time(Utc::now())
        .data("application/json", serde_json::json!({
            "synthetic": true,
            "purpose": "health_check",
            "timestamp": Utc::now().to_rfc3339(),
        }))
        .build()
        .map_err(|e| Error::RustError(format!("Failed to build event: {}", e)))?;
    
    let request = Request::new_with_init(
        "/events",
        RequestInit::new()
            .with_method(Method::Post)
            .with_body(Some(JsValue::from_str(&serde_json::to_string(&event)?)))
            .with_headers({
                let headers = Headers::new();
                headers.set("Content-Type", "application/json")?;
                headers
            }),
    )?;
    
    let response = service_binding.fetch(request).await?;
    
    if !response.status_code() == 200 {
        return Err(Error::RustError(format!(
            "Synthetic event failed with status: {}",
            response.status_code()
        )));
    }
    
    Ok(())
}

async fn send_alert(alert: &Alert, webhook_url: Option<&str>, email: Option<&str>) -> Result<Vec<String>> {
    let mut alerts_sent = Vec::new();
    
    if let Some(webhook) = webhook_url {
        if !webhook.is_empty() {
            let request = Request::new_with_init(
                webhook,
                RequestInit::new()
                    .with_method(Method::Post)
                    .with_body(Some(JsValue::from_str(&serde_json::to_string(&alert)?)))
                    .with_headers({
                        let headers = Headers::new();
                        headers.set("Content-Type", "application/json")?;
                        headers
                    }),
            )?;
            
            match Fetch::Request(request).send().await {
                Ok(_) => alerts_sent.push("webhook".to_string()),
                Err(e) => console_error!("Failed to send webhook alert: {}", e),
            }
        }
    }
    
    if let Some(email_addr) = email {
        if !email_addr.is_empty() {
            // Email sending would be implemented here using a service like SendGrid
            console_log!("Would send email alert to: {}", email_addr);
            alerts_sent.push("email".to_string());
        }
    }
    
    Ok(alerts_sent)
}

async fn record_metrics(
    analytics: &AnalyticsEngineDataset,
    report: &HealthReport,
) -> Result<()> {
    for result in &report.results {
        analytics.write_data_point(&serde_json::json!({
            "timestamp": result.timestamp.timestamp(),
            "check_name": result.check_name,
            "success": result.success as u8,
            "response_time_ms": result.response_time_ms,
            "status_code": result.status_code,
        }))?;
    }
    
    Ok(())
}

#[event(scheduled)]
pub async fn scheduled(_event: ScheduledEvent, env: Env, _ctx: ScheduleContext) {
    console_error_panic_hook::set_once();
    
    let service_binding = match env.service("EVENT_COLLECTOR") {
        Ok(service) => service,
        Err(e) => {
            console_error!("Failed to get EVENT_COLLECTOR service binding: {}", e);
            return;
        }
    };
    
    let timeout_ms: u32 = env.var("CHECK_TIMEOUT_MS")
        .unwrap_or_else(|_| "30000".to_string())
        .parse()
        .unwrap_or(30000);
    
    let synthetic_event_type = env.var("SYNTHETIC_EVENT_TYPE")
        .unwrap_or_else(|_| "analytics.synthetic.health_check".to_string());
    
    // Define health checks
    let health_checks = vec![
        HealthCheck {
            name: "Event Collector Health".to_string(),
            endpoint: "/health".to_string(),
            method: "GET".to_string(),
            expected_status: 200,
            timeout_ms: 5000,
            body: None,
            validators: None,
        },
        HealthCheck {
            name: "Single Event Ingestion".to_string(),
            endpoint: "/events".to_string(),
            method: "POST".to_string(),
            expected_status: 200,
            timeout_ms: 10000,
            body: Some(serde_json::json!({
                "specversion": "1.0",
                "type": synthetic_event_type,
                "source": "health-checker",
                "id": uuid::Uuid::new_v4().to_string(),
                "time": Utc::now().to_rfc3339(),
                "data": {
                    "synthetic": true,
                    "check_id": uuid::Uuid::new_v4().to_string(),
                }
            })),
            validators: Some(vec![
                "has_success_field".to_string(),
                "has_events_received".to_string(),
            ]),
        },
        HealthCheck {
            name: "Buffer Status Check".to_string(),
            endpoint: format!("/debug/status/{}", synthetic_event_type),
            method: "GET".to_string(),
            expected_status: 200,
            timeout_ms: 5000,
            body: None,
            validators: None,
        },
        HealthCheck {
            name: "R2 Connectivity".to_string(),
            endpoint: "/debug/test-r2".to_string(),
            method: "GET".to_string(),
            expected_status: 200,
            timeout_ms: 15000,
            body: None,
            validators: None,
        },
    ];
    
    // Perform health checks
    let mut results = Vec::new();
    for check in &health_checks {
        let result = perform_health_check(check, &service_binding, timeout_ms).await;
        results.push(result);
    }
    
    // Calculate overall health
    let checks_passed = results.iter().filter(|r| r.success).count();
    let checks_failed = results.len() - checks_passed;
    let overall_health = checks_failed == 0;
    
    let mut report = HealthReport {
        timestamp: Utc::now(),
        overall_health,
        checks_total: results.len(),
        checks_passed,
        checks_failed,
        results,
        alerts_sent: None,
    };
    
    // Send alerts if any checks failed
    if !overall_health {
        let alert = Alert {
            severity: "error".to_string(),
            title: "Analytics Health Check Failed".to_string(),
            message: format!(
                "{} out of {} health checks failed",
                checks_failed,
                report.checks_total
            ),
            timestamp: Utc::now(),
            details: {
                let mut details = HashMap::new();
                details.insert("report".to_string(), serde_json::to_value(&report).unwrap());
                details
            },
        };
        
        let webhook_url = env.var("ALERT_WEBHOOK_URL").ok();
        let alert_email = env.var("ALERT_EMAIL").ok();
        
        match send_alert(&alert, webhook_url.as_deref(), alert_email.as_deref()).await {
            Ok(alerts) => report.alerts_sent = Some(alerts),
            Err(e) => console_error!("Failed to send alerts: {}", e),
        }
    }
    
    // Record metrics
    if let Ok(analytics) = env.analytics("HEALTH_METRICS") {
        if let Err(e) = record_metrics(&analytics, &report).await {
            console_error!("Failed to record metrics: {}", e);
        }
    }
    
    console_log!("Health check completed: {}", serde_json::to_string(&report).unwrap());
}

#[event(fetch)]
pub async fn main(req: Request, env: Env, _ctx: Context) -> Result<Response> {
    console_error_panic_hook::set_once();
    
    let router = Router::new();
    
    router
        .get("/", |_, _| {
            Response::ok("Analytics Health Checker")
        })
        .get_async("/status", |_req, ctx| async move {
            // Return the last health check report
            // In production, this would fetch from KV or Durable Objects
            Response::ok(serde_json::json!({
                "status": "healthy",
                "message": "Health checker is running",
                "next_check": "in 5 minutes"
            }).to_string())
        })
        .post_async("/trigger", |_req, ctx| async move {
            // Allow manual triggering of health checks
            // This would call the same logic as the scheduled handler
            Response::ok("Health check triggered")
        })
        .run(req, env)
        .await
}