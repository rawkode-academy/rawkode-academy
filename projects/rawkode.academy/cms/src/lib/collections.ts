// What the CMS edits. Each collection is one editor screen over an entity
// model in a platform service; panels are the lists (guests, authors, links)
// and attached rows (a person's biography, a video's episode) edited on the
// same screen. Fields come from the write models' describe() at runtime, so
// this file only says where things live and how they relate.
import type { Row } from "@rawkodeacademy/content-write";

/** Service binding names on the CMS worker (wrangler.jsonc "services"). */
export const BINDINGS = [
	"WRITE_PEOPLE",
	"WRITE_PEOPLE_LINKS",
	"WRITE_PEOPLE_BIOGRAPHIES",
	"WRITE_TECHNOLOGIES",
	"WRITE_TRANSCRIPTION_TERMS",
	"WRITE_SHOWS",
	"WRITE_SHOW_HOSTS",
	"WRITE_VIDEOS",
	"WRITE_VIDEO_GUESTS",
	"WRITE_VIDEO_TECHNOLOGIES",
	"WRITE_CHAPTERS",
	"WRITE_EPISODES",
	"WRITE_ARTICLES",
	"WRITE_NEWS",
	"WRITE_CHANGELOG",
	"WRITE_ADRS",
	"WRITE_TESTIMONIALS",
	"WRITE_COURSES",
] as const;
export type Binding = (typeof BINDINGS)[number];

/** A list of rows that belong to the entity, replaced together. */
export interface ListPanel {
	kind: "list";
	/** URL segment and label key, e.g. "guests". */
	name: string;
	label: string;
	binding: Binding;
	model: string;
	/** The list's parent key, from the entity row. */
	parent: (row: Row) => Row;
	/** For pickers: the collection an item field points at. */
	picks?: { field: string; collection: string };
}

/** A single row in another service, keyed by the entity (biography, episode). */
export interface AttachedPanel {
	kind: "attached";
	name: string;
	label: string;
	binding: Binding;
	model: string;
	/** The attached row's key, from the entity row. */
	key: (row: Row) => string;
	/** The attached row's key property, filled in when creating it. */
	keyField: string;
	/** Fields the write model derives (Markdown copies), not shown in forms. */
	hidden?: string[];
}

export type Panel = ListPanel | AttachedPanel;

/** Rows elsewhere that point at an entity; a delete is refused while any exist. */
export interface Reference {
	label: string;
	binding: Binding;
	model: string;
	column: string;
}

export interface Collection {
	/** URL segment, e.g. "technologies". */
	name: string;
	label: string;
	singular: string;
	binding: Binding;
	model: string;
	/** Field shown as the row's title in lists. */
	titleField: string;
	/** Fields written by the write model, not by people. */
	hidden: string[];
	panels: Panel[];
	references: Reference[];
	/** The entity's page on the website, for "View on site". */
	websitePath?: (row: Row) => string;
}

const derived = ["updatedAt"];

export const COLLECTIONS: Collection[] = [
	{
		name: "people",
		label: "People",
		singular: "Person",
		binding: "WRITE_PEOPLE",
		model: "person",
		titleField: "name",
		hidden: derived,
		panels: [
			{
				kind: "list",
				name: "links",
				label: "Links",
				binding: "WRITE_PEOPLE_LINKS",
				model: "person-links",
				parent: (row) => ({ personId: row.id }),
			},
			{
				kind: "attached",
				name: "biography",
				label: "Biography",
				binding: "WRITE_PEOPLE_BIOGRAPHIES",
				model: "person-biography",
				key: (row) => String(row.id),
				keyField: "personId",
				hidden: ["biography"],
			},
		],
		references: [
			{
				label: "video guest",
				binding: "WRITE_VIDEO_GUESTS",
				model: "video-guests",
				column: "guestId",
			},
			{
				label: "show host",
				binding: "WRITE_SHOW_HOSTS",
				model: "show-hosts",
				column: "hostId",
			},
			{
				label: "article author",
				binding: "WRITE_ARTICLES",
				model: "article-authors",
				column: "personId",
			},
			{
				label: "news author",
				binding: "WRITE_NEWS",
				model: "news-authors",
				column: "personId",
			},
			{
				label: "ADR author",
				binding: "WRITE_ADRS",
				model: "adr-authors",
				column: "personId",
			},
			{
				label: "changelog author",
				binding: "WRITE_CHANGELOG",
				model: "changelog-entry",
				column: "authorId",
			},
			{
				label: "course author",
				binding: "WRITE_COURSES",
				model: "course",
				column: "authors",
			},
			{
				label: "course module author",
				binding: "WRITE_COURSES",
				model: "course-module",
				column: "authors",
			},
			{
				label: "learning path author",
				binding: "WRITE_COURSES",
				model: "learning-path",
				column: "authors",
			},
		],
		websitePath: (row) => `/people/${row.id}`,
	},
	{
		name: "technologies",
		label: "Technologies",
		singular: "Technology",
		binding: "WRITE_TECHNOLOGIES",
		model: "technology",
		titleField: "name",
		hidden: [...derived, "description"],
		panels: [
			{
				kind: "list",
				name: "terms",
				label: "Transcription terms",
				binding: "WRITE_TRANSCRIPTION_TERMS",
				model: "transcription-terms",
				parent: (row) => ({ kind: "technology", foreignId: row.id }),
			},
		],
		references: [
			{
				label: "video",
				binding: "WRITE_VIDEO_TECHNOLOGIES",
				model: "video-technologies",
				column: "technologyId",
			},
			{
				label: "article",
				binding: "WRITE_ARTICLES",
				model: "article-technologies",
				column: "technologyId",
			},
			{
				label: "news story",
				binding: "WRITE_NEWS",
				model: "news-technologies",
				column: "technologyId",
			},
			{
				label: "course",
				binding: "WRITE_COURSES",
				model: "course",
				column: "technologies",
			},
			{
				label: "learning path",
				binding: "WRITE_COURSES",
				model: "learning-path",
				column: "technologies",
			},
			{
				label: "related technology",
				binding: "WRITE_TECHNOLOGIES",
				model: "technology",
				column: "relatedTechnologies",
			},
		],
		websitePath: (row) => `/technology/${row.id}`,
	},
	{
		name: "shows",
		label: "Shows",
		singular: "Show",
		binding: "WRITE_SHOWS",
		model: "show",
		titleField: "name",
		// description is the write model's Markdown copy of descriptionDoc.
		hidden: [...derived, "description"],
		panels: [
			{
				kind: "list",
				name: "hosts",
				label: "Hosts",
				binding: "WRITE_SHOW_HOSTS",
				model: "show-hosts",
				parent: (row) => ({ showId: row.id }),
				picks: { field: "hostId", collection: "people" },
			},
		],
		references: [
			{
				label: "episode",
				binding: "WRITE_EPISODES",
				model: "episode",
				column: "showId",
			},
		],
		websitePath: (row) => `/shows/${row.id}`,
	},
	{
		name: "videos",
		label: "Videos",
		singular: "Video",
		binding: "WRITE_VIDEOS",
		model: "video",
		titleField: "title",
		// description is the write model's plain-text copy of descriptionDoc.
		hidden: [...derived, "description"],
		panels: [
			{
				kind: "list",
				name: "guests",
				label: "Guests",
				binding: "WRITE_VIDEO_GUESTS",
				model: "video-guests",
				parent: (row) => ({ videoId: row.id }),
				picks: { field: "guestId", collection: "people" },
			},
			{
				kind: "list",
				name: "technologies",
				label: "Technologies",
				binding: "WRITE_VIDEO_TECHNOLOGIES",
				model: "video-technologies",
				parent: (row) => ({ videoId: row.id }),
				picks: { field: "technologyId", collection: "technologies" },
			},
			{
				kind: "list",
				name: "chapters",
				label: "Chapters",
				binding: "WRITE_CHAPTERS",
				model: "chapters",
				parent: (row) => ({ videoId: row.id }),
			},
			{
				kind: "attached",
				name: "episode",
				label: "Episode",
				binding: "WRITE_EPISODES",
				model: "episode",
				key: (row) => String(row.id),
				keyField: "videoId",
			},
		],
		references: [],
		websitePath: (row) => `/watch/${row.slug ?? row.id}`,
	},
	{
		name: "articles",
		label: "Articles",
		singular: "Article",
		binding: "WRITE_ARTICLES",
		model: "article",
		titleField: "title",
		hidden: derived,
		panels: [
			{
				kind: "list",
				name: "authors",
				label: "Authors",
				binding: "WRITE_ARTICLES",
				model: "article-authors",
				parent: (row) => ({ articleId: row.id }),
				picks: { field: "personId", collection: "people" },
			},
			{
				kind: "list",
				name: "technologies",
				label: "Technologies",
				binding: "WRITE_ARTICLES",
				model: "article-technologies",
				parent: (row) => ({ articleId: row.id }),
				picks: { field: "technologyId", collection: "technologies" },
			},
		],
		references: [],
		websitePath: (row) => `/read/${row.id}`,
	},
	{
		name: "news",
		label: "News",
		singular: "News story",
		binding: "WRITE_NEWS",
		model: "news-story",
		titleField: "title",
		hidden: derived,
		panels: [
			{
				kind: "list",
				name: "authors",
				label: "Authors",
				binding: "WRITE_NEWS",
				model: "news-authors",
				parent: (row) => ({ storyId: row.id }),
				picks: { field: "personId", collection: "people" },
			},
			{
				kind: "list",
				name: "technologies",
				label: "Technologies",
				binding: "WRITE_NEWS",
				model: "news-technologies",
				parent: (row) => ({ storyId: row.id }),
				picks: { field: "technologyId", collection: "technologies" },
			},
		],
		references: [],
		websitePath: (row) => `/news/${row.id}`,
	},
	{
		name: "changelog",
		label: "Changelog",
		singular: "Changelog entry",
		binding: "WRITE_CHANGELOG",
		model: "changelog-entry",
		titleField: "title",
		hidden: derived,
		panels: [],
		references: [],
		websitePath: () => "/changelog",
	},
	{
		name: "adrs",
		label: "ADRs",
		singular: "ADR",
		binding: "WRITE_ADRS",
		model: "adr",
		titleField: "title",
		hidden: derived,
		panels: [
			{
				kind: "list",
				name: "authors",
				label: "Authors",
				binding: "WRITE_ADRS",
				model: "adr-authors",
				parent: (row) => ({ adrId: row.id }),
				picks: { field: "personId", collection: "people" },
			},
		],
		references: [],
		websitePath: (row) => `/adrs/${row.id}`,
	},
	{
		name: "testimonials",
		label: "Testimonials",
		singular: "Testimonial",
		binding: "WRITE_TESTIMONIALS",
		model: "testimonial",
		titleField: "authorName",
		hidden: derived,
		panels: [],
		references: [],
	},
	{
		name: "courses",
		label: "Courses",
		singular: "Course",
		binding: "WRITE_COURSES",
		model: "course",
		titleField: "title",
		hidden: derived,
		panels: [],
		references: [
			{
				label: "course module",
				binding: "WRITE_COURSES",
				model: "course-module",
				column: "courseId",
			},
		],
		websitePath: (row) => `/courses/${row.id}`,
	},
	{
		name: "course-modules",
		label: "Course modules",
		singular: "Course module",
		binding: "WRITE_COURSES",
		model: "course-module",
		titleField: "title",
		hidden: derived,
		panels: [],
		references: [],
	},
	{
		name: "learning-paths",
		label: "Learning paths",
		singular: "Learning path",
		binding: "WRITE_COURSES",
		model: "learning-path",
		titleField: "title",
		hidden: derived,
		panels: [],
		references: [],
	},
];

export function findCollection(name: string): Collection | undefined {
	return COLLECTIONS.find((c) => c.name === name);
}

export function findPanel(
	collection: Collection,
	name: string,
): Panel | undefined {
	return collection.panels.find((p) => p.name === name);
}
