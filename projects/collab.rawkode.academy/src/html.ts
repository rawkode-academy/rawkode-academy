export const esc = (value: string): string =>
	value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");

const STYLE = `
:root{color-scheme:light dark;--bg:#fff;--fg:#17181c;--mute:#5d6270;--line:#dcdfe6;--accent:#4b3fd8;--panel:#f5f6fa;--warn:#fff3cd;--warnfg:#5c4400}
@media(prefers-color-scheme:dark){:root{--bg:#121318;--fg:#eceef4;--mute:#a0a6b5;--line:#2b2e3a;--accent:#9d93ff;--panel:#1b1d26;--warn:#3b3000;--warnfg:#ffe9a6}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,sans-serif}
header,main{max-width:68rem;margin:0 auto;padding:1rem}
header{display:flex;gap:1rem;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line)}
a{color:var(--accent)}h1{font-size:1.5rem;margin:.5rem 0 1rem}h2{font-size:1.1rem}
.banner{background:var(--warn);color:var(--warnfg);padding:.6rem 1rem;display:flex;gap:1rem;justify-content:space-between;align-items:center}
.card{border:1px solid var(--line);border-radius:.5rem;padding:1rem;margin:0 0 1rem;background:var(--panel)}
button,.btn{font:inherit;border:1px solid var(--accent);background:var(--accent);color:#fff;border-radius:.4rem;padding:.35rem .8rem;cursor:pointer;text-decoration:none;display:inline-block}
button.ghost{background:transparent;color:var(--accent)}button:disabled{opacity:.5;cursor:not-allowed}
.muted{color:var(--mute)}.pill{border:1px solid var(--line);border-radius:99px;padding:0 .6rem;font-size:.85rem}
.layout{display:grid;gap:1rem;grid-template-columns:minmax(0,3fr) minmax(0,2fr)}@media(max-width:800px){.layout{grid-template-columns:1fr}}
video{width:100%;border-radius:.5rem;background:#000}
.comment{border-top:1px solid var(--line);padding:.6rem 0}.comment:first-child{border-top:0}
.ts{font-variant-numeric:tabular-nums;border:0;background:var(--line);color:var(--fg);padding:0 .5rem}
textarea,select,input{font:inherit;width:100%;padding:.4rem;border:1px solid var(--line);border-radius:.4rem;background:var(--bg);color:var(--fg)}
.row{display:flex;gap:.5rem;align-items:center;flex-wrap:wrap}
`;

export const page = (title: string, body: string, opts: { script?: string; nonce?: string } = {}): string =>
	`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} · Partner portal</title><meta name="robots" content="noindex"><style>${STYLE}</style></head><body>${body}${opts.script ? `<script nonce="${opts.nonce ?? ""}">${opts.script}</script>` : ""}</body></html>`;
