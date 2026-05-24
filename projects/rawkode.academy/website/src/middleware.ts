import { sequence } from "astro:middleware";
import { authMiddleware } from "./middleware/auth";
import { corsMiddleware } from "./middleware/cors";
import { klusteredRedirectMiddleware } from "./middleware/klustered-redirect";
import { legacyRoutesMiddleware } from "./middleware/legacy-routes";
import { robotsMiddleware } from "./middleware/robots";

// Redirect legacy klustered.live hosts first, then resolve legacy public URLs,
// then attach cross-origin, auth, and robots headers to the remaining responses.
export const onRequest = sequence(
	klusteredRedirectMiddleware,
	legacyRoutesMiddleware,
	corsMiddleware,
	authMiddleware,
	robotsMiddleware,
);
