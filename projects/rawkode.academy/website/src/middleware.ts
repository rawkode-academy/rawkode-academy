import { sequence } from "astro:middleware";
import { authMiddleware } from "./middleware/auth";
import { corsMiddleware } from "./middleware/cors";
import { robotsMiddleware } from "./middleware/robots";

// Apply CORS/auth first, then attach robots headers to internal endpoints.
export const onRequest = sequence(corsMiddleware, authMiddleware, robotsMiddleware);
