import { defineConfig, fontProviders } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import vue from "@astrojs/vue";

export default defineConfig({
	site: "https://play.rawkode.academy",
	adapter: cloudflare({ inspectorPort: false }),
	integrations: [vue()],
	output: "server",
	// The Academy editorial trio, self-hosted and subsetted at build time by
	// Astro's fonts API. Matches projects/rawkode.academy/website exactly, so
	// Arcade and the main site render identical type with no third-party
	// request and no layout shift.
	fonts: [
		{
			provider: fontProviders.google(),
			name: "Instrument Serif",
			cssVariable: "--font-instrument-serif",
			weights: ["400"],
			styles: ["normal", "italic"],
			display: "optional",
		},
		{
			provider: fontProviders.google(),
			name: "Inter Tight",
			cssVariable: "--font-inter-tight",
			weights: ["400", "500", "600", "700"],
			styles: ["normal"],
			display: "optional",
		},
		{
			provider: fontProviders.google(),
			name: "JetBrains Mono",
			cssVariable: "--font-jetbrains-mono",
			weights: ["400", "500", "600"],
			styles: ["normal"],
			display: "optional",
		},
	],
	vite: {
		resolve: {
			alias: {
				"@": new URL("./src", import.meta.url).pathname,
			},
		},
	},
});
