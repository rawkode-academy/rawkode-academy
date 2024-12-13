import { glob } from "astro/loaders";
import { defineCollection, reference, z } from "astro:content";

const blog = defineCollection({
  loader: glob({
    pattern: ["**\/*.mdx"],
    base: "./src/content/blog",
  }),
  schema: z.object({
    title: z.string(),
    series: reference("series").optional(),
    subtitle: z.string().optional(),
    publishedAt: z.coerce.date(),
    updatedAt: z.coerce.date().optional(),
    isDraft: z.boolean().default(true),
    authors: z.array(z.string()).default(["Rawkode Academy"]),
  }),
});

const series = defineCollection({
  loader: glob({
    pattern: ["**\/*.mdx"],
    base: "./src/content/series",
  }),
  schema: z.object({
    title: z.string(),
  }),
});

export const collections = {
  blog,
  series,
};
