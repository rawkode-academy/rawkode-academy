import { sequence } from "astro:middleware";
import { authMiddleware } from "./auth";
import { corsMiddleware } from "./cors";

// Ensure canonical redirects happen first
export const onRequest = sequence(
	corsMiddleware,
	authMiddleware,
);
