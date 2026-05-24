import { DEFAULT_PAYLOAD } from "@/lib/payload";
import { createHash, type Template } from "@/lib/template";
import { html } from "satori-html";

const truncate = (value: string | undefined, maxLength: number) => {
	if (!value) {
		return "";
	}

	const normalized = value.replace(/\s+/g, " ").trim();

	if (normalized.length <= maxLength) {
		return normalized;
	}

	return `${normalized.slice(0, maxLength - 1).trim()}...`;
};

export const template: Template = {
	font: {
		name: "Inter",
		weight: 700,
		style: "normal",
	},

	hash() {
		return createHash(this.render(DEFAULT_PAYLOAD));
	},

	render(payload) {
		const eyebrow = truncate(payload.subtitle, 72) || "Rawkode Academy";
		const summary = truncate(payload.text, 105);

		return html(`
			<div style="display: flex; width: 1200px; height: 630px; background: #f4f1ea; color: #17130f; font-family: Inter;">
				<div style="display: flex; width: 100%; height: 100%; padding: 54px 60px; flex-direction: column; border: 1px solid #d8d2c7;">
					<div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
						<div style="display: flex; align-items: center;">
							<div style="display: flex; width: 36px; height: 36px; background: #17130f; border-radius: 4px; margin-right: 16px;"></div>
							<div style="display: flex; flex-direction: column;">
								<div style="display: flex; font-size: 24px; font-weight: 700; letter-spacing: -0.01em; color: #17130f;">Rawkode</div>
								<div style="display: flex; font-size: 24px; font-weight: 700; letter-spacing: -0.01em; color: #17130f; margin-top: -4px;">Academy</div>
							</div>
						</div>
						<div style="display: flex; font-size: 18px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #2d7e67;">rawkode.academy</div>
					</div>

					<div style="display: flex; width: 100%; height: 1px; background: #d8d2c7; margin-top: 38px;"></div>

					<div style="display: flex; flex: 1; flex-direction: column; justify-content: center; padding-right: 80px; padding-bottom: 24px;">
						<div style="display: flex; align-items: center; margin-bottom: 22px;">
							<div style="display: flex; width: 10px; height: 10px; border-radius: 999px; background: #2d7e67; margin-right: 16px;"></div>
							<div style="display: flex; font-size: 20px; font-weight: 700; color: #2d7e67; letter-spacing: 0.12em; text-transform: uppercase;">${eyebrow}</div>
						</div>

						<div style="display: flex; font-size: 60px; font-weight: 700; line-height: 1.02; letter-spacing: -0.035em; color: #17130f; max-width: 1000px;">
							${payload.title}
						</div>

						${
							summary
								? `<div style="display: flex; margin-top: 22px; max-width: 780px; font-size: 24px; font-weight: 700; line-height: 1.28; letter-spacing: -0.012em; color: #5d574f;">${summary}</div>`
								: ""
						}
					</div>

					<div style="display: flex; align-items: center; width: 100%; border-top: 1px solid #d8d2c7; padding-top: 18px;">
						<div style="display: flex; font-size: 20px; font-weight: 700; color: #17130f;">Practical cloud native learning.</div>
					</div>
				</div>
			</div>
		`);
	},
};
