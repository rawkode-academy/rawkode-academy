import cloudflare from "@astrojs/cloudflare";
import vue from "@astrojs/vue";
import { defineConfig, fontProviders } from "astro/config";

export default defineConfig({
	site: "https://collaborate.rawkode.academy",
	output: "server",
	trailingSlash: "never",
	adapter: cloudflare({ inspectorPort: 0, imageService: "passthrough" }),
	integrations: [vue()],
	security: { checkOrigin: true },
	fonts: [
		{ provider: fontProviders.google(), name: "Red Hat Display", cssVariable: "--font-red-hat-display", weights: ["500", "600", "700", "800", "900"], styles: ["normal"], display: "swap" },
		{ provider: fontProviders.google(), name: "Red Hat Text", cssVariable: "--font-red-hat-text", weights: ["400", "500", "600", "700"], styles: ["normal"], display: "swap" },
		{ provider: fontProviders.google(), name: "Red Hat Mono", cssVariable: "--font-red-hat-mono", weights: ["400", "500", "600"], styles: ["normal"], display: "swap" },
	],
});
