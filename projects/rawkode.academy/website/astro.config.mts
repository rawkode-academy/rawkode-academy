import cloudflare from "@astrojs/cloudflare";
import mdx from "@astrojs/mdx";
import partytown from "@astrojs/partytown";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwind from "@astrojs/tailwind";
import vue from "@astrojs/vue";
import d2 from "astro-d2";
import expressiveCode from "astro-expressive-code";
import { defineConfig, envField } from "astro/config";
import rehypeExternalLinks from "rehype-external-links";
import { vite as vidstackPlugin } from "vidstack/plugins";

// Type assertion to work around type incompatibility
const vidstack = vidstackPlugin as any;

export default defineConfig({
	output: "server",
	adapter: cloudflare({
		imageService: "cloudflare",
	}),
	integrations: [
		d2(),
		expressiveCode({
			themes: ["catppuccin-mocha", "catppuccin-latte"],
		}),
		mdx(),
		react({ experimentalReactChildren: true }),
		sitemap({
			filter: (page) => !page.includes('api/'),
			changefreq: 'weekly',
			lastmod: new Date(),
			priority: 0.7,
		}),
		tailwind(),
		vue(),
		partytown(),
	],
	vite: {
		plugins: [
			vidstack({ include: /components\/video\// }),
			vue({
				template: {
					compilerOptions: {
						isCustomElement: (tag) => tag.startsWith("media-"),
					},
				},
			}),
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
	site: import.meta.env.CF_PAGES_URL
		? import.meta.env.CF_PAGES_URL
		: "https://rawkode.academy",
	env: {
		validateSecrets: true,
		schema: {
			ZITADEL_URL: envField.string({
				context: "server",
				access: "public",
			}),
			ZITADEL_CLIENT_ID: envField.string({
				context: "server",
				access: "public",
			}),
			INFLUX_HOST: envField.string({
				context: "server",
				access: "secret",
				optional: true,
			}),
			INFLUX_TOKEN: envField.string({
				context: "server",
				access: "secret",
				optional: true,
			}),
			INFLUX_ORG: envField.string({
				context: "server",
				access: "public",
				optional: true,
			}),
			INFLUX_BUCKET: envField.string({
				context: "server",
				access: "public",
				default: "video-events",
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
