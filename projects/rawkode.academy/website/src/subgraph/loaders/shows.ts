import type { CollectionEntry } from "@/lib/payload-content";

export type ShowEntry = CollectionEntry<"shows">;

export interface ShowItem {
	id: string;
	name: string;
	description: string | undefined;
	terms?: string[] | undefined;
	hosts: string[];
}

export async function listShows(): Promise<ShowItem[]> {
	const { getAllCollection } = await import("@/lib/payload-content");

	const items = await getAllCollection("shows");
	return items.map((e: ShowEntry) => {
		const data = e.data;
		return {
			id: data.id,
			name: data.name,
			description: data.description,
			terms: data.terms,
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
