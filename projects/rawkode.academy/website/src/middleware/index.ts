import { sequence } from "astro:middleware";
import { authMiddleware } from "./auth";
import { corsMiddleware } from "./cors";
import { canonicalMiddleware } from "./canonical";

// Ensure canonical redirects happen first
export const onRequest = sequence(
	canonicalMiddleware,
	corsMiddleware,
	authMiddleware,
);
