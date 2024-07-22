import cloudflare from "@astrojs/cloudflare";
import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import tailwind from "@astrojs/tailwind";
import vue from "@astrojs/vue";
import rehypeExternalLinks from 'rehype-external-links';

import { defineConfig } from "astro/config";
// https://astro.build/config
export default defineConfig({
	output: "hybrid",
	integrations: [tailwind(), vue(), react(), mdx()],
	adapter: cloudflare({
		mode: "advanced",
	}),
	experimental: {
		serverIslands: true,
	},
	markdown: {
		rehypePlugins: [
			[
				rehypeExternalLinks,
				{
					"target": '_blank'
				}
			]
		]
	}
});
