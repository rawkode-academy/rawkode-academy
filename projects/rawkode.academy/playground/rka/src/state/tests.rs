#[cfg(test)]
mod tests {
    use super::super::*;
    use chrono::Utc;

    #[test]
    fn test_state_serialization() {
        let state = PlaygroundState {
            course_id: "test-course".to_string(),
            vm_name: "test-vm".to_string(),
            vm_provider: "test-provider".to_string(),
            status: "running".to_string(),
            started_at: Utc::now(),
            teleport_url: "http://localhost:3080".to_string(),
            resources: ResourceAllocation {
                cpus: 4,
                memory_gb: 8,
                disk_gb: 20,
            },
        };

        // Test serialization
        let json = serde_json::to_string(&state).unwrap();
        assert!(json.contains("test-course"));
        assert!(json.contains("test-vm"));
        
        // Test deserialization
        let deserialized: PlaygroundState = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.course_id, state.course_id);
        assert_eq!(deserialized.vm_name, state.vm_name);
        assert_eq!(deserialized.resources.cpus, state.resources.cpus);
    }
}