// @ts-check

import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, envField } from "astro/config";

const site = (): string => {
	if (import.meta.env.CF_PAGES_URL) {
		return import.meta.env.CF_PAGES_URL;
	}

	if (import.meta.env.DEV) {
		return "http://localhost:4321";
	}

	return "https://rawkode.studio";
};

// https://astro.build/config
export default defineConfig({
	devToolbar: {
		enabled: false,
	},

	output: "server",

	adapter: cloudflare({
		imageService: "cloudflare",
	}),

	site: site(),

	security: {
		checkOrigin: true,
	},

	integrations: [react()],

	vite: {
		plugins: [tailwindcss()],

		ssr: {
			external: ["node:crypto", "node:fs/promises", "node:path", "node:url"],
		},

		resolve: {
			alias: import.meta.env.PROD
				? {
						"react-dom/server": "react-dom/server.edge",
					}
				: undefined,
		},
	},

	env: {
		schema: {
			// Public variables
			ZITADEL_URL: envField.string({
				context: "server",
				access: "public",
			}),
			ZITADEL_CLIENT_ID: envField.string({
				context: "server",
				access: "public",
			}),
			// Secret variables
			AUTH_STATE_SECRET: envField.string({
				context: "server",
				access: "secret",
			}),
		},
	},
});
