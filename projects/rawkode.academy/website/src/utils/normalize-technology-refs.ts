type TechnologyReferenceObject = { id?: string; slug?: string };

function isTechnologyReferenceObject(
	value: unknown,
): value is TechnologyReferenceObject {
	return (
		typeof value === "object" &&
		value !== null &&
		("id" in (value as Record<string, unknown>) ||
			"slug" in (value as Record<string, unknown>))
	);
}

/**
 * Normalizes technology references to consistent string IDs.
 * Handles both plain string IDs and Astro content reference objects.
 *
 * The technology collection uses simple IDs like "kubescape" (not "kubescape/index"),
 * so we strip any "/index" suffix that may have been added by schema transforms.
 *
 * @param values - Array of technology references (strings or { id, slug } objects)
 * @returns Array of normalized technology IDs (without "/index" suffix)
 */
export function normalizeTechnologyReferences(values: unknown): string[] {
	if (!Array.isArray(values)) return [];

	const stripIndex = (value: string) =>
		value.endsWith("/index") ? value.slice(0, -6) : value;

	return values
		.map((value) => {
			if (typeof value === "string") return stripIndex(value);
			if (isTechnologyReferenceObject(value)) {
				const ref = value.id ?? value.slug;
				if (typeof ref === "string") return stripIndex(ref);
			}
			return undefined;
		})
		.filter((value): value is string => Boolean(value));
}
