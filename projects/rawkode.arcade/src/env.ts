export interface Env {
	ASSETS: Fetcher;
	IDENTITY: Fetcher;
	ARCADE_ASSETS: R2Bucket;
	DB: D1Database;
	GAME_ROOM: DurableObjectNamespace;
	AUDIENCE_SHARD: DurableObjectNamespace;
	TICKET_SECRET: string;
	SESSION_SECRET: string;
	ENVIRONMENT?: string;
	E2E_SEED_SECRET?: string;
	ADMISSION_ENABLED?: string;
}
