import type { ImageServicePayload } from "@/types/image-service";
import {
	encodeImageServicePayload,
	IMAGE_SERVICE_TEMPLATE_VERSION,
} from "@/lib/image-service-payload";

export const OPEN_GRAPH_IMAGE_WIDTH = 1200;
export const OPEN_GRAPH_IMAGE_HEIGHT = 630;
export const IMAGE_SERVICE_URL = "https://image.rawkode.academy/image";

const DEFAULT_DESCRIPTION =
	"Hands-on cloud native lessons, articles, and field notes from Rawkode Academy.";

type OpenGraphImageInput = {
	title: string;
	subtitle?: string;
	description?: string;
	image?: Omit<Partial<ImageServicePayload>, "image"> & {
		image?: string | URL | undefined;
	};
	pageUrl: URL;
	useImageDirectly?: boolean;
};

export type ResolvedOpenGraphImage = {
	url: string;
	alt: string;
	width?: number;
	height?: number;
	type?: "image/png";
};

const imageUrlFromValue = (
	value: unknown,
	pageUrl: URL,
): string | undefined => {
	if (value instanceof URL) {
		return value.href;
	}

	if (typeof value !== "string" || value.trim().length === 0) {
		return undefined;
	}

	return new URL(value, pageUrl).href;
};

export const resolveOpenGraphImage = ({
	title,
	subtitle,
	description,
	image,
	pageUrl,
	useImageDirectly = false,
}: OpenGraphImageInput): ResolvedOpenGraphImage => {
	const directImageUrl = imageUrlFromValue(image?.image, pageUrl);

	if (useImageDirectly && directImageUrl) {
		return {
			url: directImageUrl,
			alt: title,
		};
	}

	const payload: ImageServicePayload = {
		format: "png",
		image: directImageUrl,
		text: image?.text ?? description ?? subtitle ?? DEFAULT_DESCRIPTION,
		title,
		subtitle,
		template: image?.template ?? "gradient",
	};

	const url = new URL(IMAGE_SERVICE_URL);
	url.searchParams.set("v", IMAGE_SERVICE_TEMPLATE_VERSION);
	url.searchParams.set("payload", encodeImageServicePayload(payload));

	return {
		url: url.href,
		alt: title,
		type: "image/png",
		width: OPEN_GRAPH_IMAGE_WIDTH,
		height: OPEN_GRAPH_IMAGE_HEIGHT,
	};
};
