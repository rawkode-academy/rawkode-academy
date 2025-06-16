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
import { defineConfig, envField } from "astro/config";
import rehypeExternalLinks from "rehype-external-links";
import { vite as vidstackPlugin } from "vidstack/plugins";
import { fetchVideosFromGraphQL } from "./src/lib/fetch-videos";

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
	output: "hybrid",
	adapter: cloudflare({
		imageService: "cloudflare",
		mode: "directory",
	}),
	integrations: [
		d2(),
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
				const siteUrl = getSiteUrl();
				const videos = await fetchVideosFromGraphQL();
				return videos.map((video) => `${siteUrl}/watch/${video.slug}/`);
			})(),
		}),
		vue(),
		partytown({
			config: {
				forward: ["dataLayer.push", "gtag", "posthog", "GrafanaFaroWebSdk"],
				lib: "/_partytown/",
			},
		}),
	],
	vite: {
		plugins: [
			vidstackPlugin({ include: /components\/video\// }),
			vue({
				template: {
					compilerOptions: {
						isCustomElement: (tag) => tag.startsWith("media-"),
					},
				},
			}),
			faroUploader({
				appName: "rawkode.academy",
				endpoint: "https://faro-api-prod-gb-south-0.grafana.net/faro/api/v1",
				appId: "27",
				stackId: "711132",
				apiKey: process.env.GRAFANA_SOURCE_MAPS || "",
				gzipContents: true,
			}),
			tailwindcss(),
		],
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
			INFLUXDB_HOST: envField.string({
				context: "server",
				access: "public",
				default: "https://eu-central-1-1.aws.cloud2.influxdata.com",
			}),
			INFLUXDB_TOKEN: envField.string({
				context: "server",
				access: "secret",
				optional: true,
			}),
			INFLUXDB_ORG: envField.string({
				context: "server",
				access: "public",
				default: "Rawkode Academy",
			}),
			INFLUXDB_BUCKET: envField.string({
				context: "server",
				access: "public",
				default: "analytics",
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
});
