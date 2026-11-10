import type { Preview } from "@storybook/react";
import { createElement, Fragment, useLayoutEffect } from "react";
import "../src/styles/global.css";
import "@rawkodeacademy/design-system/styles.css";

// The site loads Red Hat through Astro's font integration, which Storybook
// cannot call. These packages vendor the same variable fonts, so a story (and
// its screenshot baseline) renders identically on every machine, offline.
import "@fontsource-variable/red-hat-display";
import "@fontsource-variable/red-hat-text";
import "@fontsource-variable/red-hat-mono";

const fontStyles = `:root {
	--font-red-hat-display: "Red Hat Display Variable";
	--font-red-hat-text: "Red Hat Text Variable";
	--font-red-hat-mono: "Red Hat Mono Variable";
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
