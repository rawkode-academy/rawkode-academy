import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { bracketsWrite } from "@/lib/brackets-write";

export const prerender = false;

const VALID_STATUS = ["interest", "active", "finished"] as const;
type Status = (typeof VALID_STATUS)[number];

function isStatus(value: string): value is Status {
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

	await bracketsWrite(env).updateSeason({ id, status });

	return redirect("/admin/seasons", 303);
};
