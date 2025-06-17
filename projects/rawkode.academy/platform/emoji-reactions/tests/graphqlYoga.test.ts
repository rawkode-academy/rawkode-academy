import { describe, it, expect } from "bun:test";
import { createYoga } from "graphql-yoga";
import { getSchema } from "../read-model/schema";

describe("GraphQL Yoga Integration", () => {
	const mockEnv = {
		DB: {} as D1Database,
	};

	it("should create a Yoga server with the schema", () => {
		const schema = getSchema(mockEnv);
		const yoga = createYoga({
			schema,
			graphqlEndpoint: "/",
		});

		expect(yoga).toBeDefined();
		expect(yoga.fetch).toBeDefined();
		expect(typeof yoga.fetch).toBe("function");
	});

	it("should handle introspection query", async () => {
		const schema = getSchema(mockEnv);
		const yoga = createYoga({
			schema,
			graphqlEndpoint: "/",
		});

		const response = await yoga.fetch(
			new Request("http://localhost/", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					query: `
						query {
							__schema {
								types {
									name
								}
							}
						}
					`,
				}),
			}),
			mockEnv,
		);

		expect(response.status).toBe(200);
		const result = await response.json();
		expect(result.data).toBeDefined();
		expect(result.data.__schema).toBeDefined();
		expect(result.data.__schema.types).toBeArray();

		const typeNames = result.data.__schema.types.map((t: any) => t.name);
		expect(typeNames).toContain("EmojiReaction");
		expect(typeNames).toContain("Video");
		expect(typeNames).toContain("Query");
	});

	it("should handle GET requests", async () => {
		const schema = getSchema(mockEnv);
		const yoga = createYoga({
			schema,
			graphqlEndpoint: "/",
		});

		const query = encodeURIComponent("{ __typename }");
		const response = await yoga.fetch(
			new Request(`http://localhost/?query=${query}`, {
				method: "GET",
			}),
			mockEnv,
		);

		expect(response.status).toBe(200);
		const result = await response.json();
		expect(result.data).toBeDefined();
		expect(result.data.__typename).toBe("Query");
	});

	it("should handle malformed requests", async () => {
		const schema = getSchema(mockEnv);
		const yoga = createYoga({
			schema,
			graphqlEndpoint: "/",
		});

		const response = await yoga.fetch(
			new Request("http://localhost/", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					query: "{ invalid query",
				}),
			}),
			mockEnv,
		);

		expect(response.status).toBe(200); // GraphQL returns 200 with errors
		const result = await response.json();
		expect(result.errors).toBeDefined();
		expect(result.errors.length).toBeGreaterThan(0);
	});
});
