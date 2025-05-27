import { sequence } from "astro:middleware";
import { authMiddleware } from "./auth";

export const onRequest = sequence(authMiddleware);
