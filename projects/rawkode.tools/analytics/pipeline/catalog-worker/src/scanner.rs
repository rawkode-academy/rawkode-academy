use crate::error::{CatalogError, Result};
use crate::models::PartitionMetadata;
use crate::r2::R2Client;
use chrono::{DateTime, NaiveDate, Utc};
use tracing::info;

pub struct PartitionScanner<'a> {
    r2_client: &'a R2Client,
}

impl<'a> PartitionScanner<'a> {
    pub fn new(r2_client: &'a R2Client) -> Self {
        Self { r2_client }
    }

    pub async fn scan_partitions(&self, event_type: &str) -> Result<Vec<PartitionMetadata>> {
        info!("Scanning partitions for event type: {}", event_type);
        
        let prefix = format!("events/{}/", event_type);
        let year_prefixes = self.r2_client.list_prefixes(&prefix).await?;
        
        let mut all_partitions = Vec::new();
        
        for year_prefix in year_prefixes {
            let year = self.extract_year_from_prefix(&year_prefix)?;
            let month_prefixes = self.r2_client.list_prefixes(&year_prefix).await?;
            
            for month_prefix in month_prefixes {
                let month = self.extract_month_from_prefix(&month_prefix)?;
                let day_prefixes = self.r2_client.list_prefixes(&month_prefix).await?;
                
                for day_prefix in day_prefixes {
                    let day = self.extract_day_from_prefix(&day_prefix)?;
                    let hour_prefixes = self.r2_client.list_prefixes(&day_prefix).await?;
                    
                    for hour_prefix in hour_prefixes {
                        let hour = self.extract_hour_from_prefix(&hour_prefix)?;
                        
                        if let Some(partition) = self.scan_hour_partition(
                            &hour_prefix,
                            event_type,
                            year,
                            month,
                            day,
                            hour
                        ).await? {
                            all_partitions.push(partition);
                        }
                    }
                }
            }
        }
        
        Ok(all_partitions)
    }

    async fn scan_hour_partition(
        &self,
        hour_prefix: &str,
        _event_type: &str,
        year: i32,
        month: i32,
        day: i32,
        hour: i32,
    ) -> Result<Option<PartitionMetadata>> {
        let objects = self.r2_client.list_objects(hour_prefix, Some(1000)).await?;
        
        if objects.is_empty() {
            return Ok(None);
        }
        
        let mut total_rows = 0i64;
        let mut total_size = 0i64;
        let mut min_event_time: Option<DateTime<Utc>> = None;
        let mut max_event_time: Option<DateTime<Utc>> = None;
        let file_count = objects.len() as i32;
        
        for obj in &objects {
            total_size += obj.size;
            
            // Extract row count from custom metadata
            if let Some(row_count_str) = obj.custom_metadata.get("row-count") {
                if let Ok(row_count) = row_count_str.parse::<i64>() {
                    total_rows += row_count;
                }
            }
            
            // Extract event time range from custom metadata
            if let Some(min_time_str) = obj.custom_metadata.get("min-event-time") {
                if let Ok(min_time) = DateTime::parse_from_rfc3339(min_time_str) {
                    let min_time_utc = min_time.with_timezone(&Utc);
                    min_event_time = Some(match min_event_time {
                        Some(current) => current.min(min_time_utc),
                        None => min_time_utc,
                    });
                }
            }
            
            if let Some(max_time_str) = obj.custom_metadata.get("max-event-time") {
                if let Ok(max_time) = DateTime::parse_from_rfc3339(max_time_str) {
                    let max_time_utc = max_time.with_timezone(&Utc);
                    max_event_time = Some(match max_event_time {
                        Some(current) => current.max(max_time_utc),
                        None => max_time_utc,
                    });
                }
            }
        }
        
        // Use partition time as fallback if no event times found
        let partition_time = NaiveDate::from_ymd_opt(year, month as u32, day as u32)
            .and_then(|d| d.and_hms_opt(hour as u32, 0, 0))
            .map(|dt| DateTime::<Utc>::from_naive_utc_and_offset(dt, Utc))
            .ok_or_else(|| CatalogError::InvalidPartitionPath(
                format!("Invalid date components: {}-{}-{} {}:00", year, month, day, hour)
            ))?;
        
        let min_event_time = min_event_time.unwrap_or(partition_time);
        let max_event_time = max_event_time.unwrap_or(partition_time);
        
        Ok(Some(PartitionMetadata {
            path: hour_prefix.to_string(),
            year,
            month,
            day,
            hour,
            file_count,
            row_count: total_rows,
            size_bytes: total_size,
            min_event_time,
            max_event_time,
        }))
    }

    fn extract_year_from_prefix(&self, prefix: &str) -> Result<i32> {
        let parts: Vec<&str> = prefix.split('/').collect();
        if parts.len() >= 3 {
            parts[2].parse().map_err(|_| 
                CatalogError::InvalidPartitionPath(format!("Invalid year in path: {}", prefix))
            )
        } else {
            Err(CatalogError::InvalidPartitionPath(format!("Cannot extract year from: {}", prefix)))
        }
    }

    fn extract_month_from_prefix(&self, prefix: &str) -> Result<i32> {
        let parts: Vec<&str> = prefix.split('/').collect();
        if parts.len() >= 4 {
            parts[3].parse().map_err(|_| 
                CatalogError::InvalidPartitionPath(format!("Invalid month in path: {}", prefix))
            )
        } else {
            Err(CatalogError::InvalidPartitionPath(format!("Cannot extract month from: {}", prefix)))
        }
    }

    fn extract_day_from_prefix(&self, prefix: &str) -> Result<i32> {
        let parts: Vec<&str> = prefix.split('/').collect();
        if parts.len() >= 5 {
            parts[4].parse().map_err(|_| 
                CatalogError::InvalidPartitionPath(format!("Invalid day in path: {}", prefix))
            )
        } else {
            Err(CatalogError::InvalidPartitionPath(format!("Cannot extract day from: {}", prefix)))
        }
    }

    fn extract_hour_from_prefix(&self, prefix: &str) -> Result<i32> {
        let parts: Vec<&str> = prefix.split('/').collect();
        if parts.len() >= 6 {
            parts[5].parse().map_err(|_| 
                CatalogError::InvalidPartitionPath(format!("Invalid hour in path: {}", prefix))
            )
        } else {
            Err(CatalogError::InvalidPartitionPath(format!("Cannot extract hour from: {}", prefix)))
        }
    }
}