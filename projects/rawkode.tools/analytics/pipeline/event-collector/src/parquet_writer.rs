use arrow_array::{ArrayRef, StringArray};
use arrow_schema::{DataType, Field, Schema};
use chrono::{DateTime, Utc};
use cloudevents::Event;
use parquet::arrow::ArrowWriter;
use parquet::file::properties::WriterProperties;
use std::sync::Arc;
use worker::*;
use crate::utils::{log_info, log_error};

pub struct ParquetWriter {
    env: Env,
}

impl ParquetWriter {
    pub fn new(env: &Env) -> Self {
        Self { env: env.clone() }
    }

    pub async fn write_events_to_r2(&self, events: &[Event], event_type: &str) -> Result<()> {
        if events.is_empty() {
            log_info("No events to write to R2");
            return Ok(());
        }

        let bucket = self.env.bucket("ANALYTICS_SOURCE")?;
        
        let now = Utc::now();
        let partition_path = self.get_partition_path(event_type, &now);
        let file_name = format!("{}_{}.parquet", now.timestamp_millis(), uuid::Uuid::new_v4());
        let key = format!("{}/{}", partition_path, file_name);

        log_info(&format!("Preparing to write {} events to R2 at: {}", events.len(), key));

        // Convert events to JSON strings
        let json_strings: Vec<String> = events
            .iter()
            .map(|event| serde_json::to_string(event).map_err(|e| Error::RustError(format!("JSON serialize error: {}", e))))
            .collect::<std::result::Result<Vec<String>, _>>()?;

        // Create Arrow array and schema
        let array: ArrayRef = Arc::new(StringArray::from(json_strings));
        let schema = Arc::new(Schema::new(vec![Field::new("raw_event", DataType::Utf8, false)]));
        let batch = arrow_array::RecordBatch::try_new(schema.clone(), vec![array])
            .map_err(|e| Error::RustError(format!("RecordBatch error: {}", e)))?;

        // Write to Parquet format
        let mut parquet_buffer = Vec::new();
        let props = WriterProperties::builder().build();
        let mut writer = ArrowWriter::try_new(&mut parquet_buffer, schema, Some(props))
            .map_err(|e| Error::RustError(format!("Parquet writer init error: {}", e)))?;
        
        writer
            .write(&batch)
            .map_err(|e| Error::RustError(format!("Parquet write error: {}", e)))?;
        
        writer
            .close()
            .map_err(|e| Error::RustError(format!("Parquet writer close error: {}", e)))?;

        log_info(&format!(
            "Created Parquet file of {} bytes for {} {} events",
            parquet_buffer.len(),
            events.len(),
            event_type
        ));

        // Write to R2
        match bucket.put(&key, parquet_buffer).execute().await {
            Ok(_) => {
                log_info(&format!("Successfully wrote {} {} events to R2: {}", events.len(), event_type, key));
                Ok(())
            }
            Err(e) => {
                log_error(&format!("Failed to write to R2 bucket: {}. Error: {}", key, e));
                Err(e)
            }
        }
    }

    pub async fn write_events_to_analytics_engine(&self, events: &[Event]) -> Result<()> {
        if events.is_empty() {
            log_info("No events to write to Analytics Engine");
            return Ok(());
        }

        // Analytics Engine is not available in the worker crate yet, so we'll skip this for now
        log_info(&format!("Analytics Engine writes are not yet implemented. Would write {} events", events.len()));
        
        // When Analytics Engine becomes available, the implementation would look like:
        // let dataset = self.env.analytics_engine("analytics-events");
        // for event in events {
        //     dataset.write_data_point(&event_json);
        // }
        
        Ok(())
    }

    fn get_partition_path(&self, event_type: &str, date: &DateTime<Utc>) -> String {
        let year = date.format("%Y");
        let month = date.format("%m");
        let day = date.format("%d");
        let hour = date.format("%H");

        // Clean event type for path
        let clean_event_type = event_type.replace('.', "_").to_lowercase();

        format!("events/{}/year={}/month={}/day={}/hour={}",
            clean_event_type, year, month, day, hour)
    }
}