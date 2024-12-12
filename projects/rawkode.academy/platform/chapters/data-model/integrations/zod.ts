import { chaptersTable } from '../schema.ts';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

export const AddChapter = createInsertSchema(chaptersTable, {
	videoId: z.string().min(1),
});
