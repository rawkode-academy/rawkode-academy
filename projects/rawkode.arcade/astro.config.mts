import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import vue from "@astrojs/vue";

export default defineConfig({
	site: "https://play.rawkode.academy",
	adapter: cloudflare({ inspectorPort: false }),
	integrations: [vue()],
	output: "server",
	vite: {
		resolve: {
			alias: {
				"@": new URL("./src", import.meta.url).pathname,
			},
		},
	},
});
