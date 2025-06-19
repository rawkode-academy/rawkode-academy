use thiserror::Error;

#[derive(Error, Debug)]
pub enum CatalogError {
    #[error("R2 operation failed: {0}")]
    R2Error(String),
    
    #[error("Invalid partition path: {0}")]
    InvalidPartitionPath(String),
    
    #[error("Serialization error: {0}")]
    SerializationError(#[from] serde_json::Error),
    
    #[error("Worker error: {0}")]
    WorkerError(#[from] worker::Error),
    
    #[error("Date parsing error: {0}")]
    DateParseError(#[from] chrono::ParseError),
}

pub type Result<T> = std::result::Result<T, CatalogError>;