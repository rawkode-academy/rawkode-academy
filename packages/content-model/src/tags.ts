// Website cache tags. The website tags every cached page with "<collection>"
// and "<collection>:<id>" for each entity it shows; writers purge by these.
// Collection names match the website's live collections.

export const WEBSITE_COLLECTIONS = [
	"videos",
	"shows",
	"people",
	"technologies",
	"articles",
	"news",
	"changelog",
	"adrs",
	"testimonials",
	"courses",
	"courseModules",
	"learningPaths",
] as const;

export type WebsiteCollection = (typeof WEBSITE_COLLECTIONS)[number];

export const tag = (collection: WebsiteCollection, id: unknown): string =>
	`${collection}:${String(id)}`;

/** Tags for each id in a list, skipping empty values. */
export const tags = (
	collection: WebsiteCollection,
	ids: Iterable<unknown> | null | undefined,
): string[] =>
	[...(ids ?? [])]
		.filter((id) => id !== null && id !== undefined && id !== "")
		.map((id) => tag(collection, id));
