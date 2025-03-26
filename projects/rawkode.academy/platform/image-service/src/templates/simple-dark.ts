import { DEFAULT_PAYLOAD } from "@/lib/payload";
import { createHash, type Template } from "@/lib/template";
import { html } from "satori-html";

export const template: Template = {
  font: {
    name: "Inter",
    weight: 500,
    style: "normal",
  },

  hash() {
    // we call the render method with a stable input to calculate the hash
    return createHash(this.render(DEFAULT_PAYLOAD));
  },

  render(payload) {
    // Simple logo
    const logo = `<svg width="120" height="40" viewBox="0 0 120 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="120" height="40" rx="8" fill="url(#paint0_linear)"/>
      <path d="M15 20H30" stroke="white" stroke-width="2" stroke-linecap="round"/>
      <path d="M22.5 12.5V27.5" stroke="white" stroke-width="2" stroke-linecap="round"/>
      <path d="M40 15H105" stroke="white" stroke-width="2" stroke-linecap="round"/>
      <path d="M40 25H90" stroke="white" stroke-width="2" stroke-linecap="round"/>
      <defs>
        <linearGradient id="paint0_linear" x1="0" y1="0" x2="120" y2="40" gradientUnits="userSpaceOnUse">
          <stop stop-color="#5f5ed7"/>
          <stop offset="1" stop-color="#00ceff"/>
        </linearGradient>
      </defs>
    </svg>`;

    return html(`
      <div style="display: flex; flex-direction: column; width: 1200px; height: 630px; background: linear-gradient(135deg, #111827 0%, #1f2937 100%); color: white; font-family: Inter;">
        <div style="display: flex; padding: 60px; flex-direction: column; height: 100%;">
          <div style="display: flex; margin-bottom: 40px;">
            ${logo}
          </div>

          <div style="display: flex; flex-direction: column; flex: 1; justify-content: center;">
            <h1 style="font-size: 64px; font-weight: 700; color: white; margin: 0 0 24px 0; line-height: 1.2; max-width: 800px;">
              ${payload.title}
            </h1>
            <p style="font-size: 24px; color: rgba(255, 255, 255, 0.8); margin: 0; line-height: 1.5;">
              Rawkode Academy
            </p>
          </div>

          <div style="display: flex; margin-top: 40px; font-size: 16px; color: rgba(255, 255, 255, 0.6);">
            rawkode.academy
          </div>
        </div>
      </div>
    `);
  },
};
