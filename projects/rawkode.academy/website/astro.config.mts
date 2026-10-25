import cloudflare from "@astrojs/cloudflare";
import { cacheCloudflare } from "@astrojs/cloudflare/cache";
import react from "@astrojs/react";
import vue from "@astrojs/vue";
import faroUploader from "@grafana/faro-rollup-plugin";
import { defineConfig, envField, fontProviders } from "astro/config";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, parse } from "node:path";
import { fileURLToPath } from "node:url";

// Local implementation of searchForWorkspaceRoot to avoid direct vite import
function searchForWorkspaceRoot(current: string): string {
	const root = parse(current).root;
	const lockFiles = [
		"bun.lock",
		"pnpm-lock.yaml",
		"package-lock.json",
		"yarn.lock",
	];
	let dir = current;
	while (dir !== root) {
		for (const lockFile of lockFiles) {
			if (existsSync(join(dir, lockFile))) {
				return dir;
			}
		}
		// Check for package.json with workspaces
		const pkgPath = join(dir, "package.json");
		if (existsSync(pkgPath)) {
			try {
				const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
				if (pkg.workspaces) {
					return dir;
				}
			} catch {}
		}
		dir = dirname(dir);
	}
	return current;
}
import { vite as vidstackPlugin } from "vidstack/plugins";
import { renderOnlyActionsPlugin } from "./src/utils/vite-plugin-render-only-actions";
import { webcontainerDemosPlugin } from "./src/utils/vite-plugin-webcontainer-demos";

const localPath = (path: string) =>
	fileURLToPath(new URL(path, import.meta.url));

type AstroUserConfig = Parameters<typeof defineConfig>[0];
type AstroVitePlugins = NonNullable<
	NonNullable<AstroUserConfig["vite"]>["plugins"]
>;

const asAstroVitePlugins = (plugins: unknown[]): AstroVitePlugins =>
	plugins as unknown as AstroVitePlugins;

const getSiteUrl = () => {
	if (import.meta.env.DEV === true) {
		return "http://localhost:4321";
	}

	if (import.meta.env.CF_PAGES_URL) {
		return import.meta.env.CF_PAGES_URL;
	}

	return "https://rawkode.academy";
};

export default defineConfig({
	output: "server",
	adapter: cloudflare({
		// Cloudflare's runtime transform endpoint is not available on every
		// Pages preview. Compile local assets into the deployment so content
		// cards never render a broken image when the transform is unavailable.
		imageService: "compile",
		sessionKVBindingName: "SESSION",
		// Use an ephemeral inspector in local dev where network-interface discovery is unavailable.
		inspectorPort: 0,
	}),
	// Content pages are rendered on demand from the API gateway and cached
	// at the edge. Pages call Astro.cache.set() (see src/lib/live-content/cache-control.ts)
	// with tags that POST /api/cache/invalidate and the hourly cron purge.
	cache: {
		provider: cacheCloudflare(),
	},
	// Astro 7 defaults to JSX whitespace rules; keep v6's HTML-aware
	// compression so inline elements keep their separating spaces.
	compressHTML: true,
	trailingSlash: "never",
	image: {
		// Content images (covers, logos, avatars) come from the content CDN.
		domains: ["content.rawkode.academy"],
	},
	// Speculatively fetch internal links as they enter the viewport so
	// MPA navigation feels instant on the homepage → watch/read paths.
	prefetch: {
		prefetchAll: true,
		defaultStrategy: "viewport",
	},
	build: {
		// PSI flagged ~620 ms of render-blocking CSS on the homepage. Inlining
		// every stylesheet pulls them out of the critical request chain at the
		// cost of a larger HTML payload per request. For a cache-cold visitor
		// (the PSI run target) this is a net win for FCP/LCP.
		inlineStylesheets: "always",
	},
	integrations: [
		react({ experimentalReactChildren: true }),
		vue({
			template: {
				compilerOptions: {
					isCustomElement: (tag) => tag.startsWith("media-"),
				},
			},
		}),
	],
	vite: {
		plugins: asAstroVitePlugins([
			renderOnlyActionsPlugin(),
			webcontainerDemosPlugin(),
			vidstackPlugin({ include: /components\/video\// }),
			...(process.env.NODE_ENV === "production" &&
			process.env.GRAFANA_SOURCEMAP_API_KEY
				? [
						faroUploader({
							appName: "rawkode.academy",
							endpoint:
								"https://faro-api-prod-gb-south-1.grafana.net/faro/api/v1",
							appId: "378",
							stackId: "1457812",
							apiKey: process.env.GRAFANA_SOURCEMAP_API_KEY,
							gzipContents: true,
							keepSourcemaps: false,
							verbose: true,
						}),
					]
				: []),
		]),
		server: {
			fs: {
				// Keep Vite's default workspace root allow-list.
				// Also allow the root node_modules for bun's .bun symlink structure.
				allow: [
					searchForWorkspaceRoot(process.cwd()),
					join(searchForWorkspaceRoot(process.cwd()), "node_modules"),
				],
			},
		},
		build: {
			sourcemap: true,
		},
		resolve: {
			// Bun's workspace setup can install duplicate React copies (e.g.
			// ^19.2.4 + ^19.2.6) under node_modules/.bun. When Vite's
			// optimizeDeps pulls in a transitive dep that resolves a *different*
			// React from the one the page entry uses, hook calls throw
			// `Cannot read properties of null (reading 'useState')` because
			// React's internal dispatcher is wired to the other copy. Force
			// dedupe so every importer sees one React instance.
			dedupe: ["react", "react-dom"],
			// Use react-dom/server.edge instead of react-dom/server.browser for React 19.
			// Without this, MessageChannel from node:worker_threads needs to be polyfilled.
			// https://github.com/withastro/adapters/pull/436
			alias: [
				...(import.meta.env.PROD
					? [
							{
								find: /^react-dom\/server$/,
								replacement: "react-dom/server.edge",
							},
						]
					: []),
				// Expressive Code's Shiki plugin imports every grammar and theme
				// and the Oniguruma WebAssembly blob; the Worker only needs the
				// site's languages, one theme and the JavaScript regex engine.
				{
					find: /^shiki\/langs$/,
					replacement: localPath(
						"./src/lib/live-content/render/shiki-langs.ts",
					),
				},
				{
					find: /^shiki\/themes$/,
					replacement: localPath(
						"./src/lib/live-content/render/shiki-themes.ts",
					),
				},
				{
					find: /^shiki\/wasm$/,
					replacement: localPath(
						"./src/lib/live-content/render/shiki-wasm-stub.ts",
					),
				},
			],
		},
		ssr: {
			external: [
				"node:process",
				"node:fs/promises",
				"node:path",
				"node:url",
				"node:crypto",
				"node:worker_threads",
			],
		},
	},
	site: getSiteUrl(),
	env: {
		validateSecrets: true,
		schema: {
			DISCORD_INVITE_URL: envField.string({
				context: "server",
				access: "public",
				default: "https://discord.gg/rawkode",
			}),
			GRAPHQL_ENDPOINT: envField.string({
				context: "server",
				access: "public",
				default: process.env.GRAPHQL_ENDPOINT || "https://api.rawkode.academy/",
			}),
			DISABLE_GAME_AUTH: envField.string({
				context: "server",
				access: "public",
				optional: true,
			}),
			PUBLIC_CAPTURE_ERRORS: envField.string({
				context: "server",
				access: "public",
				default: "true",
			}),
			ATTIO_API_KEY: envField.string({
				context: "server",
				access: "secret",
				optional: true,
			}),
			ATTIO_INBOUND_DEAL_STAGE: envField.string({
				context: "server",
				access: "public",
				default: "In Progress",
			}),
			ATTIO_INBOUND_DEAL_OFFER_ATTRIBUTE: envField.string({
				context: "server",
				access: "public",
				default: "offer",
			}),
			ATTIO_SOURCE_ATTRIBUTE: envField.string({
				context: "server",
				access: "public",
				default: "source",
			}),
			ATTIO_SOURCE_VALUE: envField.string({
				context: "server",
				access: "public",
				default: "Inbound: partnerships page",
			}),
		},
	},
	security: {
		checkOrigin: true,
	},
	fonts: [
		// One type system across every route. Display and text are preloaded
		// by the document head; code and metadata load mono on demand.
		{
			provider: fontProviders.google(),
			name: "Red Hat Display",
			cssVariable: "--font-red-hat-display",
			weights: ["500", "600", "700", "800", "900"],
			styles: ["normal"],
			display: "swap",
		},
		{
			provider: fontProviders.google(),
			name: "Red Hat Text",
			cssVariable: "--font-red-hat-text",
			weights: ["400", "500", "600", "700"],
			// Prose emphasis needs a true italic; the display and mono faces
			// never render italic, so they stay upright-only.
			styles: ["normal", "italic"],
			display: "swap",
		},
		{
			provider: fontProviders.google(),
			name: "Red Hat Mono",
			cssVariable: "--font-red-hat-mono",
			weights: ["400", "500", "600", "700"],
			styles: ["normal"],
			display: "swap",
		},
	],
});
