import { describe, it, expect, beforeEach } from "bun:test";
import { createYoga } from "graphql-yoga";
import { getSchema } from "../../read-model/schema";
import { drizzle } from "drizzle-orm/d1";
import { emojiReactionsTable } from "../../data-model/schema";

describe("GraphQL Validation Tests", () => {
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
				globalThis.env,
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
				globalThis.env,
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
				globalThis.env,
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
				globalThis.env,
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
				globalThis.env,
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
				globalThis.env,
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
				globalThis.env,
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
				globalThis.env,
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
				globalThis.env,
			);

			const result = await response.json();
			expect(result.errors).toBeUndefined();
			expect(result.data.getTopEmojiReactions).toBeArray();
		});
	});
});
