import { fileURLToPath } from "node:url";
import cloudflare from "@astrojs/cloudflare";
import vue from "@astrojs/vue";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, fontProviders } from "astro/config";

export default defineConfig({
	site: "https://rawkode.studio",
	output: "server",
	adapter: cloudflare({ imageService: "compile" }),
	integrations: [vue()],
	server: {
		port: 4342,
	},
	vite: {
		resolve: {
			alias: {
				"@": fileURLToPath(new URL("./src", import.meta.url)),
			},
		},
		plugins: [tailwindcss()],
	},
	fonts: [
		{
			provider: fontProviders.google(),
			name: "Sora",
			cssVariable: "--font-display",
			weights: ["500", "600", "700"],
			styles: ["normal"],
		},
		{
			provider: fontProviders.google(),
			name: "IBM Plex Sans",
			cssVariable: "--font-body",
			weights: ["400", "500", "600"],
			styles: ["normal"],
		},
		{
			provider: fontProviders.fontsource(),
			name: "Monaspace Neon",
			cssVariable: "--font-mono",
			weights: ["400", "500"],
			styles: ["normal"],
		},
	],
});
