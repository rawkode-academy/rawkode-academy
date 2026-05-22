export function getVideoThumbnailUrl(videoId: string): string {
	return `https://content.rawkode.academy/videos/${videoId}/thumbnail.webp`;
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
