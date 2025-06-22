use std::fmt;
use worker::Error as WorkerError;

#[derive(Debug)]
pub enum CollectorError {
    InvalidEvent {
        reason: String,
    },
    DurableObjectAccess {
        name: String,
        source: WorkerError,
    },
    TooManyFailures {
        count: u32,
    },
    ValidationError(String),
}

impl fmt::Display for CollectorError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidEvent { reason } => write!(f, "Invalid event: {}", reason),
            Self::DurableObjectAccess { name, source } => {
                write!(f, "Cannot access Durable Object '{}': {}", name, source)
            }
            Self::TooManyFailures { count } => write!(f, "Too many failures: {}", count),
            Self::ValidationError(msg) => write!(f, "Validation error: {}", msg),
        }
    }
}

impl std::error::Error for CollectorError {}

// Telemetry helper
pub fn log_error_with_context(error: &CollectorError, request_id: &str) {
    use crate::utils::log_error;

    let error_type = match error {
        CollectorError::InvalidEvent { .. } => "event_validation_error",
        CollectorError::DurableObjectAccess { .. } => "do_access_error",
        CollectorError::TooManyFailures { .. } => "circuit_breaker_error",
        CollectorError::ValidationError(_) => "validation_error",
    };

    log_error(&format!(
        "request_id={} error_type={} error=\"{}\"",
        request_id, error_type, error
    ));
}

// Result type alias for convenience
pub type CollectorResult<T> = Result<T, CollectorError>;

// Conversion helper for Worker errors
impl From<WorkerError> for CollectorError {
    fn from(error: WorkerError) -> Self {
        CollectorError::InvalidEvent {
            reason: error.to_string(),
        }
    }
}
