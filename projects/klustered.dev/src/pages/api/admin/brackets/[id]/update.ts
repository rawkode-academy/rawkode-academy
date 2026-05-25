import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getBracketsDb } from "@/db/client";
import {
	type BracketStatus,
	updateBracketStatus,
} from "@/lib/admin-bracket-commands";

export const prerender = false;

const VALID_STATUS = ["draft", "active", "finished"] as const;

function isStatus(value: string): value is BracketStatus {
	return (VALID_STATUS as readonly string[]).includes(value);
}

export const POST: APIRoute = async ({ params, request, locals, redirect }) => {
	if (!locals.roles.includes("admin")) {
		return new Response("Forbidden", { status: 403 });
	}

	const id = params.id;
	if (!id) return new Response("missing id", { status: 400 });

	const form = await request.formData();
	const status = String(form.get("status") ?? "").trim();
	if (!isStatus(status)) {
		return new Response("invalid status", { status: 400 });
	}

	await updateBracketStatus(getBracketsDb(env.BRACKETS), { id, status });

	return redirect(request.headers.get("Referer") ?? "/admin/brackets", 303);
};
