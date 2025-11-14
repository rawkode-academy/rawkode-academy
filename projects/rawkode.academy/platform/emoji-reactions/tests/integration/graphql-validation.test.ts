import { describe, it, expect, beforeEach } from "bun:test";
import { env } from "cloudflare:test";
import { createYoga } from "graphql-yoga";
import { getSchema } from "../../read-model/schema";
import { drizzle } from "drizzle-orm/d1";
import { emojiReactionsTable } from "../../data-model/schema";

describe("GraphQL Validation Tests", () => {
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

	describe("Query Validation", () => {
		it("should validate required contentId in getEmojiReactionsForContent", async () => {
			const query = `
				query {
					getEmojiReactionsForContent {
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
			);

			const result = await response.json();
			expect(result.errors).toBeDefined();
			expect(result.errors[0].message).toContain("contentId");
		});

		it("should handle non-existent content gracefully", async () => {
			const query = `
				query {
					getEmojiReactionsForContent(contentId: "non-existent-id") {
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
			);

			const result = await response.json();
			expect(result.errors).toBeUndefined();
			expect(result.data.getEmojiReactionsForContent).toEqual([]);
		});

		it("should validate limit parameter in getTopEmojiReactions", async () => {
			const query = `
				query {
					getTopEmojiReactions(limit: "five") {
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
			);

			const result = await response.json();
			expect(result.errors).toBeDefined();
			expect(result.errors[0].message).toContain("Int");
		});

		it("should handle negative limit in getTopEmojiReactions", async () => {
			const query = `
				query {
					getTopEmojiReactions(limit: -5) {
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
			);

			const result = await response.json();
			expect(result.errors).toBeUndefined();
			// Should return empty array for negative limit
			expect(result.data.getTopEmojiReactions).toEqual([]);
		});
	});

	describe("Federation Query Validation", () => {
		it("should validate entity representations", async () => {
			const query = `
				query {
					_entities(representations: [{ __typename: "InvalidType", id: "123" }]) {
						__typename
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
			expect(result.errors).toBeDefined();
			expect(result.errors[0].message).toBe("Unexpected error.");
		});

		it("should validate required args in hasReacted", async () => {
			const query = `
				query {
					_entities(representations: [{ __typename: "Video", id: "123" }]) {
						... on Video {
							hasReacted(personId: "user-123")
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
			expect(result.errors).toBeDefined();
			expect(result.errors[0].message).toContain("emoji");
		});
	});

	describe("Boundary Conditions", () => {
		it("should handle very long contentIds", async () => {
			const longId = "a".repeat(1000);
			const query = `
				query {
					getEmojiReactionsForContent(contentId: "${longId}") {
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
			);

			const result = await response.json();
			expect(result.errors).toBeUndefined();
			expect(result.data.getEmojiReactionsForContent).toEqual([]);
		});

		it("should handle special characters in contentId", async () => {
			const specialId = "video-123!@#$%^&*()_+";
			const query = `
				query {
					getEmojiReactionsForContent(contentId: "${specialId}") {
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
			);

			const result = await response.json();
			expect(result.errors).toBeUndefined();
			expect(result.data.getEmojiReactionsForContent).toEqual([]);
		});

		it("should handle large limit values", async () => {
			const query = `
				query {
					getTopEmojiReactions(limit: 10000) {
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
			);

			const result = await response.json();
			expect(result.errors).toBeUndefined();
			expect(result.data.getTopEmojiReactions).toBeArray();
		});
	});
});
