export interface Env {
	CONTENT_BUCKET: R2Bucket;
}

const ROBOTS_TXT = `User-agent: *
Disallow: /
`;

const NOINDEX = "noindex";
const CORS_HEADERS: Record<string, string> = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type, Range",
	"Access-Control-Expose-Headers":
		"Content-Length, Content-Range, Accept-Ranges, ETag",
};

function applyCors(headers: Headers): void {
	for (const [key, value] of Object.entries(CORS_HEADERS)) {
		headers.set(key, value);
	}
}

function parseRange(header: string | null): R2Range | undefined {
	if (!header) return undefined;
	const match = /^bytes=(\d+)-(\d*)$/.exec(header);
	if (!match) return undefined;
	const start = Number(match[1]);
	const end = match[2] === "" ? undefined : Number(match[2]);
	if (Number.isNaN(start) || (end !== undefined && Number.isNaN(end))) {
		return undefined;
	}
	return end === undefined
		? { offset: start }
		: { offset: start, length: end - start + 1 };
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === "/robots.txt") {
			return new Response(ROBOTS_TXT, {
				headers: {
					"Content-Type": "text/plain; charset=utf-8",
					"Cache-Control": "public, max-age=3600",
					"X-Robots-Tag": NOINDEX,
				},
			});
		}

		if (request.method === "OPTIONS") {
			const headers = new Headers();
			applyCors(headers);
			return new Response(null, { status: 204, headers });
		}

		if (request.method !== "GET" && request.method !== "HEAD") {
			return new Response("Method Not Allowed", { status: 405 });
		}

		const key = decodeURIComponent(url.pathname.replace(/^\//, ""));
		if (!key) {
			return new Response("Not Found", { status: 404 });
		}

		const range = parseRange(request.headers.get("range"));
		const object = range
			? await env.CONTENT_BUCKET.get(key, { range })
			: await env.CONTENT_BUCKET.get(key);

		if (!object) {
			return new Response("Not Found", { status: 404 });
		}

		const headers = new Headers();
		object.writeHttpMetadata(headers);
		headers.set("ETag", object.httpEtag);
		headers.set("Accept-Ranges", "bytes");
		headers.set("X-Robots-Tag", NOINDEX);
		applyCors(headers);

		if (range) {
			const start = typeof range.offset === "number" ? range.offset : 0;
			const length =
				typeof range.length === "number"
					? range.length
					: object.size - start;
			const end = start + length - 1;
			headers.set("Content-Range", `bytes ${start}-${end}/${object.size}`);
			headers.set("Content-Length", String(length));
			return new Response(request.method === "HEAD" ? null : object.body, {
				status: 206,
				headers,
			});
		}

		headers.set("Content-Length", String(object.size));
		return new Response(request.method === "HEAD" ? null : object.body, {
			status: 200,
			headers,
		});
	},
};
