import type { FontStyle, FontWeight } from "satori";
import { html } from "satori-html";

// redefine type from "satori-html", because it is not exported
export interface VNode {
	type: string;
	props: {
		style?: Record<string, any>;
		children?: string | VNode | VNode[];
		[prop: string]: any;
	};
}

export interface Font {
	name: string;
	weight: FontWeight;
	style: FontStyle;
}

export const DEFAULT_FONT: Font = {
	name: "Open Sans",
	weight: 400,
	style: "normal",
};

export interface Template {
	font: Font;
	render: (title: string) => VNode;
}

export const DEFAULT_TEMPLATE: Template = {
	font: DEFAULT_FONT,

	render(title) {
		return html`<div>${title}</div>`;
	},
};
