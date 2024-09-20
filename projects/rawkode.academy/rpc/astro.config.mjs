import { defineConfig, envField } from "astro/config";
import cloudflare from "@astrojs/cloudflare";

export default defineConfig({
	output: "server",
	adapter: cloudflare(),
	vite: {
		ssr: {
			external: ['node:async_hooks', 'node:buffer', 'node:crypto', 'node:stream/web'],
		},
	},
	experimental: {
		env: {
			schema: {
				BASELIME_API_KEY: envField.string({
					context: "server",
					access: "secret",
					optional: false,
				}),
				RESEND_API_KEY: envField.string({
					context: "server",
					access: "secret",
					optional: false,
				}),
				RESTATE_API_KEY: envField.string({
					context: "server",
					access: "secret",
					optional: false,
				}),
				RESTATE_CLOUD_URL: envField.string({
					context: "server",
					access: "secret",
					optional: false,
				}),
				RESTATE_IDENTITY_KEY: envField.string({
					context: "server",
					access: "secret",
					optional: false,
				}),
				TRIGGER_SECRET_KEY: envField.string({
					context: "server",
					access: "secret",
					optional: false,
				}),
				WEBHOOK_SECRET_USER_REGISTERED: envField.string({
					context: "server",
					access: "secret",
					optional: false
				}),
				WORKOS_API_KEY: envField.string({
					context: "server",
					access: "secret",
					optional: false
				})
			}
		}
	},
});
