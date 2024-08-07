import { defineConfig, envField } from "astro/config";
import cloudflare from "@astrojs/cloudflare";

// https://astro.build/config
export default defineConfig({
  experimental: {
    env: {
      schema: {
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
  output: "server",
  adapter: cloudflare()
});