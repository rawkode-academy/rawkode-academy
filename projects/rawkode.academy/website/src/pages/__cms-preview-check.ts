import type { APIRoute } from "astro";
import { getCollection } from "@/lib/payload-content";

interface RuntimeLocals {
	runtime?: { env?: { PAYLOAD_PREVIEW_PR?: string } };
}

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
	const env = (locals as typeof locals & RuntimeLocals).runtime?.env;
	if (!env?.PAYLOAD_PREVIEW_PR) {
		return new Response(null, {
			status: 404,
			headers: { "Cache-Control": "no-store" },
		});
	}

	try {
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

		return new Response(
			JSON.stringify({ id: video.id, slug: video.slug, title: video.data.title }),
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
