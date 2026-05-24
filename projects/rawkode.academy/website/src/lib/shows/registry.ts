import { klusteredExtension } from "@/shows/klustered";
import type { ShowExtension, ShowNavItem } from "./types";

// Every show that contributes custom pages registers its extension here.
const extensions: ShowExtension[] = [klusteredExtension];

const byId = new Map<string, ShowExtension>(
	extensions.map((e) => [e.showId, e]),
);

export function getShowExtension(showId: string): ShowExtension | undefined {
	return byId.get(showId);
}

export function hasExtension(showId: string): boolean {
	return byId.has(showId);
}

export function getShowNav(showId: string): ShowNavItem[] {
	const ext = byId.get(showId);
	if (!ext) return [];
	return ext.pages
		.filter((p) => !p.hidden)
		.map((p) => ({ slug: p.slug, label: p.label, icon: p.icon }));
}
