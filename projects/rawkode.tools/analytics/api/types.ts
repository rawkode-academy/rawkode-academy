export interface Env {
  ANALYTICS_SOURCE: R2Bucket;
  ANALYTICS_PROCESSED: R2Bucket;
  ANALYTICS_CATALOG: R2Bucket;
  ANALYTICS_ENGINE: AnalyticsEngineDataset;
  DUCKDB_WASM_URL?: string;
  R2_ENDPOINT?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
}

export interface Context {
  env: Env;
  executionContext: ExecutionContext;
}

export interface TimeRange {
  start: string;
  end: string;
}

export interface EventCount {
  dimensions: Record<string, string>;
  count: number;
}

export interface TableMetadata {
  tableName: string;
  eventType: string;
  totalRows: number;
  totalSizeBytes: number;
  lastUpdated: string;
  partitions?: PartitionMetadata[];
}

export interface PartitionMetadata {
  path: string;
  year: number;
  month: number;
  day: number;
  hour: number;
  fileCount: number;
  rowCount: number;
  sizeBytes: number;
}
