export interface RelatedArticleCandidate {
	id: string;
	data: {
		publishedAt: Date | string;
		series?: string | undefined;
		technologies?: ReadonlyArray<string | { id: string }> | undefined;
		type?: string | undefined;
	};
}

const normalizeTechId = (value: string | { id: string }): string | null => {
	const raw = typeof value === "string" ? value : value?.id;
	if (typeof raw !== "string") return null;
	const normalized = raw.trim().replace(/\/index$/, "").toLowerCase();
	return normalized.length > 0 ? normalized : null;
};

const toTechnologySet = (
	technologies: ReadonlyArray<string | { id: string }> | undefined,
): Set<string> => {
	const set = new Set<string>();
	if (!Array.isArray(technologies)) return set;
	for (const tech of technologies) {
		const id = normalizeTechId(tech);
		if (id) set.add(id);
	}
	return set;
};

const toTimestamp = (value: Date | string): number => {
	const time = new Date(value).getTime();
	return Number.isFinite(time) ? time : 0;
};

/**
 * Deterministically rank related articles by topical relevance:
 *   1. Same series (highest priority)
 *   2. Shared technology count (descending)
 *   3. Same article type
 *   4. Recency (newest publishedAt first)
 *   5. Lexicographic id tie-breaker
 */
export function selectRelatedArticles<T extends RelatedArticleCandidate>(
	currentArticle: RelatedArticleCandidate,
	candidates: ReadonlyArray<T>,
	limit = 3,
): T[] {
	const maxItems = Math.max(0, Math.floor(limit));
	if (maxItems === 0) return [];

	const currentSeries = currentArticle.data.series?.trim() || undefined;
	const currentTechs = toTechnologySet(currentArticle.data.technologies);
	const currentType = currentArticle.data.type || "tutorial";

	return candidates
		.filter((candidate) => candidate.id !== currentArticle.id)
		.map((candidate) => {
			const sameSeries =
				Boolean(currentSeries) &&
				candidate.data.series?.trim() === currentSeries
					? 1
					: 0;
			let sharedTechCount = 0;
			if (currentTechs.size > 0) {
				const candidateTechs = toTechnologySet(candidate.data.technologies);
				for (const tech of candidateTechs) {
					if (currentTechs.has(tech)) sharedTechCount += 1;
				}
			}
			const sameType =
				(candidate.data.type || "tutorial") === currentType ? 1 : 0;
			const publishedTime = toTimestamp(candidate.data.publishedAt);
			return {
				candidate,
				sameSeries,
				sharedTechCount,
				sameType,
				publishedTime,
			};
		})
		.sort(
			(a, b) =>
				b.sameSeries - a.sameSeries ||
				b.sharedTechCount - a.sharedTechCount ||
				b.sameType - a.sameType ||
				b.publishedTime - a.publishedTime ||
				a.candidate.id.localeCompare(b.candidate.id),
		)
		.slice(0, maxItems)
		.map((entry) => entry.candidate);
}
