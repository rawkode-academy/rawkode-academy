import type { CollectionEntry } from "astro:content";

export type VideoEntry = CollectionEntry<"videos">;

export type VideoType = "live" | "recorded";
export type VideoCategory =
	| "editorial"
	| "tutorial"
	| "review"
	| "interview"
	| "announcement";

export interface VideoItem {
	id: string; // video asset ID (used for CDN URLs, PostHog events)
	slug: string; // human-readable URL identifier
	title: string;
	subtitle: string | undefined;
	description: string;
	publishedAt: Date;
	duration: number | undefined;
	type: VideoType | undefined;
	category: VideoCategory | undefined;
	streamUrl: string;
	thumbnailUrl: string;
	technologies: string[];
	show: string | undefined;
	guests: string[];
	chapters: Array<{ startTime: number; title: string }>;
}

export async function listVideos(): Promise<VideoItem[]> {
	const { getCollection } = await import("astro:content");

	const items = await getCollection("videos");
	return items.map((e: VideoEntry) => {
		const data = e.data;
		return {
			id: data.id, // video asset ID
			slug: data.slug, // human-readable URL identifier
			title: data.title,
			subtitle: data.subtitle,
			description: data.description,
			publishedAt: data.publishedAt,
			duration: data.duration,
			type: data.type,
			category: data.category,
			streamUrl: `https://content.rawkode.academy/videos/${data.id}/stream.m3u8`,
			thumbnailUrl: `https://content.rawkode.academy/videos/${data.id}/thumbnail.jpg`,
			technologies: (data.technologies ?? []).map((t: any) =>
				typeof t === "string" ? t : t.id,
			),
			show: data.show
				? typeof data.show === "string"
					? data.show
					: data.show.id
				: undefined,
			guests: (data.guests ?? []).map((g: any) =>
				typeof g === "string" ? g : g.id,
			),
			chapters: data.chapters ?? [],
		} satisfies VideoItem;
	});
}

export async function getVideoById(id: string): Promise<VideoItem | null> {
	const list = await listVideos();
	return list.find((v) => v.id === id) ?? null;
}

export async function getVideoBySlug(slug: string): Promise<VideoItem | null> {
	const list = await listVideos();
	return list.find((v) => v.slug === slug) ?? null;
}

export async function getVideosByShow(showId: string): Promise<VideoItem[]> {
	const list = await listVideos();
	return list.filter((v) => v.show === showId);
}

export async function getPublishedVideos(): Promise<VideoItem[]> {
	const list = await listVideos();
	const now = new Date();
	return list
		.filter((v) => v.publishedAt <= now)
		.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
}

export async function getLatestVideos(
	limit = 15,
	offset = 0,
): Promise<VideoItem[]> {
	const published = await getPublishedVideos();
	return published.slice(offset, offset + limit);
}

export async function searchVideos(
	term: string,
	limit = 15,
): Promise<VideoItem[]> {
	const published = await getPublishedVideos();
	const lowerTerm = term.toLowerCase();
	return published
		.filter(
			(v) =>
				v.title.toLowerCase().includes(lowerTerm) ||
				v.description.toLowerCase().includes(lowerTerm) ||
				(v.subtitle?.toLowerCase().includes(lowerTerm) ?? false),
		)
		.slice(0, limit);
}

export async function getRandomVideos(limit = 5): Promise<VideoItem[]> {
	const published = await getPublishedVideos();
	const shuffled = [...published].sort(() => Math.random() - 0.5);
	return shuffled.slice(0, limit);
}
