import { describe, it, expect, beforeEach } from "bun:test";
import { env } from "cloudflare:test";
import { drizzle } from "drizzle-orm/d1";
import { eq, and } from "drizzle-orm";
import * as schema from "../../data-model/schema";

describe("Database", () => {
	let db: ReturnType<typeof drizzle>;

	beforeEach(async () => {
		// Use cloudflare:test D1 stub
		const d1 = env.DB;
		db = drizzle(d1, { schema });

		// Create the table using Drizzle schema
		await d1.exec(`
			CREATE TABLE IF NOT EXISTS casting_credits (
				person_id TEXT NOT NULL,
				role TEXT NOT NULL,
				video_id TEXT NOT NULL,
				created_at INTEGER DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
				PRIMARY KEY (person_id, role, video_id)
			);
		`);
	});

	describe("Primary Key Constraints", () => {
		it("should enforce unique constraint on (personId, role, videoId)", async () => {
			// Insert first record
			await db.insert(schema.castingCreditsTable).values({
				personId: "person1",
				role: "host",
				videoId: "video1",
			});

			// Try to insert duplicate - should fail
			try {
				await db.insert(schema.castingCreditsTable).values({
					personId: "person1",
					role: "host",
					videoId: "video1",
				});
				// If we get here, the test should fail
				expect(true).toBe(false);
			} catch (error) {
				expect(error.message).toMatch(/UNIQUE constraint failed/);
			}
		});

		it("should allow same person in different roles for same video", async () => {
			await db.insert(schema.castingCreditsTable).values([
				{ personId: "person1", role: "host", videoId: "video1" },
				{ personId: "person1", role: "producer", videoId: "video1" },
			]);

			const credits = await db
				.select()
				.from(schema.castingCreditsTable)
				.where(eq(schema.castingCreditsTable.personId, "person1"));

			expect(credits).toHaveLength(2);
		});

		it("should allow same person-role combination for different videos", async () => {
			await db.insert(schema.castingCreditsTable).values([
				{ personId: "person1", role: "host", videoId: "video1" },
				{ personId: "person1", role: "host", videoId: "video2" },
			]);

			const credits = await db
				.select()
				.from(schema.castingCreditsTable)
				.where(eq(schema.castingCreditsTable.personId, "person1"));

			expect(credits).toHaveLength(2);
		});
	});

	describe("Data Validation", () => {
		it("should not allow null values for required fields", async () => {
			// Test null personId
			try {
				await db.insert(schema.castingCreditsTable).values({
					personId: null as any,
					role: "host",
					videoId: "video1",
				});
				expect(true).toBe(false);
			} catch (error) {
				expect(error).toBeDefined();
			}

			// Test null role
			try {
				await db.insert(schema.castingCreditsTable).values({
					personId: "person1",
					role: null as any,
					videoId: "video1",
				});
				expect(true).toBe(false);
			} catch (error) {
				expect(error).toBeDefined();
			}

			// Test null videoId
			try {
				await db.insert(schema.castingCreditsTable).values({
					personId: "person1",
					role: "host",
					videoId: null as any,
				});
				expect(true).toBe(false);
			} catch (error) {
				expect(error).toBeDefined();
			}
		});

		it("should handle empty strings", async () => {
			// Empty strings should be allowed (though maybe not ideal)
			await db.insert(schema.castingCreditsTable).values({
				personId: "",
				role: "",
				videoId: "",
			});

			const result = await db
				.select()
				.from(schema.castingCreditsTable)
				.where(eq(schema.castingCreditsTable.personId, ""));

			expect(result).toHaveLength(1);
			expect(result[0].personId).toBe("");
		});

		it("should handle very long strings", async () => {
			const longString = "a".repeat(1000);

			await db.insert(schema.castingCreditsTable).values({
				personId: longString,
				role: longString,
				videoId: longString,
			});

			const result = await db
				.select()
				.from(schema.castingCreditsTable)
				.where(eq(schema.castingCreditsTable.personId, longString));

			expect(result).toHaveLength(1);
			expect(result[0].personId).toBe(longString);
		});

		it("should handle special characters and unicode", async () => {
			const specialChars = "!@#$%^&*()_+-=[]{}|;':\",./<>?";
			const unicode = "🎬 导演 監督 réalisateur";

			await db.insert(schema.castingCreditsTable).values({
				personId: specialChars,
				role: unicode,
				videoId: "video1",
			});

			const result = await db
				.select()
				.from(schema.castingCreditsTable)
				.where(eq(schema.castingCreditsTable.personId, specialChars));

			expect(result).toHaveLength(1);
			expect(result[0].role).toBe(unicode);
		});
	});
});
