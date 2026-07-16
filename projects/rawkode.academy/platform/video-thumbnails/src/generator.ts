import {
	THUMBNAIL_CACHE_CONTROL,
	THUMBNAIL_CONTENT_TYPE,
	THUMBNAIL_HEIGHT,
	THUMBNAIL_WIDTH,
	githubAvatarUrl,
	thumbnailKey,
	type ThumbnailGuest,
	type ThumbnailRenderParams,
	type ThumbnailShow,
	type ThumbnailWorkflowParams,
} from "./contracts";
import type { Env } from "./env";
import { renderVideoThumbnailHtml } from "./render";

export type Fetcher = (
	input: string | URL | Request,
	init?: RequestInit,
) => Promise<Response>;

export interface GenerateThumbnailDeps {
	fetch: Fetcher;
}

export interface GenerateThumbnailResult {
	key: string;
	size: number;
}

interface FluxImageResponse {
	image?: string;
}

const TEXT_TO_IMAGE_MODEL = "@cf/black-forest-labs/flux-2-klein-9b";
const GRAPHQL_ENDPOINT = "https://api.rawkode.academy";

const VIDEO_THUMBNAIL_DETAILS_QUERY = `
  query VideoThumbnailDetails($id: String!) {
    videoByID(id: $id) {
      id
      slug
      title
      description
      publishedAt
      terms
      episode {
        show {
          id
          name
          terms
        }
      }
      guests {
        id
        name
        terms
      }
    }
  }
`;

interface GraphQLResponse<T> {
	data?: T;
	errors?: Array<{ message?: string }>;
}

interface GraphQLVideoDetails {
	videoByID?: {
		id?: string | null;
		slug?: string | null;
		title?: string | null;
		description?: string | null;
		publishedAt?: string | null;
		terms?: string[] | null;
		episode?: {
			show?: {
				id?: string | null;
				name?: string | null;
				terms?: string[] | null;
			} | null;
		} | null;
		guests?: Array<{
			id?: string | null;
			name?: string | null;
			terms?: string[] | null;
		} | null> | null;
	} | null;
}

function mapGuest(guest: NonNullable<NonNullable<GraphQLVideoDetails["videoByID"]>["guests"]>[number]): ThumbnailGuest | null {
	if (!guest?.id || !guest.name) return null;

	return {
		id: guest.id,
		name: guest.name,
		github: guest.id,
		avatarUrl: githubAvatarUrl(guest.id),
	};
}

function mapShow(
	show: NonNullable<NonNullable<NonNullable<GraphQLVideoDetails["videoByID"]>["episode"]>["show"]> | null | undefined,
): ThumbnailShow | undefined {
	if (!show?.id || !show.name) return undefined;
	return {
		id: show.id,
		name: show.name,
		terms: show.terms ?? undefined,
	};
}

export async function fetchVideoThumbnailDetails(
	params: ThumbnailWorkflowParams,
	fetcher: Fetcher,
): Promise<ThumbnailRenderParams> {
	const response = await fetcher(GRAPHQL_ENDPOINT, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			query: VIDEO_THUMBNAIL_DETAILS_QUERY,
			variables: { id: params.videoId },
		}),
	});

	if (!response.ok) {
		throw new Error(
			`Failed to fetch video details for ${params.videoId}: ${response.status} ${response.statusText}`,
		);
	}

	const payload = (await response.json()) as GraphQLResponse<GraphQLVideoDetails>;
	if (payload.errors?.length) {
		throw new Error(
			`GraphQL failed to fetch video details for ${params.videoId}: ${payload.errors.map((error) => error.message ?? "unknown error").join("; ")}`,
		);
	}

	const video = payload.data?.videoByID;
	if (!video?.id || !video.slug || !video.title) {
		throw new Error(`GraphQL returned no usable video details for ${params.videoId}`);
	}

	return {
		video: {
			id: video.id,
			slug: video.slug,
			title: video.title,
			tagline: params.tagline,
			description: video.description ?? undefined,
			publishedAt: video.publishedAt ?? undefined,
		},
		technology: params.technology,
		guests: (video.guests ?? [])
			.map(mapGuest)
			.filter((guest): guest is ThumbnailGuest => guest !== null),
		show: mapShow(video.episode?.show),
		source: params.source,
	};
}

export function buildBackgroundPrompt(params: ThumbnailRenderParams): string {
	const technologyId = params.technology.id.toLowerCase();
	const technologyName = params.technology.name.toLowerCase();
	const visualMotif =
		technologyId.includes("iroh") || technologyName.includes("iroh")
			? "distributed peer network, encrypted connection arcs, packet trails, mesh topology, flowing data paths"
			: technologyId.includes("odin") || technologyName.includes("odin")
				? "systems programming, memory layout grids, compiler pipeline silhouettes, low-level runtime architecture, geometric data blocks"
				: technologyId.includes("kueue") || technologyName.includes("kueue")
					? "queued workload lanes, resource quota pools, admission gates, GPU cluster topology, fair-sharing flows"
					: "abstract software architecture, network topology, execution traces, data flow paths, geometric systems patterns";

	return [
		"Create a 16:9 abstract background-only image for a developer livestream thumbnail.",
		`Use this nonverbal visual motif only: ${visualMotif}.`,
		"Make it cinematic and technical with unlabeled flows, nodes, topology lines, traces, depth, and high-contrast lighting.",
		"Leave the center 460 by 360 pixel area intentionally dark, empty, and low-detail because a real technology logo will be placed there later.",
		"Put visual detail in the outer thirds and edges. Do not draw a central emblem, badge, icon, mark, sign, label, screen, dashboard, terminal, chart, or product identity.",
		"Palette: deep black and charcoal, with technology-colored highlights, cool cyan, and small white accents.",
		"Absolutely no readable or pseudo-readable typography: no letters, no words, no numbers, no captions, no labels, no code snippets, no terminal text, no dashboard text, no chart labels, no UI screenshots, no watermarks, no logos, no wordmarks, no icons, no product marks, and no human faces.",
		"The image must be only a clean background texture behind a semi-transparent black overlay.",
	].join(" ");
}

async function generateBackgroundImageDataUrl(
	env: Pick<Env, "AI">,
	params: ThumbnailRenderParams,
): Promise<string> {
	const form = new FormData();
	form.append("prompt", buildBackgroundPrompt(params));
	form.append("width", String(THUMBNAIL_WIDTH));
	form.append("height", String(THUMBNAIL_HEIGHT));

	const formResponse = new Response(form);
	const formStream = formResponse.body;
	const formContentType = formResponse.headers.get("content-type");

	if (!formStream || !formContentType) {
		throw new Error("Failed to serialize Workers AI multipart form");
	}

	const response = (await env.AI.run(TEXT_TO_IMAGE_MODEL, {
		multipart: {
			body: formStream,
			contentType: formContentType,
		},
	} as never)) as FluxImageResponse;

	if (!response.image) {
		throw new Error("Workers AI did not return a generated image");
	}

	return `data:image/png;base64,${response.image}`;
}

async function resolveTechnologyIconSvg(
	fetcher: Fetcher,
	params: ThumbnailRenderParams,
): Promise<string> {
	if (params.technology.iconSvg) return params.technology.iconSvg;
	if (!params.technology.iconUrl) {
		throw new Error(`Technology ${params.technology.id} has no iconSvg or iconUrl`);
	}

	const response = await fetcher(params.technology.iconUrl);
	if (!response.ok) {
		throw new Error(
			`Failed to fetch technology icon ${params.technology.iconUrl}: ${response.status} ${response.statusText}`,
		);
	}

	return response.text();
}

async function captureThumbnailWebp(
	env: Pick<Env, "BROWSER">,
	html: string,
): Promise<Uint8Array> {
	const response = await env.BROWSER.quickAction("screenshot", {
		html,
		viewport: {
			width: THUMBNAIL_WIDTH,
			height: THUMBNAIL_HEIGHT,
		},
		gotoOptions: {
			waitUntil: "networkidle0",
			timeout: 60_000,
		},
		waitForSelector: {
			selector: ".thumbnail",
			visible: true,
			timeout: 10_000,
		},
		screenshotOptions: {
			type: "webp",
			quality: 92,
			fullPage: false,
		},
		waitForTimeout: 500,
		cacheTTL: 0,
	});

	if (!response.ok) {
		throw new Error(
			`Browser Rendering screenshot failed: ${response.status} ${response.statusText} ${await response.text()}`,
		);
	}

	return new Uint8Array(await response.arrayBuffer());
}

export async function generateAndStoreThumbnail(
	env: Env,
	params: ThumbnailWorkflowParams,
	deps: GenerateThumbnailDeps = { fetch: globalThis.fetch },
): Promise<GenerateThumbnailResult> {
	const details = await fetchVideoThumbnailDetails(params, deps.fetch);
	const [backgroundImageDataUrl, technologyIconSvg] = await Promise.all([
		generateBackgroundImageDataUrl(env, details),
		resolveTechnologyIconSvg(deps.fetch, details),
	]);

	const html = renderVideoThumbnailHtml({
		params: details,
		backgroundImageDataUrl,
		technologyIconSvg,
	});
	const webp = await captureThumbnailWebp(env, html);
	const key = thumbnailKey(params.videoId);

	await env.CONTENT_BUCKET.put(key, webp, {
		httpMetadata: {
			contentType: THUMBNAIL_CONTENT_TYPE,
			cacheControl: THUMBNAIL_CACHE_CONTROL,
		},
		customMetadata: {
			source: params.source.trigger,
			commitSha: params.source.commitSha,
			technology: details.technology.id,
		},
	});

	return { key, size: webp.byteLength };
}

export async function thumbnailExists(
	env: Pick<Env, "CONTENT_BUCKET">,
	params: ThumbnailWorkflowParams,
): Promise<boolean> {
	if (params.force) return false;
	return (await env.CONTENT_BUCKET.head(thumbnailKey(params.videoId))) !== null;
}
