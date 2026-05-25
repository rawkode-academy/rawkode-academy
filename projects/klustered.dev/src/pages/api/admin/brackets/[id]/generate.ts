import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { bracketsWrite } from "@/lib/brackets-write";

export const prerender = false;

export const POST: APIRoute = async ({ params, locals, redirect }) => {
	if (!locals.roles.includes("admin")) {
		return new Response("Forbidden", { status: 403 });
	}
	const bracketId = params.id;
	if (!bracketId) return new Response("missing id", { status: 400 });

	await bracketsWrite(env).generateBracket({ bracketId });

	return redirect(`/admin/brackets/${bracketId}`, 303);
};
