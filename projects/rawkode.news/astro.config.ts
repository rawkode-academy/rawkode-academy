import { fileURLToPath } from "node:url";
import { defineConfig, envField, fontProviders } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";

import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
  output: "server",
  adapter: cloudflare(),
  integrations: [react()],
  env: {
    schema: {
      RKA_ALLOWED_NAMES: envField.string({
        context: "server",
        access: "secret",
        optional: true,
        default: "Stefan Ruzitschka,David Flanagan",
      }),
    },
  },
  server: {
    port: 4321,
  },
  vite: {
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },

    plugins: [tailwindcss()],
  },
  experimental: {
    fonts: [
      {
        provider: fontProviders.google(),
        name: "Quicksand",
        cssVariable: "--font-quicksand",
        weights: ["400", "700"],
        styles: ["normal"],
      },
      {
        provider: fontProviders.google(),
        name: "Poppins",
        cssVariable: "--font-poppins",
        weights: ["400", "600"],
        styles: ["normal"],
      },
      {
        provider: fontProviders.fontsource(),
        name: "Monaspace Neon",
        cssVariable: "--font-monaspace-neon",
        weights: ["400"],
        styles: ["normal"],
      },
    ],
  },
});
