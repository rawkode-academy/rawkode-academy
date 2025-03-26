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
    // Modern logo with glass effect
    const logo = `<svg width="140" height="40" viewBox="0 0 140 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="10" width="120" height="20" rx="10" fill="rgba(255, 255, 255, 0.2)"/>
      <path d="M30 20H40" stroke="white" stroke-width="2" stroke-linecap="round"/>
      <path d="M35 15V25" stroke="white" stroke-width="2" stroke-linecap="round"/>
      <path d="M50 15H120" stroke="white" stroke-width="2" stroke-linecap="round"/>
      <path d="M50 25H100" stroke="white" stroke-width="2" stroke-linecap="round"/>
    </svg>`;

    // Background pattern
    const pattern = `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="10" r="1" fill="rgba(255, 255, 255, 0.1)"/>
    </svg>`;

    return html(`
      <div style="display: flex; flex-direction: column; width: 1200px; height: 630px; background: linear-gradient(125deg, #0F172A 0%, #1E293B 100%); color: white; font-family: Inter;">
        <div style="display: flex; padding: 60px; flex-direction: column; height: 100%;">
          <!-- Logo -->
          <div style="display: flex; margin-bottom: 60px;">
            ${logo}
          </div>

          <!-- Main content -->
          <div style="display: flex; flex-direction: column; flex: 1; justify-content: center;">
            <!-- Glass card effect -->
            <div style="display: flex; flex-direction: column; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 24px; padding: 60px;">
              <h1 style="font-size: 64px; font-weight: 700; color: white; margin: 0 0 32px 0; line-height: 1.2; display: flex;">
                ${payload.title}
              </h1>
              <p style="font-size: 24px; color: rgba(255, 255, 255, 0.7); margin: 0; line-height: 1.5; display: flex;">
                ${payload.subtitle}
              </p>
            </div>
          </div>

          <!-- Footer -->
          <div style="display: flex; justify-content: flex-end; margin-top: 40px;">
            <div style="font-size: 16px; color: rgba(255, 255, 255, 0.5); display: flex;">
              Rawkode Academy
            </div>
          </div>
        </div>
      </div>
    `);
  },
};
