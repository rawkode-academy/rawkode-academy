import { sequence } from "astro:middleware";
import { authMiddleware } from "./middleware/auth";

export const onRequest = sequence(authMiddleware);
