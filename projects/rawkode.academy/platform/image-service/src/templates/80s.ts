import { createHash, DEFAULT_FONT, type Template } from "@/lib/template";
import { html } from "satori-html";

export const template: Template = {
  font: DEFAULT_FONT,
  hash() {
    // we call the render method with a stable input to calculate the hash
    return createHash(this.render("comtrya"));
  },
  render(title) {
    return html(`<div
			style="width: 1200px; height: 630px; background: linear-gradient(45deg, #ff00ff, #00ffff, #ffff00, #ff00ff); background-size: 400% 400%; display: flex; justify-content: center; align-items: center; font-family: Arial, sans-serif;"
		>
			<h1
				style="font-family: ; font-size: 4em; color: #ffffff; text-shadow: 3px 3px 0 #ff00ff, 6px 6px 0 #00ffff; text-transform: uppercase; letter-spacing: 2px; text-align: center; padding: 20px;"
			>
				${title}
			</h1>
		</div>`);
  },
};
