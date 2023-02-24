import { defineCollection, z } from "astro:content";

const authorCollection = defineCollection({
	schema: z.object({
		id: z.string(),
		name: z.string(),
	}),
});

const articleCollection = defineCollection({
	schema: z.object({
		title: z.string(),
		author: z.string(),
	}),
});

export const collections = {
	articles: articleCollection,
	authors: authorCollection,
};
