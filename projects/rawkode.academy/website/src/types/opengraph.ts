import type { ImageServicePayload } from "./image-service";
import type { CollectionEntry } from "astro:content";

export interface OpenGraphProps {
  title: string;
  description?: string;
  useImageDirectly?: boolean;
  image?: Partial<ImageServicePayload>;
  isArticle?: boolean;
  publishedAt?: Date;
  updatedAt?: Date;
  authors?: CollectionEntry<"people">[];
}
