import { sequence } from "astro:middleware";
import { authMiddleware } from "./middleware/auth";
import { corsMiddleware } from "./middleware/cors";

// Ensure canonical redirects happen first
export const onRequest = sequence(corsMiddleware, authMiddleware);
