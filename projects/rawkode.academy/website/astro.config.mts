import cloudflare from "@astrojs/cloudflare";
import mdx from "@astrojs/mdx";
import partytown from "@astrojs/partytown";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import vue from "@astrojs/vue";
import d2 from "astro-d2";
import expressiveCode from "astro-expressive-code";
import { defineConfig, envField } from "astro/config";
import rehypeExternalLinks from "rehype-external-links";
import { vite as vidstackPlugin } from "vidstack/plugins";
import faroUploader from "@grafana/faro-rollup-plugin";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  output: "server",
  adapter: cloudflare({
    imageService: "cloudflare",
  }),
  integrations: [
    d2(),
    expressiveCode({
      themes: ["catppuccin-mocha", "catppuccin-latte"],
    }),
    mdx(),
    react({ experimentalReactChildren: true }),
    sitemap({
      filter: (page) => !page.includes("api/"),
      changefreq: "weekly",
      lastmod: new Date(),
      priority: 0.7,
    }),
    vue(),
    partytown(),
  ],
  vite: {
    plugins: [
      vidstackPlugin({ include: /components\/video\// }),
      vue({
        template: {
          compilerOptions: {
            isCustomElement: (tag) => tag.startsWith("media-"),
          },
        },
      }),
      faroUploader({
        appName: "rawkode.academy",
        endpoint: "https://faro-api-prod-gb-south-0.grafana.net/faro/api/v1",
        appId: "27",
        stackId: "711132",
        apiKey: process.env.GRAFANA_SOURCE_MAPS || "",
        gzipContents: true,
      }),
      tailwindcss(),
    ],
    resolve: {
      // Use react-dom/server.edge instead of react-dom/server.browser for React 19.
      // Without this, MessageChannel from node:worker_threads needs to be polyfilled.
      // https://github.com/withastro/adapters/pull/436
      alias: import.meta.env.PROD
        ? {
            "react-dom/server": "react-dom/server.edge",
          }
        : {},
    },
  },
  site: import.meta.env.CF_PAGES_URL
    ? import.meta.env.CF_PAGES_URL
    : "https://rawkode.academy",
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
      INFLUXDB_URL: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      INFLUXDB_TOKEN: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      INFLUXDB_ORG: envField.string({
        context: "server",
        access: "public",
        optional: true,
      }),
      INFLUXDB_BUCKET: envField.string({
        context: "server",
        access: "public",
        default: "video-events",
      }),
    },
  },
  security: {
    checkOrigin: true,
  },
  markdown: {
    rehypePlugins: [
      [
        rehypeExternalLinks,
        {
          target: "_blank",
        },
      ],
    ],
  },
});
