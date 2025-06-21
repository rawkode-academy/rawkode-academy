use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId};
use crate::iceberg::writer::*;
use crate::iceberg::manifest::*;
use cloudevents::{Event, EventBuilder, EventBuilderV10};
use chrono::Utc;

fn generate_test_events(count: usize) -> Vec<Event> {
    (0..count)
        .map(|i| {
            EventBuilderV10::new()
                .id(format!("bench-event-{}", i))
                .source("benchmark-source")
                .ty("benchmark.event.type")
                .time(Utc::now())
                .data("application/json", serde_json::json!({
                    "index": i,
                    "message": format!("Benchmark event {}", i),
                    "timestamp": Utc::now().to_rfc3339(),
                    "data": "x".repeat(100), // 100 bytes of data
                }))
                .build()
                .unwrap()
        })
        .collect()
}

fn create_test_data_file(name: &str, records: i64) -> DataFile {
    DataFile {
        path: format!("data/{}", name),
        file_format: FileFormat::Parquet,
        record_count: records,
        file_size_bytes: records * 1024, // Assume 1KB per record
        column_sizes: std::collections::HashMap::new(),
        value_counts: std::collections::HashMap::new(),
        null_value_counts: std::collections::HashMap::new(),
        lower_bounds: std::collections::HashMap::new(),
        upper_bounds: std::collections::HashMap::new(),
        key_metadata: None,
    }
}

fn benchmark_iceberg_writes(c: &mut Criterion) {
    let mut group = c.benchmark_group("iceberg_writes");
    
    // Test different batch sizes
    for size in [100, 1000, 10000].iter() {
        group.bench_with_input(
            BenchmarkId::from_parameter(format!("{}_events", size)),
            size,
            |b, &size| {
                let runtime = tokio::runtime::Runtime::new().unwrap();
                let events = generate_test_events(size);
                let config = WriteConfig::default();
                let writer = IcebergWriter::new(create_test_env(), config);
                
                b.iter(|| {
                    runtime.block_on(async {
                        black_box(writer.write_data_file(events.clone()).await.unwrap());
                    })
                })
            },
        );
    }
    
    group.finish();
}

fn benchmark_parquet_conversion(c: &mut Criterion) {
    let mut group = c.benchmark_group("parquet_conversion");
    
    for size in [100, 1000, 10000].iter() {
        group.bench_with_input(
            BenchmarkId::from_parameter(format!("{}_events", size)),
            size,
            |b, &size| {
                let events = generate_test_events(size);
                let config = WriteConfig::default();
                let writer = IcebergWriter::new(create_test_env(), config);
                
                b.iter(|| {
                    black_box(writer.events_to_parquet(&events).unwrap());
                })
            },
        );
    }
    
    group.finish();
}

fn benchmark_compression_types(c: &mut Criterion) {
    let mut group = c.benchmark_group("compression_types");
    let events = generate_test_events(1000);
    
    for compression in [
        CompressionType::None,
        CompressionType::Snappy,
        CompressionType::Gzip,
        CompressionType::Lz4,
        CompressionType::Zstd,
    ].iter() {
        group.bench_with_input(
            BenchmarkId::from_parameter(format!("{:?}", compression)),
            compression,
            |b, &compression| {
                let mut config = WriteConfig::default();
                config.compression = *compression;
                let writer = IcebergWriter::new(create_test_env(), config);
                
                b.iter(|| {
                    black_box(writer.events_to_parquet(&events).unwrap());
                })
            },
        );
    }
    
    group.finish();
}

fn benchmark_manifest_operations(c: &mut Criterion) {
    let mut group = c.benchmark_group("manifest_operations");
    
    // Benchmark manifest creation with different file counts
    for file_count in [10, 100, 1000].iter() {
        group.bench_with_input(
            BenchmarkId::from_parameter(format!("{}_files", file_count)),
            file_count,
            |b, &file_count| {
                let data_files: Vec<DataFile> = (0..file_count)
                    .map(|i| create_test_data_file(&format!("file{}.parquet", i), 1000))
                    .collect();
                
                b.iter(|| {
                    black_box(ManifestFile::create(data_files.clone()));
                })
            },
        );
    }
    
    group.finish();
}

fn benchmark_metadata_operations(c: &mut Criterion) {
    let mut group = c.benchmark_group("metadata_operations");
    
    group.bench_function("create_initial_metadata", |b| {
        let schema = create_test_schema();
        
        b.iter(|| {
            black_box(IcebergMetadata::create_initial(
                "s3://bucket/table".to_string(),
                schema.clone(),
            ));
        })
    });
    
    group.bench_function("add_snapshot", |b| {
        let mut metadata = create_test_metadata();
        let snapshot = create_test_snapshot();
        
        b.iter(|| {
            let mut m = metadata.clone();
            black_box(m.add_snapshot(snapshot.clone()));
        })
    });
    
    group.bench_function("validate_invariants", |b| {
        let metadata = create_large_metadata(100); // 100 snapshots
        
        b.iter(|| {
            black_box(metadata.validate_invariants());
        })
    });
    
    group.finish();
}

fn benchmark_row_group_sizes(c: &mut Criterion) {
    let mut group = c.benchmark_group("row_group_sizes");
    let events = generate_test_events(100000); // 100k events
    
    for row_group_size in [1000, 10000, 50000, 100000].iter() {
        group.bench_with_input(
            BenchmarkId::from_parameter(format!("{}_rows", row_group_size)),
            row_group_size,
            |b, &row_group_size| {
                let mut config = WriteConfig::default();
                config.row_group_size = row_group_size;
                let writer = IcebergWriter::new(create_test_env(), config);
                
                b.iter(|| {
                    black_box(writer.events_to_parquet(&events).unwrap());
                })
            },
        );
    }
    
    group.finish();
}

// Memory usage benchmark
fn benchmark_memory_usage(c: &mut Criterion) {
    let mut group = c.benchmark_group("memory_usage");
    group.sample_size(10); // Reduce sample size for memory benchmarks
    
    group.bench_function("write_large_batch", |b| {
        let runtime = tokio::runtime::Runtime::new().unwrap();
        
        b.iter(|| {
            runtime.block_on(async {
                let events = generate_test_events(50000); // 50k events
                let config = WriteConfig::default();
                let writer = IcebergWriter::new(create_test_env(), config);
                
                black_box(writer.write_data_file(events).await.unwrap());
            })
        })
    });
    
    group.finish();
}

// Concurrent write benchmark
fn benchmark_concurrent_writes(c: &mut Criterion) {
    let mut group = c.benchmark_group("concurrent_writes");
    group.sample_size(10);
    
    for concurrency in [1, 5, 10, 20].iter() {
        group.bench_with_input(
            BenchmarkId::from_parameter(format!("{}_writers", concurrency)),
            concurrency,
            |b, &concurrency| {
                let runtime = tokio::runtime::Runtime::new().unwrap();
                
                b.iter(|| {
                    runtime.block_on(async {
                        let mut handles = vec![];
                        
                        for i in 0..concurrency {
                            let handle = tokio::spawn(async move {
                                let events = generate_test_events(1000);
                                let config = WriteConfig::default();
                                let writer = IcebergWriter::new(create_test_env(), config);
                                writer.write_data_file(events).await.unwrap()
                            });
                            handles.push(handle);
                        }
                        
                        let results = futures::future::join_all(handles).await;
                        black_box(results);
                    })
                })
            },
        );
    }
    
    group.finish();
}

// Test helper functions
fn create_test_env() -> worker::Env {
    // Mock environment for benchmarking
    unsafe { worker::Env::from_raw(std::ptr::null_mut()) }
}

fn create_test_schema() -> crate::iceberg::metadata::Schema {
    crate::iceberg::metadata::Schema {
        schema_id: 0,
        fields: vec![
            crate::iceberg::metadata::Field {
                id: 1,
                name: "id".to_string(),
                field_type: "string".to_string(),
                required: true,
            },
            crate::iceberg::metadata::Field {
                id: 2,
                name: "timestamp".to_string(),
                field_type: "long".to_string(),
                required: true,
            },
        ],
    }
}

fn create_test_metadata() -> crate::iceberg::metadata::IcebergMetadata {
    crate::iceberg::metadata::IcebergMetadata::create_initial(
        "s3://test-bucket/test-table".to_string(),
        create_test_schema(),
    )
}

fn create_test_snapshot() -> crate::iceberg::metadata::Snapshot {
    crate::iceberg::metadata::Snapshot {
        snapshot_id: 1,
        parent_snapshot_id: None,
        sequence_number: 1,
        timestamp_ms: Utc::now().timestamp_millis(),
        manifest_list: "manifest-list-1.avro".to_string(),
        summary: crate::iceberg::metadata::SnapshotSummary {
            operation: "append".to_string(),
            properties: std::collections::HashMap::new(),
        },
        schema_id: Some(0),
    }
}

fn create_large_metadata(snapshot_count: usize) -> crate::iceberg::metadata::IcebergMetadata {
    let mut metadata = create_test_metadata();
    
    for i in 0..snapshot_count {
        let snapshot = crate::iceberg::metadata::Snapshot {
            snapshot_id: i as i64,
            parent_snapshot_id: if i > 0 { Some((i - 1) as i64) } else { None },
            sequence_number: i as i64,
            timestamp_ms: Utc::now().timestamp_millis() + i as i64,
            manifest_list: format!("manifest-list-{}.avro", i),
            summary: crate::iceberg::metadata::SnapshotSummary {
                operation: "append".to_string(),
                properties: std::collections::HashMap::new(),
            },
            schema_id: Some(0),
        };
        metadata.add_snapshot(snapshot);
    }
    
    metadata
}

criterion_group!(
    benches,
    benchmark_iceberg_writes,
    benchmark_parquet_conversion,
    benchmark_compression_types,
    benchmark_manifest_operations,
    benchmark_metadata_operations,
    benchmark_row_group_sizes,
    benchmark_memory_usage,
    benchmark_concurrent_writes
);

criterion_main!(benches);