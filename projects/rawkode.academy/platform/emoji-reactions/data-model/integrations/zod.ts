import { emojiReactionsTable } from "../schema";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// Schema for the emoji reactions table select operations
export const selectEmojiReaction = createSelectSchema(emojiReactionsTable);

// Query parameter schemas
export const emojiReactionsForContentQuery = z.object({
	contentId: z.string().min(1),
});

export const hasReactedQuery = z.object({
	contentId: z.string().min(1),
	personId: z.string().min(1),
	emoji: z.string().emoji(),
});

export const topEmojiReactionsQuery = z.object({
	limit: z.number().int().positive().optional().default(10),
});

// Type exports
export type EmojiReaction = z.infer<typeof selectEmojiReaction>;
export type EmojiReactionsForContentQuery = z.infer<
	typeof emojiReactionsForContentQuery
>;
export type HasReactedQuery = z.infer<typeof hasReactedQuery>;
export type TopEmojiReactionsQuery = z.infer<typeof topEmojiReactionsQuery>;
