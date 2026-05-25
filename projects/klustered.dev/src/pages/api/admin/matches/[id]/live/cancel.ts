import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { bracketsWrite } from "@/lib/brackets-write";

export const prerender = false;

export const POST: APIRoute = async ({ params, locals, redirect }) => {
	if (!locals.roles.includes("admin")) {
		return new Response("Forbidden", { status: 403 });
	}
	const id = params.id;
	if (!id) return new Response("missing id", { status: 400 });

	await bracketsWrite(env).setMatchLiveState({
		matchId: id,
		state: "cancelled",
	});

	return redirect(`/admin/matches/${id}`, 303);
};
