import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { reply, type ToolModule } from "./module.ts";

// Social handles for people and technologies, and nothing else. Handles are
// only ever filled in where empty, each write needs the official page the
// handle came from, and every write (and refusal) is kept in an audit log.
const PERSON_FIELDS = ["twitter", "bluesky", "linkedin", "mastodon"] as const;
const TECH_FIELDS = ["twitter", "bluesky", "linkedin", "mastodon", "youtube"] as const;

const slug = z.string().min(1).max(200).regex(/^[a-z0-9][a-z0-9-]*$/, "an Academy id (lowercase slug)");
const httpsUrl = z.url().max(500).refine(value => value.startsWith("https://"), "must be an https URL");
const sourceUrl = httpsUrl.describe("The official page the handles came from (the project's own site, its README or GitHub profile, the person's own site). Required: a third party's guess is not a source.");

const bare = {
	twitter: z.string().regex(/^[A-Za-z0-9_]{1,15}$/, "an X handle without @"),
	bluesky: z.string().regex(/^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)+$/, "a Bluesky handle such as name.bsky.social"),
	linkedin: z.string().regex(/^[A-Za-z0-9_%.-]{2,100}$/, "the LinkedIn profile slug"),
	mastodon: httpsUrl,
};
export const personInput = z.object({
	personId: slug,
	handles: z.object({ twitter: bare.twitter, bluesky: bare.bluesky, linkedin: bare.linkedin, mastodon: bare.mastodon }).partial().strict()
		.refine(value => Object.keys(value).length > 0, "give at least one handle"),
	sourceUrl,
}).strict();
export const technologyInput = z.object({
	technologyId: slug,
	handles: z.object({ twitter: httpsUrl, bluesky: httpsUrl, linkedin: httpsUrl, mastodon: httpsUrl, youtube: httpsUrl }).partial().strict()
		.refine(value => Object.keys(value).length > 0, "give at least one handle"),
	sourceUrl,
}).strict();

type Actor = { userId: string; username?: string };
type Outcome = { applied: Record<string, string>; skipped: Record<string, string> };

const empty = (value: unknown) => value == null || String(value).trim() === "";

async function audit(env: CloudflareEnv, entry: Record<string, unknown>) {
	const at = new Date().toISOString();
	await env.OAUTH_KV.put(`handle-audit:${at}:${crypto.randomUUID().slice(0, 8)}`, JSON.stringify({ at, ...entry }));
}

export async function setPersonHandles(env: CloudflareEnv, input: z.infer<typeof personInput>, actor: Actor): Promise<Outcome & { personId: string }> {
	const row = await env.PEOPLE.prepare("SELECT twitter, bluesky, linkedin, mastodon FROM people WHERE id = ?").bind(input.personId).first<Record<string, string | null>>();
	if (!row) throw Object.assign(new Error(`no person ${input.personId}`), { code: "not_found" });
	const applied: Record<string, string> = {}, skipped: Record<string, string> = {};
	for (const field of PERSON_FIELDS) {
		const next = input.handles[field];
		if (next === undefined) continue;
		if (!empty(row[field])) { skipped[field] = `already set to ${row[field]}`; continue; }
		// The WHERE clause makes this safe against a concurrent write: it only ever fills an empty field.
		const result = await env.PEOPLE.prepare(`UPDATE people SET ${field} = ?, updated_at = ? WHERE id = ? AND (${field} IS NULL OR trim(${field}) = '')`).bind(next, Date.now(), input.personId).run();
		if (result.meta.changes > 0) applied[field] = next; else skipped[field] = "changed concurrently";
	}
	await audit(env, { table: "platform-people.people", id: input.personId, applied, skipped, sourceUrl: input.sourceUrl, actor });
	return { personId: input.personId, applied, skipped };
}

export async function setTechnologyHandles(env: CloudflareEnv, input: z.infer<typeof technologyInput>, actor: Actor): Promise<Outcome & { technologyId: string; community: Record<string, string> }> {
	const row = await env.TECHNOLOGIES.prepare("SELECT community FROM technologies WHERE id = ?").bind(input.technologyId).first<{ community: string | null }>();
	if (!row) throw Object.assign(new Error(`no technology ${input.technologyId}`), { code: "not_found" });
	const current: Record<string, string> = row.community ? JSON.parse(row.community) : {};
	const applied: Record<string, string> = {}, skipped: Record<string, string> = {};
	for (const field of TECH_FIELDS) {
		const next = input.handles[field];
		if (next === undefined) continue;
		if (!empty(current[field])) skipped[field] = `already set to ${current[field]}`; else applied[field] = next;
	}
	const merged = { ...current, ...applied };
	if (Object.keys(applied).length > 0) {
		// Compare-and-set on the community JSON read above: fails (and writes nothing) if it changed meanwhile.
		const result = await env.TECHNOLOGIES.prepare("UPDATE technologies SET community = ?, updated_at = ? WHERE id = ? AND community IS ?").bind(JSON.stringify(merged), Date.now(), input.technologyId, row.community).run();
		if (result.meta.changes === 0) { for (const field of Object.keys(applied)) skipped[field] = "changed concurrently"; for (const field of Object.keys(applied)) delete applied[field]; }
	}
	await audit(env, { table: "platform-technologies.technologies", id: input.technologyId, applied, skipped, sourceUrl: input.sourceUrl, actor });
	return { technologyId: input.technologyId, applied, skipped, community: { ...current, ...applied } };
}

export async function recentHandleWrites(env: CloudflareEnv, limit: number) {
	const listed = await env.OAUTH_KV.list({ prefix: "handle-audit:" });
	const keys = listed.keys.map(key => key.name).sort().reverse().slice(0, limit);
	return Promise.all(keys.map(async key => JSON.parse((await env.OAUTH_KV.get(key)) ?? "null")));
}

// Fills in empty social handles for people and technologies, nothing else.
// Operators only, and only when asked for by name.
export const handles: ToolModule = {
	scope: "handles:write",
	audience: "operator",
	readOnly: false,
	description: "fill in missing social handles (X, Bluesky, LinkedIn, Mastodon) for Rawkode Academy people and technologies, from a cited official source, never overwriting a handle that is already set",
	instructions: [
		"Social handles (set_person_handles, set_technology_handles, list_handle_writes):",
		"- When you draft or schedule social posts and a guest, host, project or company has no handle on file, look it up on an official source only (the project's own site or README, a GitHub profile's links, the person's own site). If you are confident, record it with set_person_handles or set_technology_handles, with that page as sourceUrl, without asking. These tools only fill empty fields, so they cannot damage existing data. If you are not confident, record nothing.",
		"- Tag a handle in the post as soon as it is on file or recorded, and leave out anyone who has none.",
		"- Post text and drafts contain only the post and its context. Never put tooling notes in them: no failed writes, 'not on file', 'probable', or comments about what you could or could not look up.",
	].join("\n"),
	register(server: McpServer, env: CloudflareEnv, caller) {
		const actor = { userId: caller.userId, username: caller.username };
		server.registerTool("set_person_handles", {
			description: "Fill in EMPTY social handles of a person (platform-people). twitter, bluesky and linkedin are bare handles (no @, no URL); mastodon is a full https URL. Fields that already hold a value are left alone and reported as skipped. A source URL is required and the write is audit-logged. Call it whenever you find a missing handle while drafting posts, then tag the handle; do not mention the write in the post.",
			inputSchema: personInput,
			annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
		}, input => reply(() => setPersonHandles(env, input, actor)));
		server.registerTool("set_technology_handles", {
			description: "Fill in EMPTY community links of a technology or company (platform-technologies, `community` JSON): twitter, bluesky, linkedin, mastodon, youtube as full https URLs. Existing links are never overwritten. A source URL is required and the write is audit-logged. Call it whenever you find a missing project or company handle while drafting posts, then tag the handle; do not mention the write in the post.",
			inputSchema: technologyInput,
			annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
		}, input => reply(() => setTechnologyHandles(env, input, actor)));
		server.registerTool("list_handle_writes", {
			description: "The audit log of handle writes, newest first: who, when, the table and id, what was applied or skipped, and the source URL.",
			inputSchema: z.object({ limit: z.number().int().min(1).max(100).default(20) }).strict(),
			annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
		}, ({ limit }) => reply(() => recentHandleWrites(env, limit)));
	},
};
