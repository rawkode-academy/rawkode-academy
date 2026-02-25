import { Marked, Renderer } from "marked";

const allowedProtocols = new Set(["http:", "https:", "mailto:"]);

const escapeHtmlAttr = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const escapeHtmlInput = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;");

const normalizeLinkHref = (href: string | null | undefined) => {
  if (!href) return null;
  const trimmed = href.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("/") || trimmed.startsWith("#")) return trimmed;

  try {
    const parsed = new URL(trimmed);
    if (!allowedProtocols.has(parsed.protocol)) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
};

const renderer = new Renderer();
renderer.link = ({ href, title, text }) => {
  const safeHref = normalizeLinkHref(href);
  if (!safeHref) {
    return `<span>${text}</span>`;
  }

  const safeTitle = title ? ` title="${escapeHtmlAttr(title)}"` : "";
  const external = safeHref.startsWith("http://") || safeHref.startsWith("https://");
  const rel = external ? ' rel="nofollow noreferrer noopener"' : "";
  const target = external ? ' target="_blank"' : "";
  return `<a href="${escapeHtmlAttr(safeHref)}"${safeTitle}${rel}${target}>${text}</a>`;
};

renderer.image = ({ href, title, text }) => {
  const safeHref = normalizeLinkHref(href);
  if (!safeHref) {
    return `<span>${escapeHtmlAttr(text ?? "")}</span>`;
  }

  const alt = escapeHtmlAttr(text ?? "");
  const safeTitle = title ? ` title="${escapeHtmlAttr(title)}"` : "";
  return `<img src="${escapeHtmlAttr(safeHref)}" alt="${alt}" loading="lazy" decoding="async"${safeTitle} />`;
};

const markdown = new Marked({
  gfm: true,
  breaks: true,
  renderer,
  async: false,
});

export const renderMarkdownToHtml = (source: string) => {
  const safeSource = source.trim();
  if (!safeSource) {
    return "";
  }

  // Avoid rendering raw HTML from user content.
  return markdown.parse(escapeHtmlInput(safeSource)) as string;
};
