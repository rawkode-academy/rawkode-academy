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
    // Modern logo with gradient
    const logo = `<svg width="140" height="40" viewBox="0 0 140 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 20C10 14.4772 14.4772 10 20 10H120C125.523 10 130 14.4772 130 20V20C130 25.5228 125.523 30 120 30H20C14.4772 30 10 25.5228 10 20V20Z" fill="url(#paint0_linear)"/>
      <path d="M30 20H40" stroke="white" stroke-width="2" stroke-linecap="round"/>
      <path d="M35 15V25" stroke="white" stroke-width="2" stroke-linecap="round"/>
      <path d="M50 15H120" stroke="white" stroke-width="2" stroke-linecap="round"/>
      <path d="M50 25H100" stroke="white" stroke-width="2" stroke-linecap="round"/>
      <defs>
        <linearGradient id="paint0_linear" x1="10" y1="20" x2="130" y2="20" gradientUnits="userSpaceOnUse">
          <stop stop-color="#6366F1"/>
          <stop offset="1" stop-color="#8B5CF6"/>
        </linearGradient>
      </defs>
    </svg>`;

    return html(`
      <div style="display: flex; flex-direction: column; width: 1200px; height: 630px; background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 50%, #EC4899 100%); color: white; font-family: Inter;">
        <!-- Top accent line -->
        <div style="height: 8px; background: rgba(255, 255, 255, 0.2); display: flex;"></div>

        <div style="display: flex; padding: 60px; flex-direction: column; height: 100%; position: relative;">
          <!-- Background decorative elements -->
          <div style="position: absolute; width: 600px; height: 600px; border-radius: 50%; background: rgba(255, 255, 255, 0.05); top: -200px; right: -200px; display: flex;"></div>
          <div style="position: absolute; width: 400px; height: 400px; border-radius: 50%; background: rgba(255, 255, 255, 0.05); bottom: -100px; left: -100px; display: flex;"></div>

          <!-- Logo -->
          <div style="display: flex; margin-bottom: 60px; z-index: 1;">
            ${logo}
          </div>

          <!-- Main content -->
          <div style="display: flex; flex-direction: column; flex: 1; justify-content: center; z-index: 1;">
            <div style="width: 80px; height: 6px; background: rgba(255, 255, 255, 0.6); margin-bottom: 32px; display: flex;"></div>
            <h1 style="font-size: 72px; font-weight: 700; color: white; margin: 0 0 32px 0; line-height: 1.1; max-width: 800px; letter-spacing: -0.02em; display: flex;">
              ${payload.text}
            </h1>
            <p style="font-size: 28px; color: rgba(255, 255, 255, 0.8); margin: 0; line-height: 1.5; max-width: 600px; display: flex;">
              Discover the latest content from Rawkode Academy
            </p>
          </div>

          <!-- Footer -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 60px; z-index: 1;">
            <div style="font-size: 18px; color: rgba(255, 255, 255, 0.7); font-weight: 500; display: flex;">
              rawkode.academy
            </div>
            <div style="display: flex; align-items: center; background: rgba(255, 255, 255, 0.1); padding: 8px 16px; border-radius: 20px;">
              <div style="width: 8px; height: 8px; border-radius: 50%; background: #4ADE80; margin-right: 8px; display: flex;"></div>
              <div style="font-size: 14px; color: rgba(255, 255, 255, 0.9); display: flex;">
                Gradient Template
              </div>
            </div>
          </div>
        </div>
      </div>
    `);
  },
};
