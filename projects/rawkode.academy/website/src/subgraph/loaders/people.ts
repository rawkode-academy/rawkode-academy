import type { CollectionEntry } from "astro:content";

export type PersonEntry = CollectionEntry<"people">;

export interface PersonLink {
	url: string;
	name: string;
}

export interface PersonItem {
	id: string;
	name: string;
	handle: string;
	forename: string;
	surname: string;
	biography: string | undefined;
	links: PersonLink[];
}

function parseName(fullName: string): { forename: string; surname: string } {
	const parts = fullName.trim().split(/\s+/);
	if (parts.length === 1) {
		return { forename: parts[0] ?? "", surname: "" };
	}
	const surname = parts.pop() ?? "";
	const forename = parts.join(" ");
	return { forename, surname };
}

export async function listPeople(): Promise<PersonItem[]> {
	const { getCollection } = await import("astro:content");

	const items = await getCollection("people");
	return items.map((e: PersonEntry) => {
		const data = e.data;
		const parsed = parseName(data.name);
		return {
			id: e.id,
			name: data.name,
			handle: data.handle,
			forename: data.forename ?? parsed.forename,
			surname: data.surname ?? parsed.surname,
			biography: data.biography,
			links: data.links ?? [],
		} satisfies PersonItem;
	});
}

export async function getPersonById(id: string): Promise<PersonItem | null> {
	const list = await listPeople();
	return list.find((p) => p.id === id) ?? null;
}

export async function getPersonByHandle(
	handle: string,
): Promise<PersonItem | null> {
	const list = await listPeople();
	return list.find((p) => p.handle === handle) ?? null;
}
