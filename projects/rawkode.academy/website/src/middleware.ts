import { sequence } from "astro:middleware";
import { authMiddleware } from "./middleware/auth";
import { corsMiddleware } from "./middleware/cors";
import { legacyRoutesMiddleware } from "./middleware/legacy-routes";
import { robotsMiddleware } from "./middleware/robots";

// Resolve legacy public URLs before normal route handling, then attach
// cross-origin, auth, and robots headers to the remaining responses.
export const onRequest = sequence(
	legacyRoutesMiddleware,
	corsMiddleware,
	authMiddleware,
	robotsMiddleware,
);
