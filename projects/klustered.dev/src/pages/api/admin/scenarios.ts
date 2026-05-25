import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { bracketsWrite } from "@/lib/brackets-write";

export const prerender = false;

const VALID_DIFFICULTY = ["easy", "medium", "hard"] as const;
type Difficulty = (typeof VALID_DIFFICULTY)[number];

function isDifficulty(value: string): value is Difficulty {
	return (VALID_DIFFICULTY as readonly string[]).includes(value);
}

export const POST: APIRoute = async ({ request, locals, redirect }) => {
	if (!locals.roles.includes("admin")) {
		return new Response("Forbidden", { status: 403 });
	}

	const form = await request.formData();
	const slug = String(form.get("slug") ?? "").trim();
	const title = String(form.get("title") ?? "").trim();
	const description = String(form.get("description") ?? "").trim();
	const difficulty = String(form.get("difficulty") ?? "medium").trim();
	const tagsRaw = String(form.get("tags") ?? "").trim();

	if (!slug || !title || !description) {
		return new Response("slug, title, description required", { status: 400 });
	}
	if (!isDifficulty(difficulty)) {
		return new Response("invalid difficulty", { status: 400 });
	}

	const tags = tagsRaw
		.split(",")
		.map((t) => t.trim())
		.filter(Boolean);

	await bracketsWrite(env).createScenario({
		slug,
		title,
		description,
		difficulty,
		tags,
	});

	return redirect("/admin/scenarios", 303);
};
