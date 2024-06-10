import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import tailwind from "@astrojs/tailwind";
import vue from "@astrojs/vue";
import { defineConfig } from "astro/config";

export default defineConfig({
	output: "hybrid",
	integrations: [tailwind(), vue(), react()],
	adapter: cloudflare({ mode: "advanced" }),
});
