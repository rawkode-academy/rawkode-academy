import type { Payload } from "./payload";

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const templateAccent = (template: string): { from: string; to: string } => {
  switch (template) {
    case "dark":
    case "simple-dark":
      return { from: "#00ceff", to: "#5f5ed7" };
    case "80s":
      return { from: "#ff4ecd", to: "#00f5ff" };
    case "minimal":
      return { from: "#111827", to: "#6b7280" };
    default:
      return { from: "#5f5ed7", to: "#00ceff" };
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
      * { box-sizing: border-box; }
      html, body { width: 1200px; height: 630px; margin: 0; overflow: hidden; }
      body {
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: linear-gradient(135deg, #f8fafc 0%, #eef2ff 48%, #e0f2fe 100%);
        color: #111827;
      }
      .card {
        width: 1200px;
        height: 630px;
        display: grid;
        grid-template-rows: 112px 1fr 80px;
      }
      header, footer {
        display: flex;
        align-items: center;
        padding: 0 64px;
        background: rgba(255, 255, 255, 0.86);
        border-color: rgba(15, 23, 42, 0.08);
      }
      header { border-bottom: 1px solid rgba(15, 23, 42, 0.08); }
      footer { justify-content: space-between; border-top: 1px solid rgba(15, 23, 42, 0.08); color: #475569; font-size: 24px; font-weight: 650; }
      .logo { display: flex; align-items: center; gap: 18px; font-size: 34px; font-weight: 800; letter-spacing: 0; }
      .mark { width: 54px; height: 54px; border-radius: 14px; background: linear-gradient(135deg, ${accent.from}, ${accent.to}); }
      main {
        display: grid;
        grid-template-columns: ${image ? "1fr 420px" : "1fr"};
        gap: 48px;
        align-items: center;
        padding: 56px 64px;
      }
      .accent { width: 88px; height: 8px; border-radius: 99px; background: linear-gradient(90deg, ${accent.from}, ${accent.to}); margin-bottom: 28px; }
      h1 {
        margin: 0;
        color: #0f172a;
        font-size: 70px;
        line-height: 1.03;
        letter-spacing: 0;
        font-weight: 850;
        max-width: 980px;
      }
      .subtitle { margin-top: 22px; color: #334155; font-size: 32px; line-height: 1.18; font-weight: 700; }
      .text { margin-top: 22px; color: #475569; font-size: 28px; line-height: 1.32; max-width: 850px; }
      .image {
        width: 420px;
        height: 330px;
        border-radius: 8px;
        object-fit: cover;
        box-shadow: 0 24px 70px rgba(15, 23, 42, 0.22);
      }
      .template { color: #64748b; font-size: 20px; font-weight: 700; text-transform: uppercase; letter-spacing: 0; }
    </style>
  </head>
  <body>
    <section class="card">
      <header>
        <div class="logo"><div class="mark"></div><span>Rawkode Academy</span></div>
      </header>
      <main>
        <div>
          <div class="accent"></div>
          <h1>${title}</h1>
          ${subtitle ? `<div class="subtitle">${subtitle}</div>` : ""}
          ${text ? `<div class="text">${text}</div>` : ""}
        </div>
        ${image ? `<img class="image" src="${escapeHtml(image)}" />` : ""}
      </main>
      <footer>
        <span>rawkode.academy</span>
        <span class="template">${escapeHtml(payload.template)}</span>
      </footer>
    </section>
  </body>
</html>`;
};
