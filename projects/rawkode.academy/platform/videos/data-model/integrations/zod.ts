import { videosTable } from '../schema.ts';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

export const CreateVideos = createInsertSchema(videosTable, {
	title: z.string().min(1),
	subtitle: z.string().min(1),
	status: z.enum(['draft', 'published']).default('draft'),
	releasedAt: z.date(),
});
