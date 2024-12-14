import { glob } from "astro/loaders";
import { defineCollection, reference, z } from "astro:content";

// HINT: image() is described here -> https://docs.astro.build/en/guides/images/#images-in-content-collections

const blog = defineCollection({
  loader: glob({
    pattern: ["**\/*.mdx", "**\/*.md"],
    base: "./src/content/blog",
  }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      cover: z.object({
        image: image(),
        alt: z.string(),
      }).optional(),
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
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      cover: z.object({
        image: image(),
        alt: z.string(),
      }).optional(),
    }),
});

export const collections = {
  blog,
  series,
};
