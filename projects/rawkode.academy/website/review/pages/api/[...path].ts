import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { reviewBridge, type ReviewEnvironment } from "../../bridge";
export const ALL: APIRoute = ({ request }) => reviewBridge(request, env as ReviewEnvironment);
