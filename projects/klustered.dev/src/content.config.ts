import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const CONTENT_ROOT = new URL("../../../content/", import.meta.url).pathname;

const chapter = z.object({
	startTime: z.number(),
	title: z.string(),
});

const episodes = defineCollection({
	loader: glob({
		pattern: "videos/shows/klustered/**/*.md",
		base: CONTENT_ROOT,
	}),
	schema: z.object({
		id: z.string(),
		slug: z.string().optional(),
		title: z.string(),
		description: z.string().optional(),
		publishedAt: z.coerce.date(),
		type: z.string().optional(),
		category: z.string().optional(),
		show: z.string().optional(),
		technologies: z.array(z.string()).optional(),
		chapters: z.array(chapter).optional(),
		guests: z.array(z.string()).optional(),
		hosts: z.array(z.string()).optional(),
		tags: z.array(z.string()).optional(),
		youtubeId: z.string().optional(),
		duration: z.number().optional(),
	}),
});

const people = defineCollection({
	loader: glob({
		pattern: "people/*.mdx",
		base: CONTENT_ROOT,
	}),
	schema: z.object({
		id: z.string(),
		name: z.string(),
		github: z.string().optional(),
		twitter: z.string().optional(),
		website: z.string().optional(),
		bio: z.string().optional(),
		avatar: z.string().optional(),
	}),
});

export const collections = { episodes, people };
