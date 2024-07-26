import cloudflare from "@astrojs/cloudflare";
import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import tailwind from "@astrojs/tailwind";
import vue from "@astrojs/vue";
import { defineConfig, envField } from "astro/config";
import rehypeExternalLinks from "rehype-external-links";

export default defineConfig({
	output: "hybrid",
	integrations: [tailwind(), vue(), react(), mdx()],
	adapter: cloudflare({
		mode: "advanced",
	}),
	site: import.meta.env.DEV ? "http://localhost:4321" : "https://rawkode.academy",
	experimental: {
		serverIslands: true,
		env: {
			validateSecrets: true,
			schema: {
				REDIRECT_URL: envField.string({
					context: "server",
					access: "public",
					optional: false,
				}),
				WORKOS_CLIENT_ID: envField.string({
					context: "server",
					access: "public",
					optional: false,
				}),
				WORKOS_API_KEY: envField.string({
					context: "server",
					access: "secret",
					optional: false,
				}),
				WORKOS_COOKIE_PASSWORD: envField.string({
					context: "server",
					access: "secret",
					optional: false,
				}),
			},
		},
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
