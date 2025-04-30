/// <reference types="vitest" />
import { getViteConfig } from "astro/config";
import process from "node:process";
import type { ViteUserConfig } from "vitest/config";

// HINT: setting the vars via "test.env" inside the "getViteConfig" object does not work :/
process.env.ZITADEL_URL = "some-zitadel-url";
process.env.ZITADEL_CLIENT_ID = "some-client-id";

// Use type assertion to work around the UserConfig type issue
export default getViteConfig({
  test: {
    include: ["src/**/*.{spec,test}.{ts,tsx}"],
    mockReset: true,
    environment: "happy-dom",
    globals: true,
    coverage: {
      reporter: ["text", "json", "html"],
    },
  },
} as ViteUserConfig);
