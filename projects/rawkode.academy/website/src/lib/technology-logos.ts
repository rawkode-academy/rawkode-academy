import { getCollection, normalizeTechnologyId } from "@/lib/live-content";
import { resolveTechnologyIconUrl } from "@/utils/resolve-technology-icon";

/**
 * Technology id to its resolved logo URL. Pages using this should list
 * "technologies" in their setContentCache collections.
 */
export async function getTechnologyLogos(): Promise<Map<string, string>> {
	const logos = new Map<string, string>();
	for (const technology of await getCollection("technologies")) {
		const logo = resolveTechnologyIconUrl(technology.id, technology.data.logos);
		if (logo) logos.set(technology.id, logo);
	}
	return logos;
}

/** Logos for technology ids in order of first mention, skipping unknown ids. */
export const logosFor = (ids: Iterable<string>, logos: Map<string, string>) =>
	[...new Set(ids)]
		.map((id) => logos.get(normalizeTechnologyId(id)))
		.filter((src): src is string => Boolean(src));
