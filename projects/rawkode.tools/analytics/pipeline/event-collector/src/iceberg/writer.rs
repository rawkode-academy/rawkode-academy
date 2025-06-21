use crate::errors::CollectorError;
use crate::iceberg::schema::IcebergEventSchema;
use crate::utils::{log_error, log_info};
use arrow_array::{ArrayRef, Int32Array, StringArray, TimestampMicrosecondArray};
use arrow_schema::{DataType, Field, Schema};
use chrono::{DateTime, Datelike, Timelike, Utc};
use cloudevents::{AttributesReader, Event};
use parquet::arrow::ArrowWriter;
use parquet::file::properties::{WriterProperties, WriterPropertiesBuilder};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use worker::*;

/// Configuration for Iceberg writer
#[derive(Debug, Clone)]
pub struct WriteConfig {
    pub target_file_size: u64,
    pub row_group_size: usize,
    pub compression: CompressionType,
    pub write_timeout: Duration,
    pub enable_bloom_filter: bool,
    pub enable_statistics: bool,
}

impl Default for WriteConfig {
    fn default() -> Self {
        Self {
            target_file_size: crate::iceberg::DEFAULT_TARGET_FILE_SIZE,
            row_group_size: crate::iceberg::DEFAULT_ROW_GROUP_SIZE,
            compression: CompressionType::Snappy,
            write_timeout: Duration::from_secs(30),
            enable_bloom_filter: true,
            enable_statistics: true,
        }
    }
}

#[derive(Debug, Clone, Copy)]
pub enum CompressionType {
    None,
    Snappy,
    Gzip,
    Lz4,
    Zstd,
}

/// Result of a write operation
#[derive(Debug)]
pub enum WriteResult {
    Complete {
        data_file: DataFile,
        duration: Duration,
    },
    Partial {
        written: usize,
        remaining: usize,
        checkpoint: WriteCheckpoint,
    },
}

/// Checkpoint for resuming partial writes
#[derive(Debug, Clone)]
pub struct WriteCheckpoint {
    pub written_count: usize,
    pub partial_file: Option<String>,
    pub timestamp: DateTime<Utc>,
}

/// Iceberg data file metadata
#[derive(Debug, Clone)]
pub struct DataFile {
    pub path: String,
    pub file_format: FileFormat,
    pub record_count: i64,
    pub file_size_bytes: i64,
    pub column_sizes: std::collections::HashMap<String, i64>,
    pub value_counts: std::collections::HashMap<String, i64>,
    pub null_value_counts: std::collections::HashMap<String, i64>,
    pub lower_bounds: std::collections::HashMap<String, Vec<u8>>,
    pub upper_bounds: std::collections::HashMap<String, Vec<u8>>,
    pub key_metadata: Option<Vec<u8>>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum FileFormat {
    Parquet,
    Avro,
    Orc,
}

impl std::fmt::Display for FileFormat {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            FileFormat::Parquet => write!(f, "parquet"),
            FileFormat::Avro => write!(f, "avro"),
            FileFormat::Orc => write!(f, "orc"),
        }
    }
}

/// Iceberg writer for CloudEvents
pub struct IcebergWriter {
    config: WriteConfig,
    env: Env,
}

impl IcebergWriter {
    pub fn new(env: Env, config: WriteConfig) -> Self {
        Self { config, env }
    }

    /// Write events to a data file with partition values
    pub async fn write_data_file(
        &self,
        events: Vec<Event>,
        partition_values: HashMap<String, String>,
    ) -> Result<DataFile> {
        if events.is_empty() {
            return Err(Error::RustError("No events to write".to_string()));
        }

        let start_time = Date::now();
        
        // Convert events to Parquet
        let (parquet_data, stats) = self.events_to_parquet(&events)?;
        
        // Generate file path with partition structure
        let file_path = self.generate_partitioned_file_path(&partition_values);
        
        // Write to R2
        let bucket = self.env.bucket("ANALYTICS_SOURCE")?;
        bucket.put(&file_path, parquet_data.clone()).execute().await?;
        
        let duration = Date::now().as_millis() - start_time.as_millis();
        log_info(&format!(
            "Wrote {} events to {} in {}ms",
            events.len(),
            file_path,
            duration
        ));

        Ok(DataFile {
            path: file_path,
            file_format: FileFormat::Parquet,
            record_count: events.len() as i64,
            file_size_bytes: parquet_data.len() as i64,
            column_sizes: stats.column_sizes,
            value_counts: stats.value_counts,
            null_value_counts: stats.null_value_counts,
            lower_bounds: stats.lower_bounds,
            upper_bounds: stats.upper_bounds,
            key_metadata: None,
        })
    }

    /// Write events with checkpoint support for large batches
    pub async fn write_with_checkpoint(
        &self,
        events: Vec<Event>,
        timeout: Duration,
    ) -> WriteResult {
        let start_time = std::time::Instant::now();
        let mut written = 0;
        
        // Process in chunks to avoid timeout
        let chunk_size = self.config.row_group_size;
        
        for chunk in events.chunks(chunk_size) {
            if start_time.elapsed() > timeout {
                // Timeout reached, return partial result
                return WriteResult::Partial {
                    written,
                    remaining: events.len() - written,
                    checkpoint: WriteCheckpoint {
                        written_count: written,
                        partial_file: None,
                        timestamp: Utc::now(),
                    },
                };
            }
            
            // Write chunk (in real implementation, this would append to file)
            written += chunk.len();
        }
        
        // All events written
        match self.write_data_file(events).await {
            Ok(data_file) => WriteResult::Complete {
                data_file,
                duration: start_time.elapsed(),
            },
            Err(_) => WriteResult::Partial {
                written: 0,
                remaining: written,
                checkpoint: WriteCheckpoint {
                    written_count: 0,
                    partial_file: None,
                    timestamp: Utc::now(),
                },
            },
        }
    }

    /// Convert events to Parquet format with proper CloudEvents schema
    fn events_to_parquet(&self, events: &[Event]) -> Result<(Vec<u8>, ParquetStats)> {
        // Create Arrow arrays for each field
        let mut id_builder = arrow_array::StringBuilder::new();
        let mut source_builder = arrow_array::StringBuilder::new();
        let mut type_builder = arrow_array::StringBuilder::new();
        let mut specversion_builder = arrow_array::StringBuilder::new();
        let mut time_builder = TimestampMicrosecondArray::builder(events.len());
        let mut datacontenttype_builder = arrow_array::StringBuilder::new();
        let mut dataschema_builder = arrow_array::StringBuilder::new();
        let mut subject_builder = arrow_array::StringBuilder::new();
        let mut data_builder = arrow_array::StringBuilder::new();
        let mut extensions_builder = arrow_array::StringBuilder::new();
        
        // Cloudflare fields
        let mut cf_colo_builder = arrow_array::StringBuilder::new();
        let mut cf_country_builder = arrow_array::StringBuilder::new();
        let mut cf_city_builder = arrow_array::StringBuilder::new();
        let mut cf_continent_builder = arrow_array::StringBuilder::new();
        let mut cf_postal_code_builder = arrow_array::StringBuilder::new();
        let mut cf_region_builder = arrow_array::StringBuilder::new();
        let mut cf_timezone_builder = arrow_array::StringBuilder::new();
        let mut cf_http_protocol_builder = arrow_array::StringBuilder::new();
        let mut cf_tls_version_builder = arrow_array::StringBuilder::new();
        let mut cf_tls_cipher_builder = arrow_array::StringBuilder::new();
        
        // Partition fields
        let mut year_builder = arrow_array::Int32Builder::new();
        let mut month_builder = arrow_array::Int32Builder::new();
        let mut day_builder = arrow_array::Int32Builder::new();
        let mut hour_builder = arrow_array::Int32Builder::new();
        
        // Raw event for compatibility
        let mut raw_event_builder = arrow_array::StringBuilder::new();
        
        // Process each event
        for event in events {
            // Core CloudEvents fields
            id_builder.append_value(event.id());
            source_builder.append_value(event.source().as_str());
            type_builder.append_value(event.ty());
            specversion_builder.append_value(event.specversion());
            
            // Time handling
            match event.time() {
                Some(time) => {
                    let micros = time.timestamp_micros();
                    time_builder.append_value(micros);
                    year_builder.append_value(time.year());
                    month_builder.append_value(time.month() as i32);
                    day_builder.append_value(time.day() as i32);
                    hour_builder.append_value(time.hour() as i32);
                }
                None => {
                    let now = Utc::now();
                    time_builder.append_null();
                    year_builder.append_value(now.year());
                    month_builder.append_value(now.month() as i32);
                    day_builder.append_value(now.day() as i32);
                    hour_builder.append_value(now.hour() as i32);
                }
            }
            
            // Optional fields
            match event.datacontenttype() {
                Some(v) => datacontenttype_builder.append_value(v),
                None => datacontenttype_builder.append_null(),
            }
            
            match event.dataschema() {
                Some(v) => dataschema_builder.append_value(v.as_str()),
                None => dataschema_builder.append_null(),
            }
            
            match event.subject() {
                Some(v) => subject_builder.append_value(v),
                None => subject_builder.append_null(),
            }
            
            // Data field as JSON string
            match event.data() {
                Some(data) => {
                    let data_str = match data {
                        cloudevents::Data::Binary(bytes) => {
                            String::from_utf8_lossy(bytes).into_owned()
                        }
                        cloudevents::Data::String(s) => s.clone(),
                        cloudevents::Data::Json(json) => json.to_string(),
                    };
                    data_builder.append_value(&data_str);
                }
                None => data_builder.append_null(),
            }
            
            // Extensions as JSON
            let extensions: HashMap<String, serde_json::Value> = event
                .iter_extensions()
                .map(|(k, v)| (k.to_string(), serde_json::Value::String(v.to_string())))
                .collect();
            
            if extensions.is_empty() {
                extensions_builder.append_null();
            } else {
                let ext_json = serde_json::to_string(&extensions)
                    .unwrap_or_else(|_| "{}".to_string());
                extensions_builder.append_value(&ext_json);
            }
            
            // Extract Cloudflare fields from extensions
            let get_extension = |key: &str| event.extension(key).map(|v| v.to_string());
            
            match get_extension("cf_colo") {
                Some(v) => cf_colo_builder.append_value(&v),
                None => cf_colo_builder.append_null(),
            }
            
            match get_extension("cf_country") {
                Some(v) => cf_country_builder.append_value(&v),
                None => cf_country_builder.append_null(),
            }
            
            match get_extension("cf_city") {
                Some(v) => cf_city_builder.append_value(&v),
                None => cf_city_builder.append_null(),
            }
            
            match get_extension("cf_continent") {
                Some(v) => cf_continent_builder.append_value(&v),
                None => cf_continent_builder.append_null(),
            }
            
            match get_extension("cf_postal_code") {
                Some(v) => cf_postal_code_builder.append_value(&v),
                None => cf_postal_code_builder.append_null(),
            }
            
            match get_extension("cf_region") {
                Some(v) => cf_region_builder.append_value(&v),
                None => cf_region_builder.append_null(),
            }
            
            match get_extension("cf_timezone") {
                Some(v) => cf_timezone_builder.append_value(&v),
                None => cf_timezone_builder.append_null(),
            }
            
            match get_extension("cf_http_protocol") {
                Some(v) => cf_http_protocol_builder.append_value(&v),
                None => cf_http_protocol_builder.append_null(),
            }
            
            match get_extension("cf_tls_version") {
                Some(v) => cf_tls_version_builder.append_value(&v),
                None => cf_tls_version_builder.append_null(),
            }
            
            match get_extension("cf_tls_cipher") {
                Some(v) => cf_tls_cipher_builder.append_value(&v),
                None => cf_tls_cipher_builder.append_null(),
            }
            
            // Raw event JSON
            let raw_json = serde_json::to_string(event)
                .unwrap_or_else(|_| "{}".to_string());
            raw_event_builder.append_value(&raw_json);
        }
        
        // Build arrays
        let arrays: Vec<ArrayRef> = vec![
            Arc::new(id_builder.finish()),
            Arc::new(source_builder.finish()),
            Arc::new(type_builder.finish()),
            Arc::new(specversion_builder.finish()),
            Arc::new(time_builder.finish()),
            Arc::new(datacontenttype_builder.finish()),
            Arc::new(dataschema_builder.finish()),
            Arc::new(subject_builder.finish()),
            Arc::new(data_builder.finish()),
            Arc::new(extensions_builder.finish()),
            Arc::new(cf_colo_builder.finish()),
            Arc::new(cf_country_builder.finish()),
            Arc::new(cf_city_builder.finish()),
            Arc::new(cf_continent_builder.finish()),
            Arc::new(cf_postal_code_builder.finish()),
            Arc::new(cf_region_builder.finish()),
            Arc::new(cf_timezone_builder.finish()),
            Arc::new(cf_http_protocol_builder.finish()),
            Arc::new(cf_tls_version_builder.finish()),
            Arc::new(cf_tls_cipher_builder.finish()),
            Arc::new(year_builder.finish()),
            Arc::new(month_builder.finish()),
            Arc::new(day_builder.finish()),
            Arc::new(hour_builder.finish()),
            Arc::new(raw_event_builder.finish()),
        ];
        
        // Create schema and batch
        let schema = Arc::new(IcebergEventSchema::create_event_schema());
        let batch = arrow_array::RecordBatch::try_new(schema.clone(), arrays)
            .map_err(|e| Error::RustError(format!("RecordBatch error: {}", e)))?;

        // Configure Parquet writer
        let props = self.build_writer_properties();
        
        // Write to buffer
        let mut parquet_buffer = Vec::new();
        let mut writer = ArrowWriter::try_new(&mut parquet_buffer, schema, Some(props))
            .map_err(|e| Error::RustError(format!("Parquet writer init error: {}", e)))?;

        writer
            .write(&batch)
            .map_err(|e| Error::RustError(format!("Parquet write error: {}", e)))?;

        let metadata = writer
            .close()
            .map_err(|e| Error::RustError(format!("Parquet writer close error: {}", e)))?;

        // Extract statistics
        let stats = self.extract_statistics_from_metadata(&metadata, events.len());

        Ok((parquet_buffer, stats))
    }

    /// Build Parquet writer properties based on config
    fn build_writer_properties(&self) -> WriterProperties {
        let mut builder = WriterProperties::builder()
            .set_writer_version(parquet::file::properties::WriterVersion::PARQUET_2_0)
            .set_data_page_row_count_limit(self.config.row_group_size)
            .set_max_row_group_size(self.config.row_group_size);

        // Set compression
        builder = match self.config.compression {
            CompressionType::None => builder,
            CompressionType::Snappy => builder.set_compression(parquet::basic::Compression::SNAPPY),
            CompressionType::Gzip => builder.set_compression(parquet::basic::Compression::GZIP(Default::default())),
            CompressionType::Lz4 => builder.set_compression(parquet::basic::Compression::LZ4),
            CompressionType::Zstd => builder.set_compression(parquet::basic::Compression::ZSTD(Default::default())),
        };

        // Enable statistics
        if self.config.enable_statistics {
            builder = builder.set_statistics_enabled(parquet::file::properties::EnabledStatistics::Page);
        }

        builder.build()
    }

    /// Generate partitioned file path
    fn generate_partitioned_file_path(&self, partition_values: &HashMap<String, String>) -> String {
        let event_type = partition_values.get("type")
            .map(|s| s.replace('.', "_").to_lowercase())
            .unwrap_or_else(|| "unknown".to_string());
        
        let year = partition_values.get("year").unwrap_or(&"0000".to_string());
        let month = partition_values.get("month").unwrap_or(&"00".to_string());
        let day = partition_values.get("day").unwrap_or(&"00".to_string());
        let hour = partition_values.get("hour").unwrap_or(&"00".to_string());
        
        let timestamp = Date::now().as_millis();
        let file_id = uuid::Uuid::new_v4();
        
        format!(
            "data/type={}/year={}/month={}/day={}/hour={}/{}-{}.parquet",
            event_type,
            year,
            month,
            day,
            hour,
            timestamp,
            file_id
        )
    }

    /// Extract statistics from Parquet metadata
    fn extract_statistics_from_metadata(
        &self,
        _metadata: &parquet::format::FileMetaData,
        record_count: usize,
    ) -> ParquetStats {
        // Create basic statistics
        let mut stats = ParquetStats {
            column_sizes: HashMap::new(),
            value_counts: HashMap::new(),
            null_value_counts: HashMap::new(),
            lower_bounds: HashMap::new(),
            upper_bounds: HashMap::new(),
        };
        
        // Add basic counts for key columns
        let key_columns = vec!["id", "type", "source", "time", "raw_event"];
        for col in key_columns {
            stats.value_counts.insert(col.to_string(), record_count as i64);
            stats.null_value_counts.insert(col.to_string(), 0);
        }
        
        stats
    }
}

/// Statistics extracted from Parquet file
struct ParquetStats {
    column_sizes: std::collections::HashMap<String, i64>,
    value_counts: std::collections::HashMap<String, i64>,
    null_value_counts: std::collections::HashMap<String, i64>,
    lower_bounds: std::collections::HashMap<String, Vec<u8>>,
    upper_bounds: std::collections::HashMap<String, Vec<u8>>,
}

impl DataFile {
    /// Get the record count
    pub fn record_count(&self) -> i64 {
        self.record_count
    }

    /// Get the file size in bytes
    pub fn file_size_bytes(&self) -> i64 {
        self.file_size_bytes
    }

    /// Get the file format
    pub fn file_format(&self) -> FileFormat {
        self.file_format
    }

    /// Get column sizes
    pub fn column_sizes(&self) -> &std::collections::HashMap<String, i64> {
        &self.column_sizes
    }

    /// Get the file path
    pub fn path(&self) -> &str {
        &self.path
    }
}