import type { Env } from "./env";
export { GenerateVideoThumbnailWorkflow } from "./workflow";

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);

		if (request.method === "GET" && url.pathname === "/health") {
			return Response.json({
				ok: true,
				service: "video-thumbnails",
				account: Boolean(env.CLOUDFLARE_ACCOUNT_ID),
			});
		}

		return new Response("Not Found", { status: 404 });
	},
};
