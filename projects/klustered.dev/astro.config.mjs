import cloudflare from "@astrojs/cloudflare";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
	site: "https://klustered.dev",
	trailingSlash: "never",
	output: "server",
	adapter: cloudflare(),
	vite: {
		plugins: [tailwindcss()],
	},
});
