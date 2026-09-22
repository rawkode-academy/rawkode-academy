import type { Preview } from "@storybook/react";
import { createElement, Fragment, useLayoutEffect } from "react";
import "../src/styles/global.css";
import "@rawkodeacademy/design-system/styles.css";

// Reuse Astro's local font cache without calling a font provider or requiring
// Astro's virtual assets runtime. An uncached checkout uses the named fallbacks.
const fontAssets = import.meta.glob<string>(
	"../.astro/fonts/font-red-hat-*-normal-latin-*.woff2",
	{ eager: true, query: "?url", import: "default" },
);
const fontFaces = Object.entries(fontAssets)
	.map(([path, url]) => {
		const match = path.match(/font-red-hat-(display|text|mono)-(\d+)-normal/);
		if (!match) return "";
		const family = `Red Hat ${match[1]![0]!.toUpperCase()}${match[1]!.slice(1)}`;
		return `@font-face { font-family: "${family}"; src: url("${url}") format("woff2"); font-weight: ${match[2]}; font-style: normal; font-display: swap; }`;
	})
	.join("\n");
const fontStyles = `${fontFaces}
:root {
	--font-red-hat-display: "Red Hat Display";
	--font-red-hat-text: "Red Hat Text";
	--font-red-hat-mono: "Red Hat Mono";
}`;

const preview: Preview = {
	globalTypes: {
		theme: {
			description: "Academy color scheme",
			toolbar: {
				title: "Academy theme",
				icon: "circlehollow",
				items: [
					{ value: "light", title: "Light" },
					{ value: "dark", title: "Dark" },
				],
				dynamicTitle: true,
			},
		},
	},
	initialGlobals: { theme: "light" },
	decorators: [
		(Story, context) => {
			const dark = context.globals.theme === "dark";
			useLayoutEffect(() => {
				const root = document.documentElement;
				root.classList.toggle("dark", dark);
				root.classList.toggle("light", !dark);
				return () => root.classList.remove("dark", "light");
			}, [dark]);
			return createElement(
				Fragment,
				null,
				createElement("style", null, fontStyles),
				createElement(Story),
			);
		},
	],
	parameters: {
		controls: {
			matchers: {
				color: /(background|color)$/i,
				date: /Date$/i,
			},
		},
		layout: "centered",
		// A background swatch alone does not switch Panda semantic tokens.
		backgrounds: { disable: true },
	},
};

export default preview;
