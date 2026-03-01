// @ts-check
import cloudflare from "@astrojs/cloudflare";
import vue from "@astrojs/vue";
import { defineConfig } from "astro/config";

export default defineConfig({
	output: "server",
	adapter: cloudflare({
		imageService: "cloudflare",
		sessionKVBindingName: "SESSION",
		platformProxy: {
			enabled: true,
			persist: {
				path: ".wrangler/state/v3",
			},
		},
	}),
	integrations: [vue()],
	site: "https://klustered.dev",
	security: {
		checkOrigin: true,
	},
});
