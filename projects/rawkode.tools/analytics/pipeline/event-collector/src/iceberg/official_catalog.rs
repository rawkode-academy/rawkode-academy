use crate::utils::{log_error, log_info};
use crate::iceberg::rest_catalog::RestCatalog;
use std::collections::HashMap;
use worker::*;

/// Wrapper around the official REST catalog for Cloudflare Workers
pub struct OfficialCatalog {
    catalog: RestCatalog,
}

impl OfficialCatalog {
    /// Create a new official catalog instance
    pub async fn new(env: &Env) -> Result<Self> {
        let account_id = env
            .var("CLOUDFLARE_ACCOUNT_ID")
            .map_err(|_| Error::RustError("CLOUDFLARE_ACCOUNT_ID not configured".to_string()))?
            .to_string();
        
        // Token will be retrieved by RestCatalog internally
        
        // For Cloudflare R2 Data Catalog
        // Based on DuckDB's working example, the endpoint includes the full path
        let catalog_uri = format!(
            "https://catalog.cloudflarestorage.com/{}/analytics-source", 
            account_id
        );
        
        // The warehouse is just a simple identifier when the full path is in the endpoint
        let warehouse = format!("{}_analytics-source", account_id);
        
        log_info(&format!("Creating REST catalog client for: {}", catalog_uri));
        
        // Use default namespace for R2 Data Catalog
        let namespace = "default".to_string();
        
        let mut catalog = RestCatalog::new(&env, catalog_uri, warehouse, namespace);
        
        // Fetch config to get prefix
        if let Err(e) = catalog.get_config().await {
            log_error(&format!("Failed to get catalog config: {}", e));
        }
        
        Ok(Self { catalog })
    }
    
    /// Check if a table exists
    pub async fn table_exists(&self, _namespace: &str, table_name: &str) -> Result<bool> {
        match self.catalog.load_table(table_name).await {
            Ok(Some(_)) => Ok(true),
            Ok(None) => Ok(false),
            Err(e) => {
                log_error(&format!("Failed to check table existence: {}", e));
                Err(Error::RustError(format!("Failed to check table: {}", e)))
            }
        }
    }
    
    /// Create the analytics events table
    pub async fn create_analytics_table(&self, _namespace: &str) -> Result<()> {
        log_info("Creating analytics_events table via REST catalog");
        
        // Define the schema for analytics events according to Iceberg spec
        let schema = serde_json::json!({
            "type": "struct",
            "schema-id": 1,
            "fields": [
                {"id": 1, "name": "id", "required": true, "type": "string"},
                {"id": 2, "name": "type", "required": true, "type": "string"},
                {"id": 3, "name": "source", "required": true, "type": "string"},
                {"id": 4, "name": "specversion", "required": true, "type": "string"},
                {"id": 5, "name": "time", "required": false, "type": "timestamptz"},
                {"id": 6, "name": "datacontenttype", "required": false, "type": "string"},
                {"id": 7, "name": "dataschema", "required": false, "type": "string"},
                {"id": 8, "name": "subject", "required": false, "type": "string"},
                {"id": 9, "name": "data", "required": false, "type": "string"},
                {"id": 10, "name": "extensions", "required": false, "type": "string"},
                // Cloudflare fields
                {"id": 11, "name": "cf_colo", "required": false, "type": "string"},
                {"id": 12, "name": "cf_country", "required": false, "type": "string"},
                {"id": 13, "name": "cf_city", "required": false, "type": "string"},
                {"id": 14, "name": "cf_continent", "required": false, "type": "string"},
                {"id": 15, "name": "cf_postal_code", "required": false, "type": "string"},
                {"id": 16, "name": "cf_region", "required": false, "type": "string"},
                {"id": 17, "name": "cf_timezone", "required": false, "type": "string"},
                {"id": 18, "name": "cf_http_protocol", "required": false, "type": "string"},
                {"id": 19, "name": "cf_tls_version", "required": false, "type": "string"},
                {"id": 20, "name": "cf_tls_cipher", "required": false, "type": "string"},
                // Partition fields
                {"id": 21, "name": "year", "required": true, "type": "int"},
                {"id": 22, "name": "month", "required": true, "type": "int"},
                {"id": 23, "name": "day", "required": true, "type": "int"},
                {"id": 24, "name": "hour", "required": true, "type": "int"},
                {"id": 25, "name": "raw_event", "required": false, "type": "string"},
            ]
        });
        
        // Skip partitioning for now - R2 Data Catalog might have specific requirements
        let partition_spec = serde_json::Value::Null;
        
        let mut properties = HashMap::new();
        properties.insert("write.format.default".to_string(), "parquet".to_string());
        properties.insert("commit.retry.num-retries".to_string(), "10".to_string());
        properties.insert("write.parquet.compression-codec".to_string(), "snappy".to_string());
        
        match self.catalog.create_table(
            "analytics_events",
            schema,
            partition_spec,
            properties
        ).await {
            Ok(_) => {
                log_info("Successfully created analytics_events table");
                Ok(())
            }
            Err(e) => {
                log_error(&format!("Failed to create table: {}", e));
                Err(Error::RustError(format!("Failed to create table: {}", e)))
            }
        }
    }
    
}