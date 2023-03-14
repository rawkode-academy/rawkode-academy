import { defineConfig } from "astro/config";

import cloudflare from "@astrojs/cloudflare";
import mdx from "@astrojs/mdx";
import partytown from "@astrojs/partytown";
import react from "@astrojs/react";
import svelte from "@astrojs/svelte";
import tailwind from "@astrojs/tailwind";

// Doesn't work with SSR
import sitemap from "@astrojs/sitemap";


export default defineConfig({
  output: "server",
  adapter: cloudflare(),
  site: "https://rawkode.academy",
  integrations: [
    mdx(),
    partytown({
      config: {
        forward: ["dataLayer.push"],
      },
    }),
    react(),
    svelte(),
    tailwind({ config: { applyBaseStyles: false } }),
  ],
});
