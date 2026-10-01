import { getCollection } from "astro:content";
import { resolveTechnologyIconUrl } from "@/utils/resolve-technology-icon";

/** Technology id (without a trailing `/index`) to its resolved logo URL. */
export async function getTechnologyLogos(): Promise<Map<string, string>> {
	const logos = new Map<string, string>();
	for (const technology of await getCollection("technologies")) {
		const logo = resolveTechnologyIconUrl(technology.id, technology.data.logos);
		if (logo) logos.set(technology.id.replace(/\/index$/, ""), logo);
	}
	return logos;
}

/** Logos for technology ids in order of first mention, skipping unknown ids. */
export const logosFor = (ids: Iterable<string>, logos: Map<string, string>) =>
	[...new Set(ids)]
		.map((id) => logos.get(id.replace(/\/index$/, "")))
		.filter((src): src is string => Boolean(src));
