import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { bracketsWrite } from "@/lib/brackets-write";

export const prerender = false;

const VALID = ["approved", "rejected"] as const;
type Decision = (typeof VALID)[number];

function isDecision(v: string): v is Decision {
	return (VALID as readonly string[]).includes(v);
}

export const POST: APIRoute = async ({ params, request, locals, redirect }) => {
	if (!locals.roles.includes("admin")) {
		return new Response("Forbidden", { status: 403 });
	}

	const id = params.id;
	if (!id) return new Response("missing id", { status: 400 });

	const form = await request.formData();
	const status = String(form.get("status") ?? "").trim();
	if (!isDecision(status)) {
		return new Response("invalid status", { status: 400 });
	}

	await bracketsWrite(env).decideRegistration({
		registrationId: id,
		decision: status,
		reviewedByUserId: locals.user?.id ?? "",
	});

	return redirect("/admin/registrations", 303);
};
