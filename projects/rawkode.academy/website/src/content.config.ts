// Build-time collections. Articles and series are authored as Markdown/MDX
// files in the repository's content/articles and content/series directories
// and compiled into the deployment; every other collection is live
// (src/live.config.ts). Pages read them through the wrappers in
// "@/lib/live-content".
import { defineCollection } from "astro:content";
import { articlesLoader, seriesLoader } from "./lib/articles/loader";

const articles = defineCollection({
	loader: articlesLoader({ includeUnpublished: import.meta.env.DEV }),
});

const series = defineCollection({ loader: seriesLoader() });

export const collections = { articles, series };
