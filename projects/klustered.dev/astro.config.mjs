import cloudflare from "@astrojs/cloudflare";
import unocss from "@unocss/astro";
import { defineConfig } from "astro/config";

export default defineConfig({
	site: "https://klustered.dev",
	trailingSlash: "never",
	output: "server",
	adapter: cloudflare(),
	integrations: [unocss({ injectReset: true })],
});
