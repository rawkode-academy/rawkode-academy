import type { Payload } from "./payload";

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const templateAccent = (template: string): { accent: string; wash: string } => {
  switch (template) {
    case "dark":
    case "simple-dark":
      return {
        accent: "oklch(0.50 0.13 290)",
        wash: "oklch(0.50 0.13 290 / 0.12)",
      };
    case "80s":
      return {
        accent: "oklch(0.55 0.13 40)",
        wash: "oklch(0.55 0.13 40 / 0.14)",
      };
    case "minimal":
      return {
        accent: "oklch(0.18 0.02 60)",
        wash: "oklch(0.18 0.02 60 / 0.06)",
      };
    default:
      return {
        accent: "oklch(0.52 0.09 165)",
        wash: "oklch(0.52 0.09 165 / 0.12)",
      };
  }
};

export const renderOpenGraphHtml = (payload: Payload): string => {
  const title = escapeHtml(payload.title);
  const subtitle = payload.subtitle ? escapeHtml(payload.subtitle) : "";
  const text = payload.text ? escapeHtml(payload.text) : "";
  const image = payload.image?.href;
  const accent = templateAccent(payload.template);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=1200, height=630, initial-scale=1" />
    <style>
      @import url("https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter+Tight:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap");
      * { box-sizing: border-box; }
      html, body { width: 1200px; height: 630px; margin: 0; overflow: hidden; }
      :root {
        --paper: oklch(0.97 0.008 85);
        --paper-deep: oklch(0.93 0.012 85);
        --ink: oklch(0.18 0.02 60);
        --ink-soft: oklch(0.36 0.015 60);
        --ink-mute: oklch(0.58 0.012 60);
        --hairline: oklch(0.18 0.02 60 / 0.14);
        --hairline-strong: oklch(0.18 0.02 60 / 0.24);
        --spruce: oklch(0.52 0.09 165);
        --amber: oklch(0.72 0.15 65);
        --rust: oklch(0.55 0.13 40);
        --accent: ${accent.accent};
        --accent-wash: ${accent.wash};
      }
      body {
        font-family: "Inter Tight", Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background:
          linear-gradient(90deg, var(--hairline) 1px, transparent 1px) 0 0 / 80px 80px,
          linear-gradient(0deg, var(--hairline) 1px, transparent 1px) 0 0 / 80px 80px,
          radial-gradient(circle at 88% 14%, var(--accent-wash), transparent 32%),
          var(--paper);
        color: var(--ink);
      }
      .card {
        width: 1200px;
        height: 630px;
        display: grid;
        grid-template-columns: 156px 1fr;
        grid-template-rows: 1fr 86px;
        border: 14px solid var(--paper);
      }
      .rail {
        grid-row: 1 / 3;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        align-items: center;
        padding: 38px 0;
        background: var(--ink);
        color: var(--paper);
      }
      .mark { width: 76px; height: 76px; display: grid; place-items: center; border: 1px solid oklch(0.97 0.008 85 / 0.34); }
      .mark svg { width: 52px; height: 52px; }
      .rail-word {
        writing-mode: vertical-rl;
        transform: rotate(180deg);
        font-family: "JetBrains Mono", ui-monospace, monospace;
        font-size: 16px;
        font-weight: 600;
        letter-spacing: 0.04em;
      }
      .rail-index {
        font-family: "JetBrains Mono", ui-monospace, monospace;
        font-size: 18px;
        font-weight: 600;
        color: var(--amber);
      }
      main {
        display: grid;
        grid-template-columns: ${image ? "1fr 356px" : "1fr"};
        gap: 44px;
        align-items: stretch;
        padding: 52px 58px 42px 58px;
        border-top: 1px solid var(--hairline-strong);
        border-right: 1px solid var(--hairline-strong);
      }
      .content { min-width: 0; display: flex; flex-direction: column; justify-content: center; }
      .kicker {
        width: max-content;
        margin-bottom: 32px;
        padding: 9px 12px;
        border: 1px solid var(--hairline-strong);
        background: var(--paper-deep);
        color: var(--spruce);
        font-family: "JetBrains Mono", ui-monospace, monospace;
        font-size: 15px;
        line-height: 1;
        font-weight: 600;
      }
      h1 {
        margin: 0;
        color: var(--ink);
        font-family: "Instrument Serif", "Iowan Old Style", Georgia, serif;
        font-size: ${image ? "70px" : "82px"};
        line-height: 0.94;
        letter-spacing: 0;
        font-weight: 400;
        max-width: ${image ? "620px" : "900px"};
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .subtitle { margin-top: 28px; color: var(--ink); font-size: 31px; line-height: 1.1; font-weight: 700; max-width: 740px; }
      .text { margin-top: 18px; color: var(--ink-soft); font-size: 26px; line-height: 1.22; max-width: 820px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      .media {
        align-self: stretch;
        min-height: 0;
        padding: 12px;
        background: var(--paper-deep);
        border: 1px solid var(--hairline-strong);
      }
      .image {
        width: 100%;
        height: 100%;
        object-fit: cover;
        border: 1px solid var(--hairline);
      }
      footer {
        display: grid;
        grid-template-columns: 1fr auto;
        align-items: center;
        gap: 28px;
        padding: 0 58px;
        border-top: 1px solid var(--hairline-strong);
        border-right: 1px solid var(--hairline-strong);
        background: color-mix(in oklab, var(--paper-deep) 72%, transparent);
      }
      .footer-title { font-size: 26px; font-weight: 700; color: var(--ink); }
      .footer-meta {
        display: flex;
        align-items: center;
        gap: 16px;
        color: var(--ink-mute);
        font-family: "JetBrains Mono", ui-monospace, monospace;
        font-size: 16px;
        font-weight: 600;
      }
      .dot { width: 7px; height: 7px; background: var(--rust); }
    </style>
  </head>
  <body>
    <section class="card">
      <aside class="rail">
        <div class="mark" aria-hidden="true">
          <svg viewBox="0 0 256 256" role="img">
            <rect x="71" y="62" width="114" height="134" fill="oklch(0.18 0.02 60)" />
            <path d="M128,32C74.98,32,32,74.98,32,128s42.98,96,96,96,96-42.98,96-96S181.02,32,128,32ZM102.77,169.7,82.72,193.36V85.69c0-6.65,5.4-12.05,12.05-12.05l50.77-.01c-2.41,3.07-4.85,6.12-7.23,9.09-2.89,3.61-5.87,7.34-8.78,11.07h-26.76V169.7Zm56.75,6.25c-3.18-3.67-6.83-7.84-10.54-12.07-7.23-8.25-14.71-16.79-19.13-22.11l-1.59-1.92-1.62,1.9c-4.97,5.85-10.02,11.73-14.87,17.35v-29.25c12.17-15.03,30.95-38.4,45.17-56.23h27.28c-14.14,16.23-28.67,32.98-42.75,50.29l-1.1,1.36,1.14,1.33c1.67,1.96,32.83,37.9,42.75,49.35H159.52Z" fill="oklch(0.97 0.008 85)" />
          </svg>
        </div>
        <div class="rail-word">RAWKODE ACADEMY</div>
        <div class="rail-index">OG/1200</div>
      </aside>
      <main>
        <div class="content">
          <div class="kicker">Cloud Native Field Notes</div>
          <h1>${title}</h1>
          ${subtitle ? `<div class="subtitle">${subtitle}</div>` : ""}
          ${text ? `<div class="text">${text}</div>` : ""}
        </div>
        ${
    image
      ? `<div class="media"><img class="image" src="${
        escapeHtml(image)
      }" /></div>`
      : ""
  }
      </main>
      <footer>
        <span class="footer-title">Rawkode Academy</span>
        <span class="footer-meta"><span>rawkode.academy</span><span class="dot"></span><span>Kubernetes / WebAssembly / Platform Engineering</span></span>
      </footer>
    </section>
  </body>
</html>`;
};
