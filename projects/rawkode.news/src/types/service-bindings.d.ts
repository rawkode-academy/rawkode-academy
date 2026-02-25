export interface TypedEnv {
  DB: D1Database;
  SESSION: KVNamespace;
  ASSETS: Fetcher;
}
