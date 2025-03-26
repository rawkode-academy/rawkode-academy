import type { FontStyle, FontWeight } from "satori";
import { html } from "satori-html";
import { sha256 } from "js-sha256";
import { DEFAULT_PAYLOAD, type Payload } from "./payload";

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
  name: "Quicksand",
  weight: 400,
  style: "normal",
};

export interface Template {
  font: Font;
  hash: () => string;
  render: (payload: Payload) => VNode;
}

export interface HashedTemplate {
  hash: string;
  template: Template;
}

export const createHash = (value: any): string => {
  // create a sha256 hash of the JSON stringified template
  // the hash should only change when something on the template changes
  const hash = sha256.create();

  hash.update(JSON.stringify(value));

  return hash.hex();
};

export const DEFAULT_TEMPLATE: Template = {
  font: DEFAULT_FONT,

  hash() {
    // we call the render method with a stable input to calculate the hash
    return createHash(this.render(DEFAULT_PAYLOAD));
  },

  render(payload: Payload) {
    return html`<div>${payload.title}</div>`;
  },
};

export const DEFAULT_HASHED_TEMPLATE: HashedTemplate = {
  hash: DEFAULT_TEMPLATE.hash(),
  template: DEFAULT_TEMPLATE,
};
