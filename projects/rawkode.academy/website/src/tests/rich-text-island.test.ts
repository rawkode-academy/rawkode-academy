import { readFileSync } from "node:fs";
import { transform } from "@astrojs/compiler";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import * as runtime from "astro/runtime/server/index.js";
import ts from "typescript";
import { beforeAll, describe, expect, it } from "vitest";

type Component = Parameters<
	Awaited<ReturnType<typeof AstroContainer.create>>["renderToString"]
>[0];
let island: Component;
let container: Awaited<ReturnType<typeof AstroContainer.create>>;

const stub = () => () => null;

// Slot children of a client:only island are shipped inside <template> for
// the client to hydrate; only what sits outside it is visible without JS.
const visible = (html: string) =>
	html.replace(/<template[\s\S]*?<\/template>/g, "");

beforeAll(async () => {
	const file = "content/RichTextIsland.astro";
	const compiled = await transform(
		readFileSync(`src/components/${file}`, "utf8"),
		{ filename: file },
	);
	expect(compiled.diagnostics).toEqual([]);
	const code = ts.transpileModule(compiled.code, {
		compilerOptions: {
			module: ts.ModuleKind.CommonJS,
			target: ts.ScriptTarget.ES2022,
		},
	}).outputText;
	const dependencies: Record<string, unknown> = {
		"astro/runtime/server/index.js": {
			...runtime,
			createMetadata: () => ({ resolvePath: (p: string) => p }),
		},
		"react-medium-image-zoom": { default: stub() },
		"react-medium-image-zoom/dist/styles.css": {},
		"@/components/video/player.vue": { default: stub() },
		"@/components/articles/cgroups/CgroupTimeline": { default: stub() },
		"@/components/articles/cgroups/CgroupTreeDiagram": { default: stub() },
		"@/components/articles/cgroups/HierarchyExplorer": { default: stub() },
		"@/components/articles/cgroups/PodCgroupMapper": { default: stub() },
		"@/components/articles/cgroups/ResourceSimulator": { default: stub() },
		"@/lib/live-content/render/islands": {},
	};
	const exports: Record<string, Component> = {};
	new Function("require", "exports", code)((id: string) => {
		if (!(id in dependencies)) throw new Error(`Unexpected import: ${id}`);
		return dependencies[id];
	}, exports);
	island = exports.default!;
	container = await AstroContainer.create();
	// client:only never calls the server renderer; it only has to exist.
	for (const name of ["@astrojs/vue", "@astrojs/react"]) {
		container.addServerRenderer({
			name,
			renderer: {
				name,
				check: async () => false,
				renderToStaticMarkup: async () => ({ html: "" }),
			},
		});
		container.addClientRenderer({ name, entrypoint: `${name}/client.js` });
	}
});

describe("RichTextIsland client:only fallbacks", () => {
	it("server-renders the video thumbnail for no-JS visitors", async () => {
		const html = visible(
			await container.renderToString(island, {
				props: {
					component: "VideoPlayer",
					hydrate: "only",
					props: { video: "abc", thumbnailUrl: "https://example.com/t.jpg" },
					fallback:
						'<img src="https://example.com/t.jpg" alt="Video thumbnail">',
				},
			}),
		);
		expect(html).toContain("<astro-island");
		expect(html).toContain('alt="Video thumbnail"');
		expect(html).toContain('src="https://example.com/t.jpg"');
	});

	it("server-renders the zoomable image with its alt text", async () => {
		const html = visible(
			await container.renderToString(island, {
				props: {
					component: "ZoomableImage",
					hydrate: "only",
					props: { src: "/diagram.png", alt: "Cluster diagram" },
					fallback: '<img src="/diagram.png" alt="Cluster diagram">',
				},
			}),
		);
		expect(html).toContain("<astro-island");
		expect(html).toContain('alt="Cluster diagram"');
	});
});
