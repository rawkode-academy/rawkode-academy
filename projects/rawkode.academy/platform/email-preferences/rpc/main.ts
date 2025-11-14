import { WorkerEntrypoint } from "cloudflare:workers";
import { EmailPreferencesService } from "./rpc-service.js";

export interface Env {
	DB: D1Database;
}

export default class extends WorkerEntrypoint<Env> {
	async fetch(request: Request): Promise<Response> {
		// Health check endpoint
		if (new URL(request.url).pathname === "/health") {
			return new Response("ok", { headers: { "Content-Type": "text/plain" } });
		}

		return new Response("Not Found", { status: 404 });
	}
}

export { EmailPreferencesService };