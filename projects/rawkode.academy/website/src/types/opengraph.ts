import type { ImageServicePayload } from "./image-service";

export interface OpenGraphProps {
  title: string;
	description?: string;
	useImageDirectly?: boolean;
  image?: Partial<ImageServicePayload>;
}
