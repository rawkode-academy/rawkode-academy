import { defineCollection, z } from "astro:content";

const blogCollection = defineCollection({
	type: "content",
	schema: z.object({
		title: z.string(),
		subtitle: z.string().optional(),
		publishedAt: z.coerce.date(),
		updatedAt: z.coerce.date().optional(),
		isDraft: z.boolean().default(true),
		authors: z.array(z.string()).default(["Rawkode Academy"]),
	}),
});

export const collections = {
	blog: blogCollection,
};
