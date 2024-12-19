import { videoLikesTable } from '../schema.ts';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

export const AddHostToShow = createInsertSchema(videoLikesTable, {
	videoId: z.string().min(1),
	personId: z.string().min(1),
	likedAt: z.date(),
});
