export interface Env {
	ASSETS: Fetcher;
	ARCADE_ASSETS: R2Bucket;
	DB: D1Database;
	GAME_ROOM: DurableObjectNamespace;
	AUDIENCE_SHARD: DurableObjectNamespace;
	TICKET_SECRET: string;
	SESSION_SECRET: string;
	ENVIRONMENT?: string;
	E2E_SEED_SECRET?: string;
	ADMISSION_ENABLED?: string;
	/** Cloudflare Access issuer hostname, e.g. team.cloudflareaccess.com. */
	CF_ACCESS_TEAM_DOMAIN?: string;
	/** Cloudflare Access application audience (AUD) tag. */
	CF_ACCESS_AUD?: string;
	/** Comma-separated emergency operator allow list: email[:host|producer|moderator]. */
	OPERATOR_EMAILS?: string;
}
