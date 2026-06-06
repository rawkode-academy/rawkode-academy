export const MAX_CACHE_TTL_SECONDS = 24 * 60 * 60;

export interface ContentCachePolicy {
	cacheControl: string;
	cacheable: boolean;
}

const ONE_HOUR = 60 * 60;
const FIVE_MINUTES = 5 * 60;

const NO_STORE: ContentCachePolicy = {
	cacheControl: "no-store",
	cacheable: false,
};

const SHORT: ContentCachePolicy = {
	cacheControl: `public, max-age=${FIVE_MINUTES}, s-maxage=${FIVE_MINUTES}`,
	cacheable: true,
};

const THUMBNAIL: ContentCachePolicy = {
	cacheControl: `public, max-age=${ONE_HOUR}, s-maxage=${ONE_HOUR}`,
	cacheable: true,
};

const MANIFEST: ContentCachePolicy = {
	cacheControl: `public, max-age=${FIVE_MINUTES}, s-maxage=${ONE_HOUR}`,
	cacheable: true,
};

const DAILY: ContentCachePolicy = {
	cacheControl: [
		`public, max-age=${MAX_CACHE_TTL_SECONDS}`,
		`s-maxage=${MAX_CACHE_TTL_SECONDS}`,
	].join(", "),
	cacheable: true,
};

const THUMBNAIL_PATTERN = /^videos\/[^/]+\/thumbnail\.(?:webp|jpe?g|png)$/;
const TRANSCODE_STATUS_PATTERN = /^videos\/[^/]+\/transcode-status\.json$/;
const CAPTION_PATTERN = /^videos\/[^/]+\/captions\/[^/]+\.(?:vtt|srt)$/;
const STABLE_MEDIA_PATTERN =
	/^videos\/[^/]+\/(?:.+\.(?:aac|m4a|m4s|mkv|mp3|mp4|ts|webm)|original\.mp3)$/;

export function getContentCachePolicy(key: string): ContentCachePolicy {
	if (TRANSCODE_STATUS_PATTERN.test(key)) return NO_STORE;
	if (THUMBNAIL_PATTERN.test(key)) return THUMBNAIL;
	if (key.startsWith("videos/") && key.endsWith(".m3u8")) return MANIFEST;
	if (CAPTION_PATTERN.test(key)) return DAILY;
	if (STABLE_MEDIA_PATTERN.test(key)) return DAILY;
	return SHORT;
}
