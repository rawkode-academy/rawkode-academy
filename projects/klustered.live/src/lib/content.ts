import { getCollection, getEntry, type CollectionEntry } from "astro:content";

export type Episode = CollectionEntry<"episodes">;
export type Person = CollectionEntry<"people">;

export async function getEpisodes(): Promise<Episode[]> {
	const episodes = await getCollection("episodes");
	return episodes.sort(
		(a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime(),
	);
}

export async function getPerson(slug: string): Promise<Person | undefined> {
	return await getEntry("people", slug);
}

export async function getEpisodesByPerson(slug: string): Promise<Episode[]> {
	const episodes = await getEpisodes();
	return episodes.filter((e) => {
		const ids = [...(e.data.guests ?? []), ...(e.data.hosts ?? [])];
		return ids.includes(slug);
	});
}

export function getSeasonFromEpisode(episode: Episode): string {
	const segments = episode.id.split("/");
	return segments[1] ?? new Date(episode.data.publishedAt).getFullYear().toString();
}

export async function getSeasonsFromContent(): Promise<string[]> {
	const episodes = await getEpisodes();
	const seasons = new Set<string>();
	for (const ep of episodes) seasons.add(getSeasonFromEpisode(ep));
	return [...seasons].sort().reverse();
}
