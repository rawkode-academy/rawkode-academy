import { sequence } from "astro:middleware";
import { authMiddleware } from "./auth";
import { corsMiddleware } from "./cors";

export const onRequest = sequence(corsMiddleware, authMiddleware);
