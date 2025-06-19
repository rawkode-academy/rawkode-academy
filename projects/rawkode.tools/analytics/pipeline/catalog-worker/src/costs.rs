use crate::error::Result;
use crate::models::{CatalogSummary, CostReport, OperationCosts, StorageCosts};
use crate::r2::R2Client;

const R2_STORAGE_COST_PER_GB_MONTH: f64 = 0.015;
const R2_CLASS_A_COST_PER_1M: f64 = 4.50;
const R2_CLASS_B_COST_PER_10M: f64 = 0.36;

pub struct CostCalculator<'a> {
    #[allow(dead_code)]
    r2_client: &'a R2Client,
}

impl<'a> CostCalculator<'a> {
    pub fn new(r2_client: &'a R2Client) -> Self {
        Self { r2_client }
    }

    pub async fn calculate_costs(&self, catalog: &CatalogSummary) -> Result<CostReport> {
        // Calculate storage costs
        let total_gb = catalog.total_size_bytes as f64 / (1024.0 * 1024.0 * 1024.0);
        let storage_monthly_cost = total_gb * R2_STORAGE_COST_PER_GB_MONTH;
        
        let storage_costs = StorageCosts {
            total_gb,
            cost_per_gb: R2_STORAGE_COST_PER_GB_MONTH,
            monthly_cost: storage_monthly_cost,
        };

        // Estimate operation costs based on typical usage patterns
        // These are rough estimates - in production you'd want to track actual operations
        let estimated_monthly_class_a = self.estimate_class_a_operations(catalog);
        let estimated_monthly_class_b = self.estimate_class_b_operations(catalog);
        
        let class_a_monthly_cost = (estimated_monthly_class_a as f64 / 1_000_000.0) * R2_CLASS_A_COST_PER_1M;
        let class_b_monthly_cost = (estimated_monthly_class_b as f64 / 10_000_000.0) * R2_CLASS_B_COST_PER_10M;
        
        let operation_costs = OperationCosts {
            class_a_operations: estimated_monthly_class_a,
            class_b_operations: estimated_monthly_class_b,
            monthly_cost: class_a_monthly_cost + class_b_monthly_cost,
        };

        let total_monthly_cost = storage_costs.monthly_cost + operation_costs.monthly_cost;

        Ok(CostReport {
            storage_costs,
            operation_costs,
            total_monthly_cost,
        })
    }

    fn estimate_class_a_operations(&self, catalog: &CatalogSummary) -> i64 {
        // Class A operations: PUT, POST, LIST
        // Estimate based on:
        // - Daily catalog updates (24 per day)
        // - Average files per partition * partitions per day
        let daily_catalog_updates = 24;
        let avg_files_per_partition = 10;
        let avg_new_partitions_per_day = 24; // One per hour
        
        let daily_puts = daily_catalog_updates + (avg_files_per_partition * avg_new_partitions_per_day);
        let daily_lists = daily_catalog_updates * catalog.total_tables as i64 * 4; // Scanning year/month/day/hour
        
        (daily_puts + daily_lists) * 30 // Monthly estimate
    }

    fn estimate_class_b_operations(&self, catalog: &CatalogSummary) -> i64 {
        // Class B operations: GET, HEAD
        // Estimate based on:
        // - Catalog reads (assume 100 per day)
        // - Metadata checks during scans
        let daily_catalog_reads = 100;
        let daily_metadata_checks = catalog.tables.iter()
            .map(|t| t.partitions.len() as i64 * 10) // Files per partition
            .sum::<i64>();
        
        (daily_catalog_reads + daily_metadata_checks) * 30 // Monthly estimate
    }

    #[allow(dead_code)]
    pub async fn calculate_actual_bucket_costs(&self) -> Result<CostReport> {
        // Calculate actual size by scanning the bucket
        let total_size_bytes = self.r2_client.calculate_bucket_size("").await?;
        let total_gb = total_size_bytes as f64 / (1024.0 * 1024.0 * 1024.0);
        let storage_monthly_cost = total_gb * R2_STORAGE_COST_PER_GB_MONTH;
        
        let storage_costs = StorageCosts {
            total_gb,
            cost_per_gb: R2_STORAGE_COST_PER_GB_MONTH,
            monthly_cost: storage_monthly_cost,
        };

        // For actual operation costs, we'd need CloudFlare analytics API
        // Using estimates for now
        let operation_costs = OperationCosts {
            class_a_operations: 50_000, // Placeholder
            class_b_operations: 500_000, // Placeholder
            monthly_cost: 0.23 + 0.02, // Placeholder calculation
        };

        let total_monthly_cost = storage_costs.monthly_cost + operation_costs.monthly_cost;

        Ok(CostReport {
            storage_costs,
            operation_costs,
            total_monthly_cost,
        })
    }
}