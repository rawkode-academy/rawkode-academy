/// Example: Using the Iceberg Event Collector with R2 Data Catalog
///
/// This example demonstrates how to configure and use the event collector
/// with Apache Iceberg table format and R2 Data Catalog integration.

use cloudevents::{EventBuilder, EventBuilderV10};
use chrono::Utc;

/// Example configuration for wrangler.jsonc
const EXAMPLE_CONFIG: &str = r#"
{
    "vars": {
        // Enable Iceberg mode
        "USE_ICEBERG": "true",
        
        // Direct R2 catalog (default)
        "ICEBERG_TABLE_LOCATION": "analytics/events",
        "ICEBERG_NAMESPACE": "analytics",
        
        // OR use REST API catalog
        "R2_CATALOG_ENDPOINT": "https://catalog-api.example.com",
        "R2_CATALOG_AUTH_TOKEN": "your-bearer-token",
        
        // Buffer configuration
        "ICEBERG_BUFFER_SIZE": "2000",
        "ICEBERG_BUFFER_TIMEOUT_MS": "30000"
    }
}
"#;

/// Example: Sending a single event
fn example_single_event() -> String {
    let event = EventBuilderV10::new()
        .id("unique-event-id")
        .ty("page.view")
        .source("website")
        .time(Utc::now())
        .data("application/json", serde_json::json!({
            "page": "/products",
            "user_id": "user123",
            "session_id": "session456"
        }))
        .build()
        .unwrap();

    serde_json::to_string(&event).unwrap()
}

/// Example: Sending a batch of events
fn example_batch_events() -> String {
    let events = vec![
        EventBuilderV10::new()
            .id("event-1")
            .ty("user.signup")
            .source("auth-service")
            .time(Utc::now())
            .data("application/json", serde_json::json!({
                "user_id": "new-user-123",
                "plan": "premium"
            }))
            .build()
            .unwrap(),
        
        EventBuilderV10::new()
            .id("event-2")
            .ty("api.call")
            .source("api-gateway")
            .time(Utc::now())
            .data("application/json", serde_json::json!({
                "endpoint": "/api/v1/users",
                "method": "GET",
                "duration_ms": 45
            }))
            .build()
            .unwrap(),
    ];

    serde_json::json!({
        "events": events
    }).to_string()
}

/// Example: Querying Iceberg tables (pseudo-code)
fn example_query_patterns() {
    // Query 1: Get all page views for today
    let _query1 = r#"
    SELECT * FROM analytics.events
    WHERE type = 'page.view'
      AND year = 2024
      AND month = 1
      AND day = 15
    ORDER BY time DESC
    "#;

    // Query 2: Count events by type for the last hour
    let _query2 = r#"
    SELECT type, COUNT(*) as event_count
    FROM analytics.events
    WHERE year = 2024
      AND month = 1
      AND day = 15
      AND hour = 14
    GROUP BY type
    ORDER BY event_count DESC
    "#;

    // Query 3: User activity timeline
    let _query3 = r#"
    SELECT 
        time,
        type,
        JSON_EXTRACT(data, '$.user_id') as user_id,
        JSON_EXTRACT(data, '$.page') as page
    FROM analytics.events
    WHERE JSON_EXTRACT(data, '$.user_id') = 'user123'
      AND time >= CURRENT_TIMESTAMP - INTERVAL '1 day'
    ORDER BY time ASC
    "#;
}

/// Example: Monitoring buffer status
async fn example_monitor_buffer() {
    // Check buffer status
    println!("GET /debug/status/page.view");
    
    // Expected response:
    let _response = r#"{
        "partition_key": "page.view/2024-01-15-14",
        "buffered_count": 1523,
        "max_buffer_size": 5000,
        "buffer_threshold": 2000,
        "table_location": "analytics/events"
    }"#;

    // Force flush if needed
    println!("POST /debug/flush/page.view");
}

/// Example: Table maintenance operations
async fn example_table_maintenance() {
    // Compact small files (would be done by a separate service)
    let _compact_command = r#"
    -- Find partitions with many small files
    SELECT 
        type, year, month, day, hour,
        COUNT(*) as file_count,
        SUM(file_size_in_bytes) as total_size,
        AVG(file_size_in_bytes) as avg_file_size
    FROM analytics.events$files
    GROUP BY type, year, month, day, hour
    HAVING COUNT(*) > 50
       AND AVG(file_size_in_bytes) < 10485760 -- 10MB
    "#;

    // Expire old snapshots
    let _expire_command = r#"
    CALL catalog.system.expire_snapshots(
        table => 'analytics.events',
        older_than => TIMESTAMP '2024-01-01 00:00:00',
        retain_last => 10
    )
    "#;
}

fn main() {
    println!("=== Iceberg Event Collector Examples ===\n");
    
    println!("1. Configuration Example:");
    println!("{}", EXAMPLE_CONFIG);
    
    println!("\n2. Single Event Example:");
    println!("{}", example_single_event());
    
    println!("\n3. Batch Events Example:");
    println!("{}", example_batch_events());
    
    println!("\n4. Query Patterns:");
    example_query_patterns();
    
    println!("\n5. Monitoring Commands:");
    // In real usage, these would be async functions
    // example_monitor_buffer().await;
    
    println!("\n6. Table Maintenance:");
    // example_table_maintenance().await;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_event_generation() {
        let event_json = example_single_event();
        assert!(event_json.contains("\"type\":\"page.view\""));
        assert!(event_json.contains("\"source\":\"website\""));
    }

    #[test]
    fn test_batch_generation() {
        let batch_json = example_batch_events();
        assert!(batch_json.contains("\"events\""));
        assert!(batch_json.contains("user.signup"));
        assert!(batch_json.contains("api.call"));
    }
}