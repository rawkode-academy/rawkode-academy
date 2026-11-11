import datum from "@/components/partner/logos/datum.svg?url";
import type { ContentEntry } from "@/lib/live-content/types";
import { resolveTechnologyIconUrl } from "@/utils/resolve-technology-icon";

export interface SupporterLogo {
	src: string;
	/** The mark is an icon only, so the name is set beside it. */
	wordmark: boolean;
}

/** Marks kept in the repository, by supporter id. */
const bundledLogos: Record<string, string> = { datum };

/**
 * A supporter's logo: the one on its record, then a mark kept in the
 * repository, then the icon of the first technology it supports. Marks are
 * transparent and drawn in one ink, so the wall can set them in the text
 * colour of either scheme.
 */
export function supporterLogo(
	supporter: ContentEntry<"supporters">,
	technologies?: ReadonlyArray<ContentEntry<"technologies">>,
): SupporterLogo | undefined {
	const own = supporter.data.logoUrl ?? bundledLogos[supporter.id];
	if (own) return { src: own, wordmark: false };

	const supported = supporter.data.technologies[0]?.id;
	if (!supported) return undefined;
	// Without the technology records the icon is assumed to exist; the markup
	// falls back to the name when it does not load.
	const technology = technologies?.find(({ id }) => id === supported);
	const icon = technologies
		? technology &&
			resolveTechnologyIconUrl(technology.id, technology.data.logos)
		: resolveTechnologyIconUrl(supported, { icon: true });
	return icon ? { src: icon, wordmark: true } : undefined;
}
