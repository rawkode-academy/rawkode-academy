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
import rehypeExternalLinks from "rehype-external-links";
import { vite as vidstackPlugin } from "vidstack/plugins";
import { fetchVideosFromGraphQL } from "./src/lib/fetch-videos";
import { webcontainerDemosPlugin } from "./src/utils/vite-plugin-webcontainer-demos";

// Check if D2 is available (used for diagram rendering)
let d2Available = false;
try {
	const { execSync } = await import("child_process");
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

export default defineConfig({
	output: "static",
	adapter: cloudflare({
		imageService: "cloudflare",
		sessionKVBindingName: "SESSION",
	}),
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
			lastmod: new Date(),
			priority: 0.7,
			customPages: await (async () => {
				try {
					const siteUrl = getSiteUrl();
					const videos = await fetchVideosFromGraphQL();
					return videos.map((video) => `${siteUrl}/watch/${video.slug}/`);
				} catch (error) {
					console.warn(
						"Skipping video pages in sitemap due to API unavailability:",
						error,
					);
					return [];
				}
			})(),
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
