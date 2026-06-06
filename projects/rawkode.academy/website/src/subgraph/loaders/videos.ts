import type { CollectionEntry } from "astro:content";
import { getVideoThumbnailUrl } from "@/lib/video-thumbnail";

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
	terms?: string[] | undefined;
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

interface VideoStore {
	videos: VideoItem[];
	byId: Map<string, VideoItem>;
	bySlug: Map<string, VideoItem>;
	byShow: Map<string, VideoItem[]>;
}

let videoStorePromise: Promise<VideoStore> | undefined;

function toVideoItem(e: VideoEntry): VideoItem {
	const data = e.data;
	return {
		id: data.id, // video asset ID
		slug: data.slug, // human-readable URL identifier
		title: data.title,
		subtitle: data.subtitle,
		description: data.description,
		terms: data.terms,
		publishedAt: data.publishedAt,
		duration: data.duration,
		type: data.type,
		category: data.category,
		streamUrl: `https://content.rawkode.academy/videos/${data.id}/stream.m3u8`,
		thumbnailUrl: getVideoThumbnailUrl(data.id),
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
}

async function loadVideoStore(): Promise<VideoStore> {
	const { getCollection } = await import("astro:content");

	const items = await getCollection("videos");
	const videos = items.map((e: VideoEntry) => toVideoItem(e));
	const byId = new Map<string, VideoItem>();
	const bySlug = new Map<string, VideoItem>();
	const byShow = new Map<string, VideoItem[]>();

	for (const video of videos) {
		byId.set(video.id, video);
		bySlug.set(video.slug, video);

		if (video.show) {
			const showVideos = byShow.get(video.show) ?? [];
			showVideos.push(video);
			byShow.set(video.show, showVideos);
		}
	}

	return { videos, byId, bySlug, byShow };
}

async function getVideoStore(): Promise<VideoStore> {
	videoStorePromise ??= loadVideoStore().catch((error) => {
		videoStorePromise = undefined;
		throw error;
	});
	return videoStorePromise;
}

export function resetVideoLoaderCacheForTests(): void {
	videoStorePromise = undefined;
}

export async function listVideos(): Promise<VideoItem[]> {
	const store = await getVideoStore();
	return [...store.videos];
}

export async function getVideoById(id: string): Promise<VideoItem | null> {
	const store = await getVideoStore();
	return store.byId.get(id) ?? null;
}

export async function getVideoBySlug(slug: string): Promise<VideoItem | null> {
	const store = await getVideoStore();
	return store.bySlug.get(slug) ?? null;
}

export async function getVideosByShow(showId: string): Promise<VideoItem[]> {
	const store = await getVideoStore();
	return [...(store.byShow.get(showId) ?? [])];
}

export async function getPublishedVideos(): Promise<VideoItem[]> {
	const list = await listVideos();
	const now = new Date();
	return list
		.filter((v) => v.publishedAt <= now)
		.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
}

export async function getUpcomingVideos(
	limit = 15,
	offset = 0,
): Promise<VideoItem[]> {
	const list = await listVideos();
	const now = new Date();
	return list
		.filter((v) => v.type === "live" && v.publishedAt > now)
		.sort((a, b) => a.publishedAt.getTime() - b.publishedAt.getTime())
		.slice(offset, offset + limit);
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
