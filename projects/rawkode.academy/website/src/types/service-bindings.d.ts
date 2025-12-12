/**
 * Service binding type declarations for RPC services.
 *
 * These types are imported from workspace packages to enable full type
 * safety when calling RPC methods on service bindings.
 */

import type { EmailPreferences } from "email-preferences/rpc/rpc-service.js";
import type { SkiAchievements } from "ski-achievements/http/http-service.js";
import type { SkiLeaderboard } from "ski-leaderboard/http/http-service.js";
import type { SkiPlayerLearnedPhrases } from "ski-player-learned-phrases/http/http-service.js";
import type { SkiPlayerStats } from "ski-player-stats/http/http-service.js";
import type { SkiShareCards } from "ski-share-cards/http/http-service.js";
import type { GtlPlayerStats } from "gtl-player-stats/http/http-service.js";
import type { GtlLeaderboard } from "gtl-leaderboard/http/http-service.js";

export interface TypedEnv {
	SESSION: KVNamespace;
	EMOJI_REACTIONS: Fetcher;
	IDENTITY: Fetcher;
	ANALYTICS: Fetcher;
	ASSETS: Fetcher;
	EMAIL_PREFERENCES: Service<typeof EmailPreferences>;
	SKI_ACHIEVEMENTS: Service<typeof SkiAchievements>;
	SKI_LEADERBOARD: Service<typeof SkiLeaderboard>;
	SKI_PLAYER_LEARNED_PHRASES: Service<typeof SkiPlayerLearnedPhrases>;
	SKI_PLAYER_STATS: Service<typeof SkiPlayerStats>;
	SKI_SHARE_CARDS: Service<typeof SkiShareCards>;
	GTL_PLAYER_STATS: Service<typeof GtlPlayerStats>;
	GTL_LEADERBOARD: Service<typeof GtlLeaderboard>;
}
