use serde::{Deserialize, Serialize};

// Re-export the types from metadata module to avoid duplication
// Note: Schema and Field are re-exported but not used in this module

/// Data types supported by Iceberg
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DataType {
    Boolean,
    Int,
    Long,
    Float,
    Double,
    Date,
    Time,
    Timestamp,
    Timestamptz,
    String,
    Uuid,
    Binary,
    Fixed(usize),
    Decimal { precision: u32, scale: u32 },
    Struct(Vec<StructField>),
    List(Box<DataType>),
    Map { key: Box<DataType>, value: Box<DataType> },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct StructField {
    pub id: i32,
    pub name: String,
    pub required: bool,
    pub field_type: DataType,
}

use arrow_schema::{DataType as ArrowDataType, Field as ArrowField, Schema as ArrowSchema};
use std::collections::HashMap;

/// Schema representing CloudEvents for Iceberg tables
pub struct IcebergEventSchema;

impl IcebergEventSchema {
    /// Create the Arrow schema for CloudEvents
    pub fn create_event_schema() -> ArrowSchema {
        ArrowSchema::new(vec![
            ArrowField::new("id", ArrowDataType::Utf8, false),
            ArrowField::new("source", ArrowDataType::Utf8, false),
            ArrowField::new("type", ArrowDataType::Utf8, false),
            ArrowField::new("specversion", ArrowDataType::Utf8, false),
            ArrowField::new("time", ArrowDataType::Timestamp(arrow_schema::TimeUnit::Microsecond, Some("UTC".into())), true),
            ArrowField::new("datacontenttype", ArrowDataType::Utf8, true),
            ArrowField::new("dataschema", ArrowDataType::Utf8, true),
            ArrowField::new("subject", ArrowDataType::Utf8, true),
            ArrowField::new("data", ArrowDataType::Utf8, true),
            ArrowField::new("extensions", ArrowDataType::Utf8, true),
            ArrowField::new("cf_colo", ArrowDataType::Utf8, true),
            ArrowField::new("cf_country", ArrowDataType::Utf8, true),
            ArrowField::new("cf_city", ArrowDataType::Utf8, true),
            ArrowField::new("cf_continent", ArrowDataType::Utf8, true),
            ArrowField::new("cf_postal_code", ArrowDataType::Utf8, true),
            ArrowField::new("cf_region", ArrowDataType::Utf8, true),
            ArrowField::new("cf_timezone", ArrowDataType::Utf8, true),
            ArrowField::new("cf_http_protocol", ArrowDataType::Utf8, true),
            ArrowField::new("cf_tls_version", ArrowDataType::Utf8, true),
            ArrowField::new("cf_tls_cipher", ArrowDataType::Utf8, true),
            // Partition fields
            ArrowField::new("year", ArrowDataType::Int32, false),
            ArrowField::new("month", ArrowDataType::Int32, false),
            ArrowField::new("day", ArrowDataType::Int32, false),
            ArrowField::new("hour", ArrowDataType::Int32, false),
            ArrowField::new("raw_event", ArrowDataType::Utf8, true),
        ])
    }
}

/// Default properties for Iceberg tables
pub struct IcebergTableProperties;

impl IcebergTableProperties {
    pub fn default_properties() -> HashMap<String, String> {
        let mut props = HashMap::new();
        props.insert("format-version".to_string(), "2".to_string());
        props.insert("write.format.default".to_string(), "parquet".to_string());
        props.insert("write.metadata.compression-codec".to_string(), "gzip".to_string());
        props.insert("write.parquet.compression-codec".to_string(), "snappy".to_string());
        props.insert("write.parquet.page-size-bytes".to_string(), "1048576".to_string());
        props.insert("write.parquet.dict-size-bytes".to_string(), "2097152".to_string());
        props.insert("write.parquet.row-group-size-bytes".to_string(), "134217728".to_string());
        props.insert("commit.retry.num-retries".to_string(), "4".to_string());
        props.insert("commit.retry.min-wait-ms".to_string(), "100".to_string());
        props
    }
}