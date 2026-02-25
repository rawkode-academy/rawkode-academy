import { fileURLToPath } from "node:url";
import { defineConfig, fontProviders } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import svelte from "@astrojs/svelte";

import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
  site: "https://rawkode.news",
  output: "server",
  adapter: cloudflare({ imageService: "compile" }),
  integrations: [svelte()],
  server: {
    port: 4321,
  },
  vite: {
    ssr: {
      external: ["node:async_hooks"],
    },
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
        name: "Sora",
        cssVariable: "--font-sora",
        weights: ["500", "600", "700"],
        styles: ["normal"],
      },
      {
        provider: fontProviders.google(),
        name: "IBM Plex Sans",
        cssVariable: "--font-ibm-plex-sans",
        weights: ["400", "500", "600"],
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
