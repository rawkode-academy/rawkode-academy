// Public API of the content layer. See the website migration guide.
export {
	type ComputedCache,
	type ContentCacheInput,
	DEFAULT_MAX_AGE,
	DEFAULT_SWR,
	disableContentCache,
	setContentCache,
} from "./cache-control";
export {
	ContentError,
	type ContentQueryOptions,
	getCollection,
	getEntries,
	getEntry,
	optionalContent,
	reference,
	sameId,
} from "./collections";
export { isScheduled, type ScheduledMode } from "./loader";
export { normalizeTechnologyId, publicationDate } from "./mappers";
export { documentToMarkdown } from "./markdown";
export { stripIslands } from "./render/islands";
export {
	entryDocument,
	type RenderedDocument,
	type RenderOptions,
	renderDocument,
	renderEntry,
} from "./render/render";
export * from "./types";
