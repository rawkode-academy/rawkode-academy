import type { APIRoute } from "astro";
import { getCollection, getEntry } from "@/lib/payload-content";

interface PayloadBinding {
	fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

interface RuntimeLocals {
	runtime?: {
		env?: {
			PAYLOAD_PREVIEW_PR?: string;
			PAYLOAD_PREVIEW_SHA?: string;
			PAYLOAD_CONTENT?: PayloadBinding;
		};
	};
}

export const prerender = false;

interface ScheduledVideoEvidence {
	id: string;
	slug: string;
	title: string;
	publishedAt: string;
}

interface D2SaveEvidence {
	articleSlug: string;
	articleId: string;
	articleStatus: "draft";
	sourceHash: string;
	svgChecksum: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function isScheduledVideoEvidence(value: unknown): value is ScheduledVideoEvidence {
	return (
		isRecord(value) &&
		typeof value.id === "string" &&
		typeof value.slug === "string" &&
		typeof value.title === "string" &&
		typeof value.publishedAt === "string"
	);
}

function isD2SaveEvidence(value: unknown): value is D2SaveEvidence {
	return (
		isRecord(value) &&
		typeof value.articleSlug === "string" &&
		typeof value.articleId === "string" &&
		value.articleStatus === "draft" &&
		typeof value.sourceHash === "string" &&
		/^[a-f0-9]{64}$/.test(value.sourceHash) &&
		typeof value.svgChecksum === "string" &&
		/^[a-f0-9]{64}$/.test(value.svgChecksum)
	);
}

export const POST: APIRoute = async ({ locals }) => {
	const env = (locals as typeof locals & RuntimeLocals).runtime?.env;
	if (!env?.PAYLOAD_PREVIEW_PR) {
		return new Response(null, {
			status: 404,
			headers: { "Cache-Control": "no-store" },
		});
	}

	try {
		if (!env.PAYLOAD_PREVIEW_SHA || !env.PAYLOAD_CONTENT) {
			throw new Error("The isolated Payload preview binding is unavailable.");
		}
		const readinessResponse = await env.PAYLOAD_CONTENT.fetch(
			new Request("https://payload-content.internal/v1/preview/readiness", {
				method: "POST",
				headers: {
					"cache-control": "no-store",
					"x-preview-pr": env.PAYLOAD_PREVIEW_PR,
					"x-preview-sha": env.PAYLOAD_PREVIEW_SHA,
				},
			}),
		);
		if (!readinessResponse.ok) {
			throw new Error("The isolated Payload preview readiness check failed.");
		}
		const readinessValue: unknown = await readinessResponse.json();
		if (!isRecord(readinessValue)) {
			throw new Error("The isolated Payload preview returned invalid readiness evidence.");
		}
		const scheduledVideo = readinessValue.scheduledVideo;
		const d2SaveCapability = readinessValue.d2SaveCapability;
		const d2Save = readinessValue.d2Save;
		if (
			!isScheduledVideoEvidence(scheduledVideo) ||
			(d2SaveCapability !== "available" &&
				d2SaveCapability !== "unavailable") ||
			(d2SaveCapability === "available" &&
				!isD2SaveEvidence(d2Save))
		) {
			throw new Error("The isolated Payload preview returned invalid readiness evidence.");
		}

		const [video] = await getCollection("videos", undefined, { limit: 1 });
		if (!video) {
			return new Response(JSON.stringify({ error: "No public video is available." }), {
				status: 503,
				headers: {
					"Content-Type": "application/json; charset=utf-8",
					"Cache-Control": "no-store",
				},
			});
		}
		let d2SaveEvidence:
			| {
					articleSlug: string;
					articleId: string;
					articleStatus: "draft";
					hiddenFromPublic: true;
					sourceHash: string;
					svgChecksum: string;
			  }
			| undefined;
		if (d2SaveCapability === "available") {
			if (!isD2SaveEvidence(d2Save)) {
				throw new Error("The Payload preview D2 save evidence is invalid.");
			}
			const draftArticle = await getEntry("articles", { slug: d2Save.articleSlug });
			if (draftArticle) {
				throw new Error("A Payload draft article is visible to the public bridge.");
			}
			d2SaveEvidence = {
				articleSlug: d2Save.articleSlug,
				articleId: d2Save.articleId,
				articleStatus: "draft",
				hiddenFromPublic: true,
				sourceHash: d2Save.sourceHash,
				svgChecksum: d2Save.svgChecksum,
			};
		}

		return new Response(
			JSON.stringify({
				video: { id: video.id, slug: video.slug, title: video.data.title },
				scheduledVideo,
				d2SaveCapability,
				...(d2SaveEvidence ? { d2Save: d2SaveEvidence } : {}),
			}),
			{
				headers: {
					"Content-Type": "application/json; charset=utf-8",
					"Cache-Control": "no-store",
				},
			},
		);
	} catch {
		return new Response(JSON.stringify({ error: "Payload bridge is unavailable." }), {
			status: 503,
			headers: {
				"Content-Type": "application/json; charset=utf-8",
				"Cache-Control": "no-store",
			},
		});
	}
};
