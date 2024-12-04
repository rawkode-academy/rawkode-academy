/// <reference types="vitest" />
import { getViteConfig } from "astro/config";

export default getViteConfig({
  test: {
    include: ["src/**/*.{spec,test}.{ts,tsx}"],
    mockReset: true,
  },
});
