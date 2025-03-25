import type { ImageServicePayload } from "./image-service";
import type { CollectionEntry } from "astro:content";

export interface OpenGraphProps {
  title: string;
  description?: string | undefined;
  useImageDirectly?: boolean | undefined;
  image?: Partial<ImageServicePayload> | undefined;
  isArticle?: boolean | undefined;
  publishedAt?: Date | undefined;
  updatedAt?: Date | undefined;
  authors?: CollectionEntry<"people">[] | undefined;
}
