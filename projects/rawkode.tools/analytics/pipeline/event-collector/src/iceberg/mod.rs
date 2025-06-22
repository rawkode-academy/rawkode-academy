//! Apache Iceberg implementation for Cloudflare Workers
//! 
//! This module provides a complete Iceberg table format implementation
//! optimized for Cloudflare Workers' constraints:
//! 
//! - **Memory efficient**: Designed to work within 128MB limit
//! - **Streaming writes**: Handles large datasets without OOM
//! - **Automatic compaction**: Merges small files for query performance
//! - **Error recovery**: Built-in retry and circuit breaker mechanisms
//! 
//! # Architecture
//! 
//! The implementation consists of several key components:
//! 
//! - [`buffer`]: Event buffering with Durable Objects
//! - [`writer`]: Parquet file writing with R2 storage
//! - [`metadata`]: Table metadata and snapshot management
//! - [`compaction`]: Background file compaction
//! - [`recovery`]: Error handling and recovery strategies
//! 
//! # Usage Example
//! 
//! ```rust
//! use analytics_event_collector::iceberg::{IcebergEventBuffer, IcebergBufferDurableObject};
//! 
//! // Initialize buffer
//! let buffer = IcebergEventBuffer::new(&env, "analytics/events".to_string());
//! 
//! // Add events
//! buffer.add_events(events).await?;
//! ```

pub mod buffer;
pub mod catalog;
pub mod compaction;
pub mod manifest;
pub mod metadata;
pub mod recovery;
pub mod rest_catalog;
pub mod schema;
pub mod writer;

// Constants for Iceberg configuration
pub const DEFAULT_TARGET_FILE_SIZE: u64 = 50 * 1024 * 1024; // 50MB target
pub const DEFAULT_ROW_GROUP_SIZE: usize = 1000; // 1000 rows per group
#[allow(dead_code)]
pub const MAX_MEMORY_USAGE: usize = 50 * 1024 * 1024; // 50MB memory limit
#[allow(dead_code)]
pub const MAX_BATCH_SIZE: usize = 5000; // Maximum events per batch

// Re-export commonly used types
pub use buffer::{IcebergBufferDurableObject, IcebergEventBuffer};

#[cfg(test)]
mod tests;