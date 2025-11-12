import cloudflare from "@astrojs/cloudflare";
import mdx from "@astrojs/mdx";
import partytown from "@astrojs/partytown";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import vue from "@astrojs/vue";
import tailwindcss from "@tailwindcss/vite";
import d2 from "astro-d2";
import expressiveCode from "astro-expressive-code";
import { defineConfig, envField, fontProviders } from "astro/config";
import matter from "gray-matter";
import { readFile, stat } from "node:fs/promises";
import { execSync } from "node:child_process";
import { statSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { glob } from "glob";
import { searchForWorkspaceRoot } from "vite";
import rehypeExternalLinks from "rehype-external-links";
import { vite as vidstackPlugin } from "vidstack/plugins";
import { webcontainerDemosPlugin } from "./src/utils/vite-plugin-webcontainer-demos";
import { deriveSlugFromFile } from "./src/utils/content-slug";

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
      const id = rel.replace(/\/index\.(md|mdx)$/i, "").replace(/\.(md|mdx)$/i, "");
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
      const rel = file.replace(/^content\/courses\//, "").replace(/\.(md|mdx)$/i, "");
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
      const id = rel.replace(/\/index\.(md|mdx)$/i, "").replace(/\.(md|mdx)$/i, "");
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
    const pkgPath = require.resolve("@rawkodeacademy/content-technologies/package.json");
    const root = dirname(pkgPath);
    const data = join(root, "data");
    try {
      const s = await stat(data);
      techBaseDir = s.isDirectory() ? data : root;
    } catch {
      techBaseDir = root;
    }
    techFiles = await glob("**/*.{md,mdx}", { cwd: techBaseDir, absolute: true });
  } catch {
    // Fallback: look in common relative locations if the package isn't resolvable
    const fallbacks = [
      "content/technologies",
      "../content/technologies",
      "../../../content/technologies",
    ];
    for (const base of fallbacks) {
      const withData = join(base, "data");
      const patterns = ["**/*.{md,mdx}"];
      const dirs = [withData, base];
      for (const d of dirs) {
        const matches = await glob(patterns[0]!, { cwd: d, absolute: true });
        if (matches.length > 0) {
          techFiles.push(...matches);
          if (!techBaseDir) techBaseDir = d;
        }
      }
    }
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
      const last = published && !isNaN(published.getTime()) ? published : undefined;
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
  const pkgPath = require.resolve("@rawkodeacademy/content-technologies/package.json");
  const root = dirname(pkgPath);
  const data = join(root, "data");
  try {
    const s = statSync(data);
    CONTENT_TECH_DIR = s.isDirectory() ? data : root;
  } catch {
    CONTENT_TECH_DIR = root;
  }
} catch {}

export default defineConfig({
	output: "static",
	adapter: cloudflare({
		imageService: "cloudflare",
		sessionKVBindingName: "SESSION",
	}),
	trailingSlash: "never",
	integrations: [
		...(d2Available ? [d2()] : []),
		expressiveCode({
			themes: ["catppuccin-mocha", "catppuccin-latte"],
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
					const key = u.pathname.endsWith("/") && u.pathname !== "/" ? u.pathname.slice(0, -1) : u.pathname;
					const lm = lastmodIndex.get(key);
					if (lm) {
						return { ...item, lastmod: lm.toISOString() };
					}
				} catch {}
				return item;
			},
		}),
		vue(),
        partytown({
            config: {
                forward: ["posthog"],
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
        plugins: [
            webcontainerDemosPlugin(),
            vidstackPlugin({ include: /components\/video\// }),
            vue({
                template: {
                    compilerOptions: {
                        isCustomElement: (tag) => tag.startsWith("media-"),
                    },
                },
            }),
            tailwindcss(),
        ],
        server: {
            fs: {
                // Keep Vite's default workspace root allow-list and add our external content dir.
                allow: [
                    searchForWorkspaceRoot(process.cwd()),
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
            ZITADEL_URL: envField.string({
                context: "server",
                access: "public",
                default: "https://zitadel.rawkode.academy",
            }),
            ZITADEL_CLIENT_ID: envField.string({
                context: "server",
                access: "public",
                default: "293097955970320066",
            }),
            POSTHOG_API_KEY: envField.string({
                context: "server",
                access: "secret",
                optional: true,
            }),
            POSTHOG_HOST: envField.string({
                context: "server",
                access: "public",
                default: "https://eu.i.posthog.com",
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
                default:
                    process.env.GRAPHQL_ENDPOINT || "https://api.rawkode.academy/graphql",
            }),
            PUBLIC_CAPTURE_ERRORS: envField.string({
                context: "server",
                access: "public",
                default: "false",
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
