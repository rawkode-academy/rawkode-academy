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
        justify-content: center;
        align-items: center;
        padding: 0;
        background: var(--ink);
        color: var(--paper);
      }
      .mark { width: 72px; height: 72px; display: grid; place-items: center; }
      .mark svg { width: 58px; height: 58px; }
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
        grid-template-columns: auto minmax(0, 1fr);
        align-items: center;
        gap: 34px;
        padding: 0 58px;
        border-top: 1px solid var(--hairline-strong);
        border-right: 1px solid var(--hairline-strong);
        background: color-mix(in oklab, var(--paper-deep) 72%, transparent);
      }
      .footer-wordmark svg {
        display: block;
        width: 254px;
        height: auto;
      }
      .footer-wordmark svg path { fill: var(--ink); }
      .footer-meta {
        display: flex;
        align-items: center;
        justify-self: end;
        gap: 13px;
        color: var(--ink-mute);
        font-family: "JetBrains Mono", ui-monospace, monospace;
        font-size: 15px;
        font-weight: 600;
        line-height: 1;
        white-space: nowrap;
      }
      .dot { flex: 0 0 auto; width: 7px; height: 7px; background: var(--rust); }
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
      </aside>
      <main>
        <div class="content">
          <div class="kicker">Cloud Native Education</div>
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
        <span class="footer-wordmark" aria-label="Rawkode Academy">
          <svg width="512" height="128" viewBox="0 0 512 128" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M93.3877 51.4242H58.2967V61.3828H93.3877C93.6991 61.3828 93.9325 61.6109 93.9325 61.9151V68.4526H58.2967V85.0248C58.2967 90.8023 63.1208 95.5156 69.0343 95.5156H104.125V61.9151C104.125 56.1376 99.3011 51.4242 93.3877 51.4242H93.3877ZM93.9325 85.5571H69.0343C68.7228 85.5571 68.4893 85.329 68.4893 85.0248V78.4873H93.9325V85.5571ZM397.751 61.9151V95.5156H387.636V61.9151C387.636 61.6109 387.402 61.3828 387.013 61.3828H370.051C369.74 61.3828 369.584 61.6109 369.584 61.9151V95.5156H359.314V61.9151C359.314 61.6109 359.08 61.3828 358.847 61.3828H341.807C341.496 61.3828 341.262 61.6109 341.262 61.9151V95.5156H331.069V51.4242H387.013C392.926 51.4242 397.751 56.1376 397.751 61.9151ZM310.144 51.4242H285.79C279.877 51.4242 275.053 56.1376 275.053 61.9151V85.0248C275.053 90.8023 279.877 95.5156 285.79 95.5156H320.881V85.5571H285.79C285.479 85.5571 285.245 85.329 285.245 85.0248V78.4873H320.881V61.9151C320.881 56.1376 316.057 51.4242 310.144 51.4242ZM310.688 68.4526H285.245V61.9151C285.245 61.6109 285.479 61.3828 285.79 61.3828H310.144C310.455 61.3828 310.689 61.6109 310.689 61.9151V68.4526H310.688ZM454 51.5766V102.509C454 108.287 449.254 113 443.34 113H415.719V102.965H443.34C443.574 102.965 443.807 102.813 443.807 102.509V95.5156H418.909C412.996 95.5156 408.172 90.8023 408.172 85.0248V51.5766H418.365V85.0248C418.365 85.329 418.598 85.5571 418.909 85.5571H443.34C443.574 85.5571 443.807 85.329 443.807 85.0248V51.5766H454ZM202.233 51.4242H167.142V61.3828H202.233C202.544 61.3828 202.778 61.6109 202.778 61.9151V68.4526H167.142V85.0248C167.142 90.8023 171.966 95.5156 177.879 95.5156H212.97V61.9151C212.97 56.1376 208.146 51.4242 202.233 51.4242H202.233ZM202.778 85.5571H177.879C177.568 85.5571 177.334 85.329 177.334 85.0248V78.4873H202.778V85.5571ZM256.538 51.4242H231.562C225.648 51.4242 220.824 56.1376 220.824 61.9151V85.0248C220.824 90.8023 225.648 95.5156 231.562 95.5156H266.73V36.981H256.538V51.4242ZM256.538 85.0248C256.538 85.329 256.304 85.5571 255.993 85.5571H231.562C231.25 85.5571 231.095 85.329 231.095 85.0248V61.9151C231.095 61.6109 231.25 61.3828 231.562 61.3828H255.993C256.304 61.3828 256.538 61.6109 256.538 61.9151V85.0248ZM122.951 85.5571H158.042V95.5156H122.951C117.037 95.5156 112.213 90.8023 112.213 85.0248V61.9151C112.213 56.1376 117.037 51.4242 122.951 51.4242H157.886V61.3828H122.951C122.639 61.3828 122.406 61.6109 122.406 61.9151V85.0248C122.406 85.329 122.639 85.5571 122.951 85.5571ZM237.123 38.5963V34.186H221.583C221.445 34.186 221.341 34.085 221.341 33.9504V31.055H237.123V23.7158C237.123 21.1571 234.987 19.0698 232.368 19.0698H221.583C218.964 19.0698 216.827 21.1571 216.827 23.7158V33.9504C216.827 36.5091 218.964 38.5964 221.583 38.5964H237.123L237.123 38.5963ZM221.341 23.7158C221.341 23.5811 221.445 23.4802 221.583 23.4802H232.368C232.506 23.4802 232.609 23.5811 232.609 23.7158V26.6111H221.341V23.7158H221.341ZM173.229 38.5963H184.015C186.634 38.5963 188.77 36.5091 188.77 33.9504V23.7158C188.77 21.1571 186.634 19.0698 184.015 19.0698H173.229C170.61 19.0698 168.474 21.1571 168.474 23.7158V33.9504C168.474 36.5091 170.61 38.5964 173.229 38.5964V38.5963ZM172.988 23.7158C172.988 23.5811 173.091 23.4802 173.229 23.4802H184.015C184.152 23.4802 184.256 23.5811 184.256 23.7158V33.9504C184.256 34.085 184.152 34.186 184.015 34.186H173.229C173.091 34.186 172.988 34.085 172.988 33.9504V23.7158V23.7158ZM160.79 19.0698H165.649V20.2144L157.654 28.8329L165.649 37.4516V38.5963H160.79L154.421 31.5527L150.108 35.9426V38.5963H145.594V14H150.108V30.1924L153.657 26.6111L160.79 19.0698L160.79 19.0698ZM100.847 19.0698H85.306V23.4802H100.847C100.985 23.4802 101.088 23.5811 101.088 23.7158V26.6111H85.306V33.9504C85.306 36.509 87.4425 38.5963 90.0612 38.5963H105.602V23.7158C105.602 21.1571 103.466 19.0698 100.847 19.0698L100.847 19.0698ZM101.088 34.186H90.0612C89.9235 34.186 89.8201 34.085 89.8201 33.9504V31.055H101.088V34.1861V34.186ZM197.268 38.5963H212.843V14H208.329V19.0698H197.268C194.649 19.0698 192.513 21.1571 192.513 23.7158V33.9504C192.513 36.5091 194.649 38.5964 197.268 38.5964V38.5963ZM197.061 23.7158C197.061 23.5811 197.13 23.4802 197.268 23.4802H208.088C208.226 23.4802 208.329 23.5811 208.329 23.7158V33.9504C208.329 34.085 208.226 34.186 208.088 34.186H197.268C197.13 34.186 197.061 34.085 197.061 33.9504V23.7158V23.7158ZM115.812 38.5963L107.955 19.0698H112.745L117.569 30.5838C119.258 26.7794 121.05 22.8404 122.704 19.0698H127.39L132.834 30.651C134.351 26.8467 135.901 22.8404 137.348 19.0698H142.138L134.626 38.5963H131.112L125.081 25.5338L119.292 38.5963H115.812H115.812ZM65.0315 27.5691C67.9777 24.0148 72.5215 18.4882 75.9637 14.2726H82.5662C79.1442 18.111 75.6285 22.0714 72.2198 26.1632L71.9526 26.4838L72.2278 26.798C72.6331 27.2605 80.173 35.7607 82.5739 38.4671H76.5869C75.8178 37.6005 74.9329 36.6141 74.0358 35.614C72.2854 33.6622 70.4753 31.6443 69.4067 30.386L69.021 29.932L68.6301 30.3819C67.4278 31.7657 66.2063 33.1543 65.0316 34.4845V27.5691H65.0315ZM62.8528 36.9899L58 42.5842V17.1245C58.001 15.5512 59.3069 14.2763 60.9172 14.2762L73.2043 14.2739C72.6212 14.9987 72.0306 15.7199 71.4543 16.4236C70.755 17.2777 70.0334 18.1587 69.3301 19.0401H62.8528V36.9899H62.8528Z" fill="#23282D" />
          </svg>
        </span>
        <span class="footer-meta"><span>rawkode.academy</span><span class="dot"></span><span>Kubernetes / WebAssembly / Platform Engineering</span></span>
      </footer>
    </section>
  </body>
</html>`;
};
