import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
export default defineConfig({
  plugins: [vue()], cacheDir: "./.astro/review/vitest",
  test: { include: ["review/tests/*.test.ts"], environment: "happy-dom", restoreMocks: true },
});
