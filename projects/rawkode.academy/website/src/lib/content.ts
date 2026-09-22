import { getCollection } from "astro:content";
import { getVideoThumbnailUrl } from "@/lib/video-thumbnail";
import { isNewsPublished } from "@/lib/news-publication";

export type AcademyContentKind =
	| "Video"
	| "Article"
	| "News"
	| "Course"
	| "Learning path";

export interface AcademyContentItem {
	kind: AcademyContentKind;
	href: string;
	title: string;
	description: string;
	publishedAt: string;
	meta: string[];
	mediaSrc?: string;
}

const compactCopy = (value: string | undefined, maxLength = 180) => {
	const normalized = (value ?? "").replace(/\s+/g, " ").trim();
	if (!normalized)
		return "Practical cloud native education from Rawkode Academy.";
	const firstSentence = normalized.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim();
	if (firstSentence && firstSentence.length <= maxLength) return firstSentence;
	if (normalized.length <= maxLength) return normalized;
	const wordBoundary = normalized.lastIndexOf(" ", maxLength);
	// Keep whole words when possible, but still bound a single oversized token.
	const end = wordBoundary > 0 ? wordBoundary : maxLength;
	return `${normalized.slice(0, end).trimEnd()}…`;
};

const formatDate = (value: Date) =>
	value.toLocaleDateString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
		timeZone: "UTC",
	});

const formatDuration = (seconds: number) => {
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes} min`;
	const hours = Math.floor(minutes / 60);
	const remainder = minutes % 60;
	return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
};

/**
 * Get published videos (excludes future-dated content for scheduled publishing).
 * Videos are filtered by publishedAt <= now and sorted newest first.
 */
export async function getPublishedVideos() {
	const now = new Date();
	const videos = await getCollection("videos", ({ data }) => {
		return data.publishedAt <= now;
	});
	return videos.sort(
		(a, b) =>
			new Date(b.data.publishedAt).getTime() -
			new Date(a.data.publishedAt).getTime(),
	);
}

export async function getUpcomingVideos() {
	const now = new Date();
	const videos = await getCollection("videos", ({ data }) => {
		return data.type === "live" && data.publishedAt > now;
	});
	return videos.sort(
		(a, b) =>
			new Date(a.data.publishedAt).getTime() -
			new Date(b.data.publishedAt).getTime(),
	);
}

/**
 * Build the Academy-wide latest feed.
 *
 * This is deliberately format-agnostic: the homepage is the front door to
 * every published resource, while collection routes such as `/watch` and
 * `/read` remain format-specific views.
 */
export async function getLatestContent(
	limit = 12,
	now = new Date(),
): Promise<AcademyContentItem[]> {
	const [videos, articles, news, courses, learningPaths] = await Promise.all([
		getPublishedVideos(),
		getCollection(
			"articles",
			({ data }) => !data.draft && data.publishedAt <= now,
		),
		getCollection("news", ({ data }) => isNewsPublished(data.publishedAt, now)),
		getCollection("courses", ({ data }) => data.publishedAt <= now),
		getCollection("learningPaths", ({ data }) => data.publishedAt <= now),
	]);

	const items: AcademyContentItem[] = [
		...videos.map((video) => ({
			kind: "Video" as const,
			href: `/watch/${video.data.slug}`,
			title: video.data.title,
			description: compactCopy(video.data.subtitle || video.data.description),
			publishedAt: video.data.publishedAt.toISOString(),
			meta: [
				"Video",
				formatDate(video.data.publishedAt),
				formatDuration(video.data.duration),
			],
			mediaSrc: getVideoThumbnailUrl(video.data.id),
		})),
		...articles.map((article) => ({
			kind: "Article" as const,
			href: `/read/${article.id}`,
			title: article.data.title,
			description: compactCopy(
				article.data.openGraph?.subtitle ||
					article.data.subtitle ||
					article.data.description,
			),
			publishedAt: article.data.publishedAt.toISOString(),
			meta: ["Article", formatDate(article.data.publishedAt)],
			...(article.data.cover?.image.src
				? { mediaSrc: article.data.cover.image.src }
				: {}),
		})),
		...news.map((item) => ({
			kind: "News" as const,
			href: `/news/${item.id}`,
			title: item.data.title,
			description: compactCopy(item.data.description),
			publishedAt: item.data.publishedAt.toISOString(),
			meta: ["News", formatDate(item.data.publishedAt)],
		})),
		...courses.map((course) => ({
			kind: "Course" as const,
			href: `/courses/${course.id}`,
			title: course.data.title,
			description: compactCopy(course.data.description),
			publishedAt: course.data.publishedAt.toISOString(),
			meta: ["Course", formatDate(course.data.publishedAt)],
			...(course.data.cover?.image.src
				? { mediaSrc: course.data.cover.image.src }
				: {}),
		})),
		...learningPaths.map((path) => ({
			kind: "Learning path" as const,
			href: `/learning-paths/${path.id}`,
			title: path.data.title,
			description: compactCopy(path.data.description),
			publishedAt: path.data.publishedAt.toISOString(),
			meta: ["Learning path", formatDate(path.data.publishedAt)],
		})),
	];

	return items
		.sort(
			(a, b) =>
				new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
		)
		.slice(0, limit);
}
