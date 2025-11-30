import { WorkerEntrypoint } from "cloudflare:workers";
import type { Env } from "./main.js";

export class {{ serviceName | pascalCase }}Service extends WorkerEntrypoint<Env> {
	async fetch(request: Request): Promise<Response> {
		// Health check endpoint
		if (new URL(request.url).pathname === "/health") {
			return new Response("ok", { headers: { "Content-Type": "text/plain" } });
		}

		return new Response("Not Found", { status: 404 });
	}

	// Add your RPC methods here
	// async myMethod(arg: string): Promise<string> {
	//   return `Hello, ${arg}!`;
	// }
}
