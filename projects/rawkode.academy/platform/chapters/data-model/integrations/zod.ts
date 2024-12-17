import { chaptersTable } from '../schema.ts';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

export const AddChapter = createInsertSchema(chaptersTable, {
	videoId: z.string().nonempty(),
	startTime: z.number().positive(),
	title: z.string().nonempty(),
});
