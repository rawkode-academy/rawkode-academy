export function getVideoThumbnailUrl(videoId: string): string {
	return `https://content.rawkode.academy/videos/${videoId}/thumbnail.webp`;
}

/**
 * Resize a video thumbnail through Cloudflare image resizing.
 * Falls back to the original asset in dev where /cdn-cgi/image/ is unavailable.
 */
export function getVideoThumbnailResizedUrl(
	videoId: string,
	width: number,
): string {
	const source = getVideoThumbnailUrl(videoId);
	if (import.meta.env.DEV) {
		return source;
	}
	const params = `width=${width},quality=82,format=auto`;
	return `/cdn-cgi/image/${params}/${source}`;
}

export function getVideoThumbnailJpegUrl(
	site: string | URL,
	videoId: string,
): string {
	const params = "format=jpeg,quality=85";
	const source = getVideoThumbnailUrl(videoId);
	const base = typeof site === "string" ? site.replace(/\/$/, "") : site.origin;
	return `${base}/cdn-cgi/image/${params}/${source}`;
}
