export interface RelatedNewsCandidate {
	id: string;
	data: {
		title: string;
		description: string;
		publishedAt: Date;
		technologies?: ReadonlyArray<string>;
	};
}

interface ScoredCandidate<T> {
	story: T;
	shared: number;
	publishedAt: number;
}

/**
 * Pick news stories related to the current one.
 *
 * Ordering rules:
 *  1. Stories sharing at least one technology tag with the current story rank
 *     above stories with no shared tags. Within that band, more shared tags
 *     ranks higher.
 *  2. Within an equal-overlap band (including the zero-overlap fallback band),
 *     newer `publishedAt` wins.
 *
 * The current story is always excluded.
 */
export function selectRelatedNews<T extends RelatedNewsCandidate>(
	currentId: string,
	currentTechnologies: ReadonlyArray<string>,
	candidates: ReadonlyArray<T>,
	limit: number,
): T[] {
	if (limit <= 0) return [];

	const currentTechSet = new Set(currentTechnologies);

	const scored: ScoredCandidate<T>[] = candidates
		.filter((story) => story.id !== currentId)
		.map((story) => {
			const shared = (story.data.technologies ?? []).reduce(
				(count, technology) =>
					currentTechSet.has(technology) ? count + 1 : count,
				0,
			);
			return {
				story,
				shared,
				publishedAt: story.data.publishedAt.getTime(),
			};
		});

	scored.sort((a, b) => {
		if (a.shared !== b.shared) return b.shared - a.shared;
		return b.publishedAt - a.publishedAt;
	});

	return scored.slice(0, limit).map((entry) => entry.story);
}
