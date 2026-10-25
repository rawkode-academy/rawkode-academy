import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import { defineConfig } from "astro/config";

// The CMS at cms.rawkode.academy: rendered on request, signed-in only.
export default defineConfig({
	output: "server",
	site: "https://cms.rawkode.academy",
	adapter: cloudflare({ inspectorPort: 0 }),
	integrations: [react()],
	security: { checkOrigin: true },
});
