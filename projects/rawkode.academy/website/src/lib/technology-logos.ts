import { getAllCollection } from "@/lib/payload-content";
import { resolveTechnologyIconUrl } from "@/utils/resolve-technology-icon";

/** Technology id (without a trailing `/index`) to its resolved logo URL. */
export async function getTechnologyLogos(): Promise<Map<string, string>> {
	const logos = new Map<string, string>();
	for (const technology of await getAllCollection("technologies")) {
		const logo = resolveTechnologyIconUrl(
			technology.slug,
			technology.data.logos,
			technology.mediaAssets,
		);
		if (logo) {
			logos.set(technology.id, logo);
			logos.set(technology.slug, logo);
		}
	}
	return logos;
}

/** Logos for technology ids in order of first mention, skipping unknown ids. */
export const logosFor = (references: Iterable<unknown>, logos: Map<string, string>) =>
	[...new Set(references)]
		.map((reference) => {
			const id =
				typeof reference === "string"
					? reference
					: reference && typeof reference === "object" && "id" in reference && typeof reference.id === "string"
						? reference.id
						: reference && typeof reference === "object" && "slug" in reference && typeof reference.slug === "string"
							? reference.slug
							: "";
			return logos.get(id.replace(/\/index$/, ""));
		})
		.filter((src): src is string => Boolean(src));
