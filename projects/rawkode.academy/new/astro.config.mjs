import cloudflare from "@astrojs/cloudflare";
import { defineConfig } from "astro/config";

export default defineConfig({
	output: "hybrid",
	adapter: cloudflare({ mode: "directory", imageService: "cloudflare" }),
});
