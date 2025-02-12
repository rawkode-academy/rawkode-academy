// @ts-check
import { defineConfig, envField } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

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
  output: "server",
  adapter: cloudflare(),

  site: site(),

  env: {
    // FIXME? to make it work, we need to have them at build time
    validateSecrets: false,

    schema: {
      LIVEKIT_URL: envField.string({ context: "server", access: "secret" }),
      LIVEKIT_API_KEY: envField.string({ context: "server", access: "secret" }),
      LIVEKIT_API_SECRET: envField.string({
        context: "server",
        access: "secret",
      }),
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

  integrations: [
    react({ experimentalReactChildren: true }),
  ],

  vite: {
    plugins: [
      tailwindcss()
    ],
    ssr: {
      external: ["node:crypto"],
    },
  },
});
