// @ts-check

import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, envField, fontProviders } from "astro/config";

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
        plugins: [tailwindcss() as any],

		ssr: {
			external: ["node:crypto", "node:fs/promises", "node:path", "node:url"],
		},
		build: {
			// Reduce noise from large UI bundle during build
			chunkSizeWarningLimit: 3072,
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
			REALTIMEKIT_ORGANIZATION_ID: envField.string({
				context: "server",
				access: "secret",
			}),
			REALTIMEKIT_API_KEY: envField.string({
				context: "server",
				access: "secret",
			}),
			REALTIMEKIT_API_URL: envField.string({
				context: "server",
				access: "public",
				optional: true,
				default: "https://rtk.realtime.cloudflare.com/v2",
			}),
			REALTIMEKIT_STREAM_URL: envField.string({
				context: "client",
				access: "public",
				optional: true,
				default: "rtmps://live.cloudflare.com:443/live/",
			}),
			REALTIMEKIT_ENABLE_RECORDING: envField.boolean({
				context: "client",
				access: "public",
				optional: true,
				default: true,
			}),
			REALTIMEKIT_ENABLE_LIVESTREAM: envField.boolean({
				context: "client",
				access: "public",
				optional: true,
				default: true,
			}),
                REALTIMEKIT_ENABLE_ANALYTICS: envField.boolean({
                    context: "client",
                    access: "public",
                    optional: true,
                    default: true,
                }),
                // R2 for local recordings
                R2_ACCOUNT_ID: envField.string({ context: "server", access: "secret" }),
                R2_BUCKET: envField.string({ context: "server", access: "secret" }),
                R2_ACCESS_KEY_ID: envField.string({ context: "server", access: "secret" }),
                R2_SECRET_ACCESS_KEY: envField.string({ context: "server", access: "secret" }),
                R2_PUBLIC_HOST: envField.string({ context: "server", access: "public", optional: true }),
                // Descript
                DESCRIPT_PARTNER_DRIVE_ID: envField.string({ context: "server", access: "secret" }),
                DESCRIPT_API_TOKEN: envField.string({ context: "server", access: "secret" }),
            },
        },

	experimental: {
		fonts: [
			{
				provider: fontProviders.google(),
				name: "Quicksand",
				cssVariable: "--font-quicksand",
				weights: ["400", "500", "600", "700"],
				styles: ["normal"],
			},
			{
				provider: fontProviders.google(),
				name: "Poppins",
				cssVariable: "--font-poppins",
				weights: ["300", "400", "500", "600", "700"],
				styles: ["normal"],
			},
		],
	},
});
