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

export const GET: APIRoute = async ({ request }) => {
	await Promise.all([initResvgWasm(), initYogaWasm(), loadTemplates()]);

	const searchParams = new URLSearchParams(new URL(request.url).search);

	const format = searchParams.get("format") || "svg";
	const title = searchParams.get("text") || "Hello, World!";
	const templateName = searchParams.get("template") || "default";

	const template = templates[templateName] ?? DEFAULT_TEMPLATE;

	const content = template.render(title);

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

	if (format === "svg") {
		return new Response(svg, {
			headers: {
				"Content-Type": "image/svg+xml",
				"Cache-Control": "public, immutable, no-transform, max-age=31536000",
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
			"Cache-Control": "public, immutable, no-transform, max-age=31536000",
		},
		status: 200,
	});
};
