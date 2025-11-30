import type { CollectionEntry } from "astro:content";

export type ShowEntry = CollectionEntry<"shows">;

export interface ShowItem {
	id: string;
	name: string;
	description: string | undefined;
	hosts: string[];
}

export async function listShows(): Promise<ShowItem[]> {
	const { getCollection } = await import("astro:content");

	const items = await getCollection("shows");
	return items.map((e: ShowEntry) => {
		const data = e.data;
		return {
			id: e.id,
			name: data.name,
			description: data.description,
			hosts: (data.hosts ?? []).map((h: any) =>
				typeof h === "string" ? h : h.id,
			),
		} satisfies ShowItem;
	});
}

export async function getShowById(id: string): Promise<ShowItem | null> {
	const list = await listShows();
	return list.find((s) => s.id === id) ?? null;
}
