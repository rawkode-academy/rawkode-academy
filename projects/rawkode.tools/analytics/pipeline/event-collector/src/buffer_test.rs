#[cfg(test)]
mod tests {
    use super::super::buffer::*;
    use cloudevents::{EventBuilder, EventBuilderV10};
    use chrono::Utc;

    fn create_test_event(event_type: &str) -> Event {
        EventBuilderV10::new()
            .id(format!("test-{}", uuid::Uuid::new_v4()))
            .ty(event_type)
            .source("test-source")
            .time(Utc::now())
            .data("application/json", serde_json::json!({"test": true}))
            .build()
            .unwrap()
    }

    #[test]
    fn test_event_buffer_creation() {
        let buffer = EventBuffer::new(100, std::time::Duration::from_secs(60));
        assert_eq!(buffer.events.len(), 0);
        assert_eq!(buffer.max_size, 100);
    }

    #[test]
    fn test_add_event() {
        let mut buffer = EventBuffer::new(10, std::time::Duration::from_secs(60));
        let event = create_test_event("test.event");
        
        buffer.add(event.clone());
        assert_eq!(buffer.events.len(), 1);
        assert_eq!(buffer.events[0].ty(), "test.event");
    }

    #[test]
    fn test_should_flush_by_size() {
        let mut buffer = EventBuffer::new(2, std::time::Duration::from_secs(60));
        
        buffer.add(create_test_event("test.event1"));
        assert!(!buffer.should_flush());
        
        buffer.add(create_test_event("test.event2"));
        assert!(buffer.should_flush());
    }

    #[test]
    fn test_should_flush_by_time() {
        let mut buffer = EventBuffer::new(100, std::time::Duration::from_millis(100));
        buffer.add(create_test_event("test.event"));
        
        assert!(!buffer.should_flush());
        
        std::thread::sleep(std::time::Duration::from_millis(150));
        assert!(buffer.should_flush());
    }

    #[test]
    fn test_clear_buffer() {
        let mut buffer = EventBuffer::new(10, std::time::Duration::from_secs(60));
        
        for i in 0..5 {
            buffer.add(create_test_event(&format!("test.event{}", i)));
        }
        
        assert_eq!(buffer.events.len(), 5);
        
        buffer.clear();
        assert_eq!(buffer.events.len(), 0);
        assert!(buffer.last_flush_time > std::time::Instant::now() - std::time::Duration::from_secs(1));
    }

    #[test]
    fn test_partitioned_buffer_creation() {
        let buffer = PartitionedEventBuffer::new(100, std::time::Duration::from_secs(60));
        assert_eq!(buffer.buffers.len(), 0);
    }

    #[test]
    fn test_partitioned_buffer_add_event() {
        let mut buffer = PartitionedEventBuffer::new(10, std::time::Duration::from_secs(60));
        
        let event1 = create_test_event("page_view");
        let event2 = create_test_event("click");
        let event3 = create_test_event("page_view");
        
        buffer.add(event1);
        buffer.add(event2);
        buffer.add(event3);
        
        assert_eq!(buffer.buffers.len(), 2);
        assert_eq!(buffer.buffers.get("page_view").unwrap().events.len(), 2);
        assert_eq!(buffer.buffers.get("click").unwrap().events.len(), 1);
    }

    #[test]
    fn test_partitioned_buffer_get_flushable() {
        let mut buffer = PartitionedEventBuffer::new(2, std::time::Duration::from_secs(60));
        
        // Add events to different partitions
        buffer.add(create_test_event("page_view"));
        buffer.add(create_test_event("page_view")); // This should trigger flush for page_view
        buffer.add(create_test_event("click"));
        
        let flushable = buffer.get_flushable_partitions();
        assert_eq!(flushable.len(), 1);
        assert_eq!(flushable[0], "page_view");
    }

    #[test]
    fn test_partitioned_buffer_flush_partition() {
        let mut buffer = PartitionedEventBuffer::new(2, std::time::Duration::from_secs(60));
        
        buffer.add(create_test_event("page_view"));
        buffer.add(create_test_event("page_view"));
        
        let events = buffer.flush_partition("page_view");
        assert_eq!(events.len(), 2);
        assert_eq!(buffer.buffers.get("page_view").unwrap().events.len(), 0);
    }

    #[test]
    fn test_partitioned_buffer_multiple_event_types() {
        let mut buffer = PartitionedEventBuffer::new(5, std::time::Duration::from_secs(60));
        
        let event_types = vec!["page_view", "click", "scroll", "form_submit"];
        
        for (i, event_type) in event_types.iter().enumerate() {
            for _ in 0..=i {
                buffer.add(create_test_event(event_type));
            }
        }
        
        assert_eq!(buffer.buffers.len(), 4);
        assert_eq!(buffer.buffers.get("page_view").unwrap().events.len(), 1);
        assert_eq!(buffer.buffers.get("click").unwrap().events.len(), 2);
        assert_eq!(buffer.buffers.get("scroll").unwrap().events.len(), 3);
        assert_eq!(buffer.buffers.get("form_submit").unwrap().events.len(), 4);
    }

    #[test]
    fn test_concurrent_access() {
        use std::sync::{Arc, Mutex};
        use std::thread;
        
        let buffer = Arc::new(Mutex::new(PartitionedEventBuffer::new(100, std::time::Duration::from_secs(60))));
        let mut handles = vec![];
        
        for i in 0..10 {
            let buffer_clone = Arc::clone(&buffer);
            let handle = thread::spawn(move || {
                let event_type = format!("event_type_{}", i % 3);
                for _ in 0..10 {
                    let event = create_test_event(&event_type);
                    buffer_clone.lock().unwrap().add(event);
                }
            });
            handles.push(handle);
        }
        
        for handle in handles {
            handle.join().unwrap();
        }
        
        let buffer = buffer.lock().unwrap();
        let total_events: usize = buffer.buffers.values()
            .map(|b| b.events.len())
            .sum();
        
        assert_eq!(total_events, 100);
        assert_eq!(buffer.buffers.len(), 3);
    }
}