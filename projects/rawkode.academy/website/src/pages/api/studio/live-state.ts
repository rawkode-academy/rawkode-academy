import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import {
	emptyStudioLiveState,
	getStudioLiveState,
	type StudioBindingEnv,
} from "@/lib/studio-live";

export const GET: APIRoute = async ({ url }) => {
	const videoSlug = url.searchParams.get("videoSlug") ?? "";
	const state = await getStudioLiveState(env as StudioBindingEnv, videoSlug);

	return new Response(
		JSON.stringify(videoSlug ? state : emptyStudioLiveState()),
		{
			headers: {
				"Content-Type": "application/json",
				"Cache-Control": "no-store",
			},
		},
	);
};
