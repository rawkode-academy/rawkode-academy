import cloudflare from "@astrojs/cloudflare";
import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwind from "@astrojs/tailwind";
import vue from "@astrojs/vue";
import { defineConfig, envField } from "astro/config";
import rehypeExternalLinks from "rehype-external-links";

export default defineConfig({
	output: "server",
	integrations: [mdx(), react(), sitemap(), tailwind(), vue()],
	adapter: cloudflare({}),
	site: import.meta.env.DEV
		? "http://localhost:4321"
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
