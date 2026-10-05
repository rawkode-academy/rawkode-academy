import { defineConfig, sessionDrivers } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import vue from "@astrojs/vue";

// A separate entrypoint keeps the public website routes and auth untouched.
export default defineConfig({
  srcDir: "./review", outDir: "./dist-review", cacheDir: "./.astro/review",
  publicDir: "./review/public", output: "server", site: "https://preview.rawkode.academy",
  // The review bridge owns authentication with Payload/OIDC; this entrypoint
  // does not use Astro sessions, so do not provision an unrelated KV binding.
  session: { driver: sessionDrivers.null() },
  adapter: cloudflare({ configPath: "wrangler.review.jsonc", imageService: "compile", inspectorPort: false }),
  integrations: [vue()],
  vite: { cacheDir: "./.astro/review/vite", resolve: { dedupe: ["vue"] } },
  security: { checkOrigin: true },
  server: { host: "127.0.0.1", port: 3100 },
});
