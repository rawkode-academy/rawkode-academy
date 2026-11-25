import { sql } from "drizzle-orm";
import { sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

// Add a platform here (and in the GraphQL enum) to support a new one.
export const VIDEO_CHANNEL_PLATFORMS = ["youtube", "x", "linkedin"] as const;
export type VideoChannelPlatform = (typeof VIDEO_CHANNEL_PLATFORMS)[number];

// Where an Academy video lives on an external platform. One external id per
// video per platform; an external id belongs to exactly one video.
export const videoChannelsTable = sqliteTable(
	"video_channels",
	{
		videoId: text("video_id").notNull(),
		platform: text("platform", { enum: VIDEO_CHANNEL_PLATFORMS }).notNull(),
		externalId: text("external_id").notNull(),
		createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
	},
	(table) => [
		uniqueIndex("video_channels_video_platform_unique").on(table.videoId, table.platform),
		uniqueIndex("video_channels_platform_external_unique").on(table.platform, table.externalId),
	],
);
