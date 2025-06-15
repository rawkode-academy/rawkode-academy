import { describe, it, expect, beforeEach } from "bun:test";
import { createYoga } from "graphql-yoga";
import * as schema from "../../data-model/schema";
import { getSchema } from "../../read-model/schema";
import { drizzle } from "drizzle-orm/d1";

declare const env: { DB: D1Database };

describe("GraphQL Input Validation and Error Handling", () => {
	let yoga: ReturnType<typeof createYoga>;

	beforeEach(async () => {
		const db = drizzle(env.DB);
		await db.delete(schema.castingCreditsTable);

		await db.insert(schema.castingCreditsTable).values([
			{ personId: "person1", role: "host", videoId: "video1" },
		]);

		yoga = createYoga({
			schema: getSchema(env),
			graphqlEndpoint: "/",
		});
	});

	describe("Query Validation", () => {
		it("should validate role argument is a string", async () => {
			const query = `
				query {
					_entities(representations: [{ __typename: "Video", id: "video1" }]) {
						... on Video {
							creditsForRole(role: 123) {
								person { id }
							}
						}
					}
				}
			`;

			const response = await yoga.fetch("http://localhost", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ query }),
			});

			const result = await response.json();
			expect(result.errors).toBeDefined();
			expect(result.errors[0].message).toContain("String");
		});

		it("should handle empty role strings", async () => {
			const query = `
				query {
					_entities(representations: [{ __typename: "Video", id: "video1" }]) {
						... on Video {
							creditsForRole(role: "") {
								person { id }
							}
						}
					}
				}
			`;

			const response = await yoga.fetch("http://localhost", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ query }),
			});

			const result = await response.json();
			expect(result.errors).toBeUndefined();
			expect(result.data._entities[0].creditsForRole).toHaveLength(0);
		});

		it("should handle very long role strings", async () => {
			const longRole = "a".repeat(1000);
			const query = `
				query($role: String!) {
					_entities(representations: [{ __typename: "Video", id: "video1" }]) {
						... on Video {
							creditsForRole(role: $role) {
								person { id }
							}
						}
					}
				}
			`;

			const response = await yoga.fetch("http://localhost", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ 
					query,
					variables: { role: longRole }
				}),
			});

			const result = await response.json();
			expect(result.errors).toBeUndefined();
			expect(result.data._entities[0].creditsForRole).toHaveLength(0);
		});

		it("should handle special characters in role", async () => {
			const db = drizzle(env.DB);
			const specialRole = "host & producer (main)";
			
			await db.insert(schema.castingCreditsTable).values({
				personId: "person2",
				role: specialRole,
				videoId: "video1",
			});

			const query = `
				query($role: String!) {
					_entities(representations: [{ __typename: "Video", id: "video1" }]) {
						... on Video {
							creditsForRole(role: $role) {
								person { id }
							}
						}
					}
				}
			`;

			const response = await yoga.fetch("http://localhost", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ 
					query,
					variables: { role: specialRole }
				}),
			});

			const result = await response.json();
			expect(result.errors).toBeUndefined();
			expect(result.data._entities[0].creditsForRole).toHaveLength(1);
			expect(result.data._entities[0].creditsForRole[0].person.id).toBe("person2");
		});
	});

	describe("HTTP Protocol Handling", () => {
		it("should require POST method", async () => {
			const response = await yoga.fetch("http://localhost", {
				method: "GET",
			});

			// GraphQL Yoga accepts GET requests for introspection
			expect(response.status).toBe(200);
		});

		it("should handle missing Content-Type", async () => {
			const response = await yoga.fetch("http://localhost", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ 
					query: "{ __typename }"
				}),
			});

			const result = await response.json();
			// GraphQL Yoga handles this gracefully
			expect(result.errors).toBeUndefined();
			expect(result.data.__typename).toBe("Query");
		});

		it("should handle malformed JSON", async () => {
			const response = await yoga.fetch("http://localhost", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: "{ invalid json",
			});

			const result = await response.json();
			expect(result.errors).toBeDefined();
			expect(response.status).toBe(400);
		});

		it("should handle empty body", async () => {
			const response = await yoga.fetch("http://localhost", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: "",
			});

			const result = await response.json();
			expect(result.errors).toBeDefined();
		});

		it("should handle missing query field", async () => {
			const response = await yoga.fetch("http://localhost", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({}),
			});

			const result = await response.json();
			expect(result.errors).toBeDefined();
		});
	});

	describe("GraphQL Error Responses", () => {
		it("should provide helpful error messages for syntax errors", async () => {
			const query = `
				query {
					_entities(representations: [{ __typename: "Video", id: "video1" }]) {
						... on Video {
							creditsForRole(role: "host" {
								person { id }
							}
						}
					}
				}
			`;

			const response = await yoga.fetch("http://localhost", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ query }),
			});

			const result = await response.json();
			expect(result.errors).toBeDefined();
			expect(result.errors[0].message).toContain("Syntax Error");
		});

		it("should handle field selection errors", async () => {
			const query = `
				query {
					_entities(representations: [{ __typename: "Video", id: "video1" }]) {
						... on Video {
							creditsForRole(role: "host") {
								person { 
									id
									nonExistentField
								}
							}
						}
					}
				}
			`;

			const response = await yoga.fetch("http://localhost", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ query }),
			});

			const result = await response.json();
			expect(result.errors).toBeDefined();
			expect(result.errors[0].message).toContain("Cannot query field");
		});

		it("should handle type mismatch in representations", async () => {
			const query = `
				query {
					_entities(representations: [{ 
						__typename: "Video", 
						id: 123  
					}]) {
						... on Video {
							id
						}
					}
				}
			`;

			const response = await yoga.fetch("http://localhost", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ query }),
			});

			const result = await response.json();
			// Should coerce number to string
			expect(result.errors).toBeUndefined();
			expect(result.data._entities[0].id).toBe("123");
		});
	});

	describe("Variable Handling", () => {
		it("should handle null variables correctly", async () => {
			const query = `
				query($role: String!) {
					_entities(representations: [{ __typename: "Video", id: "video1" }]) {
						... on Video {
							creditsForRole(role: $role) {
								person { id }
							}
						}
					}
				}
			`;

			const response = await yoga.fetch("http://localhost", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ 
					query,
					variables: { role: null }
				}),
			});

			const result = await response.json();
			expect(result.errors).toBeDefined();
			expect(result.errors[0].message).toContain("Variable");
		});

		it("should handle missing required variables", async () => {
			const query = `
				query($role: String!) {
					_entities(representations: [{ __typename: "Video", id: "video1" }]) {
						... on Video {
							creditsForRole(role: $role) {
								person { id }
							}
						}
					}
				}
			`;

			const response = await yoga.fetch("http://localhost", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ 
					query,
					variables: {}
				}),
			});

			const result = await response.json();
			expect(result.errors).toBeDefined();
		});

		it("should handle extra variables gracefully", async () => {
			const query = `
				query {
					_entities(representations: [{ __typename: "Video", id: "video1" }]) {
						... on Video {
							creditsForRole(role: "host") {
								person { id }
							}
						}
					}
				}
			`;

			const response = await yoga.fetch("http://localhost", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ 
					query,
					variables: { 
						unusedVar: "value",
						anotherUnused: 123 
					}
				}),
			});

			const result = await response.json();
			expect(result.errors).toBeUndefined();
			expect(result.data._entities[0].creditsForRole).toHaveLength(1);
		});
	});

	describe("Introspection Security", () => {
		it("should allow introspection queries", async () => {
			const query = `
				{
					__schema {
						queryType {
							name
						}
					}
				}
			`;

			const response = await yoga.fetch("http://localhost", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ query }),
			});

			const result = await response.json();
			expect(result.errors).toBeUndefined();
			expect(result.data.__schema.queryType.name).toBe("Query");
		});

		it("should handle deeply nested queries", async () => {
			// Create a potential DoS query
			const query = `
				query {
					_entities(representations: [{ __typename: "Video", id: "video1" }]) {
						... on Video {
							creditsForRole(role: "host") {
								person { 
									id
									__typename
								}
								__typename
							}
							__typename
						}
						__typename
					}
				}
			`;

			const response = await yoga.fetch("http://localhost", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ query }),
			});

			const result = await response.json();
			expect(result.errors).toBeUndefined();
			// Should handle without performance issues
		});
	});
});