#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::*;
    use chrono::Utc;

    #[test]
    fn test_catalog_summary_default() {
        let catalog = CatalogSummary::default();
        assert_eq!(catalog.version, "1.0");
        assert_eq!(catalog.total_tables, 0);
        assert_eq!(catalog.total_rows, 0);
        assert_eq!(catalog.total_size_bytes, 0);
        assert!(catalog.tables.is_empty());
    }

    #[test]
    fn test_partition_metadata_serialization() {
        let partition = PartitionMetadata {
            path: "events/page_view/2024/01/15/10/".to_string(),
            year: 2024,
            month: 1,
            day: 15,
            hour: 10,
            file_count: 5,
            row_count: 1000,
            size_bytes: 1024000,
            min_event_time: Utc::now(),
            max_event_time: Utc::now(),
        };

        let json = serde_json::to_string(&partition).unwrap();
        let deserialized: PartitionMetadata = serde_json::from_str(&json).unwrap();
        
        assert_eq!(partition.path, deserialized.path);
        assert_eq!(partition.year, deserialized.year);
        assert_eq!(partition.row_count, deserialized.row_count);
    }

    #[test]
    fn test_cost_calculation() {
        let storage_costs = StorageCosts {
            total_gb: 100.0,
            cost_per_gb: 0.015,
            monthly_cost: 1.5,
        };

        assert_eq!(storage_costs.monthly_cost, storage_costs.total_gb * storage_costs.cost_per_gb);
    }
}