import type { Preview } from "@storybook/react";
import "../src/styles/global.css";

const preview: Preview = {
	parameters: {
		controls: {
			matchers: {
				color: /(background|color)$/i,
				date: /Date$/i,
			},
		},
		layout: "centered",
		backgrounds: {
			default: "mocha",
			options: {
				mocha: { name: "mocha", value: "#1e1e2e" },
				mantle: { name: "mantle", value: "#181825" },
				crust: { name: "crust", value: "#11111b" },
				light: { name: "light (stub)", value: "#ffffff" },
			},
		},
	},
};

export default preview;
