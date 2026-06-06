export const THUMBNAIL_WIDTH = 1280;
export const THUMBNAIL_HEIGHT = 720;
export const THUMBNAIL_CONTENT_TYPE = "image/webp";
export const THUMBNAIL_CACHE_CONTROL = "public, max-age=31536000, immutable";

export interface ThumbnailVideo {
	id: string;
	slug: string;
	title: string;
	tagline?: string;
	description?: string;
	publishedAt?: string;
}

export interface ThumbnailTechnology {
	id: string;
	name: string;
	iconSvg?: string;
	iconUrl?: string;
	terms?: string[];
}

export interface ThumbnailGuest {
	id: string;
	name: string;
	github: string;
	avatarUrl: string;
}

export interface ThumbnailShow {
	id: string;
	name: string;
	terms?: string[];
}

export interface ThumbnailSource {
	commitSha: string;
	trigger: "github-actions" | "manual" | "test";
	contentPath?: string;
}

export interface ThumbnailWorkflowParams {
	videoId: string;
	tagline?: string;
	technology: ThumbnailTechnology;
	source: ThumbnailSource;
	force?: boolean;
}

export interface ThumbnailRenderParams {
	video: ThumbnailVideo;
	technology: ThumbnailTechnology;
	guests: ThumbnailGuest[];
	show?: ThumbnailShow;
	source: ThumbnailSource;
	force?: boolean;
}

export interface GuestLayout {
	count: number;
	columns: number;
	size: number;
}

const VIDEO_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

export function assertValidVideoId(id: string): void {
	if (!VIDEO_ID_PATTERN.test(id)) {
		throw new Error(`Invalid video id for thumbnail key: ${id}`);
	}
}

export function thumbnailKey(videoId: string): string {
	assertValidVideoId(videoId);
	return `videos/${videoId}/thumbnail.webp`;
}

export function githubAvatarUrl(handle: string): string {
	const trimmed = handle.trim();
	if (!trimmed) throw new Error("GitHub handle is required for avatar URL");
	return `https://github.com/${encodeURIComponent(trimmed)}.png?size=512`;
}

export function normalizeGuests(guests: ThumbnailGuest[]): ThumbnailGuest[] {
	return guests.slice(0, 4);
}

export function guestLayout(count: number): GuestLayout {
	const clamped = Math.max(0, Math.min(4, count));

	switch (clamped) {
		case 0:
			return { count: 0, columns: 0, size: 0 };
		case 1:
			return { count: 1, columns: 1, size: 174 };
		case 2:
			return { count: 2, columns: 2, size: 144 };
		case 3:
			return { count: 3, columns: 3, size: 124 };
		default:
			return { count: 4, columns: 2, size: 112 };
	}
}
