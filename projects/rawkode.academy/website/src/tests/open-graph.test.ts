import { describe, expect, it } from "vitest";
import {
	decodeImageServicePayload,
	IMAGE_SERVICE_TEMPLATE_VERSION,
} from "@/lib/image-service-payload";
import {
	OPEN_GRAPH_IMAGE_HEIGHT,
	OPEN_GRAPH_IMAGE_WIDTH,
	resolveOpenGraphImage,
} from "@/lib/open-graph";

const payloadFromUrl = (url: string) => {
	const payload = new URL(url).searchParams.get("payload");
	if (!payload) {
		throw new Error("Missing image payload");
	}

	return decodeImageServicePayload(payload);
};

describe("resolveOpenGraphImage", () => {
	it("generates a large share card when no image is provided", () => {
		const image = resolveOpenGraphImage({
			title: "Latest Articles",
			description: "Articles and tutorials.",
			pageUrl: new URL("https://rawkode.academy/read"),
		});

		expect(image.url).toContain("https://image.rawkode.academy/image?");
		expect(new URL(image.url).searchParams.get("payload")).toBeTruthy();
		expect(new URL(image.url).searchParams.get("v")).toBe(
			IMAGE_SERVICE_TEMPLATE_VERSION,
		);
		expect(image.type).toBe("image/png");
		expect(image.width).toBe(OPEN_GRAPH_IMAGE_WIDTH);
		expect(image.height).toBe(OPEN_GRAPH_IMAGE_HEIGHT);
		expect(image.alt).toBe("Latest Articles");

		expect(payloadFromUrl(image.url)).toMatchObject({
			title: "Latest Articles",
			text: "Articles and tutorials.",
			format: "png",
			template: "gradient",
		});
	});

	it("keeps direct images absolute when requested", () => {
		const image = resolveOpenGraphImage({
			title: "Hands-on Introduction to sympozium",
			image: {
				image: new URL("/images/video.jpg", "https://rawkode.academy/watch"),
			},
			pageUrl: new URL("https://rawkode.academy/watch"),
			useImageDirectly: true,
		});

		expect(image).toEqual({
			url: "https://rawkode.academy/images/video.jpg",
			alt: "Hands-on Introduction to sympozium",
		});
	});

	it("normalizes URL image values before payload encoding", () => {
		const image = resolveOpenGraphImage({
			title: "Hands-on Introduction to sympozium",
			image: {
				image: new URL("/images/video.jpg", "https://rawkode.academy/watch"),
			},
			pageUrl: new URL("https://rawkode.academy/watch"),
		});

		expect(payloadFromUrl(image.url)).toMatchObject({
			image: "https://rawkode.academy/images/video.jpg",
		});
	});
});
