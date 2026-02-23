import { fileURLToPath } from "node:url";
import { defineConfig, fontProviders } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";

import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
  site: "https://rawkode.news",
  output: "server",
  adapter: cloudflare({ imageService: "compile" }),
  integrations: [react()],
  server: {
    port: 4321,
  },
  vite: {
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) {
              return;
            }
            if (
              id.includes("@uiw/react-md-editor") ||
              id.includes("@uiw/react-markdown-preview")
            ) {
              return "uiw";
            }
            if (
              id.includes("react-markdown") ||
              id.includes("remark-") ||
              id.includes("rehype-") ||
              id.includes("unified")
            ) {
              return "markdown";
            }
            if (id.includes("prismjs")) {
              return "prism";
            }
          },
        },
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
