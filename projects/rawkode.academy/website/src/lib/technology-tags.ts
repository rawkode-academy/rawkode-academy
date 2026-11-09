// Technology tags on content pages. A tag links to /technology/<id> only when
// that id is in the technologies collection; anything else (an id with no page,
// or every id when the collection failed to load) renders as a plain label.

interface TechnologyEntry {
	id: string;
	data: { name: string };
}

export interface TechnologyTag {
	id: string;
	label: string;
	href?: string;
}

// "cloud-native/opentelemetry" → "Cloud Native Opentelemetry"; short segments
// are treated as acronyms ("k8s" → "K8S").
export function formatTechnologyId(technologyId: string): string {
	return technologyId
		.split(/[-/]/g)
		.filter(Boolean)
		.map((segment) =>
			segment.length <= 3
				? segment.toUpperCase()
				: `${segment.charAt(0).toUpperCase()}${segment.slice(1)}`,
		)
		.join(" ");
}

export function buildTechnologyTags(
	technologyIds: readonly string[],
	technologies: readonly TechnologyEntry[],
	fallbackLabel: (technologyId: string) => string = formatTechnologyId,
): TechnologyTag[] {
	const technologyById = new Map(
		technologies.map((technology) => [technology.id, technology] as const),
	);
	return technologyIds.map((technologyId) => {
		const technology = technologyById.get(technologyId);
		if (!technology) {
			return { id: technologyId, label: fallbackLabel(technologyId) };
		}
		return {
			id: technologyId,
			label: technology.data.name,
			href: `/technology/${technologyId}`,
		};
	});
}
