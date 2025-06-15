import { describe, it, expect } from "bun:test";
import { getSchema } from "../read-model/schema";

declare const env: { DB: D1Database };

// This test focuses on the schema structure without requiring database access
describe("Casting Credits GraphQL Schema Structure", () => {
	it("should have the correct structure", async () => {
		const schema = getSchema(env);

		// Check that the schema has the expected types
		const videoType = schema.getType("Video");
		expect(videoType).toBeDefined();

		const castingCreditType = schema.getType("CastingCredit");
		expect(castingCreditType).toBeDefined();

		const personType = schema.getType("Person");
		expect(personType).toBeDefined();

		// Check that the Video type has the creditsForRole field
		const videoTypeFields = (videoType as any).getFields();
		expect(videoTypeFields.creditsForRole).toBeDefined();

		// Check that the CastingCredit type has the person field
		const castingCreditTypeFields = (castingCreditType as any).getFields();
		expect(castingCreditTypeFields.person).toBeDefined();
	});
});
