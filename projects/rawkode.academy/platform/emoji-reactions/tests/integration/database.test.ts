import { describe, it, expect, beforeEach } from "bun:test";
import { env } from "cloudflare:test";
import { drizzle } from "drizzle-orm/d1";
import { emojiReactionsTable } from "../../data-model/schema";
import { eq, and, count } from "drizzle-orm";

describe("Database Integration Tests", () => {
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
	});

	describe("Adding Emoji Reactions", () => {
		it("should successfully add a new emoji reaction", async () => {
			const reaction = {
				contentId: "video-123",
				personId: "user-456",
				emoji: "👍",
				reactedAt: new Date(),
				contentTimestamp: 12345,
			};

			await db.insert(emojiReactionsTable).values(reaction).execute();

			const result = await db
				.select()
				.from(emojiReactionsTable)
				.where(eq(emojiReactionsTable.contentId, "video-123"))
				.execute();

			expect(result.length).toBe(1);
			expect(result[0].contentId).toBe("video-123");
			expect(result[0].personId).toBe("user-456");
			expect(result[0].emoji).toBe("👍");
			expect(result[0].contentTimestamp).toBe(12345);
		});

		it("should handle duplicate reactions gracefully", async () => {
			const reaction = {
				contentId: "video-123",
				personId: "user-456",
				emoji: "👍",
				reactedAt: new Date(),
			};

			// First insert
			await db.insert(emojiReactionsTable).values(reaction).execute();

			// Try to insert duplicate (same content, person, emoji, and null timestamp)
			await expect(
				db.insert(emojiReactionsTable).values(reaction).execute(),
			).rejects.toThrow();

			// Verify only one reaction exists
			const result = await db.select().from(emojiReactionsTable).execute();
			expect(result.length).toBe(1);
		});

		it("should allow same emoji with different timestamps", async () => {
			// First reaction without timestamp
			await db.insert(emojiReactionsTable).values({
				contentId: "video-123",
				personId: "user-456",
				emoji: "👍",
				reactedAt: new Date(),
			}).execute();

			// Second reaction with timestamp - should succeed
			await db.insert(emojiReactionsTable).values({
				contentId: "video-123",
				personId: "user-456",
				emoji: "👍",
				reactedAt: new Date(),
				contentTimestamp: 12345,
			}).execute();

			// Third reaction with different timestamp - should succeed
			await db.insert(emojiReactionsTable).values({
				contentId: "video-123",
				personId: "user-456",
				emoji: "👍",
				reactedAt: new Date(),
				contentTimestamp: 67890,
			}).execute();

			// Verify all three reactions exist
			const result = await db.select().from(emojiReactionsTable)
				.where(
					and(
						eq(emojiReactionsTable.contentId, "video-123"),
						eq(emojiReactionsTable.personId, "user-456"),
						eq(emojiReactionsTable.emoji, "👍")
					)
				)
				.execute();
			expect(result.length).toBe(3);
			expect(result.filter(r => r.contentTimestamp === 0).length).toBe(1);
			expect(result.filter(r => r.contentTimestamp === 12345).length).toBe(1);
			expect(result.filter(r => r.contentTimestamp === 67890).length).toBe(1);
		});

		it("should allow different emojis from same user on same content", async () => {
			await db
				.insert(emojiReactionsTable)
				.values([
					{
						contentId: "video-123",
						personId: "user-456",
						emoji: "👍",
						reactedAt: new Date(),
					},
					{
						contentId: "video-123",
						personId: "user-456",
						emoji: "❤️",
						reactedAt: new Date(),
					},
				])
				.execute();

			const result = await db
				.select()
				.from(emojiReactionsTable)
				.where(eq(emojiReactionsTable.contentId, "video-123"))
				.execute();

			expect(result.length).toBe(2);
			expect(result.map((r) => r.emoji).sort()).toEqual(["❤️", "👍"]);
		});
	});

	describe("Removing Emoji Reactions", () => {
		it("should successfully remove an emoji reaction", async () => {
			// Add a reaction
			await db
				.insert(emojiReactionsTable)
				.values({
					contentId: "video-123",
					personId: "user-456",
					emoji: "👍",
					reactedAt: new Date(),
				})
				.execute();

			// Remove the reaction
			await db
				.delete(emojiReactionsTable)
				.where(
					and(
						eq(emojiReactionsTable.contentId, "video-123"),
						eq(emojiReactionsTable.personId, "user-456"),
						eq(emojiReactionsTable.emoji, "👍"),
					),
				)
				.execute();

			const result = await db.select().from(emojiReactionsTable).execute();
			expect(result.length).toBe(0);
		});

		it("should only remove specific reaction, not all from user", async () => {
			// Add multiple reactions
			await db
				.insert(emojiReactionsTable)
				.values([
					{
						contentId: "video-123",
						personId: "user-456",
						emoji: "👍",
						reactedAt: new Date(),
					},
					{
						contentId: "video-123",
						personId: "user-456",
						emoji: "❤️",
						reactedAt: new Date(),
					},
				])
				.execute();

			// Remove only the thumbs up
			await db
				.delete(emojiReactionsTable)
				.where(
					and(
						eq(emojiReactionsTable.contentId, "video-123"),
						eq(emojiReactionsTable.personId, "user-456"),
						eq(emojiReactionsTable.emoji, "👍"),
					),
				)
				.execute();

			const result = await db.select().from(emojiReactionsTable).execute();
			expect(result.length).toBe(1);
			expect(result[0].emoji).toBe("❤️");
		});
	});

	describe("Querying Emoji Reactions", () => {
		beforeEach(async () => {
			// Add test data
			await db
				.insert(emojiReactionsTable)
				.values([
					{
						contentId: "video-123",
						personId: "user-1",
						emoji: "👍",
						reactedAt: new Date(),
					},
					{
						contentId: "video-123",
						personId: "user-2",
						emoji: "👍",
						reactedAt: new Date(),
					},
					{
						contentId: "video-123",
						personId: "user-3",
						emoji: "👍",
						reactedAt: new Date(),
					},
					{
						contentId: "video-123",
						personId: "user-4",
						emoji: "❤️",
						reactedAt: new Date(),
					},
					{
						contentId: "video-123",
						personId: "user-5",
						emoji: "❤️",
						reactedAt: new Date(),
					},
					{
						contentId: "video-456",
						personId: "user-1",
						emoji: "🎉",
						reactedAt: new Date(),
					},
				])
				.execute();
		});

		it("should count reactions by emoji for a content", async () => {
			const result = await db
				.select({
					emoji: emojiReactionsTable.emoji,
					count: count(),
				})
				.from(emojiReactionsTable)
				.where(eq(emojiReactionsTable.contentId, "video-123"))
				.groupBy(emojiReactionsTable.emoji)
				.execute();

			expect(result.length).toBe(2);
			const thumbsUp = result.find((r) => r.emoji === "👍");
			const heart = result.find((r) => r.emoji === "❤️");
			expect(thumbsUp?.count).toBe(3);
			expect(heart?.count).toBe(2);
		});

		it("should get all reactions for a specific user", async () => {
			const result = await db
				.select()
				.from(emojiReactionsTable)
				.where(eq(emojiReactionsTable.personId, "user-1"))
				.execute();

			expect(result.length).toBe(2);
			expect(result.map((r) => r.contentId).sort()).toEqual([
				"video-123",
				"video-456",
			]);
		});

		it("should check if user has reacted with specific emoji", async () => {
			const result = await db
				.select({ count: count() })
				.from(emojiReactionsTable)
				.where(
					and(
						eq(emojiReactionsTable.contentId, "video-123"),
						eq(emojiReactionsTable.personId, "user-1"),
						eq(emojiReactionsTable.emoji, "👍"),
					),
				)
				.execute();

			expect(result[0].count).toBe(1);
		});
	});

	describe("Content Timestamp Handling", () => {
		it("should store and retrieve content timestamp", async () => {
			const timestamp = 54321;
			await db
				.insert(emojiReactionsTable)
				.values({
					contentId: "video-123",
					personId: "user-456",
					emoji: "⏱️",
					reactedAt: new Date(),
					contentTimestamp: timestamp,
				})
				.execute();

			const result = await db
				.select()
				.from(emojiReactionsTable)
				.where(eq(emojiReactionsTable.emoji, "⏱️"))
				.execute();

			expect(result[0].contentTimestamp).toBe(timestamp);
		});

		it("should handle reactions without content timestamp", async () => {
			await db
				.insert(emojiReactionsTable)
				.values({
					contentId: "video-123",
					personId: "user-456",
					emoji: "🚀",
					reactedAt: new Date(),
					// contentTimestamp will default to 0
				})
				.execute();

			const result = await db
				.select()
				.from(emojiReactionsTable)
				.where(eq(emojiReactionsTable.emoji, "🚀"))
				.execute();

			expect(result[0].contentTimestamp).toBe(0);
		});
	});
});
