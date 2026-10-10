// Lazy content loader for Technology records from Astro content.
// We derive types directly from the technologies collection schema
// to ensure compile-time safety with zero drift.
import type { CollectionEntry } from "@/lib/payload-content";
import {
	technologyZod,
	type TechnologyData as ContentTechnologyData,
} from "@rawkodeacademy/content";

export type TechnologyEntry = CollectionEntry<"technologies">;
// Match content package definition exactly for compile-time safety
export type TechnologyData = TechnologyEntry["data"] & ContentTechnologyData;
export type LearningResources = NonNullable<
	TechnologyData["learningResources"]
>;
export type TechnologyItem = Omit<TechnologyData, "icon"> & {
	id: string;
	slug: string;
	logo?: string | undefined;
	icon?: string | undefined;
};

export async function listTechnologies(): Promise<TechnologyItem[]> {
	const { getAllCollection } = await import("@/lib/payload-content");
	const { resolveTechnologyIconUrl } = await import(
		"../../utils/resolve-technology-icon"
	);

	const items = await getAllCollection("technologies");
	return items.map((e: TechnologyEntry) => {
		const data = technologyZod.parse((e as any).data);
		const iconValue = resolveTechnologyIconUrl(e.slug, (e as any).data.logos, e.mediaAssets);
		return {
			id: e.id,
			slug: e.slug,
			...data,
			icon: iconValue,
			logo: iconValue,
			learningResources: data.learningResources ?? undefined,
		} satisfies TechnologyItem;
	});
}

export async function getTechnologyById(
	id: string,
): Promise<TechnologyItem | null> {
	const list = await listTechnologies();
	return list.find((t) => t.id === id) ?? null;
}
