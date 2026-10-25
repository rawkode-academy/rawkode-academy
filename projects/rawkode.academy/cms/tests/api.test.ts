import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { BINDINGS } from "../src/lib/collections";
import { ADMIN, AGENT, GUEST, type Harness, harness, PARTNER } from "./harness";

const doc = (text: string) => ({
	type: "doc",
	content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

const article = {
	id: "bun-from-scratch",
	title: "Bun from scratch",
	description: "Learn Bun",
	body: doc("Hello"),
	type: "tutorial",
	publishedAt: "2026-10-01T00:00:00.000Z",
};

let h: Harness;

beforeEach(async () => {
	h = await harness([...BINDINGS]);
});
afterEach(() => h.dispose());

describe("authentication", () => {
	test("requires a principal", async () => {
		const { status, json } = await h.call(null, "GET", "/collections");
		expect(status).toBe(401);
		expect(json.error.code).toBe("unauthenticated");
	});

	test("refuses cross-origin writes from cookie sessions but not from tokens", async () => {
		const cross = await h.call(ADMIN, "POST", "/collections/articles", { data: article }, {
			origin: "https://evil.example",
		});
		expect(cross.status).toBe(403);
		const agent = await h.call(
			{ ...AGENT, roles: ["content_admin"] },
			"POST",
			"/collections/articles",
			{ data: article },
			{ origin: "" },
		);
		expect(agent.status).toBe(201);
	});

	test("serves an OpenAPI document listing every collection", async () => {
		const { status, json } = await h.call(null, "GET", "/openapi.json");
		expect(status).toBe(200);
		expect(json.paths["/collections/{collection}"].parameters[0].schema.enum).toContain(
			"technologies",
		);
	});
});

describe("collections", () => {
	test("describes fields from the write models, with panels", async () => {
		const { status, json } = await h.call(ADMIN, "GET", "/collections");
		expect(status).toBe(200);
		const articles = json.collections.find((c: { name: string }) => c.name === "articles");
		const fields = Object.fromEntries(articles.fields.map((f: { name: string }) => [f.name, f]));
		expect(fields.body.type).toBe("rich-text");
		expect(fields.type).toMatchObject({ type: "enum", options: expect.arrayContaining(["tutorial"]) });
		expect(articles.panels.map((p: { name: string }) => p.name)).toEqual(["authors", "technologies"]);
		expect(articles.create).toBe("write");
	});

	test("create, read with panels, update, conflict and history", async () => {
		const created = await h.call(ADMIN, "POST", "/collections/articles", { data: article });
		expect(created.status).toBe(201);
		expect(created.json.version).toBe(1);

		const authors = await h.call(ADMIN, "PUT", "/collections/articles/bun-from-scratch/panels/authors", {
			items: [{ personId: "rawkode" }],
			ifVersion: 0,
		});
		expect(authors.status).toBe(200);

		const read = await h.call(ADMIN, "GET", "/collections/articles/bun-from-scratch");
		expect(read.status).toBe(200);
		expect(read.json.panels.authors.value).toEqual([
			{ articleId: "bun-from-scratch", personId: "rawkode", position: 0 },
		]);
		expect(read.json.websitePath).toBe("/read/bun-from-scratch");

		const updated = await h.call(ADMIN, "PATCH", "/collections/articles/bun-from-scratch", {
			patch: { title: "Bun from first principles" },
			ifVersion: 1,
		});
		expect(updated.status).toBe(200);
		const stale = await h.call(ADMIN, "PATCH", "/collections/articles/bun-from-scratch", {
			patch: { title: "Again" },
			ifVersion: 1,
		});
		expect(stale.status).toBe(409);
		expect(stale.json.error.currentVersion).toBe(2);

		const history = await h.call(ADMIN, "GET", "/collections/articles/bun-from-scratch/revisions");
		expect(history.json.revisions.map((r: { operation: string }) => r.operation)).toEqual([
			"update",
			"create",
		]);

		const activity = await h.call(ADMIN, "GET", "/activity");
		expect(activity.json.activity.map((a: { operation: string }) => a.operation)).toEqual([
			"update",
			"set authors",
			"create",
		]);
		expect(h.events.map((e) => e.model)).toEqual(["article", "article-authors", "article"]);
	});

	test("validation issues come back as 422 with field paths", async () => {
		const { status, json } = await h.call(ADMIN, "POST", "/collections/articles", {
			data: { ...article, type: "poem", body: "not a document" },
		});
		expect(status).toBe(422);
		const paths = json.error.issues.map((i: { path: string }) => i.path);
		expect(paths).toContain("type");
		expect(paths).toContain("body");
	});

	test("lists with search and paging", async () => {
		await h.call(ADMIN, "POST", "/collections/articles", { data: article });
		await h.call(ADMIN, "POST", "/collections/articles", {
			data: { ...article, id: "deno-deploy", title: "Deno Deploy" },
		});
		const found = await h.call(ADMIN, "GET", "/collections/articles?search=deno");
		expect(found.json.rows.map((r: { id: string }) => r.id)).toEqual(["deno-deploy"]);
		const page = await h.call(ADMIN, "GET", "/collections/articles?limit=1&offset=1");
		expect(page.json.total).toBe(2);
		expect(page.json.rows).toHaveLength(1);
	});

	test("attached panels create the row the first time and update it after", async () => {
		await h.call(ADMIN, "POST", "/collections/people", {
			data: { id: "jane-doe", forename: "Jane", surname: "Doe", name: "Jane Doe" },
		});
		const first = await h.call(ADMIN, "PUT", "/collections/people/jane-doe/panels/biography", {
			data: { biography: "Jane builds *platforms*." },
			ifVersion: 0,
		});
		expect(first.status).toBe(201 === first.status ? 201 : 200);
		expect(first.json.version).toBe(1);
		const second = await h.call(ADMIN, "PUT", "/collections/people/jane-doe/panels/biography", {
			data: { biography: "Jane builds platforms at scale." },
			ifVersion: 1,
		});
		expect(second.json.version).toBe(2);
		const read = await h.call(ADMIN, "GET", "/collections/people/jane-doe");
		expect(read.json.panels.biography.value.biographyDoc.type).toBe("doc");
	});

	test("delete is refused while other services reference the entity", async () => {
		await h.call(ADMIN, "POST", "/collections/people", {
			data: { id: "jane-doe", forename: "Jane", surname: "Doe", name: "Jane Doe" },
		});
		await h.call(ADMIN, "POST", "/collections/articles", { data: article });
		await h.call(ADMIN, "PUT", "/collections/articles/bun-from-scratch/panels/authors", {
			items: [{ personId: "jane-doe" }],
			ifVersion: 0,
		});
		const refused = await h.call(ADMIN, "DELETE", "/collections/people/jane-doe?ifVersion=1");
		expect(refused.status).toBe(409);
		expect(refused.json.error.code).toBe("referenced");
		expect(refused.json.error.references[0].label).toBe("article author");

		await h.call(ADMIN, "PUT", "/collections/articles/bun-from-scratch/panels/authors", {
			items: [],
			ifVersion: 1,
		});
		const deleted = await h.call(ADMIN, "DELETE", "/collections/people/jane-doe?ifVersion=1");
		expect(deleted.status).toBe(200);
		const restored = await h.call(ADMIN, "POST", "/collections/people/jane-doe/restore", {
			version: 2,
		});
		expect(restored.status).toBe(200);
		expect(restored.json.value.name).toBe("Jane Doe");
	});

	test("ids containing a slash stay one path segment", async () => {
		const { status } = await h.call(ADMIN, "GET", `/collections/articles/${encodeURIComponent("a/b")}`);
		expect(status).toBe(404);
	});
});

describe("roles and proposals", () => {
	test("agents write directly where allowed and propose elsewhere", async () => {
		const tech = await h.call(AGENT, "POST", "/collections/technologies", {
			data: { id: "bun", name: "Bun", description: "A fast runtime." },
		});
		expect(tech.status).toBe(201);
		const story = await h.call(AGENT, "POST", "/collections/articles", { data: article });
		expect(story.status).toBe(202);
		const missing = await h.call(ADMIN, "GET", "/collections/articles/bun-from-scratch");
		expect(missing.status).toBe(404);

		const pending = await h.call(ADMIN, "GET", "/proposals");
		expect(pending.json.proposals).toHaveLength(1);
		const id = pending.json.proposals[0].id;
		const approved = await h.call(ADMIN, "POST", `/proposals/${id}/approve`, {});
		expect(approved.status).toBe(200);
		const read = await h.call(ADMIN, "GET", "/collections/articles/bun-from-scratch");
		expect(read.status).toBe(200);
		const history = await h.call(ADMIN, "GET", "/collections/articles/bun-from-scratch/revisions");
		expect(history.json.revisions[0].actor.name).toBe("david (proposed by token:news)");

		const again = await h.call(ADMIN, "POST", `/proposals/${id}/approve`, {});
		expect(again.status).toBe(409);
	});

	test("agents cannot delete, restore or manage tokens", async () => {
		expect((await h.call(AGENT, "DELETE", "/collections/technologies/bun?ifVersion=0")).status).toBe(403);
		expect((await h.call(AGENT, "GET", "/tokens")).status).toBe(403);
	});

	test("guests propose changes to their own person only, and see nothing else", async () => {
		await h.call(ADMIN, "POST", "/collections/people", {
			data: { id: "jane-doe", forename: "Jane", surname: "Doe", name: "Jane Doe" },
		});
		await h.call(ADMIN, "POST", "/access", { userId: "guest-user", kind: "person", targetId: "jane-doe" });

		expect((await h.call(GUEST, "GET", "/collections/articles")).status).toBe(403);
		const mine = await h.call(GUEST, "GET", "/collections/people");
		expect(mine.json.rows.map((r: { id: string }) => r.id)).toEqual(["jane-doe"]);
		expect((await h.call(GUEST, "GET", "/collections/people/rawkode")).status).toBe(403);

		const proposed = await h.call(GUEST, "PATCH", "/collections/people/jane-doe", {
			patch: { github: "janedoe" },
			ifVersion: 1,
		});
		expect(proposed.status).toBe(202);
		const links = await h.call(GUEST, "PUT", "/collections/people/jane-doe/panels/links", {
			items: [{ url: "https://jane.dev", name: "Site" }],
			ifVersion: 0,
		});
		expect(links.status).toBe(202);
		expect((await h.call(GUEST, "PATCH", "/collections/people/rawkode", { patch: {}, ifVersion: 0 })).status).toBe(403);

		// Guests see their own proposals only; nothing is written until approval.
		const own = await h.call(GUEST, "GET", "/proposals");
		expect(own.json.proposals).toHaveLength(2);
		const before = await h.call(ADMIN, "GET", "/collections/people/jane-doe");
		expect(before.json.value.github).toBeNull();

		// The admin edits meanwhile: approving the stale proposal is a conflict
		// unless forced onto the current version.
		await h.call(ADMIN, "PATCH", "/collections/people/jane-doe", {
			patch: { surname: "Doe-Smith" },
			ifVersion: 1,
		});
		const proposalId = own.json.proposals.find((p: { kind: string }) => p.kind === "update").id;
		const conflict = await h.call(ADMIN, "POST", `/proposals/${proposalId}/approve`, {});
		expect(conflict.status).toBe(409);
		const forced = await h.call(ADMIN, "POST", `/proposals/${proposalId}/approve`, { force: true });
		expect(forced.status).toBe(200);
		const after = await h.call(ADMIN, "GET", "/collections/people/jane-doe");
		expect(after.json.value).toMatchObject({ github: "janedoe", surname: "Doe-Smith" });
	});

	test("partners propose factual fields of their technology, never editorial ones", async () => {
		await h.call(ADMIN, "POST", "/collections/technologies", {
			data: { id: "teleport", name: "Teleport", description: "Access platform." },
		});
		await h.call(ADMIN, "POST", "/access", {
			userId: "partner-user",
			kind: "technology",
			targetId: "teleport",
		});
		const factual = await h.call(PARTNER, "PATCH", "/collections/technologies/teleport", {
			patch: { website: "https://goteleport.com" },
			ifVersion: 1,
		});
		expect(factual.status).toBe(202);
		const editorial = await h.call(PARTNER, "PATCH", "/collections/technologies/teleport", {
			patch: { matrix: { status: "advocate" } },
			ifVersion: 1,
		});
		expect(editorial.status).toBe(403);
		const status = await h.call(PARTNER, "PATCH", "/collections/technologies/teleport", {
			patch: { status: "stable", website: "https://goteleport.com" },
			ifVersion: 1,
		});
		expect(status.status).toBe(403);

		const pending = await h.call(ADMIN, "GET", "/proposals");
		const rejected = await h.call(ADMIN, "POST", `/proposals/${pending.json.proposals[0].id}/reject`, {
			note: "Use the docs link",
		});
		expect(rejected.status).toBe(200);
		expect((await h.call(ADMIN, "GET", "/proposals")).json.proposals).toHaveLength(0);
	});
});

describe("tokens and media", () => {
	test("tokens are shown once, listed without secrets and revocable", async () => {
		const created = await h.call(ADMIN, "POST", "/tokens", { name: "news agent", role: "content_agent" });
		expect(created.status).toBe(201);
		expect(created.json.secret).toMatch(/^cms_/);
		const list = await h.call(ADMIN, "GET", "/tokens");
		expect(JSON.stringify(list.json)).not.toContain(created.json.secret);
		expect((await h.call(ADMIN, "DELETE", `/tokens/${created.json.id}`)).status).toBe(200);
		const bad = await h.call(ADMIN, "POST", "/tokens", { name: "x", role: "root" });
		expect(bad.status).toBe(422);
	});

	test("uploads land under the entity with image dimensions", async () => {
		// A 3x2 PNG header is enough for the dimension reader.
		const png = new Uint8Array(32);
		png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
		png.set([0, 0, 0, 3, 0, 0, 0, 2], 16);
		const form = new FormData();
		form.set("file", new File([png], "My Cover.PNG", { type: "image/png" }));
		form.set("collection", "articles");
		form.set("id", "bun-from-scratch");
		const { status, json } = await h.call(ADMIN, "POST", "/media", undefined, { form });
		expect(status).toBe(201);
		expect(json.key).toMatch(/^articles\/bun-from-scratch\/my-cover-[a-z0-9]+\.png$/);
		expect(json).toMatchObject({ width: 3, height: 2, contentType: "image/png" });
		expect(json.url).toBe(`https://content.rawkode.academy/${json.key}`);
		expect(h.media.has(json.key)).toBe(true);

		const exe = new FormData();
		exe.set("file", new File([new Uint8Array(4)], "x.exe", { type: "application/octet-stream" }));
		exe.set("collection", "articles");
		exe.set("id", "bun-from-scratch");
		expect((await h.call(ADMIN, "POST", "/media", undefined, { form: exe })).status).toBe(415);
		expect((await h.call(GUEST, "POST", "/media", undefined, { form })).status).toBe(403);
	});
});
