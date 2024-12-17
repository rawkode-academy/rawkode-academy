import type { ImageServicePayload } from "./image-service";

export interface OpenGraphProps {
  title: string;
  description?: string;
  image?: Partial<ImageServicePayload>;
}
