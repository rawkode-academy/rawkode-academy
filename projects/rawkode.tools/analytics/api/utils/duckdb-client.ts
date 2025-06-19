import type { Env } from '../types';
import type { AsyncDuckDB, DuckDBConnection, DuckDBModule } from '../types/duckdb';

export class DuckDBClient {
  private db: AsyncDuckDB | null = null;
  private conn: DuckDBConnection | null = null;

  constructor(private env: Env) {}

  async initialize(): Promise<void> {
    // Dynamic import for DuckDB WASM
    const duckdb = (await import('@duckdb/duckdb-wasm')) as unknown as DuckDBModule;

    // Bundle the WASM files with the worker or load from CDN
    const DUCKDB_BUNDLES = duckdb.getJsDelivrBundles();

    // Create DuckDB instance
    const bundle = await duckdb.selectBundle(DUCKDB_BUNDLES);
    const worker_url = URL.createObjectURL(
      new Blob([`importScripts("${bundle.mainWorker}");`], { type: 'text/javascript' }),
    );

    const worker = new Worker(worker_url);
    const logger = new duckdb.ConsoleLogger();
    this.db = new duckdb.AsyncDuckDB(logger, worker);

    await this.db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    this.conn = await this.db.connect();

    // Configure S3 access for R2
    await this.setupR2Access();
  }

  private async setupR2Access(): Promise<void> {
    if (!this.conn) {
      throw new Error('DuckDB connection not initialized');
    }
    // Install and load required extensions
    await this.conn.query(`INSTALL httpfs;`);
    await this.conn.query(`LOAD httpfs;`);

    // Configure S3 settings for R2
    await this.conn.query(`
      SET s3_region='auto';
      SET s3_endpoint='${this.env.R2_ENDPOINT || 'https://ACCOUNT_ID.r2.cloudflarestorage.com'}';
      SET s3_access_key_id='${this.env.R2_ACCESS_KEY_ID || ''}';
      SET s3_secret_access_key='${this.env.R2_SECRET_ACCESS_KEY || ''}';
      SET s3_url_style='path';
    `);
  }

  async query(sql: string): Promise<Record<string, unknown>[]> {
    if (!this.conn) {
      throw new Error('DuckDB connection not initialized');
    }
    try {
      const result = await this.conn.query(sql);
      return result.toArray().map((row) => row.toJSON());
    } catch (error) {
      console.error('DuckDB query error:', error);
      throw new Error(`Query failed: ${error}`);
    }
  }

  async close(): Promise<void> {
    if (this.conn) {
      await this.conn.close();
    }
    if (this.db) {
      await this.db.terminate();
    }
  }
}
