import cloudflare from "@astrojs/cloudflare";
import vue from "@astrojs/vue";
import { defineConfig } from "astro/config";

export default defineConfig({
	site: "https://rawkode.studio",
	output: "server",
	trailingSlash: "never",
	adapter: cloudflare({
		// Verification containers may not expose network interfaces for debugger
		// port discovery. The application still uses the real Cloudflare adapter.
		inspectorPort: process.env.STUDIO_DISABLE_INSPECTOR === "1" ? false : undefined,
	}),
	integrations: [vue()],
});
