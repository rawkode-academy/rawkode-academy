use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TableMetadata {
    pub table_name: String,
    pub event_type: String,
    pub partitions: Vec<PartitionMetadata>,
    pub total_rows: i64,
    pub total_size_bytes: i64,
    pub last_updated: DateTime<Utc>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub schema: Option<HashMap<String, String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PartitionMetadata {
    pub path: String,
    pub year: i32,
    pub month: i32,
    pub day: i32,
    pub hour: i32,
    pub file_count: i32,
    pub row_count: i64,
    pub size_bytes: i64,
    pub min_event_time: DateTime<Utc>,
    pub max_event_time: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogSummary {
    pub version: String,
    pub updated_at: DateTime<Utc>,
    pub tables: Vec<TableMetadata>,
    pub total_tables: i32,
    pub total_rows: i64,
    pub total_size_bytes: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CostReport {
    pub storage_costs: StorageCosts,
    pub operation_costs: OperationCosts,
    pub total_monthly_cost: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageCosts {
    pub total_gb: f64,
    pub cost_per_gb: f64,
    pub monthly_cost: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OperationCosts {
    pub class_a_operations: i64,
    pub class_b_operations: i64,
    pub monthly_cost: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct R2ObjectMetadata {
    pub path: String,
    pub size: i64,
    pub last_modified: DateTime<Utc>,
    pub custom_metadata: HashMap<String, String>,
}

impl Default for CatalogSummary {
    fn default() -> Self {
        Self {
            version: "1.0".to_string(),
            updated_at: Utc::now(),
            tables: Vec::new(),
            total_tables: 0,
            total_rows: 0,
            total_size_bytes: 0,
        }
    }
}