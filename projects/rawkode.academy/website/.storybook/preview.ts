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
			default: "light",
			options: {
				light: { name: "light", value: "#ffffff" },
				dark: { name: "dark", value: "#0a0a0a" },
				"rawkode-dark": { name: "rawkode-dark", value: "#1a1a2e" },
			},
		},
	},
};

export default preview;
