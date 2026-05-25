import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { bracketsWrite } from "@/lib/brackets-write";

export const prerender = false;

export const POST: APIRoute = async ({ params, locals, redirect }) => {
	const user = locals.user;
	if (!user) return new Response("Unauthorized", { status: 401 });

	const token = params.token;
	if (!token) return new Response("missing token", { status: 400 });

	const displayName = user.name?.trim() || user.email?.split("@")[0]?.trim() || user.id;

	try {
		await bracketsWrite(env).joinTeamViaInvite({
			token,
			userId: user.id,
			displayName,
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : "could not join team";
		return new Response(message, { status: 400 });
	}

	return redirect("/me/team", 303);
};
