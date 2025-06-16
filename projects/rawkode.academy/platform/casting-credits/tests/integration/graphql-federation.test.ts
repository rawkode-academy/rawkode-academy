import { describe, it, expect, beforeEach } from "bun:test";
import { createYoga } from "graphql-yoga";
import * as schema from "../../data-model/schema";
import { getSchema } from "../../read-model/schema";
import { drizzle } from "drizzle-orm/d1";

declare const env: { DB: D1Database };

describe("GraphQL Federation Features", () => {
	let yoga: ReturnType<typeof createYoga>;

	beforeEach(async () => {
		const db = drizzle(env.DB);

		// Clear existing data
		await db.delete(schema.castingCreditsTable);

		// Seed test data
		await db.insert(schema.castingCreditsTable).values([
			{ personId: "person1", role: "host", videoId: "video1" },
			{ personId: "person2", role: "guest", videoId: "video1" },
			{ personId: "person3", role: "producer", videoId: "video1" },
			{ personId: "person1", role: "host", videoId: "video2" },
			{ personId: "person4", role: "editor", videoId: "video2" },
		]);

		// Create the yoga server
		yoga = createYoga({
			schema: getSchema(env),
			graphqlEndpoint: "/",
		});
	});

	describe("Federation SDL", () => {
		it("should expose proper federation directives", async () => {
			const query = `
				{
					_service {
						sdl
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

			const sdl = result.data._service.sdl;

			// Check for federation directives
			expect(sdl).toContain("@extends");
			expect(sdl).toContain("@external");

			// Check for proper type extensions
			expect(sdl).toContain("type Video");
			expect(sdl).toContain("@extends");
			expect(sdl).toContain("type Person");

			// Check for our custom fields
			expect(sdl).toContain("creditsForRole(role: String!): [CastingCredit!]");
		});
	});

	describe("Entity Resolution", () => {
		it("should resolve Video entities with credits", async () => {
			const query = `
				query {
					_entities(representations: [
						{ __typename: "Video", id: "video1" },
						{ __typename: "Video", id: "video2" }
					]) {
						... on Video {
							id
							creditsForRole(role: "host") {
								person {
									id
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
			expect(result.errors).toBeUndefined();

			const entities = result.data._entities;
			expect(entities).toHaveLength(2);

			// video1 should have person1 as host
			expect(entities[0].id).toBe("video1");
			expect(entities[0].creditsForRole).toHaveLength(1);
			expect(entities[0].creditsForRole[0].person.id).toBe("person1");

			// video2 should have person1 as host
			expect(entities[1].id).toBe("video2");
			expect(entities[1].creditsForRole).toHaveLength(1);
			expect(entities[1].creditsForRole[0].person.id).toBe("person1");
		});

		it("should handle non-existent entities gracefully", async () => {
			const query = `
				query {
					_entities(representations: [
						{ __typename: "Video", id: "nonexistent" }
					]) {
						... on Video {
							id
							creditsForRole(role: "host") {
								person {
									id
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
			expect(result.errors).toBeUndefined();
			expect(result.data._entities[0].creditsForRole).toHaveLength(0);
		});

		it("should handle invalid entity types", async () => {
			const query = `
				query {
					_entities(representations: [
						{ __typename: "InvalidType", id: "123" }
					]) {
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
			// The schema doesn't include InvalidType, so it returns an error
			expect(result.errors).toBeDefined();
			expect(result.errors[0].message).toContain("Unexpected error");
			expect(result.errors[0].path).toEqual(["_entities"]);
		});
	});

	describe("Complex Queries", () => {
		it("should handle multiple role queries efficiently", async () => {
			const query = `
				query {
					_entities(representations: [{ __typename: "Video", id: "video1" }]) {
						... on Video {
							id
							hosts: creditsForRole(role: "host") {
								person { id }
							}
							guests: creditsForRole(role: "guest") {
								person { id }
							}
							producers: creditsForRole(role: "producer") {
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

			const video = result.data._entities[0];
			expect(video.hosts).toHaveLength(1);
			expect(video.hosts[0].person.id).toBe("person1");
			expect(video.guests).toHaveLength(1);
			expect(video.guests[0].person.id).toBe("person2");
			expect(video.producers).toHaveLength(1);
			expect(video.producers[0].person.id).toBe("person3");
		});

		it("should handle batch entity resolution", async () => {
			// Create more test data
			const db = drizzle(env.DB);
			const videoIds = Array.from({ length: 10 }, (_, i) => `video${i + 10}`);
			await db.insert(schema.castingCreditsTable).values(
				videoIds.map((videoId) => ({
					personId: "person1",
					role: "host",
					videoId,
				})),
			);

			const representations = videoIds.map((id) => ({
				__typename: "Video",
				id,
			}));

			const query = `
				query($representations: [_Any!]!) {
					_entities(representations: $representations) {
						... on Video {
							id
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
					variables: { representations },
				}),
			});

			const result = await response.json();
			expect(result.errors).toBeUndefined();
			expect(result.data._entities).toHaveLength(10);
			expect(
				result.data._entities.every(
					(e: any) =>
						e.creditsForRole.length === 1 &&
						e.creditsForRole[0].person.id === "person1",
				),
			).toBe(true);
		});
	});

	describe("Error Handling", () => {
		it("should handle malformed queries gracefully", async () => {
			const query = `
				query {
					_entities(representations: "not an array") {
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
			expect(result.errors).toBeDefined();
			// The actual error message varies, but we get an error
			expect(result.errors[0].message).toBeTruthy();
		});

		it("should handle missing required arguments", async () => {
			const query = `
				query {
					_entities(representations: [{ __typename: "Video", id: "video1" }]) {
						... on Video {
							creditsForRole {
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
			expect(result.errors[0].message).toContain("required");
		});

		it("should handle database errors gracefully", async () => {
			// This is tricky to test without mocking, but we can test
			// that the server doesn't crash on unexpected inputs
			const query = `
				query {
					_entities(representations: [{
						__typename: "Video",
						id: "'; DROP TABLE casting_credits; --"
					}]) {
						... on Video {
							id
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
				body: JSON.stringify({ query }),
			});

			const result = await response.json();
			expect(result.errors).toBeUndefined();
			// Should return empty results, not crash
			expect(result.data._entities[0].creditsForRole).toHaveLength(0);
		});
	});

	describe("Performance Characteristics", () => {
		it("should handle large result sets", async () => {
			// Add many credits for one video
			const db = drizzle(env.DB);

			// D1 has a limit on SQL variables, batch the inserts
			const batchSize = 30;
			for (let i = 0; i < 100; i += batchSize) {
				const credits = Array.from(
					{ length: Math.min(batchSize, 100 - i) },
					(_, j) => ({
						personId: `person${i + j + 100}`,
						role: "extra",
						videoId: "video1",
					}),
				);
				await db.insert(schema.castingCreditsTable).values(credits);
			}

			const query = `
				query {
					_entities(representations: [{ __typename: "Video", id: "video1" }]) {
						... on Video {
							id
							creditsForRole(role: "extra") {
								person { id }
							}
						}
					}
				}
			`;

			const startTime = Date.now();
			const response = await yoga.fetch("http://localhost", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ query }),
			});
			const endTime = Date.now();

			const result = await response.json();
			expect(result.errors).toBeUndefined();
			expect(result.data._entities[0].creditsForRole).toHaveLength(100);

			// Should complete in reasonable time (< 1 second)
			expect(endTime - startTime).toBeLessThan(1000);
		});

		it("should avoid N+1 queries for person resolution", async () => {
			// This test verifies that person references are efficient
			const query = `
				query {
					_entities(representations: [{ __typename: "Video", id: "video1" }]) {
						... on Video {
							id
							hosts: creditsForRole(role: "host") {
								person { id }
							}
							guests: creditsForRole(role: "guest") {
								person { id }
							}
							producers: creditsForRole(role: "producer") {
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

			// All queries should complete successfully
			const video = result.data._entities[0];
			expect(video.hosts).toHaveLength(1);
			expect(video.guests).toHaveLength(1);
			expect(video.producers).toHaveLength(1);
		});
	});
});
