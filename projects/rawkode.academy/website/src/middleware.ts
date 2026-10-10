import { sequence } from "astro:middleware";
import { authMiddleware } from "./middleware/auth";
import { corsMiddleware } from "./middleware/cors";
import { klusteredRedirectMiddleware } from "./middleware/klustered-redirect";
import { legacyRoutesMiddleware } from "./middleware/legacy-routes";
import { robotsMiddleware } from "./middleware/robots";
import { payloadContentMiddleware } from "./middleware/payload-content";

// Redirect legacy klustered.live hosts first, then resolve legacy public URLs,
// then attach cross-origin, auth, and robots headers to the remaining responses.
export const onRequest = sequence(
	payloadContentMiddleware,
	klusteredRedirectMiddleware,
	legacyRoutesMiddleware,
	corsMiddleware,
	authMiddleware,
	robotsMiddleware,
);
