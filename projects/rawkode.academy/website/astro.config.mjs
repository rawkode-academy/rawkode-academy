import { defineConfig } from "astro/config";

import mdx from "@astrojs/mdx";
import partytown from "@astrojs/partytown";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import svelte from "@astrojs/svelte";
import tailwind from "@astrojs/tailwind";

export default defineConfig({
  integrations: [
    mdx(),
    partytown({
      config: {
        forward: ["dataLayer.push"],
      },
    }),
    react(),
    sitemap(),
    svelte(),
    tailwind({ config: { applyBaseStyles: false } }),
  ],
});
