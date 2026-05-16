import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
	site: "https://klustered.live",
	trailingSlash: "never",
	vite: {
		plugins: [tailwindcss()],
	},
});
