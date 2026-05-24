import { defineConfig, sessionDrivers } from "astro/config";
import cloudflare from "@astrojs/cloudflare";

export default defineConfig({
  output: "server",
  session: {
    driver: sessionDrivers.lruCache(),
  },
  adapter: cloudflare({
    imageService: "passthrough",
  }),
});
