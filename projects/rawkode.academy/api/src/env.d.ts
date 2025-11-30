/// <reference types="@cloudflare/workers-types" />

export interface Env {
	// Website subgraph (serves content: videos, shows, people, technologies, etc.)
	WEBSITE: Fetcher;
	// User interaction services (dynamic data requiring D1)
	EMOJI_REACTIONS: Fetcher;
	VIDEO_LIKES: Fetcher;
	EMAIL_PREFERENCES: Fetcher;
	// Identity service for auth validation
	IDENTITY: Fetcher;
}
