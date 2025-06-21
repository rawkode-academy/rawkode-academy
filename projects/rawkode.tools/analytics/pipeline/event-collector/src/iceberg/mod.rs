pub mod buffer;
pub mod catalog;
pub mod compaction;
pub mod manifest;
pub mod metadata;
pub mod rest_catalog;
pub mod schema;
pub mod writer;

// Constants for Iceberg configuration
pub const DEFAULT_TARGET_FILE_SIZE: u64 = 50 * 1024 * 1024; // 50MB target
pub const DEFAULT_ROW_GROUP_SIZE: usize = 1000; // 1000 rows per group
pub const MAX_MEMORY_USAGE: usize = 50 * 1024 * 1024; // 50MB memory limit
pub const MAX_BATCH_SIZE: usize = 5000; // Maximum events per batch

pub use buffer::{IcebergBufferDurableObject, IcebergEventBuffer};
pub use catalog::IcebergCatalog;
pub use compaction::IcebergCompactor;
pub use manifest::{DataFile, ManifestFile};
pub use metadata::IcebergMetadata;
pub use rest_catalog::{CatalogFactory, CatalogOperations, RestCatalog};
pub use schema::{IcebergEventSchema, IcebergTableProperties};
pub use writer::IcebergWriter;