import { klusteredEnabledPages } from "@/shows/klustered/config";

// Pure TypeScript mirror of enabled show subpages (kept separate from Astro
// component imports so sitemap helpers remain importable in Node/Vitest).
const SHOW_SUBPAGES: Readonly<Record<string, readonly string[]>> = {
	klustered: klusteredEnabledPages,
};

export function getShowSubpages(showId: string): readonly string[] {
	return SHOW_SUBPAGES[showId] ?? [];
}
