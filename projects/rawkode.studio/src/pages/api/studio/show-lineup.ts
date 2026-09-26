import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import type { StudioEnv } from "../../../env";
import { json } from "../../../server/http";
import { getPublicStudioShowLineup } from "../../../server/studio";

export const GET: APIRoute = async () => {
	const response = json(await getPublicStudioShowLineup(env as StudioEnv));
	response.headers.set("Cache-Control", "no-store");
	return response;
};
