import cloudflare from "@astrojs/cloudflare";
import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import vue from "@astrojs/vue";
import faroUploader from "@grafana/faro-rollup-plugin";
import unocss from "@unocss/astro";
import d2 from "astro-d2";
import expressiveCode from "astro-expressive-code";
import { defineConfig, envField, fontProviders } from "astro/config";
import { execSync } from "node:child_process";
import { statSync, readFileSync } from "node:fs";
import { dirname, join, parse } from "node:path";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import rehypeExternalLinks from "rehype-external-links";
import { loadTechLookup } from "./src/lib/load-tech-lookup";
import { remarkTechAutolink } from "./src/lib/remark-tech-autolink";

// Load CUE language grammar for syntax highlighting
let cueLanguageGrammar: import("shiki").LanguageRegistration | undefined;
try {
	const grammarPath = join(process.cwd(), "src/grammars/cue.tmLanguage.json");
	if (existsSync(grammarPath)) {
		cueLanguageGrammar = JSON.parse(
			readFileSync(grammarPath, "utf-8"),
		) as import("shiki").LanguageRegistration;
	}
} catch (e) {
	console.warn("Failed to load CUE grammar:", e);
}

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
import { webcontainerDemosPlugin } from "./src/utils/vite-plugin-webcontainer-demos";

type AstroUserConfig = Parameters<typeof defineConfig>[0];
type AstroVitePlugins = NonNullable<
	NonNullable<AstroUserConfig["vite"]>["plugins"]
>;

const asAstroVitePlugins = (plugins: unknown[]): AstroVitePlugins =>
	plugins as unknown as AstroVitePlugins;

// Check if D2 is available (used for diagram rendering)
let d2Available = false;
try {
	execSync("d2 --version", { stdio: "ignore" });
	d2Available = true;
} catch {
	console.warn("D2 not available, skipping diagram support");
}

const getSiteUrl = () => {
	if (import.meta.env.DEV === true) {
		return "http://localhost:4321";
	}

	if (import.meta.env.CF_PAGES_URL) {
		return import.meta.env.CF_PAGES_URL;
	}

	return "https://rawkode.academy";
};

// Resolve external content package directory for Vite FS allow (dev + build asset import)
let CONTENT_TECH_DIR: string | undefined;
try {
	const require = createRequire(import.meta.url);
	const pkgPath = require.resolve("@rawkodeacademy/content/package.json");
	const root = dirname(pkgPath);
	const data = join(root, "technologies");
	try {
		const s = statSync(data);
		CONTENT_TECH_DIR = s.isDirectory() ? data : root;
	} catch {
		CONTENT_TECH_DIR = root;
	}
} catch {}

export default defineConfig({
	output: "server",
	adapter: cloudflare({
		imageService: "cloudflare",
		sessionKVBindingName: "SESSION",
	}),
	trailingSlash: "never",
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
		// UnoCSS — Astro integration auto-discovers uno.config.ts and wires
		// the transformer pipeline through Vite for .astro, .vue, .tsx, and
		// scoped <style> blocks. `injectReset` opts into the Tailwind-equivalent
		// preflight reset so removing @import "tailwindcss" doesn't strip
		// base browser normalisation.
		unocss({ injectReset: true }),
		// Inline the SVG output so we don't depend on the generated file's
		// on-disk path. Our article MDX lives outside the website project (in
		// the sibling @rawkodeacademy/content package), and astro-d2 computes
		// its output path relative to file.cwd — that traversal escapes both
		// public/ and the URL base, leaving the <img src> pointing at a path
		// that never ships in dist. Inlining avoids the broken file reference.
		...(d2Available ? [d2({ inline: true })] : []),
		expressiveCode({
			// Code blocks are "screen within the page" surfaces: like the
			// --terminal-* tokens they stay dark in both colour schemes, so
			// shell frames, output blocks, and editor frames all read as the
			// same material instead of flipping between light and dark chrome.
			themes: ["catppuccin-mocha"],
			styleOverrides: {
				borderRadius: "var(--radius-sm)",
				borderColor: "var(--terminal-border)",
				borderWidth: "1px",
				codeBackground: "var(--terminal-bg)",
				codeFontFamily:
					"var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, Menlo, monospace",
				codeFontSize: "13px",
				codeLineHeight: "1.7",
				frames: {
					editorActiveTabBackground: "transparent",
					editorActiveTabBorderColor: "transparent",
					editorActiveTabIndicatorBottomColor: "transparent",
					editorActiveTabIndicatorTopColor: "var(--editorial-spruce)",
					editorBackground: "var(--terminal-bg)",
					editorTabBarBackground: "var(--terminal-surface)",
					editorTabBarBorderBottomColor: "var(--terminal-border)",
					frameBoxShadowCssValue: "none",
					terminalBackground: "var(--terminal-bg)",
					terminalTitlebarBackground: "var(--terminal-surface)",
					terminalTitlebarBorderBottomColor: "var(--terminal-border)",
					terminalTitlebarDotsForeground: "oklch(1 0 0 / 0.18)",
				},
			},
			...(cueLanguageGrammar && {
				shiki: {
					langs: [cueLanguageGrammar],
				},
			}),
		}),
		mdx(),
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
		optimizeDeps: {
			// Cloudflare's SSR module runner can lose the optimized `marked` bundle in
			// `.vite/deps_ssr`, so load it directly from node_modules in dev.
			exclude: ["marked"],
		},
		server: {
			fs: {
				// Keep Vite's default workspace root allow-list and add our external content dir.
				// Also allow the root node_modules for bun's .bun symlink structure.
				allow: [
					searchForWorkspaceRoot(process.cwd()),
					join(searchForWorkspaceRoot(process.cwd()), "node_modules"),
					...(CONTENT_TECH_DIR ? [CONTENT_TECH_DIR] : []),
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
			alias: import.meta.env.PROD
				? {
						"react-dom/server": "react-dom/server.edge",
					}
				: {},
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
		},
	},
	security: {
		checkOrigin: true,
	},
	markdown: {
		// Cast: the plugin returns a unified Plugin shape that's correct at
		// runtime, but our local mdast `Root` type doesn't structurally
		// match Astro's `RemarkPlugin` parameter constraint.
		remarkPlugins: [
			// biome-ignore lint/suspicious/noExplicitAny: see comment above
			remarkTechAutolink({ lookup: loadTechLookup() }) as any,
		],
		rehypePlugins: [
			[
				rehypeExternalLinks,
				{
					target: "_blank",
				},
			],
		],
	},
	fonts: [
		// Editorial trio — "engineering journal meets terminal":
		// Instrument Serif (display, italic) / Inter Tight (body) / JetBrains Mono (labels & metadata).
		{
			provider: fontProviders.google(),
			name: "Instrument Serif",
			cssVariable: "--font-instrument-serif",
			weights: ["400"],
			styles: ["normal", "italic"],
			display: "optional",
		},
		{
			provider: fontProviders.google(),
			name: "Inter Tight",
			cssVariable: "--font-inter-tight",
			weights: ["300", "400", "500", "600", "700"],
			styles: ["normal"],
			display: "optional",
		},
		{
			provider: fontProviders.google(),
			name: "JetBrains Mono",
			cssVariable: "--font-jetbrains-mono",
			weights: ["400", "500", "600"],
			styles: ["normal"],
			display: "optional",
		},
	],
});
