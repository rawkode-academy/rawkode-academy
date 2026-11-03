import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { dailyPuzzle, dayKey, MAX_GUESSES, normalize, restoreGuesses } from "@/lib/games/kubele";

interface Result { date: string; guesses: string[]; won: boolean }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" } });
const prefix = (id: string) => `kubele:v1:player:${encodeURIComponent(id)}:`;

async function readStats(id: string) {
	const results: Result[] = [];
	let cursor: string | undefined;
	do {
		const page = await env.SESSION.list({ prefix: prefix(id), ...(cursor ? { cursor } : {}) });
		const values = await Promise.all(page.keys.map(key => env.SESSION.get<Result>(key.name, "json")));
		results.push(...values.filter((value): value is Result => value !== null));
		cursor = page.list_complete ? undefined : page.cursor;
	} while (cursor);
	results.sort((a, b) => b.date.localeCompare(a.date));
	const distribution = Array<number>(MAX_GUESSES).fill(0);
	for (const result of results) if (result.won) distribution[result.guesses.length - 1] = (distribution[result.guesses.length - 1] ?? 0) + 1;
	let streak = 0;
	let expected = Date.parse(`${dayKey()}T00:00:00Z`);
	if (results[0]?.date !== dayKey()) expected -= 86400000;
	for (const result of results) {
		if (!result.won || Date.parse(`${result.date}T00:00:00Z`) !== expected) break;
		streak++; expected -= 86400000;
	}
	return { stats: { played: results.length, wins: results.filter(result => result.won).length, streak, distribution }, today: results.find(result => result.date === dayKey())?.guesses ?? null };
}

export const GET: APIRoute = async ({ locals }) => {
	if (!locals.user) return json({ error: "Authentication required" }, 401);
	try { return json(await readStats(locals.user.id)); }
	catch { return json({ error: "Stats unavailable" }, 503); }
};

export const POST: APIRoute = async ({ locals, request }) => {
	if (!locals.user) return json({ error: "Authentication required" }, 401);
	const origin = request.headers.get("origin");
	if (origin && origin !== new URL(request.url).origin) return json({ error: "Invalid origin" }, 403);
	let body: unknown;
	try { body = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
	if (!body || typeof body !== "object" || !("date" in body) || !("guesses" in body)) return json({ error: "Invalid result" }, 400);
	const puzzle = dailyPuzzle();
	const guesses = restoreGuesses(JSON.stringify(body.guesses), puzzle.answer.name);
	const won = guesses.includes(normalize(puzzle.answer.name));
	if (body.date !== puzzle.date || !guesses.length || (!won && guesses.length !== MAX_GUESSES)) return json({ error: "Submit a completed result for today" }, 400);
	try {
		const key = `${prefix(locals.user.id)}${puzzle.date}`;
		// One key per account/day prevents retries from inflating aggregate counts.
		const existing = await env.SESSION.get<Result>(key, "json");
		const result = existing ?? { date: puzzle.date, guesses, won };
		if (!existing) await env.SESSION.put(key, JSON.stringify(result));
		const data = await readStats(locals.user.id);
		// KV listings may lag a new write: include this result in the immediate response.
		if (!data.today) {
			data.stats.played++;
			if (result.won) { data.stats.wins++; data.stats.distribution[result.guesses.length - 1] = (data.stats.distribution[result.guesses.length - 1] ?? 0) + 1; data.stats.streak++; }
			else data.stats.streak = 0;
		}
		return json({ stats: data.stats, today: result.guesses });
	} catch { return json({ error: "Stats unavailable" }, 503); }
};
