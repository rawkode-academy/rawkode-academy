import { sequence } from "astro:middleware";
import { analyticsMiddleware } from "./middleware/analytics";
import { authMiddleware } from "./middleware/auth";
import { corsMiddleware } from "./middleware/cors";
import { robotsMiddleware } from "./middleware/robots";

// Apply CORS/auth first, track page views, then attach robots headers.
export const onRequest = sequence(corsMiddleware, authMiddleware, analyticsMiddleware, robotsMiddleware);
