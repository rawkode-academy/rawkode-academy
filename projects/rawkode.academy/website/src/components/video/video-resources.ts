export interface VideoResource {
	id?: string | undefined;
	title: string;
	description?: string | undefined;
	type: "url" | "file" | "embed";
	url?: string | undefined;
	filePath?: string | undefined;
	category?: string | undefined;
}

const RESOURCE_CATEGORIES = [
	"documentation",
	"code",
	"slides",
	"demos",
	"other",
] as const;

/**
 * The destination of a resource, or undefined when it has none worth
 * linking: only http(s) URLs and site-relative paths are links.
 */
function resourceHref(resource: VideoResource): string | undefined {
	for (const candidate of [resource.url, resource.filePath]) {
		const href = candidate?.trim();
		if (
			!href ||
			href.startsWith("#") ||
			href.startsWith("//") ||
			/[\\\u0000- ]/.test(href)
		)
			continue;
		try {
			const url = new URL(href, "https://rawkode.academy/");
			if (url.protocol === "https:" || url.protocol === "http:") return href;
		} catch {
			// An invalid destination is not a resource link.
		}
	}
	return undefined;
}

/** Resources with a title and a safe destination; unknown categories are "other". */
export function validVideoResources(resources: readonly VideoResource[]) {
	return resources.flatMap((resource) => {
		const href = resourceHref(resource);
		if (!href || !resource.title.trim()) return [];
		const category = (RESOURCE_CATEGORIES as readonly string[]).includes(
			resource.category ?? "",
		)
			? (resource.category as string)
			: "other";
		return [{ ...resource, href, category }];
	});
}
