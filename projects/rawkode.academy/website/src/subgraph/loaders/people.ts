import type { CollectionEntry } from "astro:content";

export type PersonEntry = CollectionEntry<"people">;

export interface PersonLink {
	url: string;
	name: string;
}

export interface PersonItem {
	id: string;
	name: string;
	forename: string;
	surname: string;
	terms?: string[] | undefined;
	githubHandle?: string | undefined;
	githubUrl?: string | undefined;
	avatarUrl?: string | undefined;
	biography: string;
	links: PersonLink[];
}

function normalizeGithubHandle(handle: string): string {
	return handle
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
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
		const handles = data.handles as { github?: string } | undefined;
		return {
			id: e.id,
			name: data.name,
			forename: data.forename ?? parsed.forename,
			surname: data.surname ?? parsed.surname,
			terms: data.terms,
			githubHandle: handles?.github,
			githubUrl: data.github,
			avatarUrl: data.avatarUrl,
			biography: e.body ?? "",
			links: data.links ?? [],
		} satisfies PersonItem;
	});
}

export async function getPersonById(id: string): Promise<PersonItem | null> {
	const list = await listPeople();
	return list.find((p) => p.id === id) ?? null;
}

export async function getPersonByGithub(
	username: string,
): Promise<PersonItem | null> {
	const normalized = normalizeGithubHandle(username);
	const direct = await getPersonById(normalized);
	if (direct) return direct;

	const list = await listPeople();
	return (
		list.find(
			(person) =>
				person.githubHandle &&
				normalizeGithubHandle(person.githubHandle) === normalized,
		) ?? null
	);
}
