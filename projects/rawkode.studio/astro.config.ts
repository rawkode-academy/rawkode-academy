// @ts-check
import { defineConfig, envField } from "astro/config";

import cloudflare from "@astrojs/cloudflare";

import tailwind from "@astrojs/tailwind";

// https://astro.build/config
export default defineConfig({
  output: "server",
  adapter: cloudflare(),

  site: import.meta.env.CF_PAGES_URL
    ? import.meta.env.CF_PAGES_URL
    : "https://rawkode.studio",

  env: {
    validateSecrets: true,
    schema: {
      ZITADEL_URL: envField.string({ context: "server", access: "public" }),
      ZITADEL_CLIENT_ID: envField.string({
        context: "server",
        access: "public",
      }),
    },
  },

  security: {
    checkOrigin: true,
  },

  integrations: [tailwind()],
});
