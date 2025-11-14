import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { env } from "cloudflare:test";
import { createYoga } from "graphql-yoga";
import * as schema from "../../data-model/schema";
import { getSchema } from "../../read-model/schema";
import { drizzle } from "drizzle-orm/d1";

/**
 * GraphQL API Integration Tests
 *
 * These tests verify that our GraphQL API works correctly with a real database.
 * We use cloudflare:test to simulate Cloudflare Workers environment.
 */
describe("GraphQL API Integration", () => {
	let yoga: ReturnType<typeof createYoga>;
	let db: ReturnType<typeof drizzle>;

	beforeEach(async () => {
		// Use cloudflare:test D1 stub
		const d1 = env.DB;
		db = drizzle(d1, { schema });

		// Create the table using D1 exec
		await d1.exec(`
			CREATE TABLE IF NOT EXISTS casting_credits (
				person_id TEXT NOT NULL,
				role TEXT NOT NULL,
				video_id TEXT NOT NULL,
				created_at INTEGER DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
				PRIMARY KEY (person_id, role, video_id)
			);
		`);

		// Seed test data
		await db.insert(schema.castingCreditsTable).values([
			{ personId: "person1", role: "host", videoId: "video1" },
			{ personId: "person2", role: "guest", videoId: "video1" },
			{ personId: "person1", role: "host", videoId: "video2" },
			{ personId: "person3", role: "guest", videoId: "video2" },
		]);

		// Create the yoga server
		yoga = createYoga({
			schema: getSchema({ DB: d1 } as any),
			graphqlEndpoint: "/",
		});
	});

	it("should execute introspection queries", async () => {
		const query = `
      {
        __schema {
          types {
            name
          }
        }
      }
    `;

		const response = await yoga.fetch("http://localhost", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ query }),
		});

		const result = await response.json();
		expect(result.errors).toBeUndefined();
		const types = result.data.__schema.types.map((t: any) => t.name);
		expect(types).toContain("Video");
		expect(types).toContain("CastingCredit");
		expect(types).toContain("Person");
	});

	it("should handle _service queries for federation", async () => {
		const query = `
      {
        _service {
          sdl
        }
      }
    `;

		const response = await yoga.fetch("http://localhost", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ query }),
		});

		const result = await response.json();
		expect(result.errors).toBeUndefined();
		expect(result.data._service.sdl).toBeDefined();
		expect(result.data._service.sdl).toContain("type Video");
		expect(result.data._service.sdl).toContain("type CastingCredit");
	});

	it("should resolve Video.creditsForRole field", async () => {
		// This is a representation of how the resolver would be called in a federated graph
		// We're simulating the Video.creditsForRole resolver being called with a video object

		// Test the resolver through GraphQL query
		const query = `
			query {
				_entities(representations: [{ __typename: "Video", id: "video1" }]) {
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
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ query }),
		});

		const result = await response.json();
		expect(result.errors).toBeUndefined();
		expect(result.data._entities[0].creditsForRole).toHaveLength(1);
		expect(result.data._entities[0].creditsForRole[0].person.id).toBe(
			"person1",
		);
	});

	it("should resolve Video.creditsForRole field with multiple results", async () => {
		// Add another host for video1
		await db.insert(schema.castingCreditsTable).values({
			personId: "person4",
			role: "host",
			videoId: "video1",
		});

		// Test the resolver through GraphQL query
		const query = `
			query {
				_entities(representations: [{ __typename: "Video", id: "video1" }]) {
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
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ query }),
		});

		const result = await response.json();
		expect(result.errors).toBeUndefined();
		expect(result.data._entities[0].creditsForRole).toHaveLength(2);

		// Check that both person1 and person4 are in the results
		const personIds = result.data._entities[0].creditsForRole.map(
			(c: any) => c.person.id,
		);
		expect(personIds).toContain("person1");
		expect(personIds).toContain("person4");
	});

	it("should resolve CastingCredit.person field", async () => {
		// Since CastingCredit is not directly queryable, we test it through Video.creditsForRole
		const query = `
			query {
				_entities(representations: [{ __typename: "Video", id: "video1" }]) {
					... on Video {
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
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ query }),
		});

		const result = await response.json();
		expect(result.errors).toBeUndefined();
		expect(result.data._entities[0].creditsForRole[0].person).toEqual({
			id: "person1",
		});
	});

	it("should handle HTTP requests", async () => {
		const response = await yoga.fetch("http://localhost:4000/", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				query: `
          {
            __schema {
              types {
                name
              }
            }
          }
        `,
			}),
		});

		expect(response.status).toBe(200);

		const result = await response.json();
		expect(result.errors).toBeUndefined();

		const types = result.data.__schema.types.map((t: any) => t.name);
		expect(types).toContain("Video");
		expect(types).toContain("CastingCredit");
		expect(types).toContain("Person");
	});

	it("should handle errors gracefully", async () => {
		const response = await yoga.fetch("http://localhost:4000/", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				query: `
          {
            nonExistentField
          }
        `,
			}),
		});

		// GraphQL typically returns 200 even for errors, with errors in the response body
		expect(response.status).toBe(200);

		const result = await response.json();
		expect(result.errors).toBeDefined();
		expect(result.errors.length).toBeGreaterThan(0);
		// Data should be undefined or null for invalid queries
		expect(result.data == null).toBe(true);
	});
});
