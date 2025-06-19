use crate::error::Result;
use crate::models::{CatalogSummary, TableMetadata};
use crate::r2::R2Client;
use crate::scanner::PartitionScanner;
use chrono::Utc;
use tracing::{error, info};

pub struct CatalogManager<'a> {
    r2_client: &'a R2Client,
}

impl<'a> CatalogManager<'a> {
    pub fn new(r2_client: &'a R2Client) -> Self {
        Self {
            r2_client,
        }
    }

    pub async fn update_catalog(&self) -> Result<CatalogSummary> {
        info!("Starting catalog update");
        
        // Discover all event types
        let event_types = self.discover_event_types().await?;
        info!("Found {} event types", event_types.len());
        
        let scanner = PartitionScanner::new(self.r2_client);
        let mut tables = Vec::new();
        
        // Scan each event type
        for event_type in event_types {
            match self.scan_event_type(&scanner, &event_type).await {
                Ok(table) => {
                    info!("Scanned table {}: {} rows, {} bytes", 
                        table.table_name, table.total_rows, table.total_size_bytes);
                    tables.push(table);
                }
                Err(e) => {
                    error!("Failed to scan event type {}: {}", event_type, e);
                }
            }
        }
        
        // Create catalog summary
        let total_rows = tables.iter().map(|t| t.total_rows).sum();
        let total_size_bytes = tables.iter().map(|t| t.total_size_bytes).sum();
        
        let catalog = CatalogSummary {
            version: "1.0".to_string(),
            updated_at: Utc::now(),
            total_tables: tables.len() as i32,
            total_rows,
            total_size_bytes,
            tables,
        };
        
        // Save catalog to R2
        let catalog_json = serde_json::to_string_pretty(&catalog)?;
        self.r2_client.put_catalog(&catalog_json).await?;
        
        info!("Catalog update complete: {} tables, {} rows, {} bytes",
            catalog.total_tables, catalog.total_rows, catalog.total_size_bytes);
        
        Ok(catalog)
    }

    async fn discover_event_types(&self) -> Result<Vec<String>> {
        let prefixes = self.r2_client.list_prefixes("events/").await?;
        
        Ok(prefixes
            .into_iter()
            .filter_map(|prefix| {
                // Extract event type from path like "events/page_view/"
                let parts: Vec<&str> = prefix.split('/').collect();
                if parts.len() >= 2 && !parts[1].is_empty() {
                    Some(parts[1].to_string())
                } else {
                    None
                }
            })
            .collect())
    }

    async fn scan_event_type(&self, scanner: &PartitionScanner<'_>, event_type: &str) -> Result<TableMetadata> {
        let partitions = scanner.scan_partitions(event_type).await?;
        
        let total_rows = partitions.iter().map(|p| p.row_count).sum();
        let total_size_bytes = partitions.iter().map(|p| p.size_bytes).sum();
        
        Ok(TableMetadata {
            table_name: format!("events_{}", event_type),
            event_type: event_type.to_string(),
            total_rows,
            total_size_bytes,
            last_updated: Utc::now(),
            partitions,
            schema: None, // Could be enhanced to extract schema from sample files
        })
    }

    pub async fn get_catalog(&self) -> Result<Option<CatalogSummary>> {
        match self.r2_client.get_catalog().await? {
            Some(json) => {
                let catalog = serde_json::from_str(&json)?;
                Ok(Some(catalog))
            }
            None => Ok(None),
        }
    }
}