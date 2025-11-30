import { listVideos, type VideoItem } from "./videos";

export interface EpisodeItem {
	id: string;
	code: string;
	videoId: string;
	showId: string;
}

function deriveEpisodeCode(videoSlug: string): string {
	const match = videoSlug.match(/(?:s(\d+))?e(\d+)/i);
	if (match && match[2]) {
		const season = match[1] ? `S${match[1].padStart(2, "0")}` : "";
		const episode = `E${match[2].padStart(2, "0")}`;
		return season ? `${season}${episode}` : episode;
	}
	return videoSlug;
}

export async function listEpisodes(): Promise<EpisodeItem[]> {
	const videos = await listVideos();
	return videos
		.filter((v: VideoItem) => v.show !== undefined)
		.map((v: VideoItem) => ({
			id: `${v.show}-${v.id}`,
			code: deriveEpisodeCode(v.slug),
			videoId: v.id,
			showId: v.show as string,
		}));
}

export async function getEpisodeById(id: string): Promise<EpisodeItem | null> {
	const list = await listEpisodes();
	return list.find((e) => e.id === id) ?? null;
}

export async function getEpisodeByVideoId(
	videoId: string,
): Promise<EpisodeItem | null> {
	const list = await listEpisodes();
	return list.find((e) => e.videoId === videoId) ?? null;
}

export async function getEpisodesByShow(
	showId: string,
): Promise<EpisodeItem[]> {
	const list = await listEpisodes();
	return list.filter((e) => e.showId === showId);
}

export async function getEpisodeByShowCode(
	showId: string,
	code: string,
): Promise<EpisodeItem | null> {
	const episodes = await getEpisodesByShow(showId);
	return (
		episodes.find((e) => e.code.toLowerCase() === code.toLowerCase()) ?? null
	);
}
