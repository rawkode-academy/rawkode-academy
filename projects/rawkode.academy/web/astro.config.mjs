import tailwind from "@astrojs/tailwind";
import vue from "@astrojs/vue";
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";

// https://astro.build/config
export default defineConfig({
  output: 'hybrid',
  integrations: [tailwind(), vue()],
  adapter: cloudflare()
});