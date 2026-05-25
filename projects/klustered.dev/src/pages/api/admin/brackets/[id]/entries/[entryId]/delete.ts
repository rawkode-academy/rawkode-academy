import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getBracketsDb } from "@/db/client";
import { deleteBracketEntry } from "@/lib/admin-bracket-commands";

export const prerender = false;

export const POST: APIRoute = async ({ params, locals, redirect }) => {
	if (!locals.roles.includes("admin")) {
		return new Response("Forbidden", { status: 403 });
	}

	const bracketId = params.id;
	const entryId = params.entryId;
	if (!bracketId || !entryId) {
		return new Response("missing bracket or entry id", { status: 400 });
	}

	try {
		await deleteBracketEntry(getBracketsDb(env.BRACKETS), { bracketId, entryId });
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "could not delete entry";
		return new Response(message, { status: 400 });
	}

	return redirect(`/admin/brackets/${bracketId}`, 303);
};
