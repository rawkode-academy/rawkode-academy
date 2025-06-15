import { describe, expect, it } from "vitest";
import { createYoga } from "graphql-yoga";
import { getSchema } from "../read-model/schema";

declare const env: { DB: D1Database };

describe("Casting Credits Integration", () => {
	it("should create a valid yoga server", async () => {
		const yoga = createYoga({
			schema: getSchema(env),
			graphqlEndpoint: "/",
		});

		expect(yoga).toBeDefined();
		expect(typeof yoga.fetch).toBe("function");
	});
});
