import { describe, it, expect, beforeEach } from "bun:test";
import { env } from "cloudflare:test";
import { createYoga } from "graphql-yoga";
import { getSchema } from "../../read-model/schema";
import { drizzle } from "drizzle-orm/d1";
import { emojiReactionsTable } from "../../data-model/schema";
import { printSchema } from "graphql";
import { printSchemaWithDirectives } from "@graphql-tools/utils";

describe("GraphQL Federation Tests", () => {
	let yoga: ReturnType<typeof createYoga>;
	let db: ReturnType<typeof drizzle>;

	beforeEach(async () => {
		// Use cloudflare:test D1 stub
		const d1 = env.DB;
		db = drizzle(d1);

		// Create the table using D1 exec
		await d1.exec(`
			CREATE TABLE IF NOT EXISTS emoji_reactions (
				content_id TEXT NOT NULL,
				person_id TEXT NOT NULL,
				emoji TEXT NOT NULL,
				reacted_at INTEGER DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
				content_timestamp INTEGER DEFAULT 0 NOT NULL,
				PRIMARY KEY (content_id, person_id, emoji, content_timestamp)
			);
		`);

		const schema = getSchema({ DB: d1 } as any);
		yoga = createYoga({
			schema,
			graphqlEndpoint: "/",
		});
	});

	describe("Federation Schema", () => {
		it("should include federation directives in schema", () => {
			const schema = getSchema({ DB: env.DB } as any);
			const schemaString = printSchemaWithDirectives(schema);

			expect(schemaString).toContain("@link");
			expect(schemaString).toContain(
				"https://specs.apollo.dev/federation/v2.6",
			);
			expect(schemaString).toContain("@extends");
			expect(schemaString).toContain("@external");
			expect(schemaString).toContain("@key");
		});

		it("should extend Video type", () => {
			const schema = getSchema({ DB: db } as any);
			const schemaString = printSchemaWithDirectives(schema);

			expect(schemaString).toContain("type Video");
			expect(schemaString).toContain("@extends");
			expect(schemaString).toContain("emojiReactions: [EmojiReaction!]");
			expect(schemaString).toContain("hasReacted");
			expect(schemaString).toContain("emoji: String!");
			expect(schemaString).toContain("personId: String!");
		});
	});

	describe("Entity Resolution", () => {
		it("should resolve Video entity with emoji reactions", async () => {
			// Add test data
			await db
				.insert(emojiReactionsTable)
				.values([
					{
						contentId: "video-123",
						personId: "user-1",
						emoji: "👍",
						reactedAt: new Date(),
					},
					{
						contentId: "video-123",
						personId: "user-2",
						emoji: "👍",
						reactedAt: new Date(),
					},
					{
						contentId: "video-123",
						personId: "user-3",
						emoji: "❤️",
						reactedAt: new Date(),
					},
				])
				.execute();

			const query = `
				query {
					_entities(representations: [{
						__typename: "Video",
						id: "video-123"
					}]) {
						... on Video {
							id
							emojiReactions {
								emoji
								count
							}
						}
					}
				}
			`;

			const response = await yoga.fetch(
				new Request("http://localhost/", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ query }),
				}),
			);

			const result = await response.json();
			expect(result.errors).toBeUndefined();
			expect(result.data._entities).toBeArray();
			expect(result.data._entities[0].id).toBe("video-123");
			expect(result.data._entities[0].emojiReactions).toBeArray();

			const thumbsUp = result.data._entities[0].emojiReactions.find(
				(r: any) => r.emoji === "👍",
			);
			expect(thumbsUp.count).toBe(2);
		});

		it("should handle multiple entity representations", async () => {
			// Add test data
			await db
				.insert(emojiReactionsTable)
				.values([
					{
						contentId: "video-123",
						personId: "user-1",
						emoji: "👍",
						reactedAt: new Date(),
					},
				])
				.execute();

			const query = `
				query {
					_entities(representations: [
						{ __typename: "Video", id: "video-123" },
					]) {
						__typename
						... on Video {
							id
							emojiReactions { emoji count }
						}
					}
				}
			`;

			const response = await yoga.fetch(
				new Request("http://localhost/", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ query }),
				}),
			);

			const result = await response.json();
			expect(result.data._entities).toBeArray();
			expect(result.data._entities.length).toBe(1);

			const video = result.data._entities.find(
				(e: any) => e.__typename === "Video",
			);
			expect(video.emojiReactions[0].emoji).toBe("👍");
		});
	});

	describe("Federation Field Extensions", () => {
		it("should check hasReacted field on Video", async () => {
			await db
				.insert(emojiReactionsTable)
				.values({
					contentId: "video-123",
					personId: "user-456",
					emoji: "👍",
					reactedAt: new Date(),
				})
				.execute();

			const query = `
				query {
					_entities(representations: [{ __typename: "Video", id: "video-123" }]) {
						... on Video {
							hasReacted(personId: "user-456", emoji: "👍")
						}
					}
				}
			`;

			const response = await yoga.fetch(
				new Request("http://localhost/", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ query }),
				}),
			);

			const result = await response.json();
			expect(result.data._entities[0].hasReacted).toBe(true);
		});

		it("should return false for hasReacted when no reaction exists", async () => {
			const query = `
				query {
					_entities(representations: [{ __typename: "Video", id: "video-123" }]) {
						... on Video {
							hasReacted(personId: "user-456", emoji: "👍")
						}
					}
				}
			`;

			const response = await yoga.fetch(
				new Request("http://localhost/", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ query }),
				}),
			);

			const result = await response.json();
			expect(result.data._entities[0].hasReacted).toBe(false);
		});
	});

	describe("Service SDL", () => {
		it("should return service SDL", async () => {
			const query = `
				query {
					_service {
						sdl
					}
				}
			`;

			const response = await yoga.fetch(
				new Request("http://localhost/", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ query }),
				}),
			);

			const result = await response.json();
			expect(result.data._service.sdl).toBeDefined();
			expect(result.data._service.sdl).toContain("type EmojiReaction");
			expect(result.data._service.sdl).toContain("type Video");
			expect(result.data._service.sdl).toContain("@extends");
		});
	});
});
