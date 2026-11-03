import type { Env } from "./env";
import { scheduleMissingThumbnails } from "./schedule";
export { GenerateVideoThumbnailWorkflow } from "./workflow";

export default {
	async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
		const result = await scheduleMissingThumbnails(env);
		console.log(JSON.stringify({ event: "thumbnails.scheduled", ...result }));
	},

	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);

		if (request.method === "GET" && url.pathname === "/health") {
			return Response.json({
				ok: true,
				service: "video-thumbnails",
				browser: Boolean(env.BROWSER),
			});
		}

		return new Response("Not Found", { status: 404 });
	},
};
