// Type definitions for DuckDB WASM
export interface DuckDBLogger {
  log(message: string): void;
}

export interface DuckDBModule {
  AsyncDuckDB: new (logger: DuckDBLogger, worker: Worker) => AsyncDuckDB;
  ConsoleLogger: new () => DuckDBLogger;
  getJsDelivrBundles: () => DuckDBBundle[];
  selectBundle: (bundles: DuckDBBundle[]) => Promise<DuckDBBundle>;
}

export interface DuckDBBundle {
  mainWorker: string;
  mainModule: string;
  pthreadWorker?: string;
}

export interface AsyncDuckDB {
  instantiate(mainModule: string, pthreadWorker?: string): Promise<void>;
  connect(): Promise<DuckDBConnection>;
  terminate(): Promise<void>;
}

export interface DuckDBConnection {
  query(sql: string): Promise<DuckDBResult>;
  close(): Promise<void>;
}

export interface DuckDBResult {
  toArray(): DuckDBRow[];
}

export interface DuckDBRow {
  toJSON(): Record<string, unknown>;
}
