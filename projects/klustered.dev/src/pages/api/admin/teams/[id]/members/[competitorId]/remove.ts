import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { bracketsWrite } from "@/lib/brackets-write";

export const prerender = false;

export const POST: APIRoute = async ({ params, locals, redirect }) => {
	if (!locals.roles.includes("admin")) {
		return new Response("Forbidden", { status: 403 });
	}

	const teamId = params.id;
	const competitorId = params.competitorId;
	if (!teamId || !competitorId) {
		return new Response("missing ids", { status: 400 });
	}

	await bracketsWrite(env).removeTeamMember({ teamId, competitorId });

	return redirect(`/admin/teams/${teamId}`, 303);
};
