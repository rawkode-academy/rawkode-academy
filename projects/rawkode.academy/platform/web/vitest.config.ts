/// <reference types="vitest" />
import {
	getViteConfig,
	type AstroInlineConfig,
	type ViteUserConfig,
} from "astro/config";

// https://stackoverflow.com/a/74453378
interface VitestConfigExport extends ViteUserConfig {
	test: AstroInlineConfig;
}

export default getViteConfig({
	test: {
		include: ["src/**/*.{spec,test}.{ts,tsx}"],
		mockReset: true,
	},
} as VitestConfigExport);
