import { WorkerEntrypoint } from "cloudflare:workers";
import type { Env } from "./main.js";

export class Content extends WorkerEntrypoint<Env> {
	private corsHeaders = {
		"Access-Control-Allow-Origin": "*",
		"Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
		"Access-Control-Allow-Headers": "Content-Type, Range",
		"Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges",
	};

	async fetch(request: Request): Promise<Response> {
		// Handle CORS preflight
		if (request.method === "OPTIONS") {
			return new Response(null, { status: 204, headers: this.corsHeaders });
		}

		const url = new URL(request.url);
		const key = url.pathname.slice(1);

		// Health check endpoint
		if (url.pathname === "/health") {
			return new Response("ok", {
				headers: { "Content-Type": "text/plain", ...this.corsHeaders },
			});
		}

		// Handle HEAD requests (podcast clients check file size)
		if (request.method === "HEAD") {
			const head = await this.env.CONTENT_BUCKET.head(key);
			if (!head) return new Response(null, { status: 404, headers: this.corsHeaders });

			const headers = new Headers(this.corsHeaders);
			head.writeHttpMetadata(headers);
			headers.set("content-length", head.size.toString());
			headers.set("accept-ranges", "bytes");
			return new Response(null, { status: 200, headers });
		}

		const range = this.parseRange(request.headers.get("range"));
		const object = await this.env.CONTENT_BUCKET.get(key, {
			range: range ?? undefined,
			onlyIf: request.headers,
		});

		if (!object) return new Response("Not Found", { status: 404, headers: this.corsHeaders });

		// Track mp3 downloads via RPC (fire-and-forget)
		if (request.method === "GET" && key.endsWith("/original.mp3")) {
			const videoId = key.match(/^videos\/([^/]+)\/original\.mp3$/)?.[1];
			if (videoId) {
				this.trackDownload(videoId, request).catch(() => {});
			}
		}

		const headers = new Headers(this.corsHeaders);
		object.writeHttpMetadata(headers);
		headers.set("etag", object.httpEtag);
		headers.set("accept-ranges", "bytes");

		if (object.range) {
			const { offset, length } = object.range as {
				offset: number;
				length: number;
			};
			headers.set("content-length", length.toString());
			headers.set(
				"content-range",
				`bytes ${offset}-${offset + length - 1}/${object.size}`,
			);
			return new Response(object.body, { status: 206, headers });
		}

		headers.set("content-length", object.size.toString());
		return new Response(object.body, { status: 200, headers });
	}

	private parseRange(
		header: string | null,
	): { offset: number; length: number } | null {
		if (!header) return null;
		const match = header.match(/^bytes=(\d+)-(\d*)$/);
		if (!match) return null;
		const start = Number.parseInt(match[1], 10);
		const end = match[2]
			? Number.parseInt(match[2], 10)
			: start + 1024 * 1024;
		return { offset: start, length: end - start + 1 };
	}

	private async trackDownload(videoId: string, request: Request) {
		const cf = request.cf as IncomingRequestCfProperties | undefined;

		const event = {
			specversion: "1.0",
			type: "com.rawkode.academy.podcast.download",
			source: "/content",
			id: crypto.randomUUID(),
			time: new Date().toISOString(),
			datacontenttype: "application/json",
			data: {
				video_id: videoId,
				user_agent: request.headers.get("user-agent") || "unknown",
			},
		};

		await this.env.ANALYTICS.trackEvent(event, {
			cf: {
				colo: cf?.colo as string,
				continent: cf?.continent as string,
				country: cf?.country as string,
			},
			attributes: ["video_id"],
		});
	}
}
