use cloudevents::{Event, AttributesReader};
use serde_json::Value;

const MAX_EVENT_SIZE: usize = 1024 * 1024; // 1MB per event
const MAX_BATCH_SIZE: usize = 100; // Max 100 events per batch
const MAX_STRING_LENGTH: usize = 1024; // Max length for string fields
const MAX_DATA_DEPTH: usize = 5; // Max depth for nested JSON data
const MAX_EVENT_TYPE_LENGTH: usize = 255; // Max length for event type
const MAX_DATA_STRING_LENGTH: usize = MAX_STRING_LENGTH * 10; // Max length for strings in data

#[derive(Debug)]
pub enum ValidationError {
    EventTooLarge(usize),
    BatchTooLarge(usize),
    InvalidEventType(String),
    InvalidSource(String),
    InvalidSubject(String),
    DataTooDeep(usize),
    StringTooLong(String, usize),
}

impl std::fmt::Display for ValidationError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ValidationError::EventTooLarge(size) => {
                write!(f, "Event size {} exceeds maximum of {} bytes", size, MAX_EVENT_SIZE)
            }
            ValidationError::BatchTooLarge(size) => {
                write!(f, "Batch size {} exceeds maximum of {} events", size, MAX_BATCH_SIZE)
            }
            ValidationError::InvalidEventType(t) => {
                write!(f, "Invalid event type '{}': must be alphanumeric with dots, hyphens, or underscores", t)
            }
            ValidationError::InvalidSource(s) => {
                write!(f, "Invalid source '{}': must be a valid URI", s)
            }
            ValidationError::InvalidSubject(s) => {
                write!(f, "Invalid subject '{}': subject too long or contains invalid characters", s)
            }
            ValidationError::DataTooDeep(depth) => {
                write!(f, "Event data nesting depth {} exceeds maximum of {}", depth, MAX_DATA_DEPTH)
            }
            ValidationError::StringTooLong(field, len) => {
                write!(f, "Field '{}' length {} exceeds maximum of {}", field, len, MAX_STRING_LENGTH)
            }
        }
    }
}

impl std::error::Error for ValidationError {}

/// Validate a batch of events
pub fn validate_batch(events: &[Value]) -> Result<(), ValidationError> {
    if events.len() > MAX_BATCH_SIZE {
        return Err(ValidationError::BatchTooLarge(events.len()));
    }
    Ok(())
}

/// Validate a CloudEvent
pub fn validate_event(event: &Event) -> Result<(), ValidationError> {
    // Check event size
    let event_size = serde_json::to_string(event)
        .map(|s| s.len())
        .unwrap_or(0);
    
    if event_size > MAX_EVENT_SIZE {
        return Err(ValidationError::EventTooLarge(event_size));
    }

    // Validate event type
    let event_type = event.ty();
    if !is_valid_event_type(event_type) {
        return Err(ValidationError::InvalidEventType(event_type.to_string()));
    }

    // Validate source (must be a valid URI-like string)
    let source = event.source();
    if source.as_str().is_empty() || source.as_str().len() > MAX_STRING_LENGTH {
        return Err(ValidationError::InvalidSource(source.to_string()));
    }

    // Validate subject if present
    if let Some(subject) = event.subject() {
        if subject.len() > MAX_STRING_LENGTH {
            return Err(ValidationError::InvalidSubject(subject.to_string()));
        }
    }

    // Validate data depth if present
    if let Some(data) = event.data() {
        match data {
            cloudevents::Data::Binary(bytes) => {
                if let Ok(json_value) = serde_json::from_slice::<Value>(bytes) {
                    validate_json_depth(&json_value, 0)?;
                }
            }
            cloudevents::Data::String(s) => {
                if let Ok(json_value) = serde_json::from_str::<Value>(s) {
                    validate_json_depth(&json_value, 0)?;
                }
            }
            cloudevents::Data::Json(value) => {
                validate_json_depth(value, 0)?;
            }
        }
    }

    Ok(())
}

/// Check if event type is valid (alphanumeric with dots, hyphens, underscores)
fn is_valid_event_type(event_type: &str) -> bool {
    !event_type.is_empty() 
        && event_type.len() <= MAX_EVENT_TYPE_LENGTH
        && event_type.chars().all(|c| c.is_alphanumeric() || c == '.' || c == '-' || c == '_')
}

/// Validate JSON depth to prevent deeply nested objects
fn validate_json_depth(value: &Value, current_depth: usize) -> Result<(), ValidationError> {
    if current_depth > MAX_DATA_DEPTH {
        return Err(ValidationError::DataTooDeep(current_depth));
    }

    match value {
        Value::Object(map) => {
            for (key, val) in map {
                if key.len() > MAX_STRING_LENGTH {
                    return Err(ValidationError::StringTooLong(key.clone(), key.len()));
                }
                validate_json_depth(val, current_depth + 1)?;
            }
        }
        Value::Array(arr) => {
            for val in arr {
                validate_json_depth(val, current_depth + 1)?;
            }
        }
        Value::String(s) => {
            if s.len() > MAX_DATA_STRING_LENGTH { // Allow longer strings in data
                return Err(ValidationError::StringTooLong("data_string".to_string(), s.len()));
            }
        }
        _ => {}
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use cloudevents::{EventBuilder, EventBuilderV10};
    use serde_json::json;

    #[test]
    fn test_valid_event() {
        let event = EventBuilderV10::new()
            .id("test-id")
            .ty("com.example.test")
            .source("https://example.com")
            .data("application/json", json!({"key": "value"}))
            .build()
            .unwrap();

        assert!(validate_event(&event).is_ok());
    }

    #[test]
    fn test_invalid_event_type() {
        let event = EventBuilderV10::new()
            .id("test-id")
            .ty("invalid type with spaces")
            .source("https://example.com")
            .build()
            .unwrap();

        assert!(matches!(
            validate_event(&event),
            Err(ValidationError::InvalidEventType(_))
        ));
    }

    #[test]
    fn test_data_too_deep() {
        let mut data = json!({"level": 0});
        for i in 1..=10 {
            data = json!({"level": i, "nested": data});
        }

        let event = EventBuilderV10::new()
            .id("test-id")
            .ty("com.example.test")
            .source("https://example.com")
            .data("application/json", data)
            .build()
            .unwrap();

        assert!(matches!(
            validate_event(&event),
            Err(ValidationError::DataTooDeep(_))
        ));
    }
}