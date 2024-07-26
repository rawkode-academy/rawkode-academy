// @ts-expect-error .wasm files are not typed
import yogaWasm from "@/wasm/yoga.wasm";
// @ts-expect-error .wasm files are not typed
import resvgWasm from "@/wasm/resvg.wasm";
import { initWasm, Resvg } from "@resvg/resvg-wasm";
import initYoga from "yoga-wasm-web";
import satori, { init } from "satori/wasm";
import type { APIRoute } from "astro";
import { loadGoogleFont } from "@/lib/fonts";
import { DEFAULT_TEMPLATE, type Template } from "@/lib/template";
import * as utf64 from "utf64";

// Code is mostly taken from https://github.com/kvnang/workers-og

const initResvgWasm = async () => {
	try {
		await initWasm(resvgWasm as WebAssembly.Module);
	} catch (err) {
		if (err instanceof Error && err.message.includes("Already initialized")) {
			return;
		}
		throw err;
	}
};

const initYogaWasm = async () => {
	const yoga = await initYoga(yogaWasm);
	init(yoga);
};

const templateModules = import.meta.glob<{ template: Template }>(
	"/src/templates/*.ts",
	{ eager: true }
);

const templates: { [name: string]: Template } = {};

const loadTemplates = async () => {
	// only load templates once
	if (Object.keys(templates).length === 0) {
		for (const [path, module] of Object.entries(templateModules)) {
			const match = path.match(/\/([^\/]+)\.ts$/);

			if (match) {
				const name = match[1];

				if (name && module.template) {
					templates[name] = module.template;
				}
			}
		}
	}
};

interface Payload {
	format: "svg" | "png";
	text: string;
	template: string;
}

const DEFAULT_PAYLOAD: Payload = {
	format: "svg",
	text: "Hello, World!",
	template: "default",
};

// Use https://github.com/more-please/more-stuff/tree/main/utf64 to decode the string
const getPayloadFromSearchParams = (searchParams: URLSearchParams): Payload => {
	const payloadFromSearchParams = searchParams.get("payload");

	if (payloadFromSearchParams !== null) {
		const decodedPayload = utf64.decode(payloadFromSearchParams);

		try {
			const payload: Partial<Payload> = JSON.parse(decodedPayload);

			return {
				format: payload.format ?? "svg",
				text: payload.text ?? "Hello, World!",
				template: payload.template ?? "default",
			};
		} catch (error) {
			return DEFAULT_PAYLOAD;
		}
	}

	return DEFAULT_PAYLOAD;
};

// cache for one day
// When changing to higher caching times, consider adding "immutable, no-transform"

const CACHE_CONTROL = "public, max-age=86400";

export const GET: APIRoute = async ({ request }) => {
	await Promise.all([initResvgWasm(), initYogaWasm(), loadTemplates()]);

	const searchParams = new URLSearchParams(new URL(request.url).search);
	const payload = getPayloadFromSearchParams(searchParams);

	const template = templates[payload.template] ?? DEFAULT_TEMPLATE;
	const content = template.render(payload.text);

	const svg = await satori(content, {
		width: 1200,
		height: 630,
		fonts: [
			{
				name: template.font.name,
				data: await loadGoogleFont({
					family: template.font.name,
					weight: template.font.weight,
				}),
				weight: template.font.weight,
				style: template.font.style,
			},
		],
	});

	if (payload.format === "svg") {
		return new Response(svg, {
			headers: {
				"Content-Type": "image/svg+xml",
				"Cache-Control": CACHE_CONTROL,
			},
			status: 200,
		});
	}

	const resvg = new Resvg(svg, {
		fitTo: {
			mode: "width",
			value: 1200,
		},
	});

	const pngData = resvg.render();
	const pngBuffer = pngData.asPng();

	const body = new ReadableStream({
		async start(controller) {
			controller.enqueue(pngBuffer);
			controller.close();
		},
	});

	return new Response(body, {
		headers: {
			"Content-Type": "image/png",
			"Cache-Control": CACHE_CONTROL,
		},
		status: 200,
	});
};
