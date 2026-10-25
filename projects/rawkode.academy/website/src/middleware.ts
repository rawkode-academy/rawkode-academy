import { sequence } from "astro:middleware";
import { contentCacheMiddleware } from "./lib/live-content/cache-control";
import { authMiddleware } from "./middleware/auth";
import { corsMiddleware } from "./middleware/cors";
import { klusteredRedirectMiddleware } from "./middleware/klustered-redirect";
import { legacyRoutesMiddleware } from "./middleware/legacy-routes";
import { robotsMiddleware } from "./middleware/robots";

// Redirect legacy klustered.live hosts first, then resolve legacy public URLs,
// then attach cross-origin, auth, and robots headers to the remaining responses.
// contentCacheMiddleware only marks when the page frontmatter has finished, so
// late setContentCache() calls from child components warn.
export const onRequest = sequence(
	contentCacheMiddleware,
	klusteredRedirectMiddleware,
	legacyRoutesMiddleware,
	corsMiddleware,
	authMiddleware,
	robotsMiddleware,
);
