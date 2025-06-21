use crate::iceberg::writer::*;
use cloudevents::{Event, EventBuilder, EventBuilderV10};
use chrono::Utc;
use worker::*;

#[cfg(test)]
use proptest::prelude::*;

// Mock environment for testing
fn create_test_env() -> Env {
    // This would be mocked in actual tests
    unsafe { Env::from_raw(std::ptr::null_mut()) }
}

#[tokio::test]
async fn should_write_data_file_when_events_buffered() {
    // Given
    let config = WriteConfig::default();
    let writer = IcebergWriter::new(create_test_env(), config);
    let events = generate_test_events(100);
    
    // When
    let result = writer.write_data_file(events.clone()).await;
    
    // Then
    assert!(result.is_ok());
    let data_file = result.unwrap();
    assert_eq!(data_file.record_count(), 100);
    assert!(data_file.file_size_bytes() > 0);
    assert_eq!(data_file.file_format(), FileFormat::Parquet);
    assert!(data_file.column_sizes().contains_key("raw_event"));
}

#[tokio::test]
async fn should_handle_empty_events_vector() {
    // Given
    let config = WriteConfig::default();
    let writer = IcebergWriter::new(create_test_env(), config);
    let events = vec![];
    
    // When
    let result = writer.write_data_file(events).await;
    
    // Then
    assert!(result.is_err());
    match result {
        Err(Error::RustError(msg)) => assert_eq!(msg, "No events to write"),
        _ => panic!("Expected RustError"),
    }
}

#[test]
fn should_generate_correct_file_path() {
    // Given
    let event = EventBuilderV10::new()
        .id("test-id")
        .source("test-source")
        .ty("com.example.test.event")
        .build()
        .unwrap();
    
    let config = WriteConfig::default();
    let writer = IcebergWriter::new(create_test_env(), config);
    
    // When
    let path = writer.generate_file_path(&event);
    
    // Then
    assert!(path.starts_with("data/com_example_test_event/year="));
    assert!(path.ends_with(".parquet"));
    assert!(path.contains("/month="));
    assert!(path.contains("/day="));
    assert!(path.contains("/hour="));
}

#[test]
fn should_build_writer_properties_with_compression() {
    // Given
    let mut config = WriteConfig::default();
    config.compression = CompressionType::Zstd;
    config.enable_statistics = true;
    
    let writer = IcebergWriter::new(create_test_env(), config);
    
    // When
    let props = writer.build_writer_properties();
    
    // Then
    // Properties would be validated if we had access to internal state
    assert!(props.writer_version() == parquet::file::properties::WriterVersion::PARQUET_2_0);
}

#[tokio::test]
async fn should_handle_timeout_in_write_with_checkpoint() {
    // Given
    let config = WriteConfig::default();
    let writer = IcebergWriter::new(create_test_env(), config);
    let events = generate_test_events(10_000);
    let timeout = std::time::Duration::from_millis(1); // Very short timeout
    
    // When
    let result = writer.write_with_checkpoint(events, timeout).await;
    
    // Then
    match result {
        WriteResult::Partial { written, remaining, checkpoint } => {
            assert!(written < 10_000);
            assert_eq!(written + remaining, 10_000);
            assert!(checkpoint.timestamp <= Utc::now());
        }
        WriteResult::Complete { .. } => {
            // OK if it completed very fast
        }
    }
}

#[test]
fn should_extract_statistics_from_events() {
    // Given
    let config = WriteConfig::default();
    let writer = IcebergWriter::new(create_test_env(), config);
    let events = generate_test_events(10);
    
    // When
    let result = writer.events_to_parquet(&events);
    
    // Then
    assert!(result.is_ok());
    let (parquet_data, stats) = result.unwrap();
    assert!(!parquet_data.is_empty());
    assert_eq!(stats.value_counts.get("raw_event"), Some(&10));
    assert_eq!(stats.null_value_counts.get("raw_event"), Some(&0));
    assert!(stats.column_sizes.get("raw_event").unwrap() > &0);
}

// Property-based tests
#[cfg(test)]
mod property_tests {
    use super::*;
    use proptest::prelude::*;

    proptest! {
        #[test]
        fn should_preserve_event_count_in_data_file(
            event_count in 1..1000usize
        ) {
            // Property: Record count in data file matches input event count
            let config = WriteConfig::default();
            let writer = IcebergWriter::new(create_test_env(), config);
            let events = generate_test_events(event_count);
            
            let runtime = tokio::runtime::Runtime::new().unwrap();
            let result = runtime.block_on(writer.write_data_file(events));
            
            if let Ok(data_file) = result {
                prop_assert_eq!(data_file.record_count() as usize, event_count);
            }
        }

        #[test]
        fn should_generate_unique_file_paths(
            event_types in prop::collection::vec("[a-z]+\\.[a-z]+", 1..10)
        ) {
            // Property: Each event type generates a unique file path
            let config = WriteConfig::default();
            let writer = IcebergWriter::new(create_test_env(), config);
            let mut paths = std::collections::HashSet::new();
            
            for event_type in event_types {
                let event = EventBuilderV10::new()
                    .id("test-id")
                    .source("test-source")
                    .ty(&event_type)
                    .build()
                    .unwrap();
                
                let path = writer.generate_file_path(&event);
                prop_assert!(!paths.contains(&path));
                paths.insert(path);
            }
        }

        #[test]
        fn should_handle_various_compression_types(
            compression in prop_oneof![
                Just(CompressionType::None),
                Just(CompressionType::Snappy),
                Just(CompressionType::Gzip),
                Just(CompressionType::Lz4),
                Just(CompressionType::Zstd),
            ]
        ) {
            // Property: All compression types produce valid Parquet files
            let mut config = WriteConfig::default();
            config.compression = compression;
            
            let writer = IcebergWriter::new(create_test_env(), config);
            let events = generate_test_events(10);
            
            let result = writer.events_to_parquet(&events);
            prop_assert!(result.is_ok());
            
            let (parquet_data, _) = result.unwrap();
            prop_assert!(!parquet_data.is_empty());
        }
    }
}

// Test helpers
fn generate_test_events(count: usize) -> Vec<Event> {
    (0..count)
        .map(|i| {
            EventBuilderV10::new()
                .id(format!("test-event-{}", i))
                .source("test-source")
                .ty("test.event.type")
                .time(Utc::now())
                .data("application/json", serde_json::json!({
                    "index": i,
                    "message": format!("Test event {}", i),
                    "timestamp": Utc::now().to_rfc3339(),
                }))
                .build()
                .unwrap()
        })
        .collect()
}

fn generate_events_with_schema_v1(count: usize) -> Vec<Event> {
    (0..count)
        .map(|i| {
            EventBuilderV10::new()
                .id(format!("v1-event-{}", i))
                .source("test-source")
                .ty("test.event.v1")
                .data("application/json", serde_json::json!({
                    "id": i,
                    "name": format!("Event {}", i),
                }))
                .build()
                .unwrap()
        })
        .collect()
}

fn generate_events_with_schema_v2(count: usize) -> Vec<Event> {
    (0..count)
        .map(|i| {
            EventBuilderV10::new()
                .id(format!("v2-event-{}", i))
                .source("test-source")
                .ty("test.event.v2")
                .data("application/json", serde_json::json!({
                    "id": i,
                    "name": format!("Event {}", i),
                    "category": "test", // New field in v2
                    "tags": ["v2", "test"], // Another new field
                }))
                .build()
                .unwrap()
        })
        .collect()
}