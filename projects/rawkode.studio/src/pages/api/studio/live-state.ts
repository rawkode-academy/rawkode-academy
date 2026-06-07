import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import type { StudioEnv } from "../../../env";
import { json } from "../../../server/http";
import { getPublicStudioLiveState } from "../../../server/studio";

export const GET: APIRoute = async ({ url }) => {
	const videoSlug = url.searchParams.get("videoSlug") ?? "";
	const state = await getPublicStudioLiveState(env as StudioEnv, videoSlug);

	return json(state);
};
