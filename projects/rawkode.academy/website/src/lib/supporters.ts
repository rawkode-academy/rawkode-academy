import { normalizeTechnologyId } from "@/lib/live-content/mappers";
import type { ContentEntry } from "@/lib/live-content/types";

export const SUPPORTERS_PATH = "/supporters";
/** Where organisations learn how to become a community supporter. */
export const BECOME_A_SUPPORTER_PATH = "/organizations/partnerships#supporter";

/**
 * The active community supporter of a technology, if any. The supporters
 * collection only lists active supporters, and a technology has at most one.
 */
export function supporterForTechnology(
	supporters: ReadonlyArray<ContentEntry<"supporters">>,
	technologyId: string,
): ContentEntry<"supporters"> | undefined {
	const id = normalizeTechnologyId(technologyId);
	return supporters.find(({ data }) =>
		data.technologies.some((technology) => technology.id === id),
	);
}
