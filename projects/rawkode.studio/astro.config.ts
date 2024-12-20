// @ts-check
import { defineConfig, envField } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import tailwind from "@astrojs/tailwind";

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
  output: "server",
  adapter: cloudflare({}),

  site: site(),

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

  integrations: [tailwind({ applyBaseStyles: false }), react()],
});
