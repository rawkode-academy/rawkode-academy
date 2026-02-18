export interface TypedEnv {
  DB: D1Database;
  SESSION: KVNamespace;
  ASSETS: Fetcher;
  AI: Ai;
  AI_SEARCH_INSTANCE?: string;
}
