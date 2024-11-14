import { episodesTable } from '../schema.ts';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

export const CreateEpisode = createInsertSchema(episodesTable, {
	code: z.string().min(1),
	showId: z.string().min(1),
	title: z.string().min(1),
	subtitle: z.string().min(1),
	description: z.string().min(1),
});
