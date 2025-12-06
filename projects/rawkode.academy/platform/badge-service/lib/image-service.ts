import { encode } from "utf64";

export const DEFAULT_IMAGE_SERVICE_BASE_URL = "https://image.rawkode.academy";

export interface BadgeImageParams {
	title: string;
	subtitle?: string;
	template?: string;
	baseUrl?: string;
}

export function generateBadgeImageUrl(params: BadgeImageParams): string {
	const payload = {
		title: params.title,
		subtitle: params.subtitle,
		format: "svg",
		template: params.template ?? "gradient",
	};

	const baseUrl = params.baseUrl ?? DEFAULT_IMAGE_SERVICE_BASE_URL;
	const encodedPayload = encode(JSON.stringify(payload));
	return `${baseUrl}/image?payload=${encodedPayload}`;
}

export async function fetchBadgeImage(url: string): Promise<string> {
	try {
		const response = await fetch(url);

		if (!response.ok) {
			throw new Error(`Image service returned status ${response.status}`);
		}

		return await response.text();
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Unknown error occurred";
		console.error(`Failed to fetch badge image: ${message}`);
		return createFallbackSvg();
	}
}

function createFallbackSvg(): string {
	return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
		<rect width="256" height="256" fill="#4A90A4"/>
		<text x="128" y="128" text-anchor="middle" fill="white" font-size="24">Badge</text>
	</svg>`;
}
