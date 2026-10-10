import { getImage } from "astro:assets";
import { getPayloadImageVariant } from "@/lib/payload-content";

export interface ContentImageResult {
	src: string;
	attributes: { width: number; height: number };
}

const fallbackAttributes = (width: number) => ({
	width,
	height: Math.round((width * 9) / 16),
});

/**
 * CMS media URLs are already runtime delivery URLs and must bypass Astro's
 * build-time image service. Local/imported assets retain Astro's transform;
 * if a remote runtime source cannot be transformed, keep its source URL.
 */
export async function getContentImage(
	image: unknown,
	width: number,
): Promise<ContentImageResult | undefined> {
	const cmsVariant = getPayloadImageVariant(image, width);
	if (cmsVariant) {
		return { src: cmsVariant, attributes: fallbackAttributes(width) };
	}

	try {
		const transformed = await getImage({
			src: image as string,
			width,
			format: "webp",
		});
		return {
			src: transformed.src,
			attributes: transformed.attributes,
		};
	} catch {
		const source =
			typeof image === "string"
				? image
				: image && typeof image === "object" && "src" in image
					? (image as { src?: unknown }).src
					: undefined;
		return typeof source === "string"
			? { src: source, attributes: fallbackAttributes(width) }
			: undefined;
	}
}
