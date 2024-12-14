import cloudflare from "@astrojs/cloudflare";
import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwind from "@astrojs/tailwind";
import vue from "@astrojs/vue";
import expressiveCode from "astro-expressive-code";
import { defineConfig, envField } from "astro/config";
import rehypeExternalLinks from "rehype-external-links";
import rehypeMermaid from "rehype-mermaid";

export default defineConfig({
  output: "server",
  integrations: [
    expressiveCode({
      themes: ["catppuccin-mocha", "catppuccin-latte"],
    }),
    mdx(),
    react(),
    sitemap(),
    tailwind(),
    vue(),
  ],
  adapter: cloudflare({
    imageService: "cloudflare",
  }),
  site: import.meta.env.CF_PAGES_URL
    ? import.meta.env.CF_PAGES_URL
    : "http://localhost:4321",
  env: {
    validateSecrets: true,
    schema: {
      ZITADEL_URL: envField.string({
        context: "server",
        access: "public",
      }),
      ZITADEL_CLIENT_ID: envField.string({
        context: "server",
        access: "public",
      }),
    },
  },
  security: {
    checkOrigin: true,
  },
  markdown: {
    rehypePlugins: [
      [
        rehypeMermaid,
        { strategy: "img-svg" },
      ],
      [
        rehypeExternalLinks,
        {
          target: "_blank",
        },
      ],
    ],
  },
});
