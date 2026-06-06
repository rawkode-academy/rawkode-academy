import cloudflare from "@astrojs/cloudflare";
import vue from "@astrojs/vue";
import { defineConfig } from "astro/config";

export default defineConfig({
	site: "https://rawkode.studio",
	output: "server",
	trailingSlash: "never",
	adapter: cloudflare(),
	integrations: [vue()],
});
