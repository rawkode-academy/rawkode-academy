import cloudflare from "@astrojs/cloudflare";
import tailwind from "@astrojs/tailwind";
import vue from "@astrojs/vue";
import { defineConfig } from "astro/config";

import react from "@astrojs/react";

// https://astro.build/config
export default defineConfig({
  output: "hybrid",
  integrations: [tailwind(), vue(), react()],
  adapter: cloudflare()
});
