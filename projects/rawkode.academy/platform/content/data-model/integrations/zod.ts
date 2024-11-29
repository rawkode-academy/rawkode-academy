import { contentTable } from '../schema.ts';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

export const CreateContent = createInsertSchema(contentTable, {
	title: z.string().min(1),
	subtitle: z.string().min(1),
});
