export const DEFAULT_IMAGE_SERVICE_BASE_URL = "https://image.rawkode.academy";

export interface BadgeImageParams {
	title: string;
	subtitle?: string;
	template?: string;
	baseUrl?: string;
}

export interface BadgeImage {
	body: ReadableStream<Uint8Array> | string;
	contentType: string;
}

const encodePayload = (payload: unknown): string => {
	const bytes = new TextEncoder().encode(JSON.stringify(payload));
	let binary = "";

	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}

	return btoa(binary)
		.replaceAll("+", "-")
		.replaceAll("/", "_")
		.replace(/=+$/u, "");
};

export function generateBadgeImageUrl(params: BadgeImageParams): string {
	const payload = {
		title: params.title,
		subtitle: params.subtitle,
		format: "png",
		template: params.template ?? "gradient",
	};

	const baseUrl = params.baseUrl ?? DEFAULT_IMAGE_SERVICE_BASE_URL;
	const encodedPayload = encodePayload(payload);
	return `${baseUrl}/image?payload=${encodedPayload}`;
}

export async function fetchBadgeImage(url: string): Promise<BadgeImage> {
	try {
		const response = await fetch(url);

		if (!response.ok) {
			throw new Error(`Image service returned status ${response.status}`);
		}

		const contentType = response.headers.get("Content-Type") ?? "image/png";
		if (!contentType.toLowerCase().startsWith("image/")) {
			throw new Error(`Image service returned unsupported ${contentType}`);
		}

		if (!response.body) {
			throw new Error("Image service returned an empty response body");
		}

		return {
			body: response.body,
			contentType,
		};
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Unknown error occurred";
		console.error(`Failed to fetch badge image: ${message}`);
		return {
			body: createFallbackSvg(),
			contentType: "image/svg+xml",
		};
	}
}

function createFallbackSvg(): string {
	return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
		<rect width="256" height="256" fill="#4A90A4"/>
		<text x="128" y="128" text-anchor="middle" fill="white" font-size="24">Badge</text>
	</svg>`;
}
