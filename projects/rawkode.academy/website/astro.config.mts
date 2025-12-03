import cloudflare from "@astrojs/cloudflare";
import mdx from "@astrojs/mdx";
import partytown from "@astrojs/partytown";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import vue from "@astrojs/vue";
import faroUploader from "@grafana/faro-rollup-plugin";
import tailwindcss from "@tailwindcss/vite";
import d2 from "astro-d2";
import expressiveCode from "astro-expressive-code";
import { defineConfig, envField, fontProviders } from "astro/config";
import matter from "gray-matter";
import { readFile, stat } from "node:fs/promises";
import { execSync } from "node:child_process";
import { statSync, readFileSync } from "node:fs";
import { dirname, join, parse } from "node:path";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { glob } from "glob";
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
import { deriveSlugFromFile } from "./src/utils/content-slug";

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

// Build a per-path lastmod index from content files and GraphQL videos.
// Keys are URL pathnames (no trailing slash), e.g. "/read/my-article".
async function buildLastmodIndex() {
	const index = new Map<string, Date>();

	function pickDate(data: Record<string, any>): Date | undefined {
		const u = data.updatedAt || data.updated_at;
		const p = data.publishedAt || data.published_at;
		const val = u || p;
		if (!val) return undefined;
		const d = new Date(val);
		return isNaN(d.getTime()) ? undefined : d;
	}

	// Articles -> /read/{id}
	const articleFiles = await glob("content/articles/**/*.{md,mdx}");
	for (const file of articleFiles) {
		try {
			const raw = await readFile(file, "utf8");
			const fm = matter(raw).data as Record<string, any>;
			const rel = file.replace(/^content\/articles\//, "");
			const id = rel
				.replace(/\/index\.(md|mdx)$/i, "")
				.replace(/\.(md|mdx)$/i, "");
			const last = pickDate(fm) ?? (await stat(file)).mtime;
			index.set(`/read/${id}`, last);
		} catch {}
	}

	// Courses (top-level) -> /courses/{id}
	const courseFiles = await glob("content/courses/*.{md,mdx}");
	for (const file of courseFiles) {
		try {
			const raw = await readFile(file, "utf8");
			const fm = matter(raw).data as Record<string, any>;
			const base = file.split("/").pop() || "";
			const id = base.replace(/\.(md|mdx)$/i, "");
			const last = pickDate(fm) ?? (await stat(file)).mtime;
			index.set(`/courses/${id}`, last);
		} catch {}
	}

	// Course modules -> /courses/{courseId}/{moduleId}
	const moduleFiles = await glob("content/courses/**/*.{md,mdx}");
	for (const file of moduleFiles) {
		// Skip top-level course files handled above
		if (/^content\/courses\/[^\/]+\.(md|mdx)$/i.test(file)) continue;
		try {
			const raw = await readFile(file, "utf8");
			const fm = matter(raw).data as Record<string, any>;
			const rel = file
				.replace(/^content\/courses\//, "")
				.replace(/\.(md|mdx)$/i, "");
			const courseId = rel.split("/")[0];
			const last = pickDate(fm) ?? (await stat(file)).mtime;
			// Route shape is /courses/{course}/{moduleId}
			index.set(`/courses/${courseId}/${rel}`, last);
		} catch {}
	}

	// Series -> /series/{id}
	const seriesFiles = await glob("content/series/**/*.{md,mdx}");
	for (const file of seriesFiles) {
		try {
			const raw = await readFile(file, "utf8");
			const fm = matter(raw).data as Record<string, any>;
			const rel = file.replace(/^content\/series\//, "");
			const id = rel
				.replace(/\/index\.(md|mdx)$/i, "")
				.replace(/\.(md|mdx)$/i, "");
			const last = pickDate(fm) ?? (await stat(file)).mtime;
			index.set(`/series/${id}`, last);
		} catch {}
	}

	// Technologies -> /technology/{id}
	// MD/MDX only (content lives in workspace package under data/)
	let techFiles: string[] = [];
	let techBaseDir: string | undefined;
	try {
		const require = createRequire(import.meta.url);
		const pkgPath = require.resolve("@rawkodeacademy/content/package.json");
		const root = dirname(pkgPath);
		const data = join(root, "technologies");
		try {
			const s = await stat(data);
			techBaseDir = s.isDirectory() ? data : root;
		} catch {
			techBaseDir = root;
		}
		techFiles = await glob("**/*.{md,mdx}", {
			cwd: techBaseDir,
			absolute: true,
		});
	} catch (err) {
		console.error("Failed to resolve @rawkodeacademy/content package:", err);
		// Don't fallback to local directories - workspace package is the only source
	}
	for (const file of techFiles) {
		try {
			const rel = techBaseDir ? file.slice(techBaseDir.length + 1) : file;
			const id = rel
				.replace(/\/index\.(md|mdx)$/i, "")
				.replace(/\.(md|mdx)$/i, "");
			const last = (await stat(file)).mtime;
			index.set(`/technology/${id}`, last);
		} catch {}
	}

	// Videos (from local content) -> /watch/{slug}
	const videoFiles = await glob("content/videos/**/*.{md,mdx}");
	for (const file of videoFiles) {
		try {
			const raw = await readFile(file, "utf8");
			const fm = matter(raw).data as Record<string, any>;
			const slug = deriveSlugFromFile(file, fm, "content/videos/");
			const published = fm.publishedAt ? new Date(fm.publishedAt) : undefined;
			const last =
				published && !isNaN(published.getTime()) ? published : undefined;
			if (last) index.set(`/watch/${slug}`, last);
		} catch {}
	}

	return index;
}

// Compute lastmod index once for sitemap serialization
const lastmodIndex = await buildLastmodIndex();

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
				// Better Auth callback route
				include: [
					{ pattern: "/sign-in" },
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
		sitemap({
			filter: (page) => !page.includes("api/") && !page.includes("sitemap-"),
			changefreq: "weekly",
			priority: 0.7,
			customPages: await (async () => {
				const siteUrl = getSiteUrl();
				const videoFiles = await glob("content/videos/**/*.{md,mdx}");
				const slugs: string[] = [];
				for (const file of videoFiles) {
					try {
						const raw = await readFile(file, "utf8");
						const fm = matter(raw).data as Record<string, any>;
						const slug = deriveSlugFromFile(file, fm, "content/videos/");
						if (slug) slugs.push(slug);
					} catch {}
				}
				// Use no-trailing slash to match canonical policy
				return slugs.map((s) => `${siteUrl}/watch/${s}`);
			})(),
			serialize: (item) => {
				try {
					const u = new URL(item.url);
					const key =
						u.pathname.endsWith("/") && u.pathname !== "/"
							? u.pathname.slice(0, -1)
							: u.pathname;
					const lm = lastmodIndex.get(key);
					if (lm) {
						return { ...item, lastmod: lm.toISOString() };
					}
				} catch {}
				return item;
			},
		}),
		vue({
			template: {
				compilerOptions: {
					isCustomElement: (tag) => tag.startsWith("media-"),
				},
			},
		}),
		partytown({
			config: {
				forward: [],
				lib: "/_partytown/",
				// Prevent service worker registration attempts from Partytown
				mainWindowAccessors: ["navigator.serviceWorker"],
				resolveUrl: (url) => {
					// Allow all URLs except service worker registrations
					if (
						url.pathname.includes("sw.js") ||
						url.pathname.includes("service-worker")
					) {
						return null;
					}
					return url;
				},
			},
		}),
	],
	vite: {
		plugins: asAstroVitePlugins([
			webcontainerDemosPlugin(),
			vidstackPlugin({ include: /components\/video\// }),
			tailwindcss(),
			// Faro sourcemap upload - only in production builds with API key
			...(process.env.GRAFANA_SOURCEMAP_API_KEY
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
			PUBLIC_GRAFANA_FARO_URL: envField.string({
				context: "client",
				access: "public",
				optional: true,
			}),
			PUBLIC_GRAFANA_FARO_APP_NAME: envField.string({
				context: "client",
				access: "public",
				default: "rawkode-academy-website",
			}),
			ZULIP_URL: envField.string({
				context: "server",
				access: "public",
				default: "https://chat.rawkode.academy",
			}),
			ZULIP_EMAIL: envField.string({
				context: "server",
				access: "public",
				default: "rocko-bot@chat.rawkode.academy",
			}),
			ZULIP_API_KEY: envField.string({
				context: "server",
				access: "secret",
				optional: true,
			}),
			GRAPHQL_ENDPOINT: envField.string({
				context: "server",
				access: "public",
				default: process.env.GRAPHQL_ENDPOINT || "https://api.rawkode.academy/",
			}),
			PUBLIC_CAPTURE_ERRORS: envField.string({
				context: "server",
				access: "public",
				default: "true",
			}),
			// Grafana Faro sourcemap upload API key (build-time only)
			GRAFANA_SOURCEMAP_API_KEY: envField.string({
				context: "server",
				access: "secret",
				optional: true,
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
