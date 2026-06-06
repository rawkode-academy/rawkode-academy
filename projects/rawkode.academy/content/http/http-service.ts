import { WorkerEntrypoint } from "cloudflare:workers";
import { handleContentRequest } from "./content-handler.js";
import type { Env } from "./main.js";

export class Content extends WorkerEntrypoint<Env> {
	async fetch(request: Request): Promise<Response> {
		return handleContentRequest(this.env, request, {
			trackDownload: (videoId, downloadRequest) =>
				this.trackDownload(videoId, downloadRequest),
			waitUntil: (promise) => this.ctx.waitUntil(promise),
		});
	}

	private async trackDownload(videoId: string, request: Request) {
		const cf = request.cf as IncomingRequestCfProperties | undefined;

		const event = {
			specversion: "1.0",
			type: "podcast.download",
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
