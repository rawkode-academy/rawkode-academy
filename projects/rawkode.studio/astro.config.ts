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
    },
  },

  security: {
    checkOrigin: true,
  },

  integrations: [react()],

  vite: {
    plugins: [
      tailwindcss(),
    ],

    ssr: {
      external: ["node:crypto"],
    },

    resolve: {
      alias: import.meta.env.PROD
        ? {
          "react-dom/server": "react-dom/server.edge",
        }
        : undefined,
    },
  },
});
