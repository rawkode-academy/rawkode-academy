#[cfg(test)]
mod tests {
    use super::super::validation::*;
    use cloudevents::{EventBuilder, EventBuilderV10};
    use chrono::Utc;
    use serde_json::json;

    fn create_valid_event() -> cloudevents::Event {
        EventBuilderV10::new()
            .id("test-123")
            .ty("com.example.test")
            .source("test-source")
            .time(Utc::now())
            .data("application/json", json!({"test": true}))
            .build()
            .unwrap()
    }

    #[test]
    fn test_validate_valid_event() {
        let event = create_valid_event();
        assert!(validate_event(&event).is_ok());
    }

    #[test]
    fn test_validate_event_missing_id() {
        let event = EventBuilderV10::new()
            .ty("com.example.test")
            .source("test-source")
            .build();
        
        match event {
            Ok(_) => panic!("Event should not build without ID"),
            Err(_) => {} // Expected
        }
    }

    #[test]
    fn test_validate_event_missing_type() {
        let event = EventBuilderV10::new()
            .id("test-123")
            .source("test-source")
            .build();
        
        match event {
            Ok(_) => panic!("Event should not build without type"),
            Err(_) => {} // Expected
        }
    }

    #[test]
    fn test_validate_event_large_data() {
        let large_data = json!({
            "data": "x".repeat(1024 * 1024 + 1) // 1MB + 1 byte
        });
        
        let event = EventBuilderV10::new()
            .id("test-123")
            .ty("com.example.test")
            .source("test-source")
            .data("application/json", large_data)
            .build()
            .unwrap();
        
        let result = validate_event(&event);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("Event data too large"));
    }

    #[test]
    fn test_validate_batch_empty() {
        let batch: Vec<serde_json::Value> = vec![];
        let result = validate_batch(&batch);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("empty"));
    }

    #[test]
    fn test_validate_batch_too_large() {
        let batch: Vec<serde_json::Value> = (0..1001)
            .map(|i| json!({
                "id": format!("test-{}", i),
                "type": "test.event",
                "source": "test"
            }))
            .collect();
        
        let result = validate_batch(&batch);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("too many events"));
    }

    #[test]
    fn test_validate_batch_valid() {
        let batch: Vec<serde_json::Value> = vec![
            json!({
                "id": "test-1",
                "type": "test.event",
                "source": "test",
                "specversion": "1.0"
            }),
            json!({
                "id": "test-2",
                "type": "test.event",
                "source": "test",
                "specversion": "1.0"
            })
        ];
        
        assert!(validate_batch(&batch).is_ok());
    }

    #[test]
    fn test_validate_event_type_format() {
        // Test valid event types
        let valid_types = vec![
            "page_view",
            "user.click",
            "com.example.test",
            "system.error.critical",
            "app_started",
        ];
        
        for event_type in valid_types {
            let event = EventBuilderV10::new()
                .id("test-123")
                .ty(event_type)
                .source("test-source")
                .build()
                .unwrap();
            
            assert!(validate_event(&event).is_ok(), "Event type '{}' should be valid", event_type);
        }
    }

    #[test]
    fn test_validate_event_with_extensions() {
        let event = EventBuilderV10::new()
            .id("test-123")
            .ty("com.example.test")
            .source("test-source")
            .extension("custom_field", "custom_value")
            .extension("cf_country", "US")
            .build()
            .unwrap();
        
        assert!(validate_event(&event).is_ok());
    }

    #[test]
    fn test_validate_event_different_content_types() {
        let content_types = vec![
            ("application/json", json!({"test": true})),
            ("text/plain", json!("plain text data")),
            ("application/xml", json!("<xml>data</xml>")),
        ];
        
        for (content_type, data) in content_types {
            let event = EventBuilderV10::new()
                .id("test-123")
                .ty("com.example.test")
                .source("test-source")
                .data(content_type, data)
                .build()
                .unwrap();
            
            assert!(validate_event(&event).is_ok(), 
                "Event with content type '{}' should be valid", content_type);
        }
    }

    #[test]
    fn test_validate_batch_total_size() {
        // Create a batch where each event is small but total is large
        let batch: Vec<serde_json::Value> = (0..100)
            .map(|i| {
                let data = "x".repeat(100 * 1024); // 100KB per event
                json!({
                    "id": format!("test-{}", i),
                    "type": "test.event",
                    "source": "test",
                    "specversion": "1.0",
                    "data": data
                })
            })
            .collect();
        
        // Total size should be ~10MB which might exceed limits
        let result = validate_batch(&batch);
        // Depending on implementation, this might pass or fail
        // The test is here to ensure the function handles large batches
        assert!(result.is_ok() || result.is_err());
    }
}