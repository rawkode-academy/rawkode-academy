import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	integer,
	primaryKey,
	sqliteTable,
	text,
} from "drizzle-orm/sqlite-core";
import { Miniflare } from "miniflare";
import { z } from "zod";
import {
	type ChangeEvent,
	ContentStore,
	defineModels,
	rowSchema,
	slug,
} from "../src/index";

const technologies = sqliteTable("technologies", {
	id: text("id").notNull().primaryKey(),
	name: text("name").notNull().unique(),
	description: text("description").notNull(),
	status: text("status", { enum: ["stable", "beta"] })
		.notNull()
		.default("stable"),
	aliases: text("aliases", { mode: "json" }).$type<string[]>(),
	publishedAt: integer("published_at", { mode: "timestamp_ms" }),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
});

const guests = sqliteTable(
	"video_guests",
	{
		videoId: text("video_id").notNull(),
		guestId: text("guest_id").notNull(),
		position: integer("position").notNull().default(0),
	},
	(t) => [primaryKey({ columns: [t.videoId, t.guestId] })],
);

const SQL = `
CREATE TABLE technologies (id text PRIMARY KEY NOT NULL, name text NOT NULL UNIQUE, description text NOT NULL, status text DEFAULT 'stable' NOT NULL, aliases text, published_at integer, updated_at integer);
CREATE TABLE video_guests (video_id text NOT NULL, guest_id text NOT NULL, position integer DEFAULT 0 NOT NULL, PRIMARY KEY(video_id, guest_id));
CREATE TABLE content_revisions (id integer PRIMARY KEY AUTOINCREMENT NOT NULL, model text NOT NULL, entity_id text NOT NULL, version integer NOT NULL, operation text NOT NULL, actor_id text NOT NULL, actor_kind text NOT NULL, actor_name text, snapshot text, created_at integer NOT NULL);
CREATE UNIQUE INDEX content_revisions_entity_version_idx ON content_revisions (model, entity_id, version);
`;

const models = defineModels("test", [
	{
		kind: "entity",
		name: "technology",
		table: technologies,
		key: "id",
		schema: rowSchema(technologies, {
			id: slug(),
			aliases: z.array(z.string()).optional(),
		}),
		derive: (row) => ({ ...row, description: String(row.description).trim() }),
		tags: (row) => [`technologies:${row.id}`],
		search: ["name"],
	},
	{
		kind: "list",
		name: "video-guests",
		table: guests,
		parent: ["videoId"],
		position: "position",
		item: z.object({ guestId: z.string().min(1) }).strict(),
		tags: (parent, items) => [
			`videos:${parent.videoId}`,
			...items.map((i) => `people:${i.guestId}`),
		],
	},
]);

const david = { id: "user-1", kind: "user" as const, name: "David" };

let mf: Miniflare;
let store: ContentStore;
let sent: ChangeEvent[];

beforeEach(async () => {
	mf = new Miniflare({
		modules: true,
		script: "export default { fetch: () => new Response() }",
		compatibilityDate: "2025-04-05",
		d1Databases: { DB: crypto.randomUUID() },
	});
	const DB = (await mf.getD1Database("DB")) as unknown as D1Database;
	for (const statement of SQL.split(";").map((s) => s.trim()).filter(Boolean)) {
		await DB.prepare(statement).run();
	}
	sent = [];
	const queue = {
		send: async (event: ChangeEvent) => {
			sent.push(event);
		},
	} as unknown as Queue<ChangeEvent>;
	store = new ContentStore(models, { DB, CONTENT_CHANGES: queue });
});

afterEach(() => mf.dispose());

const bun = {
	id: "bun",
	name: "Bun",
	description: "  A JavaScript runtime ",
	aliases: ["bunjs"],
	publishedAt: "2026-10-01T00:00:00.000Z",
};

describe("entities", () => {
	test("create validates, derives, stamps updated_at, records version 1 and announces", async () => {
		const created = await store.create("technology", bun, david);
		expect(created.ok).toBe(true);
		if (!created.ok) return;
		expect(created.value.version).toBe(1);
		expect(created.value.value.description).toBe("A JavaScript runtime");
		expect(created.value.value.updatedAt).toBeInstanceOf(Date);
		const got = await store.get("technology", "bun");
		expect(got.ok && got.value.value.aliases).toEqual(["bunjs"]);
		expect(got.ok && got.value.value.publishedAt).toEqual(
			new Date("2026-10-01T00:00:00.000Z"),
		);
		expect(sent).toHaveLength(1);
		expect(sent[0]).toMatchObject({
			model: "technology",
			id: "bun",
			operation: "create",
			version: 1,
			tags: ["technologies:bun"],
			actor: david,
		});
	});

	test("create rejects invalid rows with field issues and writes nothing", async () => {
		const result = await store.create(
			"technology",
			{ ...bun, id: "Not A Slug", status: "gone" },
			david,
		);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.code).toBe("validation");
		const paths = result.error.issues?.map((i) => i.path);
		expect(paths).toContain("id");
		expect(paths).toContain("status");
		const list = await store.list("technology");
		expect(list.ok && list.value.total).toBe(0);
		expect(sent).toHaveLength(0);
	});

	test("create refuses an existing id", async () => {
		await store.create("technology", bun, david);
		const again = await store.create("technology", bun, david);
		expect(!again.ok && again.error.code).toBe("exists");
	});

	test("update merges a patch, bumps the version and keeps the id", async () => {
		await store.create("technology", bun, david);
		const updated = await store.update(
			"technology",
			"bun",
			{ status: "beta" },
			{ ifVersion: 1 },
			david,
		);
		expect(updated.ok && updated.value.version).toBe(2);
		const got = await store.get("technology", "bun");
		expect(got.ok && got.value.value.status).toBe("beta");
		expect(got.ok && got.value.value.name).toBe("Bun");
		expect(got.ok && got.value.version).toBe(2);
		const renamed = await store.update(
			"technology",
			"bun",
			{ id: "bunjs" },
			{ ifVersion: 2 },
			david,
		);
		expect(!renamed.ok && renamed.error.code).toBe("validation");
	});

	test("update with a stale version is a conflict and changes nothing", async () => {
		await store.create("technology", bun, david);
		await store.update("technology", "bun", { status: "beta" }, { ifVersion: 1 }, david);
		const stale = await store.update(
			"technology",
			"bun",
			{ name: "Bun 2" },
			{ ifVersion: 1 },
			david,
		);
		expect(stale.ok).toBe(false);
		if (stale.ok) return;
		expect(stale.error.code).toBe("conflict");
		expect(stale.error.currentVersion).toBe(2);
		const got = await store.get("technology", "bun");
		expect(got.ok && got.value.value.name).toBe("Bun");
	});

	test("a unique column clash is a validation error, not a crash", async () => {
		await store.create("technology", bun, david);
		const clash = await store.create(
			"technology",
			{ ...bun, id: "bun-two" },
			david,
		);
		expect(!clash.ok && clash.error.code).toBe("validation");
		// The failed batch must not leave a revision behind.
		const revisions = await store.revisions("technology", "bun-two");
		expect(revisions.ok && revisions.value).toHaveLength(0);
	});

	test("delete keeps the row in the last revision and restore brings it back", async () => {
		await store.create("technology", bun, david);
		await store.update("technology", "bun", { status: "beta" }, { ifVersion: 1 }, david);
		const deleted = await store.delete("technology", "bun", { ifVersion: 2 }, david);
		expect(deleted.ok && deleted.value.version).toBe(3);
		expect((await store.get("technology", "bun")).ok).toBe(false);

		const restored = await store.restore("technology", "bun", 3, david);
		expect(restored.ok && restored.value.version).toBe(4);
		const got = await store.get("technology", "bun");
		expect(got.ok && got.value.value.status).toBe("beta");

		const back = await store.restore("technology", "bun", 1, david);
		expect(back.ok && back.value.value.status).toBe("stable");

		const history = await store.revisions("technology", "bun");
		expect(history.ok && history.value.map((r) => r.operation)).toEqual([
			"restore",
			"restore",
			"delete",
			"update",
			"create",
		]);
		expect(sent.map((e) => e.operation)).toEqual([
			"create",
			"update",
			"delete",
			"restore",
			"restore",
		]);
	});

	test("list searches, filters and pages", async () => {
		await store.create("technology", bun, david);
		await store.create("technology", { ...bun, id: "deno", name: "Deno" }, david);
		await store.create(
			"technology",
			{ ...bun, id: "node", name: "Node.js", status: "beta" },
			david,
		);
		const search = await store.list("technology", { search: "de" });
		expect(search.ok && search.value.rows.map((r) => r.id)).toEqual([
			"deno",
			"node",
		]);
		const beta = await store.list("technology", { where: { status: "beta" } });
		expect(beta.ok && beta.value.rows.map((r) => r.id)).toEqual(["node"]);
		const page = await store.list("technology", { limit: 1, offset: 1 });
		expect(page.ok && page.value).toMatchObject({ total: 3 });
		expect(page.ok && page.value.rows.map((r) => r.id)).toEqual(["deno"]);
	});

	test("an actor is required", async () => {
		const result = await store.create(
			"technology",
			bun,
			undefined as unknown as typeof david,
		);
		expect(!result.ok && result.error.code).toBe("invalid_request");
	});

	test("unknown models are reported", async () => {
		const result = await store.get("nope", "x");
		expect(!result.ok && result.error.code).toBe("unknown_model");
	});
});

describe("lists", () => {
	test("setList replaces items, writes positions and tags old and new items", async () => {
		const first = await store.setList(
			"video-guests",
			{ videoId: "v1" },
			[{ guestId: "alice" }, { guestId: "bob" }],
			{ ifVersion: 0 },
			david,
		);
		expect(first.ok && first.value.version).toBe(1);
		const second = await store.setList(
			"video-guests",
			{ videoId: "v1" },
			[{ guestId: "carol" }, { guestId: "alice" }],
			{ ifVersion: 1 },
			david,
		);
		expect(second.ok).toBe(true);
		const got = await store.getList("video-guests", { videoId: "v1" });
		expect(got.ok && got.value.value).toEqual([
			{ videoId: "v1", guestId: "carol", position: 0 },
			{ videoId: "v1", guestId: "alice", position: 1 },
		]);
		expect(got.ok && got.value.version).toBe(2);
		expect(sent[1]?.tags.sort()).toEqual(
			["videos:v1", "people:alice", "people:bob", "people:carol"].sort(),
		);
	});

	test("setList validates every item and checks the version", async () => {
		const bad = await store.setList(
			"video-guests",
			{ videoId: "v1" },
			[{ guestId: "" }, { guestId: "x", extra: 1 }],
			{ ifVersion: 0 },
			david,
		);
		expect(!bad.ok && bad.error.issues?.map((i) => i.path)).toEqual([
			"0.guestId",
			"1.",
		]);
		await store.setList("video-guests", { videoId: "v1" }, [], { ifVersion: 0 }, david);
		const stale = await store.setList(
			"video-guests",
			{ videoId: "v1" },
			[],
			{ ifVersion: 0 },
			david,
		);
		expect(!stale.ok && stale.error.code).toBe("conflict");
	});

	test("setList inserts lists longer than one statement's parameter limit", async () => {
		const many = Array.from({ length: 90 }, (_, i) => ({ guestId: `g${i}` }));
		const result = await store.setList(
			"video-guests",
			{ videoId: "v2" },
			many,
			{ ifVersion: 0 },
			david,
		);
		expect(result.ok).toBe(true);
		const got = await store.getList("video-guests", { videoId: "v2" });
		expect(got.ok && got.value.value).toHaveLength(90);
		expect(got.ok && got.value.value[89]).toMatchObject({ guestId: "g89", position: 89 });
	});

	test("findReferences finds parents that point at an entity", async () => {
		await store.setList(
			"video-guests",
			{ videoId: "v1" },
			[{ guestId: "alice" }],
			{ ifVersion: 0 },
			david,
		);
		await store.setList(
			"video-guests",
			{ videoId: "v2" },
			[{ guestId: "alice" }, { guestId: "bob" }],
			{ ifVersion: 0 },
			david,
		);
		const refs = await store.findReferences("video-guests", "guestId", "alice");
		expect(refs.ok && refs.value.map((r) => r.videoId).sort()).toEqual(["v1", "v2"]);
	});
});

test("a failing queue does not fail a committed write", async () => {
	const DB = (await mf.getD1Database("DB")) as unknown as D1Database;
	const broken = new ContentStore(models, {
		DB,
		CONTENT_CHANGES: {
			send: async () => {
				throw new Error("queue down");
			},
		} as unknown as Queue<ChangeEvent>,
	});
	const original = console.error;
	console.error = () => {};
	try {
		const created = await broken.create("technology", bun, david);
		expect(created.ok).toBe(true);
	} finally {
		console.error = original;
	}
});

test("describeModels derives editor fields from the zod schemas", async () => {
	const { describeModels } = await import("../src/index");
	const [technology, guestList] = describeModels(models);
	expect(technology?.key).toBe("id");
	const fields = Object.fromEntries((technology?.fields ?? []).map((f) => [f.name, f]));
	expect(fields.id).toMatchObject({ type: "slug", required: true });
	expect(fields.name).toMatchObject({ type: "text", required: true });
	expect(fields.status).toMatchObject({
		type: "enum",
		options: ["stable", "beta"],
		required: false,
	});
	expect(fields.aliases).toMatchObject({ type: "strings", required: false });
	expect(fields.publishedAt).toMatchObject({ type: "date", nullable: true });
	expect(guestList).toMatchObject({
		kind: "list",
		parent: ["videoId"],
		position: "position",
		fields: [{ name: "guestId", type: "text", required: true }],
	});
});
