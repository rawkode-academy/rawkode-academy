/// <reference types="vitest" />
import { getViteConfig } from "astro/config";

export default getViteConfig({
	test: {
		teardownTimeout: 1_000,
	},
});
