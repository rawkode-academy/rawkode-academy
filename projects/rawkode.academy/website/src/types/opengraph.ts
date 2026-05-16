import type { CollectionEntry } from "astro:content";
import type { ImageServicePayload } from "./image-service";

/**
 * Schema.org `@type` for the inline WebPage-family JSON-LD emitted by
 * opengraph.astro. Article pages set `isArticle` instead - they're served
 * by the dedicated article-jsonld emitters and the inline WebPage block
 * is suppressed.
 */
export type PageType =
	| "WebPage"
	| "AboutPage"
	| "CollectionPage"
	| "ProfilePage"
	| "ContactPage"
	| "SearchResultsPage";

export interface OpenGraphProps {
	title: string;
	subtitle?: string | undefined;
	description?: string | undefined;
	useImageDirectly?: boolean | undefined;
	image?: Partial<ImageServicePayload> | undefined;
	isArticle?: boolean | undefined;
	publishedAt?: Date | undefined;
	updatedAt?: Date | undefined;
	authors?: CollectionEntry<"people">[] | undefined;
	noindex?: boolean | undefined;
	pageType?: PageType | undefined;
}
