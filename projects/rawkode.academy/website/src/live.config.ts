// Every content collection is live: fetched at request time from the API
// gateway (src/lib/live-content), cached in KV and at the CDN. Pages use the
// wrappers in "@/lib/live-content" rather than astro:content directly; see
// the migration guide for the call patterns.
import { defineLiveCollection } from "astro:content";
import { contentLoader } from "./lib/live-content/loader";

const videos = defineLiveCollection({ loader: contentLoader("videos") });
const shows = defineLiveCollection({ loader: contentLoader("shows") });
const people = defineLiveCollection({ loader: contentLoader("people") });
const technologies = defineLiveCollection({
	loader: contentLoader("technologies"),
});
const articles = defineLiveCollection({ loader: contentLoader("articles") });
const news = defineLiveCollection({ loader: contentLoader("news") });
const changelog = defineLiveCollection({ loader: contentLoader("changelog") });
const adrs = defineLiveCollection({ loader: contentLoader("adrs") });
const testimonials = defineLiveCollection({
	loader: contentLoader("testimonials"),
});
const courses = defineLiveCollection({ loader: contentLoader("courses") });
const courseModules = defineLiveCollection({
	loader: contentLoader("courseModules"),
});
const learningPaths = defineLiveCollection({
	loader: contentLoader("learningPaths"),
});

export const collections = {
	videos,
	shows,
	people,
	technologies,
	articles,
	news,
	changelog,
	adrs,
	testimonials,
	courses,
	courseModules,
	learningPaths,
};
