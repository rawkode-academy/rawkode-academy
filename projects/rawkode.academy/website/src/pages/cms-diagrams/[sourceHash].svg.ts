import type { APIRoute } from "astro";

interface PayloadBinding {
	fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

interface RuntimeLocals {
	runtime?: { env?: { PAYLOAD_CONTENT?: PayloadBinding } };
}

const SHA256 = /^[a-f0-9]{64}$/;

function noStore(status: number): Response {
	return new Response(null, {
		status,
		headers: {
			"Cache-Control": "no-store",
			"CDN-Cache-Control": "no-store",
			"X-Content-Type-Options": "nosniff",
		},
	});
}

export const GET: APIRoute = async ({ params, locals }) => {
	const sourceHash = params.sourceHash ?? "";
	if (!SHA256.test(sourceHash)) return noStore(404);
	const payload = (locals as typeof locals & RuntimeLocals).runtime?.env
		?.PAYLOAD_CONTENT;
	if (!payload) return noStore(503);

	let svg: Response;
	try {
		svg = await payload.fetch(
			new Request(
				`https://payload-content.internal/v1/diagrams/${sourceHash}.svg`,
			),
		);
	} catch {
		return noStore(502);
	}
	if (svg.status === 404) return noStore(404);
	if (!svg.ok || !svg.body) return noStore(502);

	const sourceChecksum = svg.headers.get("X-Source-Checksum");
	const svgChecksum =
		svg.headers.get("X-Content-Checksum") ??
		svg.headers.get("ETag")?.replace(/^W\//, "").replace(/^"|"$/g, "");
	if (
		sourceChecksum !== sourceHash ||
		!svgChecksum ||
		!SHA256.test(svgChecksum.toLowerCase()) ||
		svg.headers.get("Content-Type")?.split(";")[0]?.trim() !== "image/svg+xml"
	) {
		return noStore(502);
	}

	return new Response(svg.body, {
		headers: {
			"Content-Type": "image/svg+xml; charset=utf-8",
			"Cache-Control": "public, max-age=31536000, immutable",
			"CDN-Cache-Control": "public, max-age=31536000, immutable",
			"ETag": `"${svgChecksum.toLowerCase()}"`,
			"X-Source-Checksum": sourceHash,
			"X-Content-Checksum": svgChecksum.toLowerCase(),
			"Cache-Tag": `cms-diagram-${sourceHash}`,
			"X-Content-Type-Options": "nosniff",
			"Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
		},
	});
};
