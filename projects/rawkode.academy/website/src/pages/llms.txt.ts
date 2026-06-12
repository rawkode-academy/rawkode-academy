import { getCollection } from "astro:content";
import type { APIContext } from "astro";
import { articleMarkdownUrl } from "@/lib/article-markdown";
import { getPublishedVideos } from "@/lib/content";
import { SITE_DESCRIPTION } from "@/lib/site";

export const prerender = true;

const DEFAULT_SITE_URL = "https://rawkode.academy";
const SUMMARY_MAX_LENGTH = 160;

function summarize(text: string): string {
	const normalized = text
		.replace(/\\n/g, " ")
		.replace(/[*_`#]+/g, "")
		.replace(/\s+/g, " ")
		.trim();
	if (normalized.length <= SUMMARY_MAX_LENGTH) return normalized;
	const truncated = normalized.slice(0, SUMMARY_MAX_LENGTH);
	const lastSpace = truncated.lastIndexOf(" ");
	return `${truncated.slice(0, lastSpace > 80 ? lastSpace : SUMMARY_MAX_LENGTH)}…`;
}

export async function GET({ site }: APIContext) {
	const base = site ?? new URL(DEFAULT_SITE_URL);
	const absolute = (path: string) => new URL(path, base).href;

	const articles = (
		await getCollection("articles", ({ data }) => !data.draft)
	).sort((a, b) => b.data.publishedAt.valueOf() - a.data.publishedAt.valueOf());
	const videos = await getPublishedVideos();
	const courses = await getCollection("courses");
	const learningPaths = await getCollection("learningPaths");

	const lines: string[] = [
		"# Rawkode Academy",
		"",
		`> ${SITE_DESCRIPTION}`,
		"",
		"Article links below point at plain-markdown renditions; the canonical",
		"HTML pages live at the same path without the `.md` suffix. Video links",
		"point at markdown documents containing the description, chapters, and",
		"full transcript of each session.",
		"",
		"## Articles",
		"",
		...articles.map(
			(article) =>
				`- [${article.data.title}](${articleMarkdownUrl(article, base)}): ${summarize(article.data.description)}`,
		),
		"",
		"## Courses",
		"",
		...courses.map(
			(course) =>
				`- [${course.data.title}](${absolute(`/courses/${course.id}`)}): ${summarize(course.data.description)}`,
		),
		"",
		"## Learning Paths",
		"",
		...learningPaths.map(
			(path) =>
				`- [${path.data.title}](${absolute(`/learning-paths/${path.id}`)}): ${summarize(path.data.description)}`,
		),
		"",
		"## Videos",
		"",
		...videos.map(
			(video) =>
				`- [${video.data.title}](${absolute(`/watch/${video.data.slug}.md`)}): ${summarize(video.data.description)}`,
		),
		"",
		"## Optional",
		"",
		`- [Full article corpus as a single document](${absolute("/llms-full.txt")})`,
		`- [All-content RSS feed](${absolute("/api/feeds/all.xml")})`,
		`- [Sitemap index](${absolute("/sitemap-index.xml")})`,
		"",
	];

	return new Response(lines.join("\n"), {
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
		},
	});
}
