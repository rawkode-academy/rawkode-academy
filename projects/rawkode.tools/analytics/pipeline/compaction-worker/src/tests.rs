#[cfg(test)]
mod tests {
    use super::*;
    use wasm_bindgen_test::*;

    #[wasm_bindgen_test]
    fn test_partition_regex() {
        let regex = Regex::new(r"^(events/[^/]+/year=\d+/month=\d+/day=\d+/hour=\d+)/").unwrap();
        
        // Test valid partition paths
        let valid_paths = vec![
            "events/pageview/year=2024/month=01/day=15/hour=14/file1.parquet",
            "events/click/year=2023/month=12/day=31/hour=23/file2.parquet",
            "events/analytics.web.pageview/year=2024/month=06/day=20/hour=00/test.parquet",
        ];
        
        for path in valid_paths {
            let captures = regex.captures(path);
            assert!(captures.is_some(), "Path should match: {}", path);
            
            let partition = captures.unwrap().get(1).unwrap().as_str();
            assert!(partition.starts_with("events/"));
            assert!(partition.contains("year="));
            assert!(partition.contains("month="));
            assert!(partition.contains("day="));
            assert!(partition.contains("hour="));
        }
        
        // Test invalid paths
        let invalid_paths = vec![
            "notevents/pageview/year=2024/month=01/day=15/hour=14/file.parquet",
            "events/pageview/invalid/structure/file.parquet",
            "events/pageview/year=2024/file.parquet",
            "_test/connection-test.txt",
        ];
        
        for path in invalid_paths {
            let captures = regex.captures(path);
            assert!(captures.is_none(), "Path should not match: {}", path);
        }
    }

    #[test]
    fn test_compaction_candidate_grouping() {
        let mut candidates: HashMap<String, CompactionCandidate> = HashMap::new();
        
        // Simulate adding files to candidates
        let partition1 = "events/pageview/year=2024/month=01/day=15/hour=14".to_string();
        let partition2 = "events/click/year=2024/month=01/day=15/hour=14".to_string();
        
        // Add files to partition1
        for i in 0..5 {
            let candidate = candidates.entry(partition1.clone())
                .or_insert_with(|| CompactionCandidate {
                    partition_path: partition1.clone(),
                    files: Vec::new(),
                    total_size_bytes: 0,
                });
            candidate.total_size_bytes += 1024 * 1024; // 1MB each
        }
        
        // Add files to partition2
        for i in 0..2 {
            let candidate = candidates.entry(partition2.clone())
                .or_insert_with(|| CompactionCandidate {
                    partition_path: partition2.clone(),
                    files: Vec::new(),
                    total_size_bytes: 0,
                });
            candidate.total_size_bytes += 5 * 1024 * 1024; // 5MB each
        }
        
        // Filter candidates with multiple files
        let filtered: Vec<_> = candidates.into_values()
            .filter(|c| c.total_size_bytes > 0)
            .collect();
        
        assert_eq!(filtered.len(), 2);
        
        // Check partition1 has correct total size
        let p1 = filtered.iter().find(|c| c.partition_path == partition1).unwrap();
        assert_eq!(p1.total_size_bytes, 5 * 1024 * 1024);
        
        // Check partition2 has correct total size
        let p2 = filtered.iter().find(|c| c.partition_path == partition2).unwrap();
        assert_eq!(p2.total_size_bytes, 10 * 1024 * 1024);
    }

    #[test]
    fn test_batch_grouping_logic() {
        // Test that files are correctly grouped into batches based on target size
        let target_size: u64 = 10 * 1024 * 1024; // 10MB target
        
        // Create mock files with different sizes
        let file_sizes = vec![
            3 * 1024 * 1024,  // 3MB
            4 * 1024 * 1024,  // 4MB
            2 * 1024 * 1024,  // 2MB
            8 * 1024 * 1024,  // 8MB
            1 * 1024 * 1024,  // 1MB
            5 * 1024 * 1024,  // 5MB
        ];
        
        let mut batches: Vec<Vec<u64>> = Vec::new();
        let mut current_batch: Vec<u64> = Vec::new();
        let mut current_batch_size: u64 = 0;
        
        for size in file_sizes {
            if current_batch_size + size > target_size && !current_batch.is_empty() {
                batches.push(current_batch);
                current_batch = Vec::new();
                current_batch_size = 0;
            }
            
            current_batch_size += size;
            current_batch.push(size);
        }
        
        if current_batch.len() > 1 {
            batches.push(current_batch);
        }
        
        // Verify batching logic
        assert_eq!(batches.len(), 2, "Should have 2 batches");
        
        // First batch: 3MB + 4MB + 2MB = 9MB (under 10MB target)
        assert_eq!(batches[0].len(), 3);
        assert_eq!(batches[0].iter().sum::<u64>(), 9 * 1024 * 1024);
        
        // Second batch: 8MB + 1MB = 9MB (5MB would exceed target, so new batch)
        assert_eq!(batches[1].len(), 2);
        assert_eq!(batches[1].iter().sum::<u64>(), 9 * 1024 * 1024);
    }

    #[test]
    fn test_metadata_generation() {
        use chrono::DateTime;
        
        let mut metadata = HashMap::new();
        metadata.insert("eventCount".to_string(), "100".to_string());
        metadata.insert("sourceFiles".to_string(), "5".to_string());
        metadata.insert("compactedAt".to_string(), Utc::now().to_rfc3339());
        
        // Verify metadata structure
        assert_eq!(metadata.get("eventCount").unwrap(), "100");
        assert_eq!(metadata.get("sourceFiles").unwrap(), "5");
        
        // Verify timestamp is valid RFC3339
        let timestamp = metadata.get("compactedAt").unwrap();
        assert!(DateTime::parse_from_rfc3339(timestamp).is_ok());
    }

    #[test]
    fn test_output_key_generation() {
        let partition_path = "events/pageview/year=2024/month=01/day=15/hour=14";
        let timestamp = 1705330800000_i64; // Fixed timestamp for testing
        let uuid = "550e8400-e29b-41d4-a716-446655440000"; // Fixed UUID for testing
        
        let output_key = format!("{}/compacted_{}_{}.parquet", 
            partition_path, timestamp, uuid);
        
        // Verify output key format
        assert!(output_key.starts_with(partition_path));
        assert!(output_key.ends_with(".parquet"));
        assert!(output_key.contains("compacted_"));
        assert!(output_key.contains(&timestamp.to_string()));
        assert!(output_key.contains(uuid));
        
        // Verify it maintains the partition structure
        assert!(output_key.contains("year=2024"));
        assert!(output_key.contains("month=01"));
        assert!(output_key.contains("day=15"));
        assert!(output_key.contains("hour=14"));
    }

    #[test]
    fn test_threshold_filtering() {
        let threshold_bytes: u64 = 10 * 1024 * 1024; // 10MB threshold
        
        let file_sizes = vec![
            (5 * 1024 * 1024, true),   // 5MB - should be included
            (15 * 1024 * 1024, false), // 15MB - should be excluded
            (1 * 1024 * 1024, true),   // 1MB - should be included
            (10 * 1024 * 1024, false), // 10MB - exactly threshold, excluded
            (9 * 1024 * 1024, true),   // 9MB - should be included
        ];
        
        for (size, should_include) in file_sizes {
            let included = size < threshold_bytes;
            assert_eq!(
                included, should_include,
                "File size {} should {} be included",
                size,
                if should_include { "" } else { "not" }
            );
        }
    }

    #[test]
    fn test_error_response_serialization() {
        let error_response = ErrorResponse {
            error: "Test error message".to_string(),
        };
        
        let serialized = serde_json::to_string(&error_response).unwrap();
        let deserialized: ErrorResponse = serde_json::from_str(&serialized).unwrap();
        
        assert_eq!(deserialized.error, "Test error message");
    }

    #[test]
    fn test_compaction_response_serialization() {
        let response = CompactionResponse {
            success: true,
            candidates_found: 10,
            partitions_compacted: 8,
        };
        
        let serialized = serde_json::to_string(&response).unwrap();
        let deserialized: CompactionResponse = serde_json::from_str(&serialized).unwrap();
        
        assert_eq!(deserialized.success, true);
        assert_eq!(deserialized.candidates_found, 10);
        assert_eq!(deserialized.partitions_compacted, 8);
    }

    #[test]
    fn test_candidates_response_serialization() {
        let response = CandidatesResponse {
            candidates: vec![
                CandidateInfo {
                    partition: "events/pageview/year=2024/month=01/day=15/hour=14".to_string(),
                    file_count: 5,
                    total_size_mb: "4.50".to_string(),
                },
                CandidateInfo {
                    partition: "events/click/year=2024/month=01/day=15/hour=15".to_string(),
                    file_count: 3,
                    total_size_mb: "2.75".to_string(),
                },
            ],
        };
        
        let serialized = serde_json::to_string(&response).unwrap();
        let deserialized: CandidatesResponse = serde_json::from_str(&serialized).unwrap();
        
        assert_eq!(deserialized.candidates.len(), 2);
        assert_eq!(deserialized.candidates[0].file_count, 5);
        assert_eq!(deserialized.candidates[1].total_size_mb, "2.75");
    }
}