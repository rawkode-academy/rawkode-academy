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
				RESEND_API_KEY: envField.string({
					context: "server",
					access: "secret",
					optional: true,
				}),
				RESTATE_API_KEY: envField.string({
					context: "server",
					access: "secret",
					optional: true,
				}),
				RESTATE_CLOUD_URL: envField.string({
					context: "server",
					access: "secret",
					optional: true,
				}),
				RESTATE_IDENTITY_KEY: envField.string({
					context: "server",
					access: "secret",
					optional: true,
				}),
				TRIGGER_SECRET_KEY: envField.string({
					context: "server",
					access: "secret",
					optional: true,
				}),
				WEBHOOK_SECRET_USER_REGISTERED: envField.string({
					context: "server",
					access: "secret",
					optional: true
				}),
				WORKOS_API_KEY: envField.string({
					context: "server",
					access: "secret",
					optional: true
				})
			}
		}
	},
});
