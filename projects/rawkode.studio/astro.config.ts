import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
// @ts-check
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

export default defineConfig({
	devToolbar: {
		enabled: false,
	},

	output: "server",

	adapter: cloudflare({
		imageService: "cloudflare",
	}),

	site: site(),

	env: {
		validateSecrets: false,

		schema: {
			ZITADEL_URL: envField.string({
				context: "server",
				access: "public",
			}),
			ZITADEL_CLIENT_ID: envField.string({
				context: "server",
				access: "public",
			}),
			LIVEKIT_URL: envField.string({
				context: "server",
				access: "secret",
			}),
			LIVEKIT_API_SECRET: envField.string({
				context: "server",
				access: "secret",
			}),
			LIVEKIT_API_KEY: envField.string({
				context: "server",
				access: "secret",
			}),
			TURSO_URL: envField.string({
				context: "server",
				access: "secret",
			}),
			TURSO_AUTH_TOKEN: envField.string({
				context: "server",
				access: "secret",
			}),
			S3_ENDPOINT: envField.string({
				context: "server",
				access: "secret",
			}),
			S3_ACCESS_KEY: envField.string({
				context: "server",
				access: "secret",
			}),
			S3_SECRET_KEY: envField.string({
				context: "server",
				access: "secret",
			}),
			S3_BUCKET_NAME: envField.string({
				context: "server",
				access: "secret",
			}),
		},
	},

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

		build: {
			rollupOptions: {
				output: {
					manualChunks: (id) => {
						// Split LiveKit SDK into its own chunk
						if (id.includes("livekit-client")) {
							return "livekit";
						}

						// Split React and React DOM into vendor chunk
						if (
							id.includes("node_modules/react/") ||
							id.includes("node_modules/react-dom/")
						) {
							return "react-vendor";
						}

						// Split other large dependencies
						if (id.includes("@radix-ui") || id.includes("@floating-ui")) {
							return "ui-vendor";
						}

						// Split form libraries
						if (
							id.includes("react-hook-form") ||
							id.includes("@hookform") ||
							id.includes("zod")
						) {
							return "forms";
						}

						// Split Astro actions runtime
						if (id.includes("_astro_actions")) {
							return "astro-actions";
						}

						// Split date/time libraries
						if (id.includes("date-fns") || id.includes("@formatjs")) {
							return "datetime";
						}

						// Split other utilities
						if (
							id.includes("clsx") ||
							id.includes("class-variance-authority") ||
							id.includes("tailwind-merge")
						) {
							return "utils";
						}
					},
				},
			},
		},
	},
});
