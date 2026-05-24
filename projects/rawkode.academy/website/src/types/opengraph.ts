import type { CollectionEntry } from "astro:content";
import type { ImageServicePayload } from "./image-service";

type OpenGraphImagePayload = Omit<Partial<ImageServicePayload>, "image"> & {
  image?: string | URL | undefined;
};

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
  image?: OpenGraphImagePayload | undefined;
  isArticle?: boolean | undefined;
  publishedAt?: Date | undefined;
  updatedAt?: Date | undefined;
  authors?: CollectionEntry<"people">[] | undefined;
  noindex?: boolean | undefined;
  pageType?: PageType | undefined;
  /**
   * Optional pre-built schema.org JSON-LD blob to emit in <head> in
   * addition to the inline WebPage / Article JSON-LD. Use for entity
   * types that aren't covered by the standard emitters — e.g. HowTo
   * on tutorial articles.
   */
  jsonLd?: Record<string, unknown> | undefined;
  /**
   * Open Graph article-namespace section + tags. Only emitted when
   * `isArticle` is true. LinkedIn and Facebook use these to categorise
   * shares so they group with related posts in feed recommendations.
   */
  articleSection?: string | undefined;
  articleTags?: ReadonlyArray<string> | undefined;
}
