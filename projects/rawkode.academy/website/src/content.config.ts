// Build-time collections. Articles are authored as Markdown/MDX files in the
// repository's content/articles directory and compiled into the deployment;
// every other collection is live (src/live.config.ts). Pages read both through
// the wrappers in "@/lib/live-content".
import { defineCollection } from "astro:content";
import { articlesLoader } from "./lib/articles/loader";

const articles = defineCollection({
	loader: articlesLoader({ includeUnpublished: import.meta.env.DEV }),
});

export const collections = { articles };
