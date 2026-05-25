import {
	defineConfig,
	presetWind3,
	transformerDirectives,
	transformerVariantGroup,
} from "unocss";

// Admin portal uses the standard Wind palette (slate/fuchsia/etc.); no bespoke
// theme. `injectReset` in astro.config supplies the preflight reset.
export default defineConfig({
	presets: [presetWind3()],
	transformers: [transformerDirectives(), transformerVariantGroup()],
	blocklist: [
		"class:list",
		"set:html",
		"set:text",
		"client:load",
		"client:idle",
		"client:visible",
		"client:only",
		"client:media",
	],
	content: {
		filesystem: ["src/**/*.{astro,ts,tsx,js,jsx,md,mdx}"],
	},
});
