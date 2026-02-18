import cloudflare from "@astrojs/cloudflare";
import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import vue from "@astrojs/vue";
import faroUploader from "@grafana/faro-rollup-plugin";
import tailwindcss from "@tailwindcss/vite";
import d2 from "astro-d2";
import expressiveCode from "astro-expressive-code";
import { defineConfig, envField, fontProviders } from "astro/config";
import { execSync } from "node:child_process";
import { statSync, readFileSync } from "node:fs";
import { dirname, join, parse } from "node:path";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import rehypeExternalLinks from "rehype-external-links";

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

const disablePlatformProxy =
	process.env.VITEST === "true" ||
	process.env.DISABLE_CLOUDFLARE_PLATFORM_PROXY === "true";

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
		platformProxy: {
			enabled: !disablePlatformProxy,
		},
		routes: {
			extend: {
				include: [
					// Auth callback routes for OAuth
					{ pattern: "/auth/callback/*" },
				],
			},
		},
	}),
	trailingSlash: "never",
	integrations: [
		...(d2Available ? [d2()] : []),
		expressiveCode({
			themes: ["catppuccin-mocha", "catppuccin-latte"],
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
			tailwindcss(),
			...(process.env.NODE_ENV === "production" && process.env.GRAFANA_SOURCEMAP_API_KEY
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
		rehypePlugins: [
			[
				rehypeExternalLinks,
				{
					target: "_blank",
				},
			],
		],
	},
	experimental: {
		fonts: [
			{
				provider: fontProviders.google(),
				name: "Quicksand",
				cssVariable: "--font-quicksand",
				weights: ["400", "700"],
				styles: ["normal"],
			},
			{
				provider: fontProviders.google(),
				name: "Poppins",
				cssVariable: "--font-poppins",
				weights: ["400", "600"],
				styles: ["normal"],
			},
			{
				provider: fontProviders.fontsource(),
				name: "Monaspace Neon",
				cssVariable: "--font-monaspace-neon",
				weights: ["400"],
				styles: ["normal"],
			},
		],
	},
});
