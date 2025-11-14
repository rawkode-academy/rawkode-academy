import { describe, it, expect, beforeEach } from "bun:test";
import { env } from "cloudflare:test";
import { getSchema } from "../read-model/schema";

// This test focuses on the schema structure without requiring database access
describe("Casting Credits GraphQL Schema Structure", () => {
	beforeEach(async () => {
		// Set up the database schema
		await env.DB.exec(`
			CREATE TABLE IF NOT EXISTS casting_credits (
				person_id TEXT NOT NULL,
				role TEXT NOT NULL,
				video_id TEXT NOT NULL,
				created_at INTEGER DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
				PRIMARY KEY (person_id, role, video_id)
			);
		`);
	});

	it("should have the correct structure", async () => {
		const schema = getSchema(env as any);

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
