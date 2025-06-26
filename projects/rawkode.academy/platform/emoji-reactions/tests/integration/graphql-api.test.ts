import { describe, it, expect, beforeEach } from "bun:test";
import { createYoga } from "graphql-yoga";
import { getSchema } from "../../read-model/schema.ts";
import { emojiReactionsTable } from "../../data-model/schema.ts";
import { drizzle } from "drizzle-orm/d1";

describe("GraphQL API Integration Tests", () => {
	let yoga: ReturnType<typeof createYoga>;
	const db = drizzle(globalThis.env.DB);

	beforeEach(async () => {
		await db.delete(emojiReactionsTable).execute();

		const schema = getSchema(globalThis.env);
		yoga = createYoga({
			schema,
			graphqlEndpoint: "/",
		});
	});

	describe("Queries", () => {
		beforeEach(async () => {
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
					{
						contentId: "video-456",
						personId: "user-1",
						emoji: "🎉",
						reactedAt: new Date(),
					},
				])
				.execute();
		});

		it("should get emoji reactions for content", async () => {
			const query = `
				query {
					getEmojiReactionsForContent(contentId: "video-123") {
						emoji
						count
					}
				}
			`;

			const response = await yoga.fetch(
				new Request("http://localhost/", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ query }),
				}),
				globalThis.env,
			);

			const result = await response.json();
			expect(result.data.getEmojiReactionsForContent).toBeArray();
			expect(result.data.getEmojiReactionsForContent.length).toBe(2);

			const thumbsUp = result.data.getEmojiReactionsForContent.find(
				(r: any) => r.emoji === "👍",
			);
			expect(thumbsUp.count).toBe(2);

			const heart = result.data.getEmojiReactionsForContent.find(
				(r: any) => r.emoji === "❤️",
			);
			expect(heart.count).toBe(1);
		});

		it("should get top emoji reactions", async () => {
			const query = `
				query {
					getTopEmojiReactions(limit: 2) {
						emoji
						count
					}
				}
			`;

			const response = await yoga.fetch(
				new Request("http://localhost/", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ query }),
				}),
				globalThis.env,
			);

			const result = await response.json();
			expect(result.data.getTopEmojiReactions).toBeArray();
			expect(result.data.getTopEmojiReactions.length).toBe(2);
			expect(result.data.getTopEmojiReactions[0].count).toBe(2); // 👍 appears twice
		});
	});

	describe("Federation Extensions", () => {
		it("should resolve Video type with emoji reactions", async () => {
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
						emoji: "❤️",
						reactedAt: new Date(),
					},
				])
				.execute();

			const query = `
				query {
					_entities(representations: [{ __typename: "Video", id: "video-123" }]) {
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
				globalThis.env,
			);

			const result = await response.json();
			expect(result.data._entities).toBeArray();
			expect(result.data._entities[0].emojiReactions).toBeArray();
			expect(result.data._entities[0].emojiReactions.length).toBe(2);
		});

		it("should check if user has reacted on Video", async () => {
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
							id
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
				globalThis.env,
			);

			const result = await response.json();
			expect(result.data._entities[0].hasReacted).toBe(true);
		});
	});

	describe("Error Handling", () => {
		it("should handle missing required arguments", async () => {
			const query = `
				query {
					getEmojiReactionsForContent
				}
			`;

			const response = await yoga.fetch(
				new Request("http://localhost/", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ query }),
				}),
				globalThis.env,
			);

			const result = await response.json();
			expect(result.errors).toBeDefined();
			expect(result.errors[0].message).toContain(
				"must have a selection of subfields",
			);
		});

		it("should handle invalid query syntax", async () => {
			const query = `
				query {
					getEmojiReactionsForContent(
				}
			`;

			const response = await yoga.fetch(
				new Request("http://localhost/", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ query }),
				}),
				globalThis.env,
			);

			const result = await response.json();
			expect(result.errors).toBeDefined();
			expect(result.errors[0].message).toContain("Syntax Error");
		});
	});
});
